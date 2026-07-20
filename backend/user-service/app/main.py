"""
User Service — FastAPI application entry point.

Startup:
1. Configure logging
2. Create DB engine (dev: auto-create tables; prod: Alembic)
3. Connect Redis + RabbitMQ
4. Start RabbitMQ event consumers
5. Register routers, middleware, error handlers, health, metrics

Consumer subscriptions:
- user.registered       → create profile
- user.phone_verified   → award Bronze badge
- subscription.tier_changed → sync tier on profile
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from functools import partial
from typing import Any

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
from shared.rabbitmq import (
    connect_with_backoff,
    consume_events,
    setup_infrastructure,
)
from shared.redis_client import (
    check_redis_health,
    close_redis_pool,
    create_redis_pool,
    get_redis_client,
)

from .config import get_settings
from .consumers import (
    handle_phone_verified,
    handle_subscription_tier_changed,
    handle_user_registered,
)
from .routers.users import internal_router, router as users_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:  # type: ignore[misc]
    settings = get_settings()

    configure_logging(
        service_name=settings.SERVICE_NAME,
        service_version=settings.SERVICE_VERSION,
        environment=settings.ENVIRONMENT,
        log_level=settings.LOG_LEVEL,
    )
    logger.info("user_service_starting")

    # ── Database ──────────────────────────────────────────────────────────────
    engine = create_engine(
        database_url=settings.DATABASE_URL,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_timeout=settings.DB_POOL_TIMEOUT,
        echo=settings.DEBUG,
    )
    if settings.ENVIRONMENT == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine, autocommit=False, autoflush=False, expire_on_commit=False
    )
    app.state.engine = engine
    app.state.session_factory = session_factory

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_pool = create_redis_pool(settings.REDIS_URL, settings.REDIS_MAX_CONNECTIONS)
    app.state.redis = get_redis_client(redis_pool)
    app.state.redis_pool = redis_pool

    # ── RabbitMQ ──────────────────────────────────────────────────────────────
    mq_conn = await connect_with_backoff(
        settings.RABBITMQ_URL,
        reconnect_delay=settings.RABBITMQ_RECONNECT_DELAY,
        max_delay=settings.RABBITMQ_RECONNECT_MAX_DELAY,
    )
    mq_channel = await mq_conn.channel()
    await mq_channel.set_qos(prefetch_count=settings.RABBITMQ_PREFETCH_COUNT)
    await setup_infrastructure(mq_channel)
    app.state.rabbitmq_connection = mq_conn
    app.state.rabbitmq_channel = mq_channel

    # ── Start consumers ───────────────────────────────────────────────────────
    # Consumers run as background tasks; each gets its own channel for isolation.
    consumer_channel = await mq_conn.channel()
    await setup_infrastructure(consumer_channel)

    async def _handle_registered(payload: dict) -> None:
        await handle_user_registered(payload, session_factory)

    async def _handle_phone_verified(payload: dict) -> None:
        await handle_phone_verified(payload, session_factory)

    async def _handle_tier_changed(payload: dict) -> None:
        await handle_subscription_tier_changed(payload, session_factory)

    asyncio.create_task(
        consume_events(
            consumer_channel,
            queue_name="user-service.user.registered",
            routing_keys=["user.registered"],
            handler=_handle_registered,
        )
    )
    asyncio.create_task(
        consume_events(
            consumer_channel,
            queue_name="user-service.user.phone_verified",
            routing_keys=["user.phone_verified"],
            handler=_handle_phone_verified,
        )
    )
    asyncio.create_task(
        consume_events(
            consumer_channel,
            queue_name="user-service.subscription.tier_changed",
            routing_keys=["subscription.tier_changed"],
            handler=_handle_tier_changed,
        )
    )

    logger.info("user_service_ready")
    yield

    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("user_service_shutting_down")
    await consumer_channel.close()
    await mq_channel.close()
    await mq_conn.close()
    await close_redis_pool(redis_pool)
    await dispose_engine(engine)
    logger.info("user_service_stopped")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Velontri User Service",
        description="User profiles, trust badges, KYC, RBAC, businesses, and branches.",
        version=settings.SERVICE_VERSION,
        docs_url="/docs" if settings.ENVIRONMENT != "production" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT != "production" else None,
        openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    configure_middleware(app)
    app.add_middleware(PrometheusMiddleware)
    register_error_handlers(app)

    app.include_router(users_router, prefix="/api/v1")
    app.include_router(internal_router)

    async def _db_check() -> bool:
        return await check_database_health(app.state.engine)

    async def _redis_check() -> bool:
        return await check_redis_health(app.state.redis)

    async def _mq_check() -> bool:
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
    app.add_route("/metrics", metrics_endpoint, methods=["GET"])

    return app


app = create_app()
