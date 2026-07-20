"""Search Service main app."""
from __future__ import annotations
import asyncio
from contextlib import asynccontextmanager
from typing import Any
import httpx
from fastapi import FastAPI
from elasticsearch import AsyncElasticsearch
from shared.errors import register_error_handlers
from shared.health import build_health_router
from shared.logging import configure_logging, get_logger
from shared.metrics import PrometheusMiddleware, metrics_endpoint
from shared.middleware import configure_middleware
from shared.rabbitmq import connect_with_backoff, consume_events, setup_infrastructure
from shared.redis_client import check_redis_health, close_redis_pool, create_redis_pool, get_redis_client
from .config import get_settings
from .consumers import handle_listing_created, handle_listing_deleted, handle_listing_updated
from .index import ensure_index_exists
from .routers.search import router

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> Any:  # type: ignore[misc]
    s = get_settings()
    configure_logging(s.SERVICE_NAME, s.SERVICE_VERSION, s.ENVIRONMENT, s.LOG_LEVEL)

    # Elasticsearch
    es_client = AsyncElasticsearch(hosts=[s.ELASTICSEARCH_URL])
    await ensure_index_exists(es_client, s.ELASTICSEARCH_INDEX)
    app.state.es_client = es_client

    # Redis
    redis_pool = create_redis_pool(s.REDIS_URL, s.REDIS_MAX_CONNECTIONS)
    app.state.redis = get_redis_client(redis_pool)
    app.state.redis_pool = redis_pool

    # RabbitMQ
    mq_conn = await connect_with_backoff(s.RABBITMQ_URL, s.RABBITMQ_RECONNECT_DELAY, s.RABBITMQ_RECONNECT_MAX_DELAY)
    mq_ch = await mq_conn.channel()
    await mq_ch.set_qos(prefetch_count=s.RABBITMQ_PREFETCH_COUNT)
    await setup_infrastructure(mq_ch)
    app.state.rabbitmq_connection = mq_conn
    app.state.rabbitmq_channel = mq_ch

    http_client = httpx.AsyncClient(timeout=30.0)
    app.state.http_client = http_client

    # Consumers
    consumer_ch = await mq_conn.channel()
    await setup_infrastructure(consumer_ch)

    asyncio.create_task(consume_events(consumer_ch, "search-service.listing.created", ["listing.created"], lambda p: handle_listing_created(p, es_client, s)))
    asyncio.create_task(consume_events(consumer_ch, "search-service.listing.updated", ["listing.updated"], lambda p: handle_listing_updated(p, es_client, s)))
    asyncio.create_task(consume_events(consumer_ch, "search-service.listing.deleted", ["listing.deleted"], lambda p: handle_listing_deleted(p, es_client, s)))

    logger.info("search_service_ready")
    yield

    await consumer_ch.close()
    await mq_ch.close()
    await mq_conn.close()
    await close_redis_pool(redis_pool)
    await http_client.aclose()
    await es_client.close()


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="Velontri Search Service",
        version=s.SERVICE_VERSION,
        docs_url="/docs" if s.ENVIRONMENT != "production" else None,
        redoc_url=None,
        openapi_url="/openapi.json" if s.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )
    configure_middleware(app)
    app.add_middleware(PrometheusMiddleware)
    register_error_handlers(app)
    app.include_router(router, prefix="/api/v1")

    async def _redis() -> bool: return await check_redis_health(app.state.redis)
    async def _es() -> bool:
        try: return await app.state.es_client.ping()
        except Exception: return False
    async def _mq() -> bool:
        try: return not app.state.rabbitmq_connection.is_closed
        except Exception: return False

    app.include_router(build_health_router(s.SERVICE_NAME, s.SERVICE_VERSION, redis_check=_redis, rabbitmq_check=_mq))
    app.add_route("/metrics", metrics_endpoint, methods=["GET"])
    return app


app = create_app()
