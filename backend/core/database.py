"""
Async SQLAlchemy engine and session management.

Schema is managed via database/schema.sql (raw SQL, run once at setup) rather
than SQLAlchemy ORM migrations — see README for rationale. SQLAlchemy Core /
async sessions are still used here for query execution and typed models.
"""
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from core.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=(settings.environment == "development"),
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a request-scoped DB session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
