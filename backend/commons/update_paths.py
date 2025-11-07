#!/usr/bin/env python3
"""
パスの地理情報フィールド一括更新スクリプト

Usage:
    python commons/update_paths.py

Example:
    python commons/update_paths.py --workers 8
"""

import argparse
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from django.db import transaction
from tqdm import tqdm

# Djangoのセットアップ
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "collectmap.settings")

import django

django.setup()
from paths.models import Path as PathModel


def update_single_path(path_id):
    """単一のパスの地理情報を更新

    Args:
        path_id: PathModelのID

    Returns:
        bool: 成功した場合True、失敗した場合False
    """
    try:
        # トランザクション内で更新処理を実行
        with transaction.atomic():
            p = PathModel.objects.get(id=path_id)
            # 地理情報フィールドを計算・更新
            p.update_geo_fields()
            p.save(
                update_fields=[
                    "route",
                    "bbox",
                    "minlon",
                    "minlat",
                    "maxlon",
                    "maxlat",
                ]
            )
        return True
    except Exception as e:
        return False


def main():
    """メイン関数"""
    # コマンドライン引数の設定
    parser = argparse.ArgumentParser(description="パスの地理情報フィールドを更新")
    parser.add_argument(
        "--workers",
        type=int,
        default=16,
        help="並列処理のワーカースレッド数 (デフォルト: 16)",
    )
    args = parser.parse_args()

    # データベースから全てのパスIDを取得
    path_ids = list(
        PathModel.objects.all().order_by("id").values_list("id", flat=True)
    )
    length = len(path_ids)

    # 処理開始
    print("=" * 60)
    print("🔄 Path Geo Fields Update Started")
    print(f"📊 Total paths to process: {length}")
    print(f"⚙️  Workers: {args.workers}")
    print("=" * 60)

    errors = 0

    # 並列処理で各パスを更新
    with tqdm(total=length, desc="Updating paths", unit="path") as pbar:
        with ThreadPoolExecutor(max_workers=args.workers) as executor:
            # 各パスIDに対して更新タスクを投入
            future_to_id = {
                executor.submit(update_single_path, path_id): path_id
                for path_id in path_ids
            }

            # タスク完了時に結果を処理
            for future in as_completed(future_to_id):
                path_id = future_to_id[future]
                try:
                    result = future.result()
                    if not result:
                        errors += 1
                except Exception as e:
                    errors += 1
                    pbar.write(f"❌ Error updating Path ID {path_id}: {str(e)}")
                finally:
                    pbar.update(1)

    # 最終結果の表示
    print("\n" * args.workers + "=" * 60)
    print("✅ Update Completed")
    print(f"📊 Summary:")
    print(f"   Total processed: {length}")
    print(f"   ✅ Successful: {length - errors}")
    if errors > 0:
        print(f"   ❌ Failed: {errors}")
    print("=" * 60)


if __name__ == "__main__":
    main()
