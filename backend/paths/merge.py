import functools
import glob
import json
import logging
import math
import os
import pickle
from collections import defaultdict
from pathlib import Path

import networkx as nx
import numpy as np
from sklearn.neighbors import BallTree
from tqdm import tqdm

# --- 定数定義 ---
CACHE_DIR = os.path.join(os.path.dirname(__file__), "../datas/geometry_cache")
ORIGINAL_PATHS_DIR = os.path.join(os.path.dirname(__file__), "../datas/paths")
OUTPUT_PATHS_DIR = os.path.join(os.path.dirname(__file__), "../datas/paths_merged")

EPSILON_H_METERS = 80
EPSILON_V_METERS = 50
EARTH_RADIUS_METERS = 6371000
FILTER_MAX_SHORT_PATH_LENGTH_METERS = 500
FILTER_MAX_FLAT_ELEV_DIFF_METERS = 20

# --- ログ設定 ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
log = logging.getLogger(__name__)


def haversine(lat1, lon1, lat2, lon2):
    """2点間の大円距離を計算"""
    # 緯度経度をラジアンに変換
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    # ハーバーサイン公式を使用して大円距離を計算
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_METERS * c


def calculate_way_length(geometry):
    """経路の全長を計算"""
    total_length = 0
    # 各セグメント間の距離を累積
    for i in range(len(geometry) - 1):
        p1, p2 = geometry[i], geometry[i + 1]
        total_length += haversine(p1["lat"], p1["lon"], p2["lat"], p2["lon"])
    return total_length


@functools.lru_cache(maxsize=None)
def get_elevation(lat, lon, cache_dir="/app/datas/elevation_cache"):
    """標高を取得（ファイル + メモリキャッシュ）"""
    cache_key = f"{lat:.6f}_{lon:.6f}.pkl"
    cache_path = Path(cache_dir)
    cache_file = cache_path / cache_key

    try:
        with open(cache_file, "rb") as f:
            return pickle.load(f)
    except Exception as e:
        log.warning(f"Failed to load cache for {lat}, {lon}: {e}.")
        raise ValueError(f"Failed to load cache for {lat}, {lon}: {e}")


class UnionFind:
    """Union-Find（素集合データ構造）"""

    def __init__(self, items):
        # 各要素の親と深さを初期化
        self.parent = {item: item for item in items}
        self.rank = {item: 0 for item in items}

    def find(self, i):
        """ルートを検索（パス圧縮）"""
        if self.parent[i] == i:
            return i
        # 経路圧縮: 親を直接ルートに設定
        self.parent[i] = self.find(self.parent[i])
        return self.parent[i]

    def union(self, i, j):
        """集合をマージ（ランクによる併合）"""
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            # ランクに基づいて木をマージ
            if self.rank[root_i] < self.rank[root_j]:
                self.parent[root_i] = root_j
            elif self.rank[root_i] > self.rank[root_j]:
                self.parent[root_j] = root_i
            else:
                self.parent[root_j] = root_i
                self.rank[root_i] += 1
            return True
        return False

    def get_clusters(self):
        """全クラスターを返す"""
        clusters = defaultdict(list)
        # 各要素をルートごとにグループ化
        for item in self.parent:
            root = self.find(item)
            clusters[root].append(item)
        return clusters


def save_to_cache(key, data):
    """ジオメトリキャッシュに保存"""
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")
    try:
        with open(cache_file, "w") as f:
            json.dump(data, f)
    except Exception as e:
        log.error(f"❌ Failed to save cache {key}: {e}")


def load_from_cache(key):
    """ジオメトリキャッシュから読み込み"""
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")
    if os.path.exists(cache_file):
        try:
            with open(cache_file, "r") as f:
                return json.load(f)
        except Exception as e:
            log.warning(f"⚠️ Failed to load cache {key}, refetching...: {e}")
    return None


def filter_ways_and_endpoints(all_ways, all_endpoints):
    """経路と端点をフィルタリング"""
    filtered_ways = {}
    filtered_endpoints = []

    for way_id, way_data in tqdm(
        all_ways.items(),
        desc="Filtering ways and endpoints",
        total=len(all_ways),
        unit="way",
    ):
        geometry = way_data["geometry"]
        start_node = geometry[0]
        end_node = geometry[-1]
        # 経路の直線距離を計算
        way_length = calculate_way_length(geometry)
        # 標高差を計算
        start_alt = get_elevation(start_node["lat"], start_node["lon"])
        end_alt = get_elevation(end_node["lat"], end_node["lon"])
        way_elev_diff = abs(start_alt - end_alt)

        # 一定以上の長さまたは標高差がある経路のみ保持
        if (
            way_length >= FILTER_MAX_SHORT_PATH_LENGTH_METERS
            or way_elev_diff >= FILTER_MAX_FLAT_ELEV_DIFF_METERS
        ):
            filtered_ways[way_id] = way_data
            filtered_endpoints.extend(
                [ep for ep in all_endpoints if ep["way_id"] == way_id]
            )

    log.info(
        f"✅ Filtering complete: {len(filtered_ways)} ways, {len(filtered_endpoints)} endpoints retained."
    )
    return filtered_ways, filtered_endpoints


