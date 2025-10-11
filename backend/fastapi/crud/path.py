from typing import Optional

from fastapi import HTTPException, status
from models.path import Path, PathGeometry, PathTag
from schemas.path import PathDetail, Point
from sqlalchemy.orm import Session


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
    path = db.query(Path).filter(Path.id == path_id).first()
    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Path with id {path_id} not found",
        )
    return path


def get_path_by_osm_id(db: Session, osm_id: int) -> Optional[Path]:
    """osm_idでPathを取得

    Args:
        db: DBセッション
        osm_id: PathのOSM ID

    Returns:
        Path（存在しない場合はNone）
    """
    return db.query(Path).filter(Path.osm_id == osm_id).first()


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
    """Path一覧を取得（フィルタリング対応）

    Args:
        db: DBセッション
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
    query = db.query(Path)

    # highwayタグでフィルタ
    if highway:
        query = query.join(Path.tags).filter(PathTag.highway == highway)

    # 境界でフィルタ（指定された範囲と重なるPathを検索）
    if minlat is not None:
        query = query.filter(Path.maxlat >= minlat)
    if maxlat is not None:
        query = query.filter(Path.minlat <= maxlat)
    if minlon is not None:
        query = query.filter(Path.maxlon >= minlon)
    if maxlon is not None:
        query = query.filter(Path.minlon <= maxlon)

    return query.offset(skip).limit(limit).all()


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
