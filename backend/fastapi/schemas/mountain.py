from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ============================================
# Type Schemas
# ============================================
class TypeBase(BaseModel):
    """共通のTypeフィールド"""

    type_id: str
    name: str


class TypeCreate(TypeBase):
    """Type作成時のスキーマ"""

    pass


class Type(TypeBase):
    """TypeのAPI応答スキーマ"""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MountainTypeDetail(BaseModel):
    """Mountain-Type関係の詳細情報（中間テーブルのdetailフィールド用）"""

    type_id: str
    name: str
    detail: Optional[str] = None


# ============================================
# Prefecture Schemas
# ============================================
class PrefectureBase(BaseModel):
    """共通のPrefectureフィールド"""

    pref_id: str
    name: str


class PrefectureCreate(PrefectureBase):
    """Prefecture作成時のスキーマ"""

    pass


class Prefecture(PrefectureBase):
    """PrefectureのAPI応答スキーマ"""

    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================
# Mountain Schemas
# ============================================
class MountainBase(BaseModel):
    """共通のMountainフィールド"""

    ptid: str
    name: str
    yomi: Optional[str] = None
    other_names: Optional[str] = None
    yamatan: Optional[str] = None
    name_en: Optional[str] = None
    elevation: Optional[float] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    detail: Optional[str] = None
    area: Optional[str] = None
    photo_url: Optional[str] = None
    page_url: Optional[str] = None


class MountainCreate(MountainBase):
    """Mountain作成時のスキーマ"""

    types: list[MountainTypeDetail] = Field(default_factory=list)
    prefs: list[PrefectureBase] = Field(default_factory=list)


class MountainUpdate(BaseModel):
    """Mountain更新時のスキーマ（すべてオプショナル）"""

    name: Optional[str] = None
    yomi: Optional[str] = None
    other_names: Optional[str] = None
    yamatan: Optional[str] = None
    name_en: Optional[str] = None
    elevation: Optional[float] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    detail: Optional[str] = None
    area: Optional[str] = None
    photo_url: Optional[str] = None
    page_url: Optional[str] = None
    types: Optional[list[MountainTypeDetail]] = None
    prefs: Optional[list[PrefectureBase]] = None


class Mountain(MountainBase):
    """MountainのAPI応答スキーマ"""

    id: int
    types: list[Type] = Field(default_factory=list)
    prefectures: list[Prefecture] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MountainList(BaseModel):
    """Mountain一覧応答スキーマ"""

    total: int
    skip: int
    limit: int
    items: list[Mountain]


# ============================================
# JSON Import Schema
# ============================================
class MountainImportType(BaseModel):
    """JSON import用のtype構造"""

    type_id: str
    name: str
    detail: Optional[str] = ""


class MountainImportPref(BaseModel):
    """JSON import用のprefecture構造"""

    id: str
    name: str


class MountainImport(BaseModel):
    """JSON import用のスキーマ（元のJSON構造に対応）"""

    ptid: str
    name: str
    yomi: Optional[str] = ""
    other_names: Optional[str] = ""
    yamatan: Optional[str] = ""
    name_en: Optional[str] = ""
    elevation: Optional[str] = ""
    lat: Optional[str] = ""
    lon: Optional[str] = ""
    detail: Optional[str] = ""
    area: Optional[str] = ""
    types: list[MountainImportType] = Field(default_factory=list)
    prefs: list[MountainImportPref] = Field(default_factory=list)
    photo_url: Optional[str] = ""
    page_url: Optional[str] = ""