def process_json_file(f_path):
    """JSONファイルから経路と端点を抽出"""
    try:
        # キャッシュの確認
        cache_key = Path(f_path).stem
        cached_data = load_from_cache(cache_key)
        if cached_data:
            return cached_data["ways"], cached_data["endpoints"]

        # JSONファイルを読み込み
        with open(f_path, "r") as f:
            data = json.load(f)

        local_ways = {}
        local_endpoints = []

        # 各要素を処理
        for element in data.get("elements", []):
            if element.get("type") == "way" and "geometry" in element:
                way_id = element["id"]
                # 重複チェック
                if way_id in local_ways:
                    continue

                geometry = element["geometry"]
                # ジオメトリの妥当性確認
                if not geometry or len(geometry) < 2:
                    log.warning(f"⚠️ Skipping way {way_id}: Invalid geometry")
                    continue

                local_ways[way_id] = element

                # 経路の始点と終点を取得し、標高を付与
                start_node = geometry[0]
                end_node = geometry[-1]
                start_alt = get_elevation(start_node["lat"], start_node["lon"])
                end_alt = get_elevation(end_node["lat"], end_node["lon"])

                # 端点情報を保存
                local_endpoints.append(
                    {
                        "id": f"{way_id}_start",
                        "way_id": way_id,
                        "is_start": True,
                        "lat": start_node["lat"],
                        "lon": start_node["lon"],
                        "alt": start_alt,
                    }
                )
                local_endpoints.append(
                    {
                        "id": f"{way_id}_end",
                        "way_id": way_id,
                        "is_start": False,
                        "lat": end_node["lat"],
                        "lon": end_node["lon"],
                        "alt": end_alt,
                    }
                )

        # 処理結果をキャッシュに保存
        save_to_cache(cache_key, {"ways": local_ways, "endpoints": local_endpoints})
        return local_ways, local_endpoints
    except Exception as e:
        log.error(f"❌ Failed to process file {f_path}: {e}")
        return {}, []


def phase_1_extract_endpoints(paths_dir):
    """Phase 1: 経路と端点を抽出"""
    log.info("🚀 Phase 1: Extracting endpoints...")
    all_ways = {}
    all_endpoints = []
    # 対象ディレクトリ内のJSONファイルを取得
    json_files = glob.glob(os.path.join(paths_dir, "*.json"))

    if not json_files:
        log.warning(f"🤔 No JSON files found in: {paths_dir}")
        return {}, []

    # 逐次処理でJSONファイルを読み込み
    for f in tqdm(json_files, desc="Processing JSON files", unit="file"):
        try:
            local_ways, local_endpoints = process_json_file(f)
            all_ways.update(local_ways)
            all_endpoints.extend(local_endpoints)
        except Exception as e:
            log.error(f"❌ Failed to process file {f}: {e}")

    log.info(
        f"✅ Phase 1 complete: {len(all_endpoints)} endpoints from {len(all_ways)} ways."
    )
    return all_ways, all_endpoints


def phase_2_cluster_junctions(all_endpoints, epsilon_h, epsilon_v):
    """Phase 2: 端点をクラスタリング"""
    log.info("🚀 Phase 2: Clustering junctions...")
    if not all_endpoints:
        log.warning("⚠️ No endpoints to cluster.")
        return None, {}

    endpoint_ids = [ep["id"] for ep in all_endpoints]
    uf = UnionFind(endpoint_ids)

    # BallTreeで近傍検索を行うための座標配列を作成
    log.info("Building BallTree coordinates...")
    endpoint_coords_rad = np.array(
        [[math.radians(ep["lat"]), math.radians(ep["lon"])] for ep in all_endpoints]
    )

    # BallTreeインデックスを構築
    log.info("Building BallTree index...")
    tree = BallTree(endpoint_coords_rad, metric="haversine")
    radius_rad = epsilon_h / EARTH_RADIUS_METERS

    # 各端点の近傍を検索
    log.info("Querying BallTree for neighbors...")
    pairs_list = tree.query_radius(endpoint_coords_rad, r=radius_rad)
    log.info("Querying complete. Clustering...")

    # 水平距離と垂直距離の条件を満たす端点ペアを抽出
    all_merge_pairs = []
    for i, neighbors in enumerate(
        tqdm(pairs_list, desc="Clustering endpoints", unit="endpoint")
    ):
        ep_i = all_endpoints[i]

        for j in neighbors:
            # 自分自身や既に処理済みのペアをスキップ
            if i >= j:
                continue

            ep_j = all_endpoints[j]

            # 同じ経路の端点同士は接続しない
            if ep_i["way_id"] == ep_j["way_id"]:
                continue

            # 標高差が閾値以内の場合にマージ対象とする
            if abs(ep_i["alt"] - ep_j["alt"]) < epsilon_v:
                all_merge_pairs.append((i, j))

    # Union-Findを使用して端点をマージ
    log.info(f"Merging {len(all_merge_pairs)} endpoint pairs...")
    merge_count = 0
    for i, j in tqdm(all_merge_pairs, desc="Applying unions", unit="pair"):
        if uf.union(endpoint_ids[i], endpoint_ids[j]):
            merge_count += 1

    clusters = uf.get_clusters()
    log.info(
        f"✅ Phase 2 complete: {len(endpoint_ids)} endpoints clustered into {len(clusters)} junctions ({merge_count} merges)."
    )

    # 各端点がどのクラスタに属するかのマップを作成
    endpoint_to_cluster_map = {ep_id: uf.find(ep_id) for ep_id in endpoint_ids}
    return uf, endpoint_to_cluster_map


