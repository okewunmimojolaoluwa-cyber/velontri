"""
Auth Service — FastAPI application entry point.

Startup sequence:
1. Load and validate settings
2. Configure structured logging
3. Create database engine and run Alembic migrations
4. Connect to Redis (pool)
5. Connect to RabbitMQ (with backoff)
6. Setup exchange/queue infrastructure
7. Register routers, middleware, error handlers
8. Register /health and /metrics endpoints

Shutdown sequence:
1. Close RabbitMQ connection
2. Close Redis pool
3. Dispose database engine
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

import aio_pika
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker

from shared.database import (
    Base,
    check_database_health,
    create_engine,
    create_session_factory,
    dispose_engine,
)
from shared.errors import register_error_handlers
from shared.health import build_health_router
from shared.logging import configure_logging, get_logger
from shared.metrics import PrometheusMiddleware, metrics_endpoint
from shared.middleware import configure_middleware
from shared.rabbitmq import connect_with_backoff, setup_infrastructure
from shared.redis_client import (
    check_redis_health,
    close_redis_pool,
    create_redis_pool,
    get_redis_client,
)

from .config import get_settings
from .routers.auth import router as auth_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:  # type: ignore[misc]
    """Manage application startup and shutdown."""
    settings = get_settings()

    # ── Configure logging ─────────────────────────────────────────────────────
    configure_logging(
        service_name=settings.SERVICE_NAME,
        service_version=settings.SERVICE_VERSION,
        environment=settings.ENVIRONMENT,
        log_level=settings.LOG_LEVEL,
    )
    logger.info("auth_service_starting", version=settings.SERVICE_VERSION)

    # ── Database ──────────────────────────────────────────────────────────────
    engine = create_engine(
        database_url=settings.DATABASE_URL,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        echo=settings.DEBUG,
    )
    # In development, create tables if they don't exist.
    # In production, Alembic migrations handle schema management.
    if settings.ENVIRONMENT == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    session_factory = create_session_factory(engine)
    app.state.engine = engine
    app.state.session_factory = async_sessionmaker(
        bind=engine, autocommit=False, autoflush=False, expire_on_commit=False
    )

    # ── Redis ─────────────────────────────────────────────────────────────────
    if settings.REDIS_URL:
        redis_pool = create_redis_pool(
            settings.REDIS_URL,
            max_connections=settings.REDIS_MAX_CONNECTIONS,
        )
        redis_client = get_redis_client(redis_pool)
        app.state.redis = redis_client
        app.state.redis_pool = redis_pool
    else:
        app.state.redis = None
        app.state.redis_pool = None
        logger.warning("redis_disabled", message="Redis not configured - rate limiting and caching disabled")

    # ── RabbitMQ ──────────────────────────────────────────────────────────────
    if settings.RABBITMQ_URL:
        rabbitmq_connection = await connect_with_backoff(
            settings.RABBITMQ_URL,
            reconnect_delay=settings.RABBITMQ_RECONNECT_DELAY,
            max_delay=settings.RABBITMQ_RECONNECT_MAX_DELAY,
        )
        rabbitmq_channel = await rabbitmq_connection.channel()
        await rabbitmq_channel.set_qos(
            prefetch_count=settings.RABBITMQ_PREFETCH_COUNT
        )
        await setup_infrastructure(rabbitmq_channel)
        app.state.rabbitmq_connection = rabbitmq_connection
        app.state.rabbitmq_channel = rabbitmq_channel
    else:
        app.state.rabbitmq_connection = None
        app.state.rabbitmq_channel = None
        logger.warning("rabbitmq_disabled", message="RabbitMQ not configured - event publishing disabled")

    logger.info("auth_service_ready")

    yield  # Application runs here

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("auth_service_shutting_down")
    if app.state.rabbitmq_channel:
        await app.state.rabbitmq_channel.close()
    if app.state.rabbitmq_connection:
        await app.state.rabbitmq_connection.close()
    if app.state.redis_pool:
        await close_redis_pool(app.state.redis_pool)
    await dispose_engine(engine)
    logger.info("auth_service_stopped")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Velontri Auth Service",
        description="Authentication, authorisation, JWT issuance, and 2FA for the Velontri platform.",
        version=settings.SERVICE_VERSION,
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────────────────────────
    configure_middleware(app)
    app.add_middleware(PrometheusMiddleware)

    # ── Error handlers ────────────────────────────────────────────────────────
    register_error_handlers(app)

    # ── Routes ────────────────────────────────────────────────────────────────
    app.include_router(auth_router, prefix="/api/v1")

    # ── Health endpoint ───────────────────────────────────────────────────────
    async def _db_check() -> bool:
        return await check_database_health(app.state.engine)

    async def _redis_check() -> bool:
        if app.state.redis is None:
            return True  # Redis is optional in local dev
        return await check_redis_health(app.state.redis)

    async def _mq_check() -> bool:
        if app.state.rabbitmq_connection is None:
            return True  # RabbitMQ is optional in local dev
        try:
            return not app.state.rabbitmq_connection.is_closed
        except Exception:
            return False

    health_router = build_health_router(
        service_name=settings.SERVICE_NAME,
        service_version=settings.SERVICE_VERSION,
        db_check=_db_check,
        redis_check=_redis_check,
        rabbitmq_check=_mq_check,
    )
    app.include_router(health_router)

    # ── Metrics endpoint ──────────────────────────────────────────────────────
    app.add_route("/metrics", metrics_endpoint, methods=["GET"])

    return app


app = create_app()
