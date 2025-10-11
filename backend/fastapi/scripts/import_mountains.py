#!/usr/bin/env python3
"""
山データJSONインポートスクリプト

Usage:
    python scripts/import_mountains.py <json_file_path>

Example:
    python scripts/import_mountains.py data/mountains.json
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

from crud.mountain import create_mountain, get_mountain_by_ptid
from database import SessionLocal
from schemas.mountain import (
    MountainCreate,
    MountainImport,
    MountainTypeDetail,
    PrefectureBase,
)
from sqlalchemy.orm import Session


def convert_to_mountain_create(mountain_import: MountainImport) -> MountainCreate:
    """MountainImportをMountainCreateに変換

    Args:
        mountain_import: インポート用スキーマ

    Returns:
        MountainCreate スキーマ
    """
    # 文字列から数値への変換（空文字列はNoneに）
    elevation = float(mountain_import.elevation) if mountain_import.elevation else None
    lat = float(mountain_import.lat) if mountain_import.lat else None
    lon = float(mountain_import.lon) if mountain_import.lon else None

    # typesをMountainTypeDetailに変換
    types = [
        MountainTypeDetail(type_id=t.type_id, name=t.name, detail=t.detail or None)
        for t in mountain_import.types
    ]

    # prefsをPrefectureBaseに変換
    prefs = [PrefectureBase(pref_id=p.id, name=p.name) for p in mountain_import.prefs]

    return MountainCreate(
        ptid=mountain_import.ptid,
        name=mountain_import.name,
        yomi=mountain_import.yomi or None,
        other_names=mountain_import.other_names or None,
        yamatan=mountain_import.yamatan or None,
        name_en=mountain_import.name_en or None,
        elevation=elevation,
        lat=lat,
        lon=lon,
        detail=mountain_import.detail or None,
        area=mountain_import.area or None,
        photo_url=mountain_import.photo_url or None,
        page_url=mountain_import.page_url or None,
        types=types,
        prefs=prefs,
    )


def import_mountain_data(
    json_path: str, db: Session, skip_existing: bool = True, batch_size: int = 100
) -> dict:
    """山データをインポート

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
    if isinstance(data, dict) and "data" in data:
        # {"data": [...]} 形式
        mountains_data = data["data"]
        print(f"  Found 'data' array with {len(mountains_data)} mountain(s)")
    elif isinstance(data, dict):
        # 単一オブジェクト
        mountains_data = [data]
    elif isinstance(data, list):
        # 配列
        mountains_data = data
    else:
        raise ValueError("Invalid JSON format: expected object or array")

    print(f"  Total: {len(mountains_data)} mountain(s)")

    # 統計情報
    stats = {
        "total": len(mountains_data),
        "created": 0,
        "skipped": 0,
        "errors": 0,
    }

    # 各山データをインポート
    print("\nImporting mountains...")
    print(f"Batch size: {batch_size} (commits every {batch_size} items)")

    for i, mountain_data in enumerate(mountains_data, 1):
        try:
            # Pydanticでバリデーション
            mountain_import = MountainImport(**mountain_data)

            # 既存チェック
            existing = get_mountain_by_ptid(db, mountain_import.ptid)
            if existing:
                if skip_existing:
                    if i % batch_size == 0 or i == 1:  # 1000件ごとまたは最初だけ表示
                        print(
                            f"  [{i}/{len(mountains_data)}] Skipped: {mountain_import.name} (ptid: {mountain_import.ptid}) - already exists"
                        )
                    stats["skipped"] += 1
                    continue
                else:
                    # 更新処理は省略（必要に応じて実装）
                    stats["skipped"] += 1
                    continue

            # MountainCreateに変換
            mountain_create = convert_to_mountain_create(mountain_import)

            # DBに保存（バッチ処理のため、まだコミットしない）
            created = create_mountain(db, mountain_create)

            # 100件ごとまたは最初だけ表示
            if i % batch_size == 0 or stats["created"] == 0:
                print(
                    f"  [{i}/{len(mountains_data)}] Created: {created.name} (ID: {created.id}, ptid: {created.ptid})"
                )

            stats["created"] += 1

        except Exception as e:
            # エラーは毎回表示
            print(
                f"  [{i}/{len(mountains_data)}] Error: {mountain_data.get('name', 'Unknown')} - {str(e)}"
            )
            stats["errors"] += 1
            db.rollback()  # エラー時はロールバック

        # バッチコミット
        if i % batch_size == 0:
            print(
                f"  → Batch commit at {i} items (Created: {stats['created']}, Skipped: {stats['skipped']}, Errors: {stats['errors']})"
            )

    print(
        f"\n  Final progress: [{len(mountains_data)}/{len(mountains_data)}] Completed!"
    )
    return stats


def main():
    json_path = Path(__file__).parent.parent.parent / "datas" / "yamareco.json"
    batch_size = 1000

    # DBセッションを作成
    db = SessionLocal()

    try:
        print("=" * 60)
        print("Mountain Data Import")
        print("=" * 60)

        import time

        start_time = time.time()

        result = import_mountain_data(
            json_path, db, skip_existing=True, batch_size=batch_size
        )

        elapsed_time = time.time() - start_time

        print("\n" + "=" * 60)
        print("📊 Import Summary")
        print("=" * 60)
        print(f"  File: {json_path}")
        print(f"  Total: {result['total']}")
        print(f"  ✅ Created: {result['created']}")
        print(f"  ⏭️  Skipped: {result['skipped']}")
        print(f"  ❌ Errors: {result['errors']}")
        print(f"  ⏱️  Time: {elapsed_time:.2f} seconds")
        if result["created"] > 0:
            print(f"  📈 Rate: {result['created'] / elapsed_time:.2f} items/sec")
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
