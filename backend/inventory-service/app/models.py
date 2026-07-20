"""
Inventory Service SQLAlchemy async ORM models.

Design Â§2.9 â€” StockRecord, StockTransfer, StockDamage, StockMovement.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from shared.database import Base


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


class StockRecord(Base):
    """
    Per-SKU, per-branch inventory record.

    Constraints:
    - (sku, branch_id) must be unique â€” one record per SKU per branch.
    - All quantity columns are non-negative.
    - quantity_reserved must not exceed quantity_on_hand.
    """

    __tablename__ = "stock_records"
    __table_args__ = (
        UniqueConstraint("sku", "branch_id", name="uq_stock_sku_branch"),
        CheckConstraint("quantity_on_hand >= 0", name="ck_stock_on_hand_non_neg"),
        CheckConstraint("quantity_reserved >= 0", name="ck_stock_reserved_non_neg"),
        CheckConstraint("quantity_damaged >= 0", name="ck_stock_damaged_non_neg"),
        CheckConstraint("reorder_threshold >= 0", name="ck_stock_reorder_non_neg"),
        CheckConstraint(
            "quantity_reserved <= quantity_on_hand",
            name="ck_stock_reserved_lte_on_hand",
        ),
        Index("ix_stock_records_branch_id", "branch_id"),
        Index("ix_stock_records_sku", "sku"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    branch_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    quantity_damaged: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reorder_threshold: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    barcode_s3_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    qr_code_s3_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        onupdate=_now,
        nullable=False,
    )


class StockTransfer(Base):
    """
    Record of a stock transfer between branches.

    Status lifecycle: pending â†’ confirmed | cancelled.
    """

    __tablename__ = "stock_transfers"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_transfer_quantity_positive"),
        CheckConstraint(
            "status IN ('pending', 'confirmed', 'cancelled')",
            name="ck_transfer_status_valid",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    from_branch_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False
    )
    to_branch_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    initiated_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        nullable=False,
    )


class StockDamage(Base):
    """Record of damaged stock at a branch."""

    __tablename__ = "stock_damages"
    __table_args__ = (
        CheckConstraint(
            "quantity_damaged > 0", name="ck_damage_quantity_positive"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    branch_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    quantity_damaged: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_by: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        nullable=False,
    )


class StockMovement(Base):
    """
    Append-only ledger of every quantity change for a SKU at a branch.

    movement_type is restricted to the valid set via a CHECK constraint.
    Indexed on (sku, branch_id) for history queries and on created_at for
    time-range scans.
    """

    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint(
            "movement_type IN "
            "('sale', 'transfer_out', 'transfer_in', 'damage', 'adjustment', 'initial')",
            name="ck_movement_type_valid",
        ),
        Index("ix_stock_movements_sku_branch", "sku", "branch_id"),
        Index("ix_stock_movements_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    branch_id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    movement_type: Mapped[str] = mapped_column(String(30), nullable=False)
    quantity_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_now,
        nullable=False,
    )
