import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from routers import mountains, paths

# .envファイルを読み込み
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Database connection settings
DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql://postgres:password@db:5432/collectmap"
)
# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# FastAPI app
app = FastAPI(title="Collect Map API")

# Include routers
app.include_router(mountains.router)
app.include_router(paths.router)


# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/")
async def root():
    return {"message": "Collect Map API"}


@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Database connection health check"""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}


@app.get("/db/test")
async def test_db_connection(db: Session = Depends(get_db)):
    """Test database connection and return PostgreSQL version"""
    try:
        result = db.execute(text("SELECT version()"))
        version = result.scalar()
        return {"status": "success", "postgresql_version": version}
    except Exception as e:
        return {"status": "error", "message": str(e)}
