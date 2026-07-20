"""
Inventory Service — RabbitMQ event consumers.

Consumed events:
- order.confirmed  → decrement quantity_reserved for the ordered SKU
- branch.created   → initialise empty stock ledger for the new branch

Both handlers are thin wrappers that delegate to InventoryService methods,
providing clean separation between messaging infrastructure and business logic.
"""
from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from shared.database import get_session
from shared.logging import get_logger

from .config import InventorySettings
from . import repository as repo

logger = get_logger(__name__)


async def handle_order_confirmed(
    payload: dict[str, Any],
    session_factory: async_sessionmaker[AsyncSession],
    settings: InventorySettings,
) -> None:
    """
    Handle order.confirmed event.

    Expected payload fields:
    - sku: str
    - branch_id: UUID str
    - quantity: int
    - order_id: UUID str (used as reference_id in stock movement)

    Decrements quantity_reserved for the SKU at the given branch.
    The stock_movement of type 'sale' is appended by the repository.
    """
    sku: str | None = payload.get("sku")
    raw_branch = payload.get("branch_id")
    raw_qty = payload.get("quantity")
    raw_order = payload.get("order_id")

    if not sku or not raw_branch or not raw_qty:
        logger.warning(
            "handle_order_confirmed_missing_fields",
            sku=sku,
            branch_id=raw_branch,
            quantity=raw_qty,
        )
        return

    branch_id = uuid.UUID(str(raw_branch))
    quantity = int(raw_qty)
    order_id = uuid.UUID(str(raw_order)) if raw_order else None

    async with get_session(session_factory) as session:
        record = await repo.decrement_reserved(session, sku, branch_id, quantity)

        # Check for low stock and log — publishing is handled by the service layer
        # when called from HTTP handlers. Here we just log the state.
        if (
            record.reorder_threshold > 0
            and record.quantity_on_hand < record.reorder_threshold
        ):
            logger.warning(
                "low_stock_after_order_confirmed",
                sku=sku,
                branch_id=str(branch_id),
                quantity_on_hand=record.quantity_on_hand,
                reorder_threshold=record.reorder_threshold,
            )

    logger.info(
        "order_confirmed_processed",
        sku=sku,
        branch_id=str(branch_id),
        quantity=quantity,
        order_id=str(order_id) if order_id else None,
    )


async def handle_branch_created(
    payload: dict[str, Any],
    session_factory: async_sessionmaker[AsyncSession],
    settings: InventorySettings,
) -> None:
    """
    Handle branch.created event.

    Expected payload fields:
    - branch_id: UUID str

    Initialises the branch ledger so it's ready for stock operations.
    This is a no-op if the branch already has stock records.
    """
    raw_branch = payload.get("branch_id")

    if not raw_branch:
        logger.warning("handle_branch_created_missing_branch_id", payload=payload)
        return

    branch_id = uuid.UUID(str(raw_branch))

    async with get_session(session_factory) as session:
        await repo.init_branch_ledger(session, branch_id)

    logger.info("branch_ledger_initialised_via_consumer", branch_id=str(branch_id))
