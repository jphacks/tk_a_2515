import glob
import json
import logging
import math
import os
import pickle
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import networkx as nx
import numpy as np
from sklearn.neighbors import BallTree
from tqdm import tqdm
import sys  # sys をインポート

# --- 定数定義 ---
# データフォルダと出力フォルダのパス
ORIGINAL_PATHS_DIR = os.path.join(os.path.dirname(__file__), "../datas/paths")
OUTPUT_PATHS_DIR = os.path.join(os.path.dirname(__file__), "../datas/paths_merged")

# 距離とフィルタリングの閾値
EPSILON_H_METERS = 40  # 水平距離の閾値
EPSILON_V_METERS = 20  # 垂直距離の閾値
EARTH_RADIUS_METERS = 6371000  # 地球の半径
FILTER_MAX_SHORT_PATH_LENGTH_METERS = 200  # 短い経路の最大長
FILTER_MAX_FLAT_ELEV_DIFF_METERS = 15  # 平坦な経路の最大標高差

# --- ログ設定 ---
# ログのフォーマットと出力設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler()],
)
log = logging.getLogger(__name__)

# --- ヘルパー関数 ---
def haversine(lat1, lon1, lat2, lon2):
    """
    2点間の大円距離を計算する
    """
    # 緯度経度をラジアンに変換
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # ハーサイン公式
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = EARTH_RADIUS_METERS * c
    return distance


def calculate_way_length(geometry):
    """
    経路の全長を計算する
    """
    total_length = 0
    for i in range(len(geometry) - 1):
        p1 = geometry[i]
        p2 = geometry[i + 1]
        total_length += haversine(p1["lat"], p1["lon"], p2["lat"], p2["lon"])
    return total_length


def get_elevation(lat, lon, cache_dir="/app/datas/elevation_cache"):
    """
    緯度・経度から標高を取得する（キャッシュ対応）

    Args:
        lat: 緯度
        lon: 経度
        dem_data: DEMデータ
        cache_dir: キャッシュを保存するディレクトリ

    Returns:
        float: 標高データ
    """
    cache_key = f"{lat:.6f}_{lon:.6f}.pkl"
    cache_path = Path(cache_dir)
    cache_file = cache_path / cache_key

    if cache_file.exists():
        try:
            with open(cache_file, "rb") as f:
                return pickle.load(f)
        except Exception as e:
            # キャッシュファイルの読み込みに失敗した場合は、エラーをログに記録し、APIを呼び出す
            log.warning(f"Failed to load cache for {lat}, {lon}: {e}. Refetching.")
            raise ValueError(f"Failed to load cache for {lat}, {lon}: {e}")

class UnionFind:
    """
    Union-Find（素集合データ構造）を実装する
    """

    def __init__(self, items):
        self.parent = {item: item for item in items}
        self.rank = {item: 0 for item in items}

    def find(self, i):
        """要素iを含む集合のルートを見つける"""
        if self.parent[i] == i:
            return i
        self.parent[i] = self.find(self.parent[i])  # パス圧縮
        return self.parent[i]

    def union(self, i, j):
        """要素iとjを含む集合をマージ"""
        root_i = self.find(i)
        root_j = self.find(j)
        if root_i != root_j:
            # ランクによる併合
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
        """全てのクラスターを {ルート: [メンバー]} 形式で返す"""
        clusters = defaultdict(list)
        for item in self.parent:
            root = self.find(item)
            clusters[root].append(item)
        return clusters


# --- メイン処理 ---
CACHE_DIR = os.path.join(os.path.dirname(__file__), "../datas/geometry_cache")

def save_to_cache(key, data):
    """
    データをキャッシュファイルに保存する
    """
    os.makedirs(CACHE_DIR, exist_ok=True)
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")
    with open(cache_file, "w") as f:
        json.dump(data, f)


def load_from_cache(key):
    """
    キャッシュファイルからデータを読み込む
    """
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")
    if os.path.exists(cache_file):
        with open(cache_file, "r") as f:
            return json.load(f)
    return None


