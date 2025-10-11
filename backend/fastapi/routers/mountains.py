from typing import Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

import crud
import schemas
from database import get_db

router = APIRouter(
    prefix="/mountains",
    tags=["mountains"],
)


@router.post("/", response_model=schemas.Mountain, status_code=status.HTTP_201_CREATED)
def create_mountain(mountain: schemas.MountainCreate, db: Session = Depends(get_db)):
    """新規Mountainを作成"""
    return crud.create_mountain(db, mountain)


@router.get("/{mountain_id}", response_model=schemas.Mountain)
def get_mountain(mountain_id: int, db: Session = Depends(get_db)):
    """指定されたIDのMountainを取得"""
    return crud.get_mountain(db, mountain_id)


@router.get("/", response_model=schemas.MountainList)
def list_mountains(
    skip: int = 0,
    limit: int = 100,
    name: Optional[str] = None,
    prefecture_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Mountain一覧を取得（フィルタリング・ページネーション対応）"""
    mountains = crud.get_mountains(
        db, skip=skip, limit=limit, name=name, prefecture_id=prefecture_id
    )
    total = crud.count_mountains(db, name=name, prefecture_id=prefecture_id)
    return schemas.MountainList(total=total, skip=skip, limit=limit, items=mountains)


@router.patch("/{mountain_id}", response_model=schemas.Mountain)
def update_mountain(
    mountain_id: int, mountain: schemas.MountainUpdate, db: Session = Depends(get_db)
):
    """Mountain情報を更新（部分更新）"""
    return crud.update_mountain(db, mountain_id, mountain)


@router.delete("/{mountain_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_mountain(mountain_id: int, db: Session = Depends(get_db)):
    """Mountainを削除"""
    crud.delete_mountain(db, mountain_id)
    return None


# ============================================
# Type & Prefecture endpoints
# ============================================
@router.get("/types/", response_model=list[schemas.Type], tags=["types"])
def list_types(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Type一覧を取得"""
    return crud.get_types(db, skip=skip, limit=limit)


@router.get("/prefectures/", response_model=list[schemas.Prefecture], tags=["prefectures"])
def list_prefectures(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Prefecture一覧を取得"""
    return crud.get_prefectures(db, skip=skip, limit=limit)
