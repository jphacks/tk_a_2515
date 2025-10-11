from datetime import datetime
from typing import List

from database import Base
from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship


class Path(Base):
    """Path model - OpenStreetMap way データ"""

    __tablename__ = "paths"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    osm_id: Mapped[int] = mapped_column(
        BigInteger, unique=True, index=True, nullable=False
    )
    type: Mapped[str] = mapped_column(String, nullable=False)

    # bounds情報
    minlat: Mapped[float | None] = mapped_column(Float, nullable=True)
    minlon: Mapped[float | None] = mapped_column(Float, nullable=True)
    maxlat: Mapped[float | None] = mapped_column(Float, nullable=True)
    maxlon: Mapped[float | None] = mapped_column(Float, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # リレーションシップ
    geometries: Mapped[List["PathGeometry"]] = relationship(
        "PathGeometry",
        back_populates="path",
        cascade="all, delete-orphan",
        order_by="PathGeometry.sequence",
    )
    tags: Mapped[List["PathTag"]] = relationship(
        "PathTag",
        back_populates="path",
        cascade="all, delete-orphan",
    )


class PathGeometry(Base):
    """PathGeometry model - Pathの座標データ"""

    __tablename__ = "path_geometries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    path_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("paths.id", ondelete="CASCADE"), nullable=False
    )
    node_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lon: Mapped[float] = mapped_column(Float, nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)

    # リレーションシップ
    path: Mapped["Path"] = relationship("Path", back_populates="geometries")


class PathTag(Base):
    """PathTag model - Pathのタグ情報（highway, sourceなど）"""

    __tablename__ = "path_tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    path_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("paths.id", ondelete="CASCADE"), nullable=False
    )
    highway: Mapped[str | None] = mapped_column(String, nullable=True)
    source: Mapped[str | None] = mapped_column(String, nullable=True)
    difficulty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    kuma: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # リレーションシップ
    path: Mapped["Path"] = relationship("Path", back_populates="tags")
