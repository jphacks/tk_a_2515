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
    # ファイル存在チェック
    if not os.path.exists(json_path):
        raise FileNotFoundError(f"File not found: {json_path}")

    # JSONファイルを読み込み
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # データ形式を判定（Overpass API形式または配列形式）
    if isinstance(data, dict) and "elements" in data:
        paths_data = data["elements"]
    elif isinstance(data, list):
        paths_data = data
    else:
        raise ValueError(
            "Invalid JSON format: expected object with 'elements' key or array"
        )

    # 統計情報の初期化
    stats = {
        "total": len(paths_data),
        "created": 0,
        "skipped": 0,
        "errors": 0,
    }

    # 各パスデータを処理
    with tqdm(
        paths_data, desc=f"Processing paths in {Path(json_path).name}", unit="path"
    ) as pbar:
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

                # データベースへの保存（トランザクション内）
                with transaction.atomic():
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
                        PathGeometry.objects.create(
                            path=path,
                            node_id=nodes[idx] if idx < len(nodes) else 0,
                            lat=geom.get("lat"),
                            lon=geom.get("lon"),
                            sequence=idx,
                        )

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

        with tqdm(
            total=len(files), desc="Processing JSON files", unit="file"
        ) as overall_pbar:
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
                        print(
                            f"\n⚠️  Warning: {result['errors']} error(s) in {json_path.name}"
                        )
                except Exception as e:
                    print(f"\n❌ Fatal error processing {json_path.name}: {e}")
                finally:
                    overall_pbar.update(1)

        # 最終結果の表示
        print("\n" + "=" * 60)
        print("✅ Import Completed Successfully")
        print(f"📊 Summary:")
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


if __name__ == "__main__":
    main()
