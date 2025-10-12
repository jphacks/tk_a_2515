from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ============================================
# PathGeometry Schemas
# ============================================
class PathGeometryBase(BaseModel):
    """PathGeometry 基本スキーマ"""

    lat: float
    lon: float
    sequence: int


class PathGeometry(PathGeometryBase):
    """PathGeometry API応答スキーマ"""

    id: Optional[int] = None
    node_id: int

    model_config = ConfigDict(from_attributes=True)


# ============================================
# PathNode Schemas
# ============================================
class PathNodeBase(BaseModel):
    """PathNode 基本スキーマ"""

    node_id: int
    sequence: int


class PathNode(PathNodeBase):
    """PathNode API応答スキーマ"""

    id: int
    path_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ============================================
# PathTag Schemas
# ============================================
class PathTagBase(BaseModel):
    """PathTag 基本スキーマ"""

    highway: Optional[str] = None
    source: Optional[str] = None
    difficulty: Optional[int] = None
    kuma: Optional[str] = None


class PathTag(PathTagBase):
    """PathTag API応答スキーマ"""

    id: Optional[int] = None
    path_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ============================================
# Path Schemas
# ============================================
class PathBase(BaseModel):
    """Path 基本スキーマ"""

    osm_id: int
    type: str
    minlat: Optional[float] = None
    minlon: Optional[float] = None
    maxlat: Optional[float] = None
    maxlon: Optional[float] = None


class Path(PathBase):
    """Path API応答スキーマ（関連データ含む）"""

    id: Optional[int] = None
    geometries: list[PathGeometry] = Field(default_factory=list)
    tags: list[PathTag] = Field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PathList(BaseModel):
    """Path一覧応答スキーマ"""

    total: int
    skip: int
    limit: int
    items: list[Path]


# ============================================
# JSON Import Schemas
# ============================================
class PathImportGeometry(BaseModel):
    """JSON import用のgeometry構造"""

    lat: float
    lon: float


class PathImportBounds(BaseModel):
    """JSON import用のbounds構造"""

    minlat: float
    minlon: float
    maxlat: float
    maxlon: float


class PathImport(BaseModel):
    """JSON import用のスキーマ（OpenStreetMap way構造）"""

    type: str
    id: int  # OSM ID
    bounds: Optional[PathImportBounds] = None
    nodes: list[int] = Field(default_factory=list)
    geometry: list[PathImportGeometry] = Field(default_factory=list)
    tags: dict[str, str] = Field(default_factory=dict)


class Point(BaseModel):
    """座標点のスキーマ"""

    x: float
    y: float


class PathDetail(BaseModel):
    """Pathの詳細情報スキーマ"""

    id: Optional[int] = None
    path_id: Optional[int] = None
    osm_id: int
    type: str
    difficulty: Optional[int] = None
    path_graphic: Optional[list[Point]] = None
