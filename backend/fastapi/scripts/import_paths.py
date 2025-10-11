#!/usr/bin/env python3
"""
登山道データJSONインポートスクリプト

Usage:
    python scripts/import_paths.py <json_file_path>

Example:
    python scripts/import_paths.py datas/sample_path.json
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# .envファイルを読み込み（プロジェクトルートから）
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# FastAPIのルートディレクトリをパスに追加
sys.path.append(str(Path(__file__).parent.parent))

from crud.path import create_path, get_path_by_osm_id
from database import SessionLocal
from schemas.path import PathImport
from sqlalchemy.orm import Session


def import_path_data(
    json_path: str, db: Session, skip_existing: bool = True, batch_size: int = 100
) -> dict:
    """登山道データをインポート

    Args:
        json_path: JSONファイルパス
        db: DBセッション
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
    print(f"Reading JSON data from {json_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # データ形式を判定
    if isinstance(data, dict) and "elements" in data:
        # OpenStreetMap Overpass API形式: {"elements": [...]}
        paths_data = data["elements"]
        print(f"  Found 'elements' array with {len(paths_data)} path(s)")
    elif isinstance(data, list):
        # 配列
        paths_data = data
    else:
        raise ValueError(
            "Invalid JSON format: expected object with 'elements' key or array"
        )

    # wayタイプのみフィルタ
    paths_data = [p for p in paths_data]
    print(f"  Total ways: {len(paths_data)}")

    # 統計情報
    stats = {
        "total": len(paths_data),
        "created": 0,
        "skipped": 0,
        "errors": 0,
    }

    # 各パスデータをインポート
    print("\nImporting paths...")
    print(f"Batch size: {batch_size} (commits every {batch_size} items)")

    for i, path_data in enumerate(paths_data, 1):
        try:
            # Pydanticでバリデーション
            path_import = PathImport(**path_data)

            # 既存チェック
            existing = get_path_by_osm_id(db, path_import.id)
            if existing:
                if skip_existing:
                    if i % batch_size == 0 or i == 1:  # 1000件ごとまたは最初だけ表示
                        print(
                            f"  [{i}/{len(paths_data)}] Skipped: OSM ID {path_import.id} - already exists"
                        )
                    stats["skipped"] += 1
                    continue

            # boundsをdict形式に変換
            bounds_dict = None
            if path_import.bounds:
                bounds_dict = {
                    "minlat": path_import.bounds.minlat,
                    "minlon": path_import.bounds.minlon,
                    "maxlat": path_import.bounds.maxlat,
                    "maxlon": path_import.bounds.maxlon,
                }

            # geometryをdict形式に変換
            geometries_dict = [
                {"lat": g.lat, "lon": g.lon} for g in path_import.geometry
            ]

            if len(geometries_dict) < 20:
                if i % batch_size == 0 or i == 1:  # 100件ごとまたは最初だけ表示
                    print(
                        f"  [{i}/{len(paths_data)}] Skipped: OSM ID {path_import.id} - less than 20 geometry points"
                    )
                stats["skipped"] += 1
                continue

            # DBに保存
            created = create_path(
                db=db,
                osm_id=path_import.id,
                type=path_import.type,
                bounds=bounds_dict,
                nodes=path_import.nodes,
                geometries=geometries_dict,
                tags=path_import.tags,
            )

            # 100件ごとまたは最初だけ表示
            if i % batch_size == 0 or stats["created"] == 0:
                highway = path_import.tags.get("highway", "unknown")
                print(
                    f"  [{i}/{len(paths_data)}] Created: OSM ID {created.osm_id} (ID: {created.id}, highway: {highway})"
                )

            stats["created"] += 1

        except Exception as e:
            # エラーは毎回表示
            print(
                f"  [{i}/{len(paths_data)}] Error: OSM ID {path_data.get('id', 'Unknown')} - {str(e)}"
            )
            stats["errors"] += 1
            db.rollback()  # エラー時はロールバック

        # バッチコミット
        if i % batch_size == 0:
            print(
                f"  → Batch commit at {i} items (Created: {stats['created']}, Skipped: {stats['skipped']}, Errors: {stats['errors']})"
            )

    print(f"\n  Final progress: [{len(paths_data)}/{len(paths_data)}] Completed!")
    return stats


def main():
    """メイン関数"""

    data_folder = Path(__file__).parent.parent.parent / "datas" / "paths"
    files = list(data_folder.glob("*.json"))

    batch_size = 1000

    # DBセッションを作成
    db = SessionLocal()

    try:
        print("=" * 60)
        print("Path Data Import")
        print("=" * 60)

        for i, json_path in enumerate(files, 1):
            print(f"\n[{i}/{len(files)}] Importing from {json_path}...")
            result = import_path_data(
                json_path, db, skip_existing=True, batch_size=batch_size
            )

            print("\n" + "=" * 60)
            print("📊 Import Summary")
            print("=" * 60)
            print(f"  File: {json_path}")
            print(f"  Total: {result['total']}")
            print(f"  ✅ Created: {result['created']}")
            print(f"  ⏭️  Skipped: {result['skipped']}")
            print(f"  ❌ Errors: {result['errors']}")
            print("=" * 60)

            if result["errors"] > 0:
                print(f"\n⚠️  Warning: {result['errors']} errors occurred during import")

    except Exception as e:
        print(f"\n❌ Error occurred: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)

    finally:
        db.close()


if __name__ == "__main__":
    main()
