from typing import Optional

from fastapi import HTTPException, status
from models.mountain import Mountain, Prefecture, Type
from schemas.mountain import (
    MountainCreate,
    MountainUpdate,
)
from sqlalchemy.orm import Session


# ============================================
# Type CRUD
# ============================================
def get_or_create_type(db: Session, type_id: str, name: str) -> Type:
    """type_idでTypeを取得、存在しなければ作成

    Args:
        db: DBセッション
        type_id: タイプID
        name: タイプ名

    Returns:
        Type
    """
    type_obj = db.query(Type).filter(Type.type_id == type_id).first()
    if not type_obj:
        type_obj = Type(type_id=type_id, name=name)
        db.add(type_obj)
        db.flush()
    return type_obj


def get_types(db: Session, skip: int = 0, limit: int = 100) -> list[Type]:
    """Type一覧を取得

    Args:
        db: DBセッション
        skip: スキップする件数
        limit: 取得する最大件数

    Returns:
        Typeのリスト
    """
    return db.query(Type).offset(skip).limit(limit).all()


# ============================================
# Prefecture CRUD
# ============================================
def get_or_create_prefecture(db: Session, pref_id: str, name: str) -> Prefecture:
    """pref_idでPrefectureを取得、存在しなければ作成

    Args:
        db: DBセッション
        pref_id: 都道府県ID
        name: 都道府県名

    Returns:
        Prefecture
    """
    pref = db.query(Prefecture).filter(Prefecture.pref_id == pref_id).first()
    if not pref:
        pref = Prefecture(pref_id=pref_id, name=name)
        db.add(pref)
        db.flush()
    return pref


def get_prefectures(db: Session, skip: int = 0, limit: int = 100) -> list[Prefecture]:
    """Prefecture一覧を取得

    Args:
        db: DBセッション
        skip: スキップする件数
        limit: 取得する最大件数

    Returns:
        Prefectureのリスト
    """
    return db.query(Prefecture).offset(skip).limit(limit).all()


# ============================================
# Mountain CRUD - Create
# ============================================
def create_mountain(db: Session, mountain: MountainCreate) -> Mountain:
    """新規Mountainを作成

    Args:
        db: DBセッション
        mountain: Mountain作成スキーマ

    Returns:
        作成されたMountain

    Raises:
        HTTPException: ptidが重複
    """
    # ptidの重複チェック
    if db.query(Mountain).filter(Mountain.ptid == mountain.ptid).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Mountain with ptid {mountain.ptid} already exists",
        )

    # Mountainオブジェクトを作成
    db_mountain = Mountain(
        ptid=mountain.ptid,
        name=mountain.name,
        yomi=mountain.yomi,
        other_names=mountain.other_names,
        yamatan=mountain.yamatan,
        name_en=mountain.name_en,
        elevation=mountain.elevation,
        lat=mountain.lat,
        lon=mountain.lon,
        detail=mountain.detail,
        area=mountain.area,
        photo_url=mountain.photo_url,
        page_url=mountain.page_url,
    )

    # Typeを関連付け
    for type_data in mountain.types:
        type_obj = get_or_create_type(db, type_data.type_id, type_data.name)
        db_mountain.types.append(type_obj)

    # Prefectureを関連付け
    for pref_data in mountain.prefs:
        pref_obj = get_or_create_prefecture(db, pref_data.pref_id, pref_data.name)
        db_mountain.prefectures.append(pref_obj)

    db.add(db_mountain)
    db.commit()
    db.refresh(db_mountain)

    return db_mountain


# ============================================
# Mountain CRUD - Read
# ============================================
def get_mountain(db: Session, mountain_id: int) -> Mountain:
    """IDでMountainを取得

    Args:
        db: DBセッション
        mountain_id: MountainのID

    Returns:
        Mountain

    Raises:
        HTTPException: Mountainが見つからない
    """
    mountain = db.query(Mountain).filter(Mountain.id == mountain_id).first()
    if not mountain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Mountain with id {mountain_id} not found",
        )
    return mountain


