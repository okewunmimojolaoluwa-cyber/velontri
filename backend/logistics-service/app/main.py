"""Logistics Service main app."""
from __future__ import annotations
from contextlib import asynccontextmanager
from typing import Any
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import async_sessionmaker
from shared.database import Base, check_database_health, create_engine, dispose_engine
from shared.errors import register_error_handlers
from shared.health import build_health_router
from shared.logging import configure_logging, get_logger
from shared.metrics import PrometheusMiddleware, metrics_endpoint
from shared.middleware import configure_middleware
from shared.rabbitmq import connect_with_backoff, setup_infrastructure
from shared.redis_client import check_redis_health, close_redis_pool, create_redis_pool, get_redis_client
from .config import get_settings
from .routers.logistics import router, webhook_router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:  # type: ignore[misc]
    s = get_settings()
    configure_logging(s.SERVICE_NAME, s.SERVICE_VERSION, s.ENVIRONMENT, s.LOG_LEVEL)
    engine = create_engine(s.DATABASE_URL, s.DB_POOL_SIZE, s.DB_MAX_OVERFLOW, s.DB_POOL_TIMEOUT, s.DEBUG)
    if s.ENVIRONMENT == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    app.state.engine = engine
    app.state.session_factory = async_sessionmaker(bind=engine, autocommit=False, autoflush=False, expire_on_commit=False)
    redis_pool = create_redis_pool(s.REDIS_URL, s.REDIS_MAX_CONNECTIONS)
    app.state.redis = get_redis_client(redis_pool)
    app.state.redis_pool = redis_pool
    mq_conn = await connect_with_backoff(s.RABBITMQ_URL, s.RABBITMQ_RECONNECT_DELAY, s.RABBITMQ_RECONNECT_MAX_DELAY)
    mq_ch = await mq_conn.channel()
    await setup_infrastructure(mq_ch)
    app.state.rabbitmq_connection = mq_conn
    app.state.rabbitmq_channel = mq_ch
    logger.info("logistics_service_ready")
    yield
    await mq_ch.close()
    await mq_conn.close()
    await close_redis_pool(redis_pool)
    await dispose_engine(engine)


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Velontri Logistics Service", version=s.SERVICE_VERSION,
                  docs_url="/docs" if s.ENVIRONMENT != "production" else None,
                  redoc_url=None, openapi_url="/openapi.json" if s.ENVIRONMENT != "production" else None, lifespan=lifespan)
    configure_middleware(app)
    app.add_middleware(PrometheusMiddleware)
    register_error_handlers(app)
    app.include_router(router, prefix="/api/v1")
    app.include_router(webhook_router, prefix="/api/v1")
    async def _db() -> bool: return await check_database_health(app.state.engine)
    async def _redis() -> bool: return await check_redis_health(app.state.redis)
    async def _mq() -> bool:
        try: return not app.state.rabbitmq_connection.is_closed
        except Exception: return False
    app.include_router(build_health_router(s.SERVICE_NAME, s.SERVICE_VERSION, _db, _redis, _mq))
    app.add_route("/metrics", metrics_endpoint, methods=["GET"])
    return app


app = create_app()
