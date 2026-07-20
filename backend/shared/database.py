"""
Async SQLAlchemy database session factory for all Velontri microservices.

Design decisions:
- Uses asyncpg driver for maximum PostgreSQL async throughput.
- Each service creates its own engine using its own DATABASE_URL.
- Sessions are managed as async context managers and are never shared
  across request boundaries.
- Explicit commit / rollback — no autocommit.
"""
from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from shared.logging import get_logger

logger = get_logger(__name__)


class Base(DeclarativeBase):
    """Declarative base for all Velontri ORM models."""


def utc_now() -> datetime:
    """Timezone-aware UTC timestamp for ORM column defaults."""
    return datetime.now(timezone.utc)


def create_engine(
    database_url: str,
    pool_size: int = 10,
    max_overflow: int = 20,
    pool_timeout: int = 30,
    echo: bool = False,
) -> AsyncEngine:
    """
    Create a configured async SQLAlchemy engine.

    :param database_url: asyncpg DSN — must start with postgresql+asyncpg:// or sqlite+aiosqlite://
    :param pool_size: number of persistent connections in the pool
    :param max_overflow: additional connections beyond pool_size allowed
    :param pool_timeout: seconds to wait for a connection before raising
    :param echo: if True, log all SQL statements (development only)
    """
    if not (database_url.startswith("postgresql+asyncpg://") or database_url.startswith("sqlite+aiosqlite://")):
        raise ValueError(
            "DATABASE_URL must use the asyncpg driver (postgresql+asyncpg://...) or aiosqlite (sqlite+aiosqlite://...)"
        )

    # Build engine kwargs based on database type
    engine_kwargs = {
        "pool_pre_ping": True,
        "echo": echo,
        "future": True,
    }

    # Only add pool settings for PostgreSQL (SQLite doesn't use connection pooling)
    if database_url.startswith("postgresql+asyncpg://"):
        engine_kwargs.update({
            "pool_size": pool_size,
            "max_overflow": max_overflow,
            "pool_timeout": pool_timeout,
        })

    engine = create_async_engine(database_url, **engine_kwargs)

    # Only set search_path for PostgreSQL
    if database_url.startswith("postgresql+asyncpg://"):
        @event.listens_for(engine.sync_engine, "connect")
        def set_search_path(dbapi_conn: Any, _conn_record: Any) -> None:  # noqa: ANN401
            # Ensure every connection uses the public schema by default.
            # This prevents accidental cross-schema data access.
            dbapi_conn.execute("SET search_path TO public")

    return engine


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """
    Return a session factory bound to *engine*.
    Use this to create request-scoped sessions.
    """
    return async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


@asynccontextmanager
async def get_session(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncGenerator[AsyncSession, None]:
    """
    Async context manager that yields a database session.

    Automatically commits on clean exit and rolls back on any exception.
    Always closes the session in the finally block.

    Usage::

        async with get_session(session_factory) as session:
            result = await session.execute(...)
    """
    session: AsyncSession = session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def check_database_health(engine: AsyncEngine) -> bool:
    """
    Execute a lightweight query to verify the database is reachable.
    Returns True on success, False on any error.
    Used by /health endpoints.
    """
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception:
        logger.warning("database_health_check_failed", exc_info=True)
        return False


async def dispose_engine(engine: AsyncEngine) -> None:
    """
    Cleanly dispose of all connection pool resources.
    Call during application shutdown.
    """
    await engine.dispose()
    logger.info("database_engine_disposed")
