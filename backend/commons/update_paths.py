# manage.py shell などで
import os
import sys
from pathlib import Path

from django.db import transaction
from tqdm import tqdm

# Djangoのセットアップ
sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "collectmap.settings")

import django

django.setup()
from paths.models import Path as PathModel


def main():
    BATCH = 1000
    qs = PathModel.objects.all().order_by("id")
    length = qs.count()

    start = 0
    print(f"Total paths to process: {length}")
    with tqdm(total=length, desc="Processing paths", unit="path") as pbar:
        while True:
            batch = list(qs[start : start + BATCH])
            if not batch:
                break
            with transaction.atomic():
                for p in batch:
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
            start += BATCH
            pbar.update(len(batch))


if __name__ == "__main__":
    main()