def process_json_file(f_path):
    """
    JSONファイルを処理して経路と端点を抽出する
    """
    try:
        cache_key = Path(f_path).stem
        cached_data = load_from_cache(cache_key)
        if cached_data:
            return cached_data["ways"], cached_data["endpoints"]

        with open(f_path, "r") as f:
            data = json.load(f)

        local_ways = {}
        local_endpoints = []

        for element in data.get("elements", []):
            if element.get("type") == "way" and "geometry" in element:
                way_id = element["id"]
                if way_id in local_ways:
                    continue  # Skip duplicate ways

                geometry = element["geometry"]
                if not geometry or len(geometry) < 2:
                    log.warning(f"⚠️ Skipping way {way_id}: Invalid geometry")
                    continue

                # Get start and end nodes
                start_node = geometry[0]
                end_node = geometry[-1]

                # Get elevation
                start_alt = get_elevation(
                    start_node["lat"], start_node["lon"]
                )
                end_alt = get_elevation(end_node["lat"], end_node["lon"])

                local_ways[way_id] = element

                # Assign unique IDs to endpoints
                endpoint_id_start = f"{way_id}_start"
                endpoint_id_end = f"{way_id}_end"

                local_endpoints.append(
                    {
                        "id": endpoint_id_start,
                        "way_id": way_id,
                        "is_start": True,
                        "lat": start_node["lat"],
                        "lon": start_node["lon"],
                        "alt": start_alt,
                    }
                )
                local_endpoints.append(
                    {
                        "id": endpoint_id_end,
                        "way_id": way_id,
                        "is_start": False,
                        "lat": end_node["lat"],
                        "lon": end_node["lon"],
                        "alt": end_alt,
                    }
                )

        # Save to cache
        save_to_cache(cache_key, {"ways": local_ways, "endpoints": local_endpoints})
        return local_ways, local_endpoints
    except Exception as e:
        log.error(f"❌ Failed to process file {f_path}: {e}")
        return {}, []


def filter_ways_and_endpoints(all_ways, all_endpoints, num_threads=4):
    """
    経路と端点をマルチスレッドでフィルタリングする
    """
    filtered_ways = {}
    filtered_endpoints = []

    def filter_way(way_id, way_data):
        """
        単一の経路をフィルタリングする
        """
        geometry = way_data["geometry"]
        way_length = calculate_way_length(geometry)

        start_node = geometry[0]
        end_node = geometry[-1]
        start_alt = get_elevation(start_node["lat"], start_node["lon"])
        end_alt = get_elevation(end_node["lat"], end_node["lon"])
        way_elev_diff = abs(start_alt - end_alt)

        if (
            way_length >= FILTER_MAX_SHORT_PATH_LENGTH_METERS
            or way_elev_diff >= FILTER_MAX_FLAT_ELEV_DIFF_METERS
        ):
            return way_id, way_data, [
                ep for ep in all_endpoints if ep["way_id"] == way_id
            ]
        return None, None, []

    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = {
            executor.submit(filter_way, way_id, way_data): way_id
            for way_id, way_data in all_ways.items()
        }

        for future in tqdm(
            as_completed(futures),
            desc="Filtering ways and endpoints",
            total=len(futures),
            unit="way",
        ):
            way_id, way_data, endpoints = future.result()
            if way_id and way_data:
                filtered_ways[way_id] = way_data
                filtered_endpoints.extend(endpoints)

    return filtered_ways, filtered_endpoints


def phase_1_extract_endpoints(paths_dir, num_threads=4):
    """
    フェーズ1: JSONファイルから経路と端点を抽出する
    """
    log.info("🚀 Phase 1: Extracting endpoints...")
    all_ways = {}
    all_endpoints = []
    json_files = glob.glob(os.path.join(paths_dir, "*.json"))

    if not json_files:
        log.warning(f"🤔 No JSON files found in: {paths_dir}")
        return {}, []

    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        future_to_file = {executor.submit(process_json_file, f): f for f in json_files}
        for future in tqdm(
            as_completed(future_to_file),
            desc="Processing JSON files",
            total=len(json_files),
            unit="file",
        ):
            local_ways, local_endpoints = future.result()
            all_ways.update(local_ways)
            all_endpoints.extend(local_endpoints)

    log.info(f"✅ Phase 1 complete: {len(all_endpoints)} endpoints from {len(all_ways)} ways.")
    return all_ways, all_endpoints


