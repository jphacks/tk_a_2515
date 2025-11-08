#!/usr/bin/env python3
"""
登山道データJSONインポートスクリプト

Usage:
    python commons/import_paths.py

Example:
    python commons/import_paths.py
"""

import json
import os
import sys
from pathlib import Path

from tqdm import tqdm
from utils import calculate_distance

# Djangoのセットアップ
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "collectmap.settings")

import django

django.setup()

from django.contrib.gis.geos import Polygon
from django.db.models.query import QuerySet

from paths.models import Path as PathModel
from paths.models import PathGeometry, PathGeometryOrder, PathTag


def merge_nodes_from_query_set(
    queryset: QuerySet[PathModel],
):
    threshold_distance_km = 0.1  # ノードをマージする距離の閾値（km単位）
    try:
        count = queryset.count()
        print(f"Starting merge_nodes_from_query_set with {count} paths")

        # QuerySetを明示的にiteratorで取得
        for path_a in tqdm(queryset.iterator(chunk_size=1000), total=count, desc="Merging nodes"):
            near_paths = Polygon.from_bbox(
                [path_a.minlon - 0.005, path_a.minlat - 0.005, path_a.maxlon + 0.005, path_a.maxlat + 0.005]
            )
            near_paths.srid = 4326
            nearby_queryset = queryset.filter(bbox__intersects=near_paths).exclude(id=path_a.id)

            for path_b in nearby_queryset:
                if path_a.id >= path_b.id:
                    continue
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
                    node_b_sequence = order_b.sequence

                    # node_bのPathGeometryOrderを削除
                    order_b.delete()

                    # node_aを同じsequenceでpath_bに追加
                    PathGeometryOrder.objects.create(path=path_b, geometry=node_a, sequence=node_b_sequence)

                    # node_bが他のPathに使われていなければ削除
                    if not node_b.path_orders.exists():
                        node_b.delete()

                    # ジオメトリフィールドを更新
                    path_a.update_geo_fields()
                    path_b.update_geo_fields()
                    path_a.save()
                    path_b.save()

                if dist_a0_b0 < threshold_distance_km:
                    merge_nodes(node_a0, path_a, node_b0, path_b, order_b0)
                elif dist_a0_b1 < threshold_distance_km:
                    merge_nodes(node_a0, path_a, node_b1, path_b, order_b1)
                elif dist_a1_b0 < threshold_distance_km:
                    merge_nodes(node_a1, path_a, node_b0, path_b, order_b0)
                elif dist_a1_b1 < threshold_distance_km:
                    merge_nodes(node_a1, path_a, node_b1, path_b, order_b1)
    except Exception as e:
        print(f"Error during merging nodes: {e}")
        import traceback

        traceback.print_exc()


