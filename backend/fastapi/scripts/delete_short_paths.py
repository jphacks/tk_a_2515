"""
PathGeometryの長さが指定数以下のPathを削除するスクリプト

使い方:
    python scripts/delete_short_paths.py [--min-length 30] [--dry-run]
"""

import argparse
import sys
from pathlib import Path

# プロジェクトルートをパスに追加
sys.path.append(str(Path(__file__).parent.parent))

from database import SessionLocal
from models.path import Path as PathModel
from sqlalchemy import func


def delete_short_paths(min_length: int = 30, dry_run: bool = False):
    """指定された最小長より短いPathを削除

    Args:
        min_length: 最小のgeometry数（この値以下のPathを削除）
        dry_run: Trueの場合、削除せずに対象をリストアップするのみ
    """
    db = SessionLocal()

    try:
        print("=" * 60)
        print(f"Delete Short Paths (min_length: {min_length})")
        if dry_run:
            print("DRY RUN MODE - No actual deletion will occur")
        print("=" * 60)

        # PathGeometryの数をカウントして、min_length以下のものを取得
        # サブクエリでgeometry数をカウント
        from models.path import PathGeometry

        all_path_count = db.query(func.count(PathModel.id)).scalar()

        paths_with_count = (
            db.query(
                PathModel.id,
                PathModel.osm_id,
                func.count(PathGeometry.id).label("geom_count"),
            )
            .outerjoin(PathModel.geometries)
            .group_by(PathModel.id, PathModel.osm_id)
            .having(func.count(PathGeometry.id) <= min_length)
            .all()
        )

        total_count = len(paths_with_count)
        print(f"Total paths in database: {all_path_count}")
        print(
            f"\nFound {total_count} paths with {min_length} or fewer geometry points."
        )

        if total_count == 0:
            print("No paths to delete. Exiting.")
            return

        # 詳細を表示
        print("\nPaths to be deleted:")
        for i, (path_id, osm_id, geom_count) in enumerate(paths_with_count, 1):
            if i <= 10 or i > total_count - 5:  # 最初の10件と最後の5件を表示
                print(
                    f"  [{i}/{total_count}] Path ID: {path_id}, OSM ID: {osm_id}, Geometry Count: {geom_count}"
                )
            elif i == 11:
                print(f"  ... ({total_count - 15} more paths)")

        if dry_run:
            print("\n✓ DRY RUN completed. No paths were deleted.")
            return

        # 確認プロンプト（dry_runでない場合）
        print(f"\n⚠️  WARNING: This will permanently delete {total_count} paths!")
        response = input("Do you want to continue? (yes/no): ")

        if response.lower() not in ["yes", "y"]:
            print("Deletion cancelled.")
            return

        # 削除実行（SQL直接実行で超高速化）
        print("\nDeleting paths and related data...")

        # IDのリストを抽出
        path_ids_to_delete = [path_id for path_id, _, _ in paths_with_count]

        from sqlalchemy import text

        # バッチサイズ（PostgreSQLのIN句の制限を考慮）
        batch_size = 2000
        total_deleted = 0

        for i in range(0, len(path_ids_to_delete), batch_size):
            batch_ids = path_ids_to_delete[i : i + batch_size]
            ids_str = ",".join(map(str, batch_ids))

            print(
                f"  Deleting batch {i // batch_size + 1}/{(len(path_ids_to_delete) + batch_size - 1) // batch_size}..."
            )

            # 関連テーブルを先に削除（外部キー制約を満たすため）
            db.execute(
                text(f"DELETE FROM path_geometries WHERE path_id IN ({ids_str})")
            )
            db.execute(text(f"DELETE FROM path_tags WHERE path_id IN ({ids_str})"))

            # Pathを削除
            result = db.execute(text(f"DELETE FROM paths WHERE id IN ({ids_str})"))
            batch_deleted = result.rowcount
            total_deleted += batch_deleted

            db.commit()
            print(
                f"    Deleted {batch_deleted} paths in this batch (Total: {total_deleted}/{len(path_ids_to_delete)})"
            )

        print(f"\n✓ Successfully deleted {total_deleted} paths and all related data.")

    except Exception as e:
        print(f"\n❌ Error during deletion: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    """メイン関数"""
    parser = argparse.ArgumentParser(
        description="Delete paths with geometry count less than or equal to specified minimum length"
    )
    parser.add_argument(
        "--min-length",
        type=int,
        default=30,
        help="Minimum geometry count (paths with this count or fewer will be deleted). Default: 30",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Dry run mode: list paths to be deleted without actually deleting them",
    )

    args = parser.parse_args()

    delete_short_paths(min_length=args.min_length, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