def phase_2_cluster_junctions(all_endpoints, epsilon_h, epsilon_v):
    """
    フェーズ2: 端点をクラスタリングする
    """
    log.info("🚀 Phase 2: Clustering junctions...")
    if not all_endpoints:
        log.warning("⚠️ No endpoints to cluster.")
        return None, {}

    endpoint_ids = [ep["id"] for ep in all_endpoints]
    uf = UnionFind(endpoint_ids)

    # BallTree用にデータを準備（ラジアン単位）
    endpoint_coords_rad = np.array(
        [[math.radians(ep["lat"]), math.radians(ep["lon"])] for ep in all_endpoints]
    )

    # 空間インデックスを構築
    tree = BallTree(endpoint_coords_rad, metric="haversine")

    # 水平閾値をラジアンに変換
    radius_rad = epsilon_h / EARTH_RADIUS_METERS

    # 木をクエリして、水平半径内の全ペアを見つける
    pairs_list = tree.query_radius(endpoint_coords_rad, r=radius_rad)

    merge_count = 0
    for i, neighbors in tqdm(
        enumerate(pairs_list),
        desc="Clustering endpoints",
        total=len(pairs_list),
        unit="endpoint",
    ):
        ep_i = all_endpoints[i]

        for j in neighbors:
            # 自己ループと重複チェックを回避
            if i >= j:
                continue

            ep_j = all_endpoints[j]

            # 同じ経路の端点はマージしない
            if ep_i["way_id"] == ep_j["way_id"]:
                continue

            # 垂直距離をチェック
            if abs(ep_i["alt"] - ep_j["alt"]) < epsilon_v:
                # 水平・垂直両方のチェックを通過した場合、ユニオンする
                if uf.union(ep_i["id"], ep_j["id"]):
                    merge_count += 1

    clusters = uf.get_clusters()
    log.info(f"✅ Phase 2 complete: {len(endpoint_ids)} endpoints clustered into {len(clusters)} junctions.")

    # endpoint_id -> cluster_root_id の単純なマッピングを作成
    endpoint_to_cluster_map = {ep_id: uf.find(ep_id) for ep_id in endpoint_ids}

    return uf, endpoint_to_cluster_map


def phase_3_build_graph(all_ways, endpoint_to_cluster_map):
    """
    フェーズ3: 経路とクラスタからグラフを構築する
    """
    log.info("🚀 Phase 3: Building trail graph...")
    # MultiGraphを使用して、同じ2つのジャンクション間に
    # 複数のエッジ（例：夏季ルートと冬季ルート）を許可
    G = nx.MultiGraph()

    if not endpoint_to_cluster_map:
        log.warning("⚠️ No clusters found. Cannot build graph.")
        return G

    for way_id, way_data in tqdm(all_ways.items(), desc="Building graph", unit="way"):
        start_ep_id = f"{way_id}_start"
        end_ep_id = f"{way_id}_end"

        # 経路の始点/終点がどのクラスタ（ジャンクション）に属するかを特定
        cluster_start_id = endpoint_to_cluster_map.get(start_ep_id)
        cluster_end_id = endpoint_to_cluster_map.get(end_ep_id)

        if cluster_start_id is None or cluster_end_id is None:
            log.warning(f"Skipping way {way_id}: Endpoint not found in cluster map.")
            continue

        # 2つのジャンクション間にエッジを追加
        # エッジ自体が経路であるため、そのデータを格納
        G.add_edge(
            cluster_start_id,
            cluster_end_id,
            way_id=way_id,
            geometry=way_data["geometry"],
        )

    log.info(f"✅ Phase 3 complete: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges.")
    return G