def phase_3_build_graph(all_ways, endpoint_to_cluster_map):
    """Phase 3: グラフを構築"""
    log.info("🚀 Phase 3: Building trail graph...")
    G = nx.MultiGraph()

    if not endpoint_to_cluster_map:
        log.warning("⚠️ No clusters found. Cannot build graph.")
        return G

    # 各経路をグラフのエッジとして追加
    for way_id, way_data in tqdm(all_ways.items(), desc="Building graph", unit="way"):
        start_ep_id = f"{way_id}_start"
        end_ep_id = f"{way_id}_end"

        # 端点が属するクラスタIDを取得
        cluster_start_id = endpoint_to_cluster_map.get(start_ep_id)
        cluster_end_id = endpoint_to_cluster_map.get(end_ep_id)

        # クラスタが見つからない場合はスキップ
        if cluster_start_id is None or cluster_end_id is None:
            continue

        # クラスタ間にエッジを追加
        G.add_edge(
            cluster_start_id,
            cluster_end_id,
            way_id=way_id,
            geometry=way_data["geometry"],
        )

    log.info(
        f"✅ Phase 3 complete: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges."
    )
    return G


def phase_4_simplify_graph(G, endpoint_to_cluster_map):
    """Phase 4: グラフを簡略化"""
    log.info("🚀 Phase 4: Simplifying graph...")

    while True:
        # 次数が2のノード（中間点）を抽出
        nodes_to_merge = [n for n, deg in G.degree() if deg == 2]

        if not nodes_to_merge:
            log.info("✅ No more 2-degree nodes. Simplification complete.")
            break

        log.info(f"🔄 Found {len(nodes_to_merge)} 2-degree nodes to process.")
        merged_in_pass = 0

        for node in tqdm(nodes_to_merge, desc="Simplifying graph", unit="node"):
            # ノードが削除されていないか、次数が2であるか確認
            if node not in G or G.degree(node) != 2:
                continue

            neighbors = list(G.neighbors(node))
            if len(neighbors) != 2:
                continue

            n1, n2 = neighbors
            # 自己ループは処理しない
            if n1 == n2:
                continue

            # 隣接エッジのデータを取得
            try:
                edge1_key = next(iter(G.get_edge_data(n1, node)))
                edge1_data = G.get_edge_data(n1, node)[edge1_key]
                edge2_key = next(iter(G.get_edge_data(node, n2)))
                edge2_data = G.get_edge_data(node, n2)[edge2_key]
            except StopIteration:
                log.warning(f"⚠️ Failed to get edge data for node {node}. Skipping.")
                continue

            geom1 = edge1_data["geometry"]
            way1_id = edge1_data["way_id"]
            geom2 = edge2_data["geometry"]
            way2_id = edge2_data["way_id"]

            # ジオメトリの向きを調整
            way1_start_cluster = endpoint_to_cluster_map.get(f"{way1_id}_start")
            if way1_start_cluster is None:
                log.warning(f"Way {way1_id} not in map, skipping merge.")
                continue

            # エッジ1の向きを調整
            ordered_geom1 = geom1 if way1_start_cluster == n1 else geom1[::-1]

            way2_start_cluster = endpoint_to_cluster_map.get(f"{way2_id}_start")
            if way2_start_cluster is None:
                log.warning(f"Way {way2_id} not in map, skipping merge.")
                continue

            # エッジ2の向きを調整
            ordered_geom2 = geom2 if way2_start_cluster == node else geom2[::-1]

            # 2つのジオメトリを結合（重複する中間ノードを除く）
            new_geometry = ordered_geom1 + ordered_geom2[1:]
            new_way_id = f"merged_{way1_id}_{way2_id}"

            # 中間ノードを削除し、新しいエッジを追加
            G.remove_node(node)
            G.add_edge(n1, n2, way_id=new_way_id, geometry=new_geometry)

            # マッピング情報を更新
            endpoint_to_cluster_map[f"{new_way_id}_start"] = n1
            endpoint_to_cluster_map[f"{new_way_id}_end"] = n2
            endpoint_to_cluster_map.pop(f"{way1_id}_start", None)
            endpoint_to_cluster_map.pop(f"{way1_id}_end", None)
            endpoint_to_cluster_map.pop(f"{way2_id}_start", None)
            endpoint_to_cluster_map.pop(f"{way2_id}_end", None)

            merged_in_pass += 1

        # 1回のパスでマージが行われなかった場合は終了
        if merged_in_pass == 0:
            log.info("    ... No merges were possible in this pass.")
            break

    log.info(
        f"✅ Phase 4 complete: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges."
    )
    return G


