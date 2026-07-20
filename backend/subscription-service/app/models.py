"""Subscription Service ORM models."""
from __future__ import annotations
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Boolean, CheckConstraint, DateTime, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from shared.database import Base

from datetime import timezone as _tz

def _utc_now():
    from datetime import datetime as _dt
    return _dt.now(tz=_tz.utc)

VALID_TIERS = ("starter", "growth", "pro", "enterprise")

# Feature entitlements per tier â€” seeded at startup
TIER_ENTITLEMENTS: dict[str, dict] = {
    "starter":    {"listing_quota": 10,  "analytics_retention_days": 30,  "ai_bi": False, "multi_branch": False, "custom_domain": False, "tour_360": False, "transaction_fee_rate": 0.025, "cashback_rate": 0.00},
    "growth":     {"listing_quota": 100, "analytics_retention_days": 90,  "ai_bi": False, "multi_branch": True,  "custom_domain": False, "tour_360": False, "transaction_fee_rate": 0.020, "cashback_rate": 0.01},
    "pro":        {"listing_quota": 0,   "analytics_retention_days": 365, "ai_bi": True,  "multi_branch": True,  "custom_domain": True,  "tour_360": True,  "transaction_fee_rate": 0.015, "cashback_rate": 0.02},
    "enterprise": {"listing_quota": 0,   "analytics_retention_days": 730, "ai_bi": True,  "multi_branch": True,  "custom_domain": True,  "tour_360": True,  "transaction_fee_rate": 0.010, "cashback_rate": 0.03},
}


class Subscription(Base):
    __tablename__ = "subscriptions"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, unique=True)
    tier: Mapped[str] = mapped_column(String(20), nullable=False, default="starter")
    pending_downgrade_tier: Mapped[str | None] = mapped_column(String(20), nullable=True)
    current_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    retry_count: Mapped[int] = mapped_column(nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now, onupdate=_utc_now)
    __table_args__ = (
        CheckConstraint("tier IN ('starter','growth','pro','enterprise')", name="ck_sub_tier"),
        Index("ix_subscriptions_user_id", "user_id"),
    )


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    tier: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    fx_rate: Mapped[Decimal | None] = mapped_column(Numeric(18, 6), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    payment_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    invoice_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    __table_args__ = (Index("ix_invoices_user_id", "user_id"),)
