#!/usr/bin/env python3
"""
登山道データJSONインポートスクリプト

Usage:
    python commons/import_paths.py

Example:
    python commons/import_paths.py
"""

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from tqdm import tqdm

# Djangoのセットアップ
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "collectmap.settings")

import django

django.setup()

from django.db import transaction
from paths.models import Path as PathModel
from paths.models import PathGeometry, PathTag


def import_path_data(
    json_path: str, skip_existing: bool = True, batch_size: int = 100
) -> dict:
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
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"File not found: {json_path}")

    # JSONデータを読み込み
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # データ形式を判定
    if isinstance(data, dict) and "elements" in data:
        # OpenStreetMap Overpass API形式: {"elements": [...]}
        paths_data = data["elements"]
    elif isinstance(data, list):
        # 配列
        paths_data = data
    else:
        raise ValueError(
            "Invalid JSON format: expected object with 'elements' key or array"
        )

    # wayタイプのみフィルタ
    # paths_data = [p for p in paths_data if p.get("type") == "way"]
    # print(f"  Total ways: {len(paths_data)}")

    # 統計情報
    stats = {
        "total": len(paths_data),
        "created": 0,
        "skipped": 0,
        "errors": 0,
    }

    # 各パスデータをインポート
    # print("\nImporting paths...")
    # print(f"Batch size: {batch_size} (commits every {batch_size} items)")

    for i, path_data in enumerate(paths_data, 1):
        try:
            osm_id = path_data.get("id")
            path_type = path_data.get("type") or "way"
            geometry = path_data.get("geometry", [])

            # 既存チェック
            if PathModel.objects.filter(osm_id=osm_id).exists():
                if skip_existing:
                    stats["skipped"] += 1
                    continue

            with transaction.atomic():
                # Pathオブジェクトを作成
                bounds = path_data.get("bounds", {})
                path = PathModel.objects.create(
                    osm_id=osm_id,
                    type=path_type,
                    minlat=bounds.get("minlat"),
                    minlon=bounds.get("minlon"),
                    maxlat=bounds.get("maxlat"),
                    maxlon=bounds.get("maxlon"),
                )

                # Geometriesを追加
                nodes = path_data.get("nodes", [])
                for idx, geom in enumerate(geometry):
                    PathGeometry.objects.create(
                        path=path,
                        node_id=nodes[idx] if idx < len(nodes) else 0,
                        lat=geom.get("lat"),
                        lon=geom.get("lon"),
                        sequence=idx,
                    )

                # Tagsを追加
                tags = path_data.get("tags", {})
                if tags:
                    PathTag.objects.create(
                        path=path,
                        highway=tags.get("highway"),
                        source=tags.get("source"),
                        difficulty=tags.get("difficulty"),
                        kuma=tags.get("kuma"),
                    )

                stats["created"] += 1
        except Exception as e:
            stats["errors"] += 1
            print(f"  Error: OSM ID {path_data.get('id', 'Unknown')} - {str(e)}")

        # バッチコミット表示
        # if i % batch_size == 0:
        #     print(
        #         f"  → Batch commit at {i} items (Created: {stats['created']}, Skipped: {stats['skipped']}, Errors: {stats['errors']})"
        #     )

    return stats


def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(description="登山道データJSONインポートスクリプト")
    parser.add_argument(
        "--subdir",
        type=str,
        default="paths",
        help="データフォルダ内のサブディレクトリ名 (デフォルト: paths)",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=4,
        help="並列処理のワーカースレッド数 (デフォルト: 4)",
    )
    args = parser.parse_args()

    data_folder = Path(__file__).parent.parent / "datas" / args.subdir

    if not data_folder.exists():
        print(f"❌ Error: Data folder not found: {data_folder}")
        sys.exit(1)

    files = list(data_folder.glob("*.json"))

    files = [f for f in files if "九州" in f.name]

    if not files:
        print(f"❌ Error: No JSON files found in {data_folder}")
        sys.exit(1)

    batch_size = 1000

    try:
        print("=" * 60)
        print("Path Data Import")
        print("=" * 60)
        print(f"Found {len(files)} JSON file(s)")

        total_stats = {
            "total": 0,
            "created": 0,
            "skipped": 0,
            "errors": 0,
        }

        with tqdm(
            total=len(files), desc="Processing JSON files", unit="file"
        ) as overall_pbar:
            with ThreadPoolExecutor(max_workers=args.workers) as executor:
                future_to_file = {
                    executor.submit(
                        import_path_data, str(json_path), True, batch_size
                    ): json_path
                    for json_path in files
                }

                for future in as_completed(future_to_file):
                    json_path = future_to_file[future]
                    try:
                        result = future.result()
                        print("\n" + "-" * 60)
                        print("📊 File Import Summary")
                        print("-" * 60)
                        print(f"  File: {json_path.name}")
                        print(f"  Total: {result['total']}")
                        print(f"  ✅ Created: {result['created']}")
                        print(f"  ⏭️  Skipped: {result['skipped']}")
                        print(f"  ❌ Errors: {result['errors']}")
                        print("-" * 60)

                        # 累計を更新
                        total_stats["total"] += result["total"]
                        total_stats["created"] += result["created"]
                        total_stats["skipped"] += result["skipped"]
                        total_stats["errors"] += result["errors"]

                        if result["errors"] > 0:
                            print(
                                f"\n⚠️  Warning: {result['errors']} errors occurred during import"
                            )
                    except Exception as e:
                        print(f"\n❌ Error processing file {json_path.name}: {e}")
                    finally:
                        overall_pbar.update(1)

        # 最終サマリー
        print("\n" + "=" * 60)
        print("📊 Total Import Summary")
        print("=" * 60)
        print(f"  Files: {len(files)}")
        print(f"  Total: {total_stats['total']}")
        print(f"  ✅ Created: {total_stats['created']}")
        print(f"  ⏭️  Skipped: {total_stats['skipped']}")
        print(f"  ❌ Errors: {total_stats['errors']}")
        print("=" * 60)

    except Exception as e:
        print(f"\n❌ Error occurred: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