def save_graph_to_json(G, output_dir, chunk_size):
    """グラフをJSON形式で保存"""
    log.info(f"💾 Saving graph to {output_dir}...")
    elements = []
    unique_id_counter = 1

    # 各エッジを処理してJSON要素を作成
    for u, v, data in tqdm(G.edges(data=True), desc="Processing edges", unit="edge"):
        geometry = data["geometry"]

        if not geometry:
            log.warning(f"⚠️ Skipping edge (u={u}, v={v}): Empty geometry.")
            continue

        # バウンディングボックスを計算
        minlat = min(point["lat"] for point in geometry)
        maxlat = max(point["lat"] for point in geometry)
        minlon = min(point["lon"] for point in geometry)
        maxlon = max(point["lon"] for point in geometry)

        # 標高情報がない場合は取得
        if "alt" not in geometry[0]:
            try:
                lats = [point["lat"] for point in geometry]
                lons = [point["lon"] for point in geometry]
                # 逐次で標高を取得
                altitudes = [get_elevation(lat, lon) for lat, lon in zip(lats, lons)]

                for i, point in enumerate(geometry):
                    point["alt"] = altitudes[i]
            except Exception as e:
                log.error(f"❌ Failed to fetch altitudes for edge (u={u}, v={v}): {e}")
                # エラー時はデフォルト値を設定
                for point in geometry:
                    point["alt"] = 0.0

        # 標高が欠落している点にデフォルト値を設定
        for point in geometry:
            if "alt" not in point:
                point["alt"] = 0.0

        # JSON要素を作成
        element = {
            "id": unique_id_counter,
            "bounds": {
                "minlat": minlat,
                "minlon": minlon,
                "maxlat": maxlat,
                "maxlon": maxlon,
            },
            "geometry": geometry,
        }
        elements.append(element)
        unique_id_counter += 1

    # 出力ディレクトリを作成
    os.makedirs(output_dir, exist_ok=True)
    # チャンクに分割して保存
    for i in tqdm(
        range(0, len(elements), chunk_size), desc="Saving chunks", unit="chunk"
    ):
        chunk = elements[i : i + chunk_size]
        output_file = os.path.join(
            output_dir, f"merged_trail_network_{i // chunk_size + 1}.json"
        )
        with open(output_file, "w") as f:
            json.dump({"elements": chunk}, f, indent=2)


if __name__ == "__main__":
    # Phase 1: 経路と端点を抽出
    all_ways, all_endpoints = phase_1_extract_endpoints(ORIGINAL_PATHS_DIR)

    if all_ways:
        # all_ways, all_endpoints = filter_ways_and_endpoints(all_ways, all_endpoints)

        # Phase 2: 端点をクラスタリング
        uf, endpoint_to_cluster_map = phase_2_cluster_junctions(
            all_endpoints, EPSILON_H_METERS, EPSILON_V_METERS
        )

        # Phase 3: グラフを構築
        G = phase_3_build_graph(all_ways, endpoint_to_cluster_map)

        # Phase 4: グラフを簡略化（元のデータを保持するためコピーを使用）
        G_copy = G.copy()
        endpoint_map_copy = endpoint_to_cluster_map.copy()
        G_simplified = phase_4_simplify_graph(G_copy, endpoint_map_copy)

        # 結果を保存
        if not os.path.exists(OUTPUT_PATHS_DIR):
            os.makedirs(OUTPUT_PATHS_DIR)
        save_graph_to_json(G_simplified, OUTPUT_PATHS_DIR, chunk_size=1024)
    else:
        log.error("❌ No way data loaded. Exiting.")
