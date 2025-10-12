import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

# .envファイルを読み込み（プロジェクトルートから）
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# FastAPIのルートディレクトリをパスに追加
sys.path.append(str(Path(__file__).parent.parent))

from crud.path import create_path, get_path_by_osm_id
from schemas.path import PathImport
from sqlalchemy.orm import Session

ROOT_DIR = Path(__file__).parent.parent.parent
DATA_DIR = ROOT_DIR / "datas" / "paths"

# データディレクトリを作成
DATA_DIR.mkdir(parents=True, exist_ok=True)

PATH = "https://overpass-api.de/api/interpreter"


def post_query(bottom: float, left: float, top: float, right: float):
    """指定されたbboxでOverpass APIにクエリを送信

    Args:
        bottom: 最小緯度
        left: 最小経度
        top: 最大緯度
        right: 最大経度

    Returns:
        dict | None: 成功時はレスポンスデータ、失敗時はNone
    """
    # Overpass APIクエリ
    query = f"""
[out:json][timeout:60];
(
  way["highway"="path"]({bottom},{left},{top},{right});
);
out geom;
"""

    try:
        print(f"  🔄 Fetching: bbox({bottom:.2f},{left:.2f},{top:.2f},{right:.2f})")
        response = requests.post(PATH, data={"data": query}, timeout=120)
        response.raise_for_status()

        # レスポンスデータを返す
        data = response.json()
        elements_count = len(data.get("elements", []))
        print(f"  ✅ Fetched: {elements_count} elements")
        return data

    except requests.exceptions.Timeout:
        print("  ⏱️  Timeout")
        return None
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Error: {str(e)}")
        return None
    except Exception as e:
        print(f"  ❌ Unexpected error: {str(e)}")
        return None


def split_bbox(
    bbox: list[float], grid_size: float = 0.5
) -> list[tuple[float, float, float, float]]:
    """bboxを小さなグリッドに分割

    Args:
        bbox: [right, left, bottom, top] 形式のbbox
        grid_size: グリッドのサイズ（緯度・経度の差）

    Returns:
        [(bottom, left, top, right), ...] のリスト
    """
    right, left, bottom, top = bbox

    # 経度方向の分割数
    lon_steps = int((right - left) / grid_size) + 1
    # 緯度方向の分割数
    lat_steps = int((top - bottom) / grid_size) + 1

    grids = []
    for lat_i in range(lat_steps):
        for lon_i in range(lon_steps):
            grid_bottom = bottom + lat_i * grid_size
            grid_top = min(bottom + (lat_i + 1) * grid_size, top)
            grid_left = left + lon_i * grid_size
            grid_right = min(left + (lon_i + 1) * grid_size, right)

            grids.append((grid_bottom, grid_left, grid_top, grid_right))

    return grids


def rename_file_name(
    name: str,
    bbox: list[float],
    grid_size: float = 0.5,
):
    grids = split_bbox(bbox=bbox, grid_size=grid_size)
    total = len(grids)
    for i, (bottom, left, top, right) in enumerate(grids, 1):
        old_file = DATA_DIR / f"{name.replace(' ', '_')}_grid_{i}.json"
        new_file = (
            DATA_DIR / f"{name.replace(' ', '_')}_{bottom}_{left}_{top}_{right}.json"
        )
        if old_file.exists():
            old_file.rename(new_file)
            print(f"Renamed: {old_file} -> {new_file}")
        else:
            print(f"File not found, skipped: {old_file}")


def crawl_region(
    name: str,
    bbox: list[float],
    db: Session,
    grid_size: float = 0.5,
    delay: float = 2.0,
):
    """指定された地域をクロールし、直接DBに保存

    Args:
        name: 地域名
        bbox: [right, left, bottom, top] 形式のbbox
        db: DBセッション
        grid_size: グリッドのサイズ
        delay: リクエスト間の待機時間（秒）
    """
    print(f"\n{'=' * 60}")
    print(f"🗾 Crawling: {name}")
    print(f"{'=' * 60}")

    grids = split_bbox(bbox, grid_size)
    total = len(grids)

    print(f"  📊 Total grids: {total}")
    print(f"  📏 Grid size: {grid_size}° x {grid_size}°")
    print(f"  ⏱️  Delay: {delay}s between requests\n")

    crawl_stats = {"total": total, "success": 0, "failed": 0}
    import_stats = {"total": 0, "created": 0, "skipped": 0, "errors": 0}

    for i, (bottom, left, top, right) in enumerate(grids, 1):
        print(f"[{i}/{total}] ", end="")

        if (DATA_DIR / f"{name.replace(' ', '_')}_grid_{i}.json").exists():
            print("  ⏭️  Skipping (already exists)")
            crawl_stats["success"] += 1
            continue

        # APIにクエリを送信
        data = post_query(bottom, left, top, right)

        if data:
            crawl_stats["success"] += 1

            # レスポンスを直接DBにインポート
            stats = import_data_to_db(data, db)
            for key in import_stats:
                import_stats[key] += stats[key]

            if stats["created"] > 0:
                print(f"    💾 Imported: {stats['created']} paths")

            with open(
                DATA_DIR / f"{name.replace(' ', '_')}_grid_{i}.json",
                "w",
                encoding="utf-8",
            ) as f:
                import json

                json.dump(data, f, ensure_ascii=False, indent=2)
        else:
            crawl_stats["failed"] += 1

        # レート制限対策：待機
        if i < total:  # 最後のリクエストの後は待たない
            time.sleep(delay)

    print(f"\n{'=' * 60}")
    print(f"📊 {name} Summary")
    print(f"{'=' * 60}")
    print("  Crawl:")
    print(f"    Total grids: {crawl_stats['total']}")
    print(f"    ✅ Success: {crawl_stats['success']}")
    print(f"    ❌ Failed: {crawl_stats['failed']}")
    print("  Import:")
    print(f"    Total paths: {import_stats['total']}")
    print(f"    ✅ Created: {import_stats['created']}")
    print(f"    ⏭️  Skipped: {import_stats['skipped']}")
    print(f"    ❌ Errors: {import_stats['errors']}")
    print(f"{'=' * 60}\n")

    return {"crawl": crawl_stats, "import": import_stats}


