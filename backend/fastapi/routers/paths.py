from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

import crud.path as crud
import schemas.path as schemas
from database import get_db

router = APIRouter(
    prefix="/paths",
    tags=["paths"],
)


@router.get("/{path_id}", response_model=schemas.Path)
def get_path(path_id: int, db: Session = Depends(get_db)):
    """指定されたIDのPathを取得"""
    return crud.get_path(db, path_id)


@router.get("/", response_model=schemas.PathList)
def list_paths(
    skip: int = 0,
    limit: int = 100,
    highway: Optional[str] = None,
    minlat: Optional[float] = None,
    minlon: Optional[float] = None,
    maxlat: Optional[float] = None,
    maxlon: Optional[float] = None,
    db: Session = Depends(get_db),
):
    """Path一覧を取得（フィルタリング・ページネーション対応）

    Args:
        skip: スキップする件数
        limit: 取得する最大件数
        highway: highwayタグでフィルタ（例: "path", "track"）
        minlat: 検索範囲の最小緯度
        minlon: 検索範囲の最小経度
        maxlat: 検索範囲の最大緯度
        maxlon: 検索範囲の最大経度
    """
    paths = crud.get_paths(
        db,
        skip=skip,
        limit=limit,
        highway=highway,
        minlat=minlat,
        minlon=minlon,
        maxlat=maxlat,
        maxlon=maxlon,
    )
    total = crud.count_paths(
        db,
        highway=highway,
        minlat=minlat,
        minlon=minlon,
        maxlat=maxlat,
        maxlon=maxlon,
    )
    return schemas.PathList(total=total, skip=skip, limit=limit, items=paths)