def import_path_data(json_path: str, skip_existing: bool = True, batch_size: int = 100) -> dict:
    """登山道データをインポート

    Args:
        json_path: JSONファイルパス
        skip_existing: 既存データをスキップするか
        batch_size: バッチコミットのサイズ

    Returns:
        インポート結果の情報

    Raises:
        FileNotFoundError: ファイルが存在しない
        ValueError: JSONフォーマットが不正
    """
    # ファイル存在チェック
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"File not found: {json_path}")

    # JSONファイルを読み込み
    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    # データ形式を判定（Overpass API形式または配列形式）
    if isinstance(data, dict) and "elements" in data:
        paths_data = data["elements"]
    elif isinstance(data, list):
        paths_data = data
    else:
        raise ValueError("Invalid JSON format: expected object with 'elements' key or array")

    # 統計情報の初期化
    stats = {
        "total": len(paths_data),
        "created": 0,
        "skipped": 0,
        "errors": 0,
    }

    # 各パスデータを処理
    with tqdm(paths_data, desc=f"Processing paths in {Path(json_path).name}", unit="path") as pbar:
        for i, path_data in enumerate(pbar, 1):
            try:
                # 基本情報を取得
                osm_id = path_data.get("id")
                path_type = path_data.get("type") or "way"
                geometry = path_data.get("geometry", [])

                # 既存データのチェック
                if PathModel.objects.filter(osm_id=osm_id).exists():
                    if skip_existing:
                        stats["skipped"] += 1
                        continue

                    # Pathレコードを作成
                bounds = path_data.get("bounds", {})
                path = PathModel.objects.create(
                    osm_id=osm_id,
                    type=path_type,
                    minlat=bounds.get("minlat"),
                    minlon=bounds.get("minlon"),
                    maxlat=bounds.get("maxlat"),
                    maxlon=bounds.get("maxlon"),
                )

                # ジオメトリ情報を保存
                nodes = path_data.get("nodes", [])
                for idx, geom in enumerate(geometry):
                    path_geometry = PathGeometry.objects.create(
                        node_id=nodes[idx] if idx < len(nodes) else 0,
                        lat=geom.get("lat"),
                        lon=geom.get("lon"),
                    )
                    # Through modelを使ってPathとPathGeometryを関連付け
                    PathGeometryOrder.objects.create(path=path, geometry=path_geometry, sequence=idx)

                # タグ情報を保存
                tags = path_data.get("tags", {})
                if tags:
                    PathTag.objects.create(
                        path=path,
                        highway=tags.get("highway"),
                        source=tags.get("source"),
                        difficulty=tags.get("difficulty"),
                        kuma=tags.get("kuma"),
                    )

                # 地理情報フィールドを更新
                path.update_geo_fields()
                path.save(
                    update_fields=[
                        "route",
                        "bbox",
                        "minlon",
                        "minlat",
                        "maxlon",
                        "maxlat",
                    ]
                )

                stats["created"] += 1
            except Exception as e:
                stats["errors"] += 1
                pbar.write(f"❌ Error importing OSM ID {path_data.get('id', 'Unknown')}: {str(e)}")

    return stats


def main():
    """メイン関数"""

    # データフォルダのパスを設定
    data_folder = Path(__file__).parent.parent / "datas" / "paths_merged"
    print(PathModel.objects.count())

    # フォルダ存在チェック
    if not data_folder.exists():
        print(f"❌ Error: Data folder not found: {data_folder}")
        sys.exit(1)

    # JSONファイルを検索
    files = list(data_folder.glob("*.json"))

    if not files:
        print(f"❌ Error: No JSON files found in {data_folder}")
        sys.exit(1)

    batch_size = 1000

    try:
        # インポート開始
        print("=" * 60)
        print("🚀 Path Data Import Started")
        print(f"📁 Found {len(files)} JSON file(s) in {data_folder.name}")
        print("=" * 60)

        # 統計情報の初期化
        total_stats = {
            "total": 0,
            "created": 0,
            "skipped": 0,
            "errors": 0,
        }

        with tqdm(total=len(files), desc="Processing JSON files", unit="file") as overall_pbar:
            for json_path in files:
                try:
                    result = import_path_data(str(json_path), True, batch_size)

                    # 統計を累積
                    total_stats["total"] += result["total"]
                    total_stats["created"] += result["created"]
                    total_stats["skipped"] += result["skipped"]
                    total_stats["errors"] += result["errors"]

                    # エラーがあれば警告表示
                    if result["errors"] > 0:
                        print(f"\n⚠️  Warning: {result['errors']} error(s) in {json_path.name}")
                except Exception as e:
                    print(f"\n❌ Fatal error processing {json_path.name}: {e}")
                finally:
                    overall_pbar.update(1)

        # 最終結果の表示
        print("\n" + "=" * 60)
        print("✅ Import Completed Successfully")
        print("📊 Summary:")
        print(f"   Files processed: {len(files)}")
        print(f"   Total paths: {total_stats['total']}")
        print(f"   ✅ Created: {total_stats['created']}")
        print(f"   ⏭️  Skipped: {total_stats['skipped']}")
        print(f"   ❌ Errors: {total_stats['errors']}")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Fatal error occurred: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)

    try:
        print("\n🚧 Starting node merging process...")
        # merge_all_nodes()
        merge_nodes_from_query_set(PathModel.objects.all())

        print("✅ Node merging completed.")
    except Exception as e:
        print(f"\n❌ Error during node merging: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
