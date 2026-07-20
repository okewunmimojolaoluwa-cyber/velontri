"""
Wallet Service RabbitMQ consumer handlers.

Each handler is a standalone async function that receives a decoded payload
dict, constructs a DB session and a WalletService instance, and delegates
all business logic to the service layer.
"""
from __future__ import annotations

from sqlalchemy.ext.asyncio import async_sessionmaker

from shared.database import get_session
from shared.logging import get_logger

from .config import WalletSettings
from .service import WalletService

logger = get_logger(__name__)


async def handle_order_completed(
    payload: dict,
    session_factory: async_sessionmaker,
    settings: WalletSettings,
) -> None:
    """
    Consumer for the ``order.completed`` routing key.

    Dispatches to WalletService.handle_order_completed which:
    - Credits seller wallet (escrow release)
    - Applies cashback to buyer wallet (if rate > 0)
    - Accumulates rewards points for buyer
    """
    order_id = payload.get("order_id", "<unknown>")
    logger.info("consumer_order_completed_received", order_id=order_id)
    try:
        async with get_session(session_factory) as session:
            svc = WalletService(session, settings)
            await svc.handle_order_completed(payload)
        logger.info("consumer_order_completed_processed", order_id=order_id)
    except Exception:
        logger.exception(
            "consumer_order_completed_error", order_id=order_id
        )
        raise


async def handle_escrow_release(
    payload: dict,
    session_factory: async_sessionmaker,
    settings: WalletSettings,
) -> None:
    """
    Consumer for the ``payment.escrow_release`` routing key.

    Credits the seller wallet when escrow is explicitly released (e.g. after
    a dispute is resolved in the seller's favour).
    """
    reference_id = payload.get("reference_id", "<unknown>")
    logger.info("consumer_escrow_release_received", reference_id=reference_id)
    try:
        async with get_session(session_factory) as session:
            svc = WalletService(session, settings)
            await svc.handle_escrow_release(payload)
        logger.info("consumer_escrow_release_processed", reference_id=reference_id)
    except Exception:
        logger.exception(
            "consumer_escrow_release_error", reference_id=reference_id
        )
        raise
