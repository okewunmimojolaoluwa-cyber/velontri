"""CRM Service consumers."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from shared.logging import get_logger

logger = get_logger(__name__)


async def handle_order_completed(payload: dict[str, Any], session_factory: Any) -> None:
    from .repository import upsert_customer
    from shared.database import get_session
    try:
        buyer_id = uuid.UUID(payload["buyer_id"])
        seller_id = uuid.UUID(payload["seller_id"])
        order_id = uuid.UUID(payload["order_id"])
        amount = Decimal(str(payload.get("amount", "0")))
        branch_id = uuid.UUID(payload["branch_id"]) if payload.get("branch_id") else None
        category = payload.get("category")
        order_date = datetime.now(tz=timezone.utc)
        async with get_session(session_factory) as session:
            await upsert_customer(session, buyer_id, seller_id, branch_id, order_id, amount, category, order_date)
        logger.info("crm_updated", order_id=str(order_id))
    except Exception:
        logger.error("crm_handle_failed", exc_info=True)
        raise
