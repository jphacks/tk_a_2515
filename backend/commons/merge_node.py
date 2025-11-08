import os
import sys
from pathlib import Path

import numpy as np
from tqdm import tqdm
from utils import calculate_distance

# Djangoのセットアップ
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "collectmap.settings")

import django

django.setup()

from django.contrib.gis.geos import Polygon
from django.db.models.query import QuerySet

from paths.models import Path, PathGeometryOrder


def merge_nodes_from_query_set(
    queryset: QuerySet[Path],
):
    threshold_distance_km = 0.02  # ノードをマージする距離の閾値（km単位）
    for i, path_a in enumerate(tqdm(queryset)):
        for path_b in queryset[i + 1 :]:
            # Through modelを使って端点を取得
            order_a0 = path_a.geometry_orders.select_related("geometry").order_by("sequence").first()
            order_a1 = path_a.geometry_orders.select_related("geometry").order_by("-sequence").first()
            order_b0 = path_b.geometry_orders.select_related("geometry").order_by("sequence").first()
            order_b1 = path_b.geometry_orders.select_related("geometry").order_by("-sequence").first()

            if not order_a0 or not order_a1 or not order_b0 or not order_b1:
                continue  # geometriesがない場合はスキップ

            node_a0, node_a1 = order_a0.geometry, order_a1.geometry
            node_b0, node_b1 = order_b0.geometry, order_b1.geometry

            dist_a0_b0 = calculate_distance(node_a0.lat, node_a0.lon, node_b0.lat, node_b0.lon)
            dist_a0_b1 = calculate_distance(node_a0.lat, node_a0.lon, node_b1.lat, node_b1.lon)
            dist_a1_b0 = calculate_distance(node_a1.lat, node_a1.lon, node_b0.lat, node_b0.lon)
            dist_a1_b1 = calculate_distance(node_a1.lat, node_a1.lon, node_b1.lat, node_b1.lon)

            def merge_nodes(node_a, path_a, node_b, path_b, order_b):
                # ID情報を先に保存（deleteの前に）
                node_a_id = node_a.id
                node_b_id = node_b.id
                path_a_id = path_a.id
                path_b_id = path_b.id
                node_b_sequence = order_b.sequence

                # path_bのnode_bの位置を取得
                # node_bのPathGeometryOrderを削除
                order_b.delete()

                # node_aを同じsequenceでpath_bに追加
                PathGeometryOrder.objects.create(path=path_b, geometry=node_a, sequence=node_b_sequence)

                # node_bが他のPathに使われていなければ削除
                if not node_b.path_orders.exists():
                    node_b.delete()
                    print(
                        f"Merged nodes: Path {path_a_id} node {node_a_id} with Path {path_b_id} node {node_b_id} at sequence {node_b_sequence} (deleted)"
                    )
                else:
                    print(
                        f"Merged nodes: Path {path_a_id} node {node_a_id} with Path {path_b_id} node {node_b_id} at sequence {node_b_sequence} (kept for other paths)"
                    )

                # ジオメトリフィールドを更新
                path_a.update_geo_fields()
                path_b.update_geo_fields()
                path_a.save()
                path_b.save()

            if dist_a0_b0 < threshold_distance_km:
                print(f"Merging nodes: Path {path_a.id} node {node_a0.id} with Path {path_b.id} node {node_b0.id}")
                merge_nodes(node_a0, path_a, node_b0, path_b, order_b0)
            elif dist_a0_b1 < threshold_distance_km:
                print(f"Merging nodes: Path {path_a.id} node {node_a0.id} with Path {path_b.id} node {node_b1.id}")
                merge_nodes(node_a0, path_a, node_b1, path_b, order_b1)
            elif dist_a1_b0 < threshold_distance_km:
                print(f"Merging nodes: Path {path_a.id} node {node_a1.id} with Path {path_b.id} node {node_b0.id}")
                merge_nodes(node_a1, path_a, node_b0, path_b, order_b0)
            elif dist_a1_b1 < threshold_distance_km:
                print(f"Merging nodes: Path {path_a.id} node {node_a1.id} with Path {path_b.id} node {node_b1.id}")
                merge_nodes(node_a1, path_a, node_b1, path_b, order_b1)


def merge_all_nodes():
    # lat = [30.0, 45.0]  # 対象エリアの緯度範囲
    # lon = [130.0, 146.0]  # 対象エリアの経度範囲
    lats = np.arange(30.0, 46.0, 0.1)  # 対象エリアの緯度範囲
    lons = np.arange(130.0, 146.0, 0.1)  # 対象エリアの経度範囲
    for lat in tqdm(lats):
        for lon in lons:
            search_bbox = Polygon.from_bbox([lon, lat, lon + 0.1, lat + 0.1])
            search_bbox.srid = 4326
            queryset = Path.objects.filter(bbox__intersects=search_bbox)
            print(f"Processing bbox: {lon}, {lat}, {lon + 0.1}, {lat + 0.1} - Found {queryset.count()} paths")
            merge_nodes_from_query_set(queryset)


if __name__ == "__main__":
    merge_all_nodes()
