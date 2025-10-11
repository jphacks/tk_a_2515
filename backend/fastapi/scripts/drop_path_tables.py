#!/usr/bin/env python3
"""
Pathテーブル削除スクリプト

Usage:
    python scripts/drop_path_tables.py
"""

import sys
from pathlib import Path

from dotenv import load_dotenv

# .envファイルを読み込み
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# FastAPIのルートディレクトリをパスに追加
sys.path.append(str(Path(__file__).parent.parent))

from database import engine
from sqlalchemy import text


def main():
    """メイン関数"""
    try:
        print("=" * 60)
        print("Dropping Path tables...")
        print("=" * 60)

        with engine.connect() as conn:
            # Pathテーブルを削除（CASCADE で関連テーブルも削除）
            conn.execute(text("DROP TABLE IF EXISTS path_geometries CASCADE"))
            print("  ✅ Dropped: path_geometries")

            conn.execute(text("DROP TABLE IF EXISTS path_tags CASCADE"))
            print("  ✅ Dropped: path_tags")

            conn.execute(text("DROP TABLE IF EXISTS paths CASCADE"))
            print("  ✅ Dropped: paths")

            conn.commit()

        print("\n✅ Path tables dropped successfully!")
        print("=" * 60)
        print("\nNow run: python fastapi/scripts/create_tables.py")

    except Exception as e:
        print(f"\n❌ Error occurred: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
