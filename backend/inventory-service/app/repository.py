"""
Inventory Service data access layer.

All database operations live here. Service layer never constructs raw SQL.
SELECT ... FOR UPDATE is used wherever concurrent writes would otherwise
corrupt quantity fields.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from shared.errors import InvalidInputError, NotFoundError
from shared.logging import get_logger

from .models import StockDamage, StockMovement, StockRecord, StockTransfer

logger = get_logger(__name__)


# ── StockRecord ───────────────────────────────────────────────────────────────


async def create_stock_record(
    session: AsyncSession,
    sku: str,
    product_id: uuid.UUID,
    branch_id: uuid.UUID,
    quantity_on_hand: int,
    reorder_threshold: int,
    barcode_s3_key: str | None = None,
    qr_code_s3_key: str | None = None,
) -> StockRecord:
    """
    Persist a new StockRecord.

    Barcode/QR S3 keys are passed in after upload so the caller controls
    the S3 interaction (service layer) and this function stays pure DB.
    Also records an 'initial' StockMovement if quantity_on_hand > 0.
    """
    record = StockRecord(
        sku=sku,
        product_id=product_id,
        branch_id=branch_id,
        quantity_on_hand=quantity_on_hand,
        quantity_reserved=0,
        quantity_damaged=0,
        reorder_threshold=reorder_threshold,
        barcode_s3_key=barcode_s3_key,
        qr_code_s3_key=qr_code_s3_key,
        updated_at=datetime.now(tz=timezone.utc),
    )
    session.add(record)
    await session.flush()

    if quantity_on_hand > 0:
        await add_stock_movement(
            session,
            sku=sku,
            branch_id=branch_id,
            movement_type="initial",
            quantity_delta=quantity_on_hand,
            quantity_after=quantity_on_hand,
            reference_id=None,
        )

    logger.info("stock_record_created", sku=sku, branch_id=str(branch_id))
    return record


async def get_stock_record(
    session: AsyncSession,
    sku: str,
    branch_id: uuid.UUID,
) -> StockRecord | None:
    """Fetch a single StockRecord by (sku, branch_id)."""
    result = await session.execute(
        select(StockRecord).where(
            StockRecord.sku == sku,
            StockRecord.branch_id == branch_id,
        )
    )
    return result.scalars().first()


async def list_branch_stock(
    session: AsyncSession,
    branch_id: uuid.UUID,
    page: int = 1,
    page_size: int = 20,
) -> list[StockRecord]:
    """Return paginated stock records for a branch."""
    result = await session.execute(
        select(StockRecord)
        .where(StockRecord.branch_id == branch_id)
        .order_by(StockRecord.sku)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all())


async def decrement_reserved(
    session: AsyncSession,
    sku: str,
    branch_id: uuid.UUID,
    quantity: int,
) -> None:
    """
    Atomically decrement quantity_reserved.

    Uses SELECT FOR UPDATE to prevent concurrent over-decrement.
    Raises InvalidInputError if the existing reservation is insufficient.
    """
    result = await session.execute(
        select(StockRecord)
        .where(
            StockRecord.sku == sku,
            StockRecord.branch_id == branch_id,
        )
        .with_for_update()
    )
    record: StockRecord | None = result.scalars().first()

    if record is None:
        raise NotFoundError(f"Stock record not found for SKU '{sku}' at branch {branch_id}.")

    if record.quantity_reserved < quantity:
        raise InvalidInputError(
            f"Cannot release {quantity} reserved units; only "
            f"{record.quantity_reserved} are reserved for SKU '{sku}'."
        )

    record.quantity_reserved -= quantity
    record.updated_at = datetime.now(tz=timezone.utc)
    await session.flush()
    logger.debug(
        "reserved_decremented",
        sku=sku,
        branch_id=str(branch_id),
        quantity=quantity,
    )


async def atomic_transfer(
    session: AsyncSession,
    sku: str,
    from_branch_id: uuid.UUID,
    to_branch_id: uuid.UUID,
    quantity: int,
    confirmed_by: uuid.UUID,
    transfer_id: uuid.UUID | None = None,
) -> None:
    """
    Atomically move stock from one branch to another.

    Steps:
    1. SELECT FOR UPDATE on the source record.
    2. Validate source has sufficient on-hand quantity.
    3. Deduct from source, add to destination.
    4. Append StockMovement records for both branches.

    Raises InvalidInputError if source quantity_on_hand < quantity.
    """
    # Lock source record
    result = await session.execute(
        select(StockRecord)
        .where(
            StockRecord.sku == sku,
            StockRecord.branch_id == from_branch_id,
        )
        .with_for_update()
    )
    source: StockRecord | None = result.scalars().first()

    if source is None:
        raise NotFoundError(
            f"Source stock record not found for SKU '{sku}' at branch {from_branch_id}."
        )
    if source.quantity_on_hand < quantity:
        raise InvalidInputError(
            f"Insufficient stock for transfer: requested {quantity}, "
            f"available {source.quantity_on_hand} for SKU '{sku}' at branch {from_branch_id}."
        )

    # Fetch (or create) destination — no lock needed since we are adding
    dest_result = await session.execute(
        select(StockRecord).where(
            StockRecord.sku == sku,
            StockRecord.branch_id == to_branch_id,
        )
    )
    dest: StockRecord | None = dest_result.scalars().first()

    if dest is None:
        raise NotFoundError(
            f"Destination stock record not found for SKU '{sku}' at branch {to_branch_id}."
        )

    # Mutate quantities
    source.quantity_on_hand -= quantity
    source.updated_at = datetime.now(tz=timezone.utc)

    dest.quantity_on_hand += quantity
    dest.updated_at = datetime.now(tz=timezone.utc)

    await session.flush()

    # Append movement ledger entries
    await add_stock_movement(
        session,
        sku=sku,
        branch_id=from_branch_id,
        movement_type="transfer_out",
        quantity_delta=-quantity,
        quantity_after=source.quantity_on_hand,
        reference_id=transfer_id,
    )
    await add_stock_movement(
        session,
        sku=sku,
        branch_id=to_branch_id,
        movement_type="transfer_in",
        quantity_delta=quantity,
        quantity_after=dest.quantity_on_hand,
        reference_id=transfer_id,
    )

    logger.info(
        "stock_transferred",
        sku=sku,
        from_branch=str(from_branch_id),
        to_branch=str(to_branch_id),
        quantity=quantity,
    )


async def record_damage(
    session: AsyncSession,
    sku: str,
    branch_id: uuid.UUID,
    quantity_damaged: int,
    reason: str,
    recorded_by: uuid.UUID,
) -> StockDamage:
    """
    Record damaged stock.

    Uses SELECT FOR UPDATE on the stock record.
    Decrements quantity_on_hand and increments quantity_damaged.
    Appends a StockMovement of type 'damage'.
    Raises InvalidInputError if on_hand < quantity_damaged.
    """
    result = await session.execute(
        select(StockRecord)
        .where(
            StockRecord.sku == sku,
            StockRecord.branch_id == branch_id,
        )
        .with_for_update()
    )
    record: StockRecord | None = result.scalars().first()

    if record is None:
        raise NotFoundError(f"Stock record not found for SKU '{sku}' at branch {branch_id}.")

    if record.quantity_on_hand < quantity_damaged:
        raise InvalidInputError(
            f"Cannot mark {quantity_damaged} units as damaged; only "
            f"{record.quantity_on_hand} on hand for SKU '{sku}'."
        )

    record.quantity_on_hand -= quantity_damaged
    record.quantity_damaged += quantity_damaged
    record.updated_at = datetime.now(tz=timezone.utc)

    damage = StockDamage(
        sku=sku,
        branch_id=branch_id,
        quantity_damaged=quantity_damaged,
        reason=reason,
        recorded_by=recorded_by,
        created_at=datetime.now(tz=timezone.utc),
    )
    session.add(damage)
    await session.flush()

    await add_stock_movement(
        session,
        sku=sku,
        branch_id=branch_id,
        movement_type="damage",
        quantity_delta=-quantity_damaged,
        quantity_after=record.quantity_on_hand,
        reference_id=damage.id,
    )

    logger.info(
        "damage_recorded",
        sku=sku,
        branch_id=str(branch_id),
        quantity=quantity_damaged,
    )
    return damage


async def add_stock_movement(
    session: AsyncSession,
    sku: str,
    branch_id: uuid.UUID,
    movement_type: str,
    quantity_delta: int,
    quantity_after: int,
    reference_id: uuid.UUID | None,
) -> StockMovement:
    """Append an immutable stock movement record."""
    movement = StockMovement(
        sku=sku,
        branch_id=branch_id,
        movement_type=movement_type,
        quantity_delta=quantity_delta,
        quantity_after=quantity_after,
        reference_id=reference_id,
        created_at=datetime.now(tz=timezone.utc),
    )
    session.add(movement)
    await session.flush()
    return movement


async def list_stock_movements(
    session: AsyncSession,
    sku: str,
    branch_id: uuid.UUID,
    page: int = 1,
    page_size: int = 100,
) -> list[StockMovement]:
    """Return paginated movement history in ascending chronological order."""
    result = await session.execute(
        select(StockMovement)
        .where(
            StockMovement.sku == sku,
            StockMovement.branch_id == branch_id,
        )
        .order_by(StockMovement.created_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all())


# ── StockTransfer ─────────────────────────────────────────────────────────────


async def get_transfer(
    session: AsyncSession,
    transfer_id: uuid.UUID,
) -> StockTransfer | None:
    result = await session.execute(
        select(StockTransfer).where(StockTransfer.id == transfer_id)
    )
    return result.scalars().first()


async def create_transfer_record(
    session: AsyncSession,
    sku: str,
    from_branch_id: uuid.UUID,
    to_branch_id: uuid.UUID,
    quantity: int,
    initiated_by: uuid.UUID,
) -> StockTransfer:
    """Create a pending transfer record."""
    transfer = StockTransfer(
        sku=sku,
        from_branch_id=from_branch_id,
        to_branch_id=to_branch_id,
        quantity=quantity,
        status="pending",
        initiated_by=initiated_by,
        created_at=datetime.now(tz=timezone.utc),
    )
    session.add(transfer)
    await session.flush()
    logger.info(
        "transfer_created",
        transfer_id=str(transfer.id),
        sku=sku,
        quantity=quantity,
    )
    return transfer


async def update_transfer_status(
    session: AsyncSession,
    transfer_id: uuid.UUID,
    status: str,
    confirmed_by: uuid.UUID | None,
) -> None:
    """Update transfer status and set confirmed_by if provided."""
    values: dict = {"status": status}
    if confirmed_by is not None:
        values["confirmed_by"] = confirmed_by

    await session.execute(
        update(StockTransfer)
        .where(StockTransfer.id == transfer_id)
        .values(**values)
    )
    await session.flush()


# ── Branch ledger init ────────────────────────────────────────────────────────


async def init_branch_ledger(
    session: AsyncSession,
    branch_id: uuid.UUID,
) -> None:
    """
    Ensure the branch is ready for inventory operations.

    This is a no-op if any stock records already exist for this branch.
    The function logs readiness — actual stock records are created when
    products are first stocked at the branch.
    """
    result = await session.execute(
        select(StockRecord.id)
        .where(StockRecord.branch_id == branch_id)
        .limit(1)
    )
    existing = result.scalars().first()

    if existing is not None:
        logger.info("branch_ledger_already_exists", branch_id=str(branch_id))
        return

    logger.info("branch_ledger_ready", branch_id=str(branch_id))
