"""Payment Service main app."""
from __future__ import annotations
import asyncio
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
from shared.rabbitmq import connect_with_backoff, consume_events, setup_infrastructure
from shared.redis_client import check_redis_health, close_redis_pool, create_redis_pool, get_redis_client
from .config import get_settings
from .routers.payments import router

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
    await mq_ch.set_qos(prefetch_count=s.RABBITMQ_PREFETCH_COUNT)
    await setup_infrastructure(mq_ch)
    app.state.rabbitmq_connection = mq_conn
    app.state.rabbitmq_channel = mq_ch

    # Consumer: shipment.updated → trigger auto-release countdown
    consumer_ch = await mq_conn.channel()
    await setup_infrastructure(consumer_ch)
    sf = app.state.session_factory

    async def _handle_shipment_updated(payload: dict) -> None:
        """Consume shipment.updated — check if delivered and start auto-release timer."""
        status = payload.get("status", "")
        if status.lower() not in ("delivered", "delivered_successfully"):
            return
        order_id = payload.get("order_id")
        if not order_id:
            return
        import uuid as _uuid
        from shared.database import get_session as _get_session
        from .repository import get_payment_by_order_id as _get_payment, update_payment_status as _update
        async with _get_session(sf) as session:
            payment = await _get_payment(session, _uuid.UUID(str(order_id)))
            if payment and payment.status == "held_in_escrow":
                # Payment already has auto_release_at set at initiation time.
                # Log that delivery has been confirmed by carrier.
                logger.info(
                    "shipment_delivered_noted",
                    order_id=order_id,
                    payment_id=str(payment.id),
                    auto_release_at=str(payment.auto_release_at),
                )

    asyncio.create_task(consume_events(consumer_ch, "payment-service.shipment.updated", ["shipment.updated"], _handle_shipment_updated))

    # Background auto-release task every 5 minutes
    async def _auto_release_loop() -> None:
        import asyncio as aio
        while True:
            await aio.sleep(300)
            try:
                from shared.database import get_session as _gs
                from .repository import get_payments_ready_for_auto_release as _get_due, update_payment_status as _upd
                from decimal import Decimal
                async with _gs(sf) as session:
                    payments = await _get_due(session)
                    for payment in payments:
                        try:
                            seller_amount = Decimal(str(payment.amount)) - Decimal(str(payment.fee_amount))
                            async with aio.timeout(10):
                                import httpx
                                async with httpx.AsyncClient(timeout=10.0) as cli:
                                    await cli.post(
                                        f"{s.WALLET_SERVICE_URL}/internal/wallet/credit",
                                        json={"user_id": str(payment.seller_id), "amount": str(seller_amount), "currency": payment.currency, "reference_id": str(payment.id), "description": f"Auto-release payment {payment.id}", "transaction_type": "credit"},
                                    )
                            await _upd(session, payment.id, "released")
                            from shared.rabbitmq import publish_event as _pub
                            await _pub(mq_ch, "order.completed", {"payment_id": str(payment.id), "order_id": str(payment.order_id), "buyer_id": str(payment.buyer_id), "seller_id": str(payment.seller_id), "amount": str(payment.amount), "released_by": "auto_release"})
                            logger.info("payment_auto_released", payment_id=str(payment.id))
                        except Exception:
                            logger.error("auto_release_failed", payment_id=str(payment.id), exc_info=True)
            except Exception:
                logger.error("auto_release_loop_error", exc_info=True)

    asyncio.create_task(_auto_release_loop())
    logger.info("payment_service_ready")
    yield
    await consumer_ch.close()
    await mq_ch.close()
    await mq_conn.close()
    await close_redis_pool(redis_pool)
    await dispose_engine(engine)


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="Velontri Payment Service", version=s.SERVICE_VERSION,
                  docs_url="/docs" if s.ENVIRONMENT != "production" else None,
                  redoc_url=None, openapi_url="/openapi.json" if s.ENVIRONMENT != "production" else None, lifespan=lifespan)
    configure_middleware(app)
    app.add_middleware(PrometheusMiddleware)
    register_error_handlers(app)
    app.include_router(router, prefix="/api/v1")
    async def _db() -> bool: return await check_database_health(app.state.engine)
    async def _redis() -> bool: return await check_redis_health(app.state.redis)
    async def _mq() -> bool:
        try: return not app.state.rabbitmq_connection.is_closed
        except Exception: return False
    app.include_router(build_health_router(s.SERVICE_NAME, s.SERVICE_VERSION, _db, _redis, _mq))
    app.add_route("/metrics", metrics_endpoint, methods=["GET"])
    return app


app = create_app()
