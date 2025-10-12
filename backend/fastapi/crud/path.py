import json
import math
from pathlib import Path as FilePath
from typing import Optional

from fastapi import HTTPException, status
from models.path import Path, PathGeometry, PathTag
from schemas.path import PathDetail, PathImport, Point
from sqlalchemy.orm import Session
from utils import (
    calc_delta_x,
    calc_delta_y,
    fetch_all_dem_data_from_bbox,
    lat_from_y,
    lon_from_x,
    x_from_lon,
    y_from_lat,
)


# ============================================
# Path CRUD - Create (for import only)
# ============================================
def create_path(
    db: Session,
    osm_id: int,
    type: str,
    bounds: Optional[dict] = None,
    nodes: list[int] = None,
    geometries: list[dict] = None,
    tags: dict[str, str] = None,
) -> Path:
    """新規Pathを作成（インポート用）

    Args:
        db: DBセッション
        osm_id: OpenStreetMap ID
        type: wayのタイプ
        bounds: 境界情報
        nodes: ノードIDのリスト
        geometries: 座標データのリスト
        tags: タグ情報

    Returns:
        作成されたPath

    Raises:
        HTTPException: osm_idが重複
    """
    # osm_idの重複チェック
    if db.query(Path).filter(Path.osm_id == osm_id).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Path with osm_id {osm_id} already exists",
        )

    # Pathオブジェクトを作成
    db_path = Path(
        osm_id=osm_id,
        type=type,
        minlat=bounds.get("minlat") if bounds else None,
        minlon=bounds.get("minlon") if bounds else None,
        maxlat=bounds.get("maxlat") if bounds else None,
        maxlon=bounds.get("maxlon") if bounds else None,
    )

    # Geometriesを追加
    if geometries:
        for i, geom in enumerate(geometries):
            db_geom = PathGeometry(
                node_id=nodes[i] if nodes and i < len(nodes) else 0,
                lat=geom["lat"],
                lon=geom["lon"],
                sequence=i,
            )
            db_path.geometries.append(db_geom)

    # Tagsを追加
    if tags:
        db_tag = PathTag(
            highway=tags.get("highway"),
            source=tags.get("source"),
        )
        db_path.tags.append(db_tag)

    db.add(db_path)
    db.commit()
    db.refresh(db_path)

    return db_path


def get_nearest_elevation(lat: float, lon: float, dem_data: dict) -> float:
    """指定した座標に最も近い標高データを取得"""
    base_x = int(x_from_lon(lon, 14))
    base_y = math.ceil(y_from_lat(lat, 14))
    if (base_x, base_y) in dem_data:
        data = dem_data[(base_x, base_y)]
        x_diff = lon - lon_from_x(base_x, 14)
        y_diff = lat_from_y(base_y, 14) - lat
        delta_x = calc_delta_x(14)
        delta_y = calc_delta_y(14, lat)
        i = int(x_diff / delta_x)
        j = int(y_diff / delta_y)
        print(f"  Nearest DEM point at ({base_x}, {base_y}), offset ({i}, {j})")
        if 0 <= i < 256 and 0 <= j < 256:
            return data[(j, i)]
        else:
            return 0
    else:
        return 0


def local_distance_m(lat1, lon1, lat2, lon2, R=6_371_000.0):
    # 入力は度、出力はメートル
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    phi = math.radians((lat1 + lat2) / 2.0)
    x = dlon * math.cos(phi) * R
    y = dlat * R
    return math.hypot(x, y)