def import_data_to_db(data: dict, db: Session) -> dict:
    """レスポンスデータのelementsをDBにインポート

    Args:
        data: APIレスポンスデータ
        db: DBセッション

    Returns:
        インポート結果の統計情報
    """
    stats = {"total": 0, "created": 0, "skipped": 0, "errors": 0}

    try:
        elements = data.get("elements", [])
        # wayタイプのみフィルタ
        elements = [e for e in elements if e.get("type") == "way"]
        stats["total"] = len(elements)

        for element in elements:
            try:
                # Pydanticでバリデーション
                path_import = PathImport(**element)

                # 既存チェック
                existing = get_path_by_osm_id(db, path_import.id)
                if existing:
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

                # DBに保存
                create_path(
                    db=db,
                    osm_id=path_import.id,
                    type=path_import.type,
                    bounds=bounds_dict,
                    nodes=path_import.nodes,
                    geometries=geometries_dict,
                    tags=path_import.tags,
                )

                stats["created"] += 1

            except Exception as e:
                stats["errors"] += 1
                print(
                    f"    ❌ Error importing OSM ID {element.get('id', 'unknown')}: {str(e)}"
                )
                db.rollback()

    except Exception as e:
        print(f"    ❌ Error processing data: {str(e)}")

    return stats


# 地域定義（[right, left, bottom, top]形式）
kyushuu = [132.18, 128.10, 30.9, 34.77]
honshuu = [142.1, 130.8, 33.05, 45.55]
hokkaido = [145.9, 139.8, 41, 45.5]


def main():
    """メイン関数"""
    print("🚀 Path Crawler & Importer - Overpass API")
    grid_size = 0.45
    rename_file_name("九州", kyushuu, grid_size=grid_size)
    rename_file_name("本州", honshuu, grid_size=grid_size)
    rename_file_name("北海道", hokkaido, grid_size=0.45)

    # start_time = time.time()

    # # DBセッションを作成
    # db = SessionLocal()

    # try:
    #     # 各地域をクロール（grid_size=0.5で、面積は約0.25）
    #     # 0.2程度にするには、grid_size=0.45くらいが良い（0.45*0.45=0.2025）

    #     all_crawl_stats = {"total": 0, "success": 0, "failed": 0}
    #     all_import_stats = {"total": 0, "created": 0, "skipped": 0, "errors": 0}

    #     # 九州
    #     stats = crawl_region("九州", kyushuu, db, grid_size=grid_size, delay=0.1)
    #     for key in all_crawl_stats:
    #         all_crawl_stats[key] += stats["crawl"][key]
    #     for key in all_import_stats:
    #         all_import_stats[key] += stats["import"][key]

    #     # 本州
    #     stats = crawl_region("本州", honshuu, db, grid_size=grid_size, delay=0.1)
    #     for key in all_crawl_stats:
    #         all_crawl_stats[key] += stats["crawl"][key]
    #     for key in all_import_stats:
    #         all_import_stats[key] += stats["import"][key]

    #     # 北海道
    #     stats = crawl_region("北海道", hokkaido, db, grid_size=grid_size, delay=0.1)
    #     for key in all_crawl_stats:
    #         all_crawl_stats[key] += stats["crawl"][key]
    #     for key in all_import_stats:
    #         all_import_stats[key] += stats["import"][key]

    #     elapsed_time = time.time() - start_time

    #     # 最終サマリー
    #     print("\n" + "=" * 60)
    #     print("🎉 FINAL SUMMARY")
    #     print("=" * 60)
    #     print("  Crawl:")
    #     print(f"    Total grids: {all_crawl_stats['total']}")
    #     print(f"    ✅ Success: {all_crawl_stats['success']}")
    #     print(f"    ❌ Failed: {all_crawl_stats['failed']}")
    #     print("  Import:")
    #     print(f"    Total paths: {all_import_stats['total']}")
    #     print(f"    ✅ Created: {all_import_stats['created']}")
    #     print(f"    ⏭️  Skipped: {all_import_stats['skipped']}")
    #     print(f"    ❌ Errors: {all_import_stats['errors']}")
    #     print(f"  ⏱️  Total time: {elapsed_time:.2f}s ({elapsed_time / 60:.2f}min)")
    #     print("=" * 60)

    # finally:
    #     db.close()


if __name__ == "__main__":
    main()
