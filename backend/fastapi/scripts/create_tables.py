#!/usr/bin/env python3
"""
データベーステーブル作成スクリプト

Usage:
    python scripts/create_tables.py
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
from models.mountain import Base
from models.path import Path as PathModel  # noqa
from models.path import PathGeometry, PathTag  # noqa


def main():
    """メイン関数"""
    try:
        print("=" * 60)
        print("Creating database tables...")
        print("=" * 60)

        # すべてのモデルのテーブルを作成
        Base.metadata.create_all(bind=engine)

        print("\n✅ Tables created successfully!")
        print("=" * 60)

        # 作成されたテーブル一覧を表示
        print("\nCreated tables:")
        for table in Base.metadata.sorted_tables:
            print(f"  - {table.name}")

    except Exception as e:
        print(f"\n❌ Error occurred: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