def phase_4_simplify_graph(G, endpoint_to_cluster_map):
    """
    フェーズ4: グラフを簡略化する
    """
    log.info("🚀 Phase 4: Simplifying graph...")

    # マージできるノードがなくなるまでループ
    while True:
        nodes_to_merge = [n for n, deg in G.degree() if deg == 2]

        if not nodes_to_merge:
            log.info("✅ No more 2-degree nodes. Simplification complete.")
            break

        log.info(f"🔄 Found {len(nodes_to_merge)} 2-degree nodes to process.")
        merged_in_pass = 0

        for node in tqdm(nodes_to_merge, desc="Simplifying graph", unit="node"):
            # ノードがまだ存在するか確認（マージされている可能性がある）
            if node not in G or G.degree(node) != 2:
                continue

            # 2つの隣接ノードを取得
            neighbors = list(G.neighbors(node))
            if len(neighbors) != 2:
                continue

            n1, n2 = neighbors

            # 単純なループ（n1 == n2）はマージしない
            if n1 == n2:
                continue

            # 2つのエッジを取得（NetworkXは辞書を返すため、最初のエッジを取得）
            # 2次元ノードセグメント上に平行エッジがないと仮定
            edge1_key = next(iter(G.get_edge_data(n1, node)))
            edge1_data = G.get_edge_data(n1, node)[edge1_key]
            
            edge2_key = next(iter(G.get_edge_data(node, n2)))
            edge2_data = G.get_edge_data(node, n2)[edge2_key]

            geom1 = edge1_data["geometry"]
            way1_id = edge1_data["way_id"]
            geom2 = edge2_data["geometry"]
            way2_id = edge2_data["way_id"]

            # --- ジオメトリの向きを特定 ---
            # geom1とgeom2をつなぎ合わせる必要がある。
            # オリジナルのendpoint_to_cluster_mapを使用して、
            # グラフノードに対するジオメトリの「向きを知る」。

            way1_start_cluster = endpoint_to_cluster_map[f"{way1_id}_start"]

            # n1 -> node の順である ordered_geom1 を見つける
            if way1_start_cluster == n1:
                ordered_geom1 = geom1
            else:  # way1_end_cluster は n1 である必要がある
                ordered_geom1 = geom1[::-1]  # 反転

            way2_start_cluster = endpoint_to_cluster_map[f"{way2_id}_start"]

            # node -> n2 の順である ordered_geom2 を見つける
            if way2_start_cluster == node:
                ordered_geom2 = geom2
            else:  # way2_end_cluster は node である必要がある
                ordered_geom2 = geom2[::-1]  # 反転

            # 中間点の重複を避けて、ジオメトリをつなぎ合わせる
            new_geometry = ordered_geom1 + ordered_geom2[1:]

            # マージされたことを示す新しい way_id を作成
            # （実際のシステムでは、IDのリストが望ましいかもしれない）
            new_way_id = f"merged_{way1_id}_{way2_id}"

            # 中間ノードと2つの古いエッジを削除
            G.remove_node(node)
            # 新しいマージエッジを追加
            G.add_edge(n1, n2, way_id=new_way_id, geometry=new_geometry)

            # --- endpoint_to_cluster_map の更新 ---
            # 新しい経路の始点と終点をそれぞれのクラスタにマッピング
            # これは反復簡略化に重要
            endpoint_to_cluster_map[f"{new_way_id}_start"] = n1
            endpoint_to_cluster_map[f"{new_way_id}_end"] = n2
            
            # 古い way_id をマッピングから削除
            del endpoint_to_cluster_map[f"{way1_id}_start"]
            del endpoint_to_cluster_map[f"{way1_id}_end"]
            del endpoint_to_cluster_map[f"{way2_id}_start"]
            del endpoint_to_cluster_map[f"{way2_id}_end"]


            merged_in_pass += 1

        if merged_in_pass == 0:
            log.info(
                "    ... No merges were possible in this pass (e.g., all 2-degree nodes were loops)."
            )
            break

    log.info(f"✅ Phase 4 complete: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges.")
    return G


