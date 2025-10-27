#!/usr/bin/env python3
"""
山データJSONインポートスクリプト

Usage:
    python commons/import_mountains.py

Example:
    python commons/import_mountains.py
"""

import json
import os
import sys
import time
from pathlib import Path

# Djangoのセットアップ
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "collectmap.settings")

import django

django.setup()

from django.db import transaction
from mountains.models import (
    Mountain,
    MountainPrefecture,
    MountainType,
    Prefecture,
    Type,
)


def convert_value(value, value_type="str"):
    """値を適切な型に変換"""
    if not value or value == "":
        return None

    if value_type == "float":
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    return value


def import_mountain_data(
    json_path: str, skip_existing: bool = True, batch_size: int = 100
) -> dict:
    """山データをインポート

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
            with transaction.atomic():
                ptid = mountain_data.get("ptid")
                name = mountain_data.get("name")

                # 既存チェック
                if Mountain.objects.filter(ptid=ptid).exists():
                    if skip_existing:
                        if i % batch_size == 0 or i == 1:
                            print(
                                f"  [{i}/{len(mountains_data)}] Skipped: {name} (ptid: {ptid}) - already exists"
                            )
                        stats["skipped"] += 1
                        continue
                    else:
                        stats["skipped"] += 1
                        continue

                # Mountainオブジェクトを作成
                mountain = Mountain.objects.create(
                    ptid=ptid,
                    name=name,
                    yomi=convert_value(mountain_data.get("yomi")),
                    other_names=convert_value(mountain_data.get("other_names")),
                    yamatan=convert_value(mountain_data.get("yamatan")),
                    name_en=convert_value(mountain_data.get("name_en")),
                    elevation=convert_value(mountain_data.get("elevation"), "float"),
                    lat=convert_value(mountain_data.get("lat"), "float"),
                    lon=convert_value(mountain_data.get("lon"), "float"),
                    detail=convert_value(mountain_data.get("detail")),
                    area=convert_value(mountain_data.get("area")),
                    photo_url=convert_value(mountain_data.get("photo_url")),
                    page_url=convert_value(mountain_data.get("page_url")),
                )

                # Typesを追加
                types_data = mountain_data.get("types", [])
                for type_data in types_data:
                    type_obj, _ = Type.objects.get_or_create(
                        type_id=type_data.get("type_id"),
                        defaults={"name": type_data.get("name")},
                    )
                    MountainType.objects.create(
                        mountain=mountain, type=type_obj, detail=type_data.get("detail")
                    )

                # Prefecturesを追加
                prefs_data = mountain_data.get("prefs", [])
                for pref_data in prefs_data:
                    pref_obj, _ = Prefecture.objects.get_or_create(
                        pref_id=pref_data.get("id"),
                        defaults={"name": pref_data.get("name")},
                    )
                    MountainPrefecture.objects.create(
                        mountain=mountain, prefecture=pref_obj
                    )

                # 100件ごとまたは最初だけ表示
                if i % batch_size == 0 or stats["created"] == 0:
                    print(
                        f"  [{i}/{len(mountains_data)}] Created: {mountain.name} (ID: {mountain.id}, ptid: {mountain.ptid})"
                    )

                stats["created"] += 1

        except Exception as e:
            # エラーは毎回表示
            print(
                f"  [{i}/{len(mountains_data)}] Error: {mountain_data.get('name', 'Unknown')} - {str(e)}"
            )
            stats["errors"] += 1

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
    json_path = str(Path(__file__).parent.parent / "datas" / "yamareco.json")
    batch_size = 1000

    try:
        print("=" * 60)
        print("Mountain Data Import")
        print("=" * 60)

        start_time = time.time()

        result = import_mountain_data(
            json_path, skip_existing=True, batch_size=batch_size
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


if __name__ == "__main__":
    main()