def get_elevation_data(path: Path) -> PathDetail:
    min_lon, min_lat, max_lon, max_lat = (
        path.minlon,
        path.minlat,
        path.maxlon,
        path.maxlat,
    )

    dem_data = fetch_all_dem_data_from_bbox(min_lon, min_lat, max_lon, max_lat)
    print(dem_data.keys())
    base_lon = path.geometries[0].lon
    base_lat = path.geometries[0].lat
    distance = 0.0
    points: list[Point] = []
    for geom in path.geometries:
        elevation_value = get_nearest_elevation(geom.lat, geom.lon, dem_data)
        distance += int(local_distance_m(base_lat, base_lon, geom.lat, geom.lon))
        points.append(Point(x=distance, y=elevation_value, lon=geom.lon, lat=geom.lat))
        base_lon = geom.lon
        base_lat = geom.lat

        # Geomに標高と距離を設定

    return PathDetail(
        id=path.id,
        path_id=path.id,
        osm_id=path.osm_id,
        type=path.type,
        difficulty=path.tags[0].difficulty if path.tags else None,
        path_graphic=points,
    )


# ============================================
# Path CRUD - Read
# ============================================
def get_path(db: Session, path_id: int) -> PathDetail:
    """IDでPathを取得

    Args:
        db: DBセッション
        path_id: PathのID

    Returns:
        Path

    Raises:
        HTTPException: Pathが見つからない
    """
    path = db.query(Path).filter(Path.osm_id == path_id).first()
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Path with id {path_id} not found",
        )
    return get_elevation_data(path)


def get_path_by_osm_id(db: Session, osm_id: int) -> Optional[Path]:
    """osm_idでPathを取得

    Args:
        db: DBセッション
        osm_id: PathのOSM ID

    Returns:
        Path（存在しない場合はNone）
    """
    return db.query(Path).filter(Path.osm_id == osm_id).first()


def _check_bounds_intersect(
    file_bottom: float,
    file_left: float,
    file_top: float,
    file_right: float,
    minlat: float,
    minlon: float,
    maxlat: float,
    maxlon: float,
) -> bool:
    """2つの境界が交差するかチェック"""
    # 交差しない条件（どれか1つでも満たせば交差しない）
    if file_right < minlon:  # ファイルの右端がリクエストの左端より左
        return False
    if file_left > maxlon:  # ファイルの左端がリクエストの右端より右
        return False
    if file_top < minlat:  # ファイルの上端がリクエストの下端より下
        return False
    if file_bottom > maxlat:  # ファイルの下端がリクエストの上端より上
        return False
    return True


kyushuu = [132.18, 128.10, 30.9, 34.77]
honshuu = [142.1, 130.8, 33.05, 45.55]
hokkaido = [145.9, 139.8, 41, 45.5]


