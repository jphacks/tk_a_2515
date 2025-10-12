from database import Base
from sqlalchemy import Float, Integer
from sqlalchemy.orm import Mapped, mapped_column


class Elevation(Base):
    """Elevation model - 標高データ"""

    __tablename__ = "elevations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    lat: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    lon: Mapped[float] = mapped_column(Float, nullable=False, index=True)
    height: Mapped[float] = mapped_column(Float, nullable=False)  # 標高(m)
