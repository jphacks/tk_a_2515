import os
import sys
from pathlib import Path

# Djangoのセットアップ
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "collectmap.settings")

import django

django.setup()

from django.db import transaction
from paths.models import Path as PathModel
from paths.models import PathGeometry, PathTag

def delete_all_paths():
    """pathsのデータを全て削除する"""
    try:
        print("Deleting all paths data...")
        
        # トランザクション内で削除
        with transaction.atomic():
            PathGeometry.objects.all().delete()
            PathTag.objects.all().delete()
            PathModel.objects.all().delete()
        
        print("✅ All paths data deleted successfully.")
    except Exception as e:
        print(f"❌ Error occurred while deleting paths data: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # pathsデータ削除の確認
    delete_confirmation = input("⚠️  Do you want to delete all paths data? (y/n): ").strip().lower()
    if delete_confirmation == "y":
        delete_all_paths()
    elif delete_confirmation != "n":
        print("❌ Invalid input. Exiting.")