def get_paths(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    highway: Optional[str] = None,
    minlat: Optional[float] = None,
    minlon: Optional[float] = None,
    maxlat: Optional[float] = None,
    maxlon: Optional[float] = None,
) -> list[Path]:
    """Path一覧を取得（JSONファイルから直接読み込み）

    Args:
        db: DBセッション（現在未使用）
        skip: スキップする件数
        limit: 取得する最大件数
        highway: highwayタグでフィルタ
        minlat: 境界の最小緯度
        minlon: 境界の最小経度
        maxlat: 境界の最大緯度
        maxlon: 境界の最大経度

    Returns:
        Pathのリスト
    """
    # datas/pathsディレクトリのパス
    # Docker環境では /datas にマウントされている
    data_dir = FilePath("/datas/paths")
    print(f"Loading paths from {data_dir}")

    if not data_dir.exists():
        print(f"Warning: Data directory not found: {data_dir}")
        return []

    # 境界が指定されていない場合は空リストを返す
    if minlat is None or maxlat is None or minlon is None or maxlon is None:
        print("Warning: Bounds not specified")
        return []

    # 交差するJSONファイルを検索
    intersecting_files = []
    for json_file in data_dir.glob("*.json"):
        # ファイル名から境界情報を抽出
        # 形式: {name}_{bottom}_{left}_{top}_{right}.json
        parts = json_file.stem.split("_")
        if len(parts) < 5:
            continue  # ファイル名が期待する形式でない場合はスキップ

        try:
            # 最後の4つの要素が境界情報
            file_bottom = float(parts[-4])
            file_left = float(parts[-3])
            file_top = float(parts[-2])
            file_right = float(parts[-1])

            # 境界が交差するかチェック
            if _check_bounds_intersect(
                file_bottom,
                file_left,
                file_top,
                file_right,
                minlat,
                minlon,
                maxlat,
                maxlon,
            ):
                intersecting_files.append(json_file)
        except (ValueError, IndexError):
            # ファイル名から境界情報を抽出できない場合はスキップ
            continue

    print(f"Found {len(intersecting_files)} intersecting JSON files")

    # JSONファイルからPathを読み込み
    paths = []
    for json_file in intersecting_files:
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            elements = data.get("elements", [])
            # wayタイプのみフィルタ
            elements = [e for e in elements if e.get("type") == "way"]

            for element in elements:
                try:
                    # Pydanticでバリデーション
                    path_import = PathImport(**element)

                    # geometryの長さチェック（15以下は排除）
                    if len(path_import.geometry) <= 15:
                        continue

                    # highwayフィルタ
                    if highway and path_import.tags.get("highway") != highway:
                        continue

                    # 境界フィルタ（さらに厳密にチェック）
                    if path_import.bounds:
                        if not _check_bounds_intersect(
                            path_import.bounds.minlat,
                            path_import.bounds.minlon,
                            path_import.bounds.maxlat,
                            path_import.bounds.maxlon,
                            minlat,
                            minlon,
                            maxlat,
                            maxlon,
                        ):
                            continue

                    # Path オブジェクトを作成（DBには保存しない）
                    path_obj = Path(
                        osm_id=path_import.id,
                        type=path_import.type,
                        minlat=path_import.bounds.minlat
                        if path_import.bounds
                        else None,
                        minlon=path_import.bounds.minlon
                        if path_import.bounds
                        else None,
                        maxlat=path_import.bounds.maxlat
                        if path_import.bounds
                        else None,
                        maxlon=path_import.bounds.maxlon
                        if path_import.bounds
                        else None,
                    )

                    # geometriesを追加
                    for i, geom in enumerate(path_import.geometry):
                        geom_obj = PathGeometry(
                            node_id=path_import.nodes[i]
                            if i < len(path_import.nodes)
                            else 0,
                            lat=geom.lat,
                            lon=geom.lon,
                            sequence=i,
                        )
                        path_obj.geometries.append(geom_obj)

                    # tagsを追加
                    if path_import.tags:
                        tag_obj = PathTag(
                            highway=path_import.tags.get("highway"),
                            source=path_import.tags.get("source"),
                        )
                        path_obj.tags.append(tag_obj)

                    paths.append(path_obj)

                    # limitに達したら終了
                    if len(paths) >= skip + limit:
                        break

                except Exception as e:
                    print(f"Error parsing path from {json_file.name}: {e}")
                    continue

            # limitに達したら終了
            if len(paths) >= skip + limit:
                break

        except Exception as e:
            print(f"Error reading file {json_file.name}: {e}")
            continue

    # skip と limit を適用
    result = paths[skip : skip + limit]
    print(f"Returning {len(result)} paths (skip={skip}, limit={limit})")
    return result


def count_paths(
    db: Session,
    highway: Optional[str] = None,
    minlat: Optional[float] = None,
    minlon: Optional[float] = None,
    maxlat: Optional[float] = None,
    maxlon: Optional[float] = None,
) -> int:
    """Pathの総数を取得

    Args:
        db: DBセッション
        highway: highwayタグでフィルタ
        minlat: 境界の最小緯度
        minlon: 境界の最小経度
        maxlat: 境界の最大緯度
        maxlon: 境界の最大経度

    Returns:
        Pathの総数
    """
    query = db.query(Path)

    if highway:
        query = query.join(Path.tags).filter(PathTag.highway == highway)

    if minlat is not None:
        query = query.filter(Path.maxlat >= minlat)
    if maxlat is not None:
        query = query.filter(Path.minlat <= maxlat)
    if minlon is not None:
        query = query.filter(Path.maxlon >= minlon)
    if maxlon is not None:
        query = query.filter(Path.minlon <= maxlon)

    return query.count()
