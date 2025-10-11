from datetime import datetime
from typing import List

from database import Base
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

# 中間テーブル: Mountain と MountainType の多対多関係
mountain_types = Table(
    "mountain_types",
    Base.metadata,
    Column(
        "mountain_id",
        Integer,
        ForeignKey("mountains.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "type_id", Integer, ForeignKey("types.id", ondelete="CASCADE"), primary_key=True
    ),
    Column("detail", String, nullable=True),
)

# 中間テーブル: Mountain と Prefecture の多対多関係
mountain_prefectures = Table(
    "mountain_prefectures",
    Base.metadata,
    Column(
        "mountain_id",
        Integer,
        ForeignKey("mountains.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "prefecture_id",
        Integer,
        ForeignKey("prefectures.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Mountain(Base):
    """Mountain model - SQLAlchemy ORM model"""

    __tablename__ = "mountains"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ptid: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False, index=True)
    yomi: Mapped[str | None] = mapped_column(String, nullable=True)
    other_names: Mapped[str | None] = mapped_column(String, nullable=True)
    yamatan: Mapped[str | None] = mapped_column(String, nullable=True)
    name_en: Mapped[str | None] = mapped_column(String, nullable=True)
    elevation: Mapped[float | None] = mapped_column(Float, nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    detail: Mapped[str | None] = mapped_column(String, nullable=True)
    area: Mapped[str | None] = mapped_column(String, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    page_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # リレーションシップ
    types: Mapped[List["Type"]] = relationship(
        "Type",
        secondary=mountain_types,
        back_populates="mountains",
    )
    prefectures: Mapped[List["Prefecture"]] = relationship(
        "Prefecture",
        secondary=mountain_prefectures,
        back_populates="mountains",
    )


class Type(Base):
    """Type model - 山のタイプ（山頂、展望ポイントなど）"""

    __tablename__ = "types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    type_id: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # リレーションシップ
    mountains: Mapped[List[Mountain]] = relationship(
        "Mountain",
        secondary=mountain_types,
        back_populates="types",
    )


class Prefecture(Base):
    """Prefecture model - 都道府県"""

    __tablename__ = "prefectures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    pref_id: Mapped[str] = mapped_column(
        String, unique=True, index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    # リレーションシップ
    mountains: Mapped[List[Mountain]] = relationship(
        "Mountain",
        secondary=mountain_prefectures,
        back_populates="prefectures",
    )
