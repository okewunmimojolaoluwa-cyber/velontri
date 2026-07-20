"""Analytics Service RabbitMQ consumers."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from shared.logging import get_logger

logger = get_logger(__name__)


async def handle_order_completed(payload: dict[str, Any], session_factory: Any) -> None:
    from .repository import record_order
    from shared.database import get_session
    try:
        order_id = uuid.UUID(payload["order_id"])
        seller_id = uuid.UUID(payload["seller_id"])
        buyer_id = uuid.UUID(payload["buyer_id"])
        amount = Decimal(str(payload.get("amount", "0")))
        currency = payload.get("currency", "NGN")
        branch_id = uuid.UUID(payload["branch_id"]) if payload.get("branch_id") else None
        business_id = uuid.UUID(payload["business_id"]) if payload.get("business_id") else None
        listing_id = uuid.UUID(payload["listing_id"]) if payload.get("listing_id") else None
        category = payload.get("category")
        order_date = datetime.now(tz=timezone.utc)
        async with get_session(session_factory) as session:
            await record_order(session, order_id, seller_id, buyer_id, branch_id, business_id, listing_id, amount, currency, category, order_date)
        logger.info("order_fact_recorded", order_id=str(order_id))
    except Exception:
        logger.error("handle_order_completed_failed", exc_info=True)
        raise