def get_mountain_by_ptid(db: Session, ptid: str) -> Optional[Mountain]:
    """ptidでMountainを取得

    Args:
        db: DBセッション
        ptid: Mountainのptid

    Returns:
        Mountain（存在しない場合はNone）
    """
    return db.query(Mountain).filter(Mountain.ptid == ptid).first()


def get_mountains(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    name: Optional[str] = None,
    prefecture_id: Optional[int] = None,
    minlat: Optional[float] = None,
    minlon: Optional[float] = None,
    maxlat: Optional[float] = None,
    maxlon: Optional[float] = None,
) -> list[Mountain]:
    """Mountain一覧を取得（フィルタリング対応）

    Args:
        db: DBセッション
        skip: スキップする件数
        limit: 取得する最大件数
        name: 名前で検索（部分一致）
        prefecture_id: 都道府県IDでフィルタ

    Returns:
        Mountainのリスト
    """
    query = db.query(Mountain)

    # 名前検索
    if name:
        query = query.filter(Mountain.name.contains(name))

    # 都道府県でフィルタ
    if prefecture_id:
        query = query.join(Mountain.prefectures).filter(Prefecture.id == prefecture_id)

    if minlat is not None and maxlat is not None:
        query = query.filter(Mountain.lat.between(minlat, maxlat))

    if minlon is not None and maxlon is not None:
        query = query.filter(Mountain.lon.between(minlon, maxlon))

    return query.offset(skip).limit(limit).all()


def count_mountains(
    db: Session,
    name: Optional[str] = None,
    prefecture_id: Optional[int] = None,
    minlat: Optional[float] = None,
    minlon: Optional[float] = None,
    maxlat: Optional[float] = None,
    maxlon: Optional[float] = None,
) -> int:
    """Mountainの総数を取得

    Args:
        db: DBセッション
        name: 名前で検索（部分一致）
        prefecture_id: 都道府県IDでフィルタ

    Returns:
        Mountainの総数
    """
    query = db.query(Mountain)

    if name:
        query = query.filter(Mountain.name.contains(name))

    if prefecture_id:
        query = query.join(Mountain.prefectures).filter(Prefecture.id == prefecture_id)

    if minlat is not None and maxlat is not None:
        query = query.filter(Mountain.lat.between(minlat, maxlat))

    if minlon is not None and maxlon is not None:
        query = query.filter(Mountain.lon.between(minlon, maxlon))

    return query.count()


# ============================================
# Mountain CRUD - Update
# ============================================
def update_mountain(
    db: Session, mountain_id: int, mountain_update: MountainUpdate
) -> Mountain:
    """Mountain情報を更新

    Args:
        db: DBセッション
        mountain_id: MountainのID
        mountain_update: 更新データ

    Returns:
        更新されたMountain

    Raises:
        HTTPException: Mountainが見つからない
    """
    db_mountain = get_mountain(db, mountain_id)

    # 更新データを辞書に変換（未設定のフィールドは除外）
    update_data = mountain_update.model_dump(exclude_unset=True)

    # TypesとPrefsは別途処理
    types_data = update_data.pop("types", None)
    prefs_data = update_data.pop("prefs", None)

    # 基本フィールドを更新
    for field, value in update_data.items():
        setattr(db_mountain, field, value)

    # Typesを更新
    if types_data is not None:
        db_mountain.types.clear()
        for type_data in types_data:
            type_obj = get_or_create_type(db, type_data.type_id, type_data.name)
            db_mountain.types.append(type_obj)

    # Prefecturesを更新
    if prefs_data is not None:
        db_mountain.prefectures.clear()
        for pref_data in prefs_data:
            pref_obj = get_or_create_prefecture(db, pref_data.pref_id, pref_data.name)
            db_mountain.prefectures.append(pref_obj)

    db.commit()
    db.refresh(db_mountain)

    return db_mountain


# ============================================
# Mountain CRUD - Delete
# ============================================
def delete_mountain(db: Session, mountain_id: int) -> None:
    """Mountainを削除

    Args:
        db: DBセッション
        mountain_id: MountainのID

    Raises:
        HTTPException: Mountainが見つからない
    """
    db_mountain = get_mountain(db, mountain_id)
    db.delete(db_mountain)
    db.commit()