def save_graph_to_json(G, output_dir, chunk_size):
    """
    グラフをJSON形式で保存する
    """
    log.info(f"💾 Saving graph to {output_dir}...")
    elements = []

    # ユニークIDカウンタを初期化
    unique_id_counter = 1

    for u, v, data in tqdm(G.edges(data=True), desc="Processing edges", unit="edge"):
        # ジオメトリを抽出し、バウンディングボックスを計算
        geometry = data["geometry"]
        minlat = min(point["lat"] for point in geometry)
        maxlat = max(point["lat"] for point in geometry)
        minlon = min(point["lon"] for point in geometry)
        maxlon = max(point["lon"] for point in geometry)

        # 各ジオメトリポイントに標高を追加
        for point in geometry:
            # alt が既に存在するか確認（元のデータからの可能性がある）
            # 存在しない場合は取得
            if "alt" not in point:
                point["alt"] = get_elevation(point["lat"], point["lon"])

        # 経路にユニークな整数IDを割り当て
        unique_id = unique_id_counter
        unique_id_counter += 1

        # 要素構造を作成
        element = {
            "id": unique_id,  # ユニークな整数IDを使用
            "bounds": {
                "minlat": minlat,
                "minlon": minlon,
                "maxlat": maxlat,
                "maxlon": maxlon,
            },
            "geometry": geometry,
        }
        elements.append(element)

    # 要素をチャンクに分割し、各チャンクを別々のファイルに保存
    os.makedirs(output_dir, exist_ok=True)
    for i in tqdm(
        range(0, len(elements), chunk_size), desc="Saving chunks", unit="chunk"
    ):
        chunk = elements[i : i + chunk_size]
        output_file = os.path.join(
            output_dir, f"merged_trail_network_{i // chunk_size + 1}.json"
        )
        with open(output_file, "w") as f:
            json.dump({"elements": chunk}, f, indent=2)


# --- メイン実行 ---

if __name__ == "__main__":
    # --- 4フェーズ処理を実行 ---
    import argparse

    parser = argparse.ArgumentParser(description="経路ネットワークをマージする")
    parser.add_argument(
        "--threads",
        type=int,
        default=4,
        help="フェーズ1で使用するスレッド数",
    )
    args = parser.parse_args()

    # フェーズ1: 経路と端点を抽出
    all_ways, all_endpoints = phase_1_extract_endpoints(
        ORIGINAL_PATHS_DIR, num_threads=args.threads
    )

    if all_ways:
        # フィルタリングを実行
        all_ways, all_endpoints = filter_ways_and_endpoints(all_ways, all_endpoints, num_threads=args.threads)

        # フェーズ2: 端点をクラスタリング
        uf, endpoint_to_cluster_map = phase_2_cluster_junctions(
            all_endpoints, EPSILON_H_METERS, EPSILON_V_METERS
        )

        # フェーズ3: グラフを構築
        G = phase_3_build_graph(all_ways, endpoint_to_cluster_map)

        # フェーズ4: グラフを簡略化
        G_copy = G.copy()
        endpoint_map_copy = endpoint_to_cluster_map.copy()
        G_simplified = phase_4_simplify_graph(G_copy, endpoint_map_copy)

        # 結果を表示
        log.info("\n--- 🌲 Final Merged Trail Network 🌲 ---")
        log.info(f"Total Junctions (Nodes): {G_simplified.number_of_nodes()}")
        log.info(f"Total Segments (Edges): {G_simplified.number_of_edges()}")

        # 結果を保存
        if not os.path.exists(OUTPUT_PATHS_DIR):
            os.makedirs(OUTPUT_PATHS_DIR)
        save_graph_to_json(G_simplified, OUTPUT_PATHS_DIR, chunk_size=1024)
    else:
        log.error("❌ No way data loaded. Exiting.")
