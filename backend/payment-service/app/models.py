"""
Payment Service SQLAlchemy ORM models.

Tables:
- payments      â€” core payment lifecycle with escrow support
- disputes      â€” buyer-raised dispute records
- fraud_scores  â€” fraud scoring audit trail
"""
from __future__ import annotations

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.database import Base

from datetime import timezone as _tz

def _utc_now():
    from datetime import datetime as _dt
    return _dt.now(tz=_tz.utc)


class Payment(Base):
    """Represents a single escrow payment for an order."""

    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("order_id", name="uq_payments_order_id"),
        CheckConstraint(
            "status IN ('pending','processing','held_in_escrow','released','refunded','failed')",
            name="ck_payments_status",
        ),
        CheckConstraint(
            "gateway IN ('paystack','flutterwave','mpesa','wallet')",
            name="ck_payments_gateway",
        ),
        CheckConstraint(
            "amount > 0",
            name="ck_payments_amount_positive",
        ),
        CheckConstraint(
            "fee_amount >= 0",
            name="ck_payments_fee_amount_nonneg",
        ),
        Index("ix_payments_order_id", "order_id"),
        Index("ix_payments_buyer_id", "buyer_id"),
        Index("ix_payments_seller_id", "seller_id"),
        Index("ix_payments_status", "status"),
        Index("ix_payments_auto_release_at", "auto_release_at"),
        Index("ix_payments_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
            )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    buyer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    seller_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    amount: Mapped[float] = mapped_column(
        Numeric(18, 2), nullable=False
    )
    fee_amount: Mapped[float] = mapped_column(
        Numeric(18, 2), nullable=False, server_default="0"
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False
    )
    gateway: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    gateway_ref: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default="pending"
    )
    escrow_held_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    auto_release_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    delivery_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=None,
        default=datetime.utcnow,
    )

    # Relationships
    disputes: Mapped[list["Dispute"]] = relationship(
        "Dispute", back_populates="payment", lazy="select"
    )
    fraud_scores: Mapped[list["FraudScore"]] = relationship(
        "FraudScore", back_populates="payment", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<Payment id={self.id} order_id={self.order_id} "
            f"status={self.status} amount={self.amount} {self.currency}>"
        )


class Dispute(Base):
    """Represents a buyer-initiated dispute against a payment."""

    __tablename__ = "disputes"
    __table_args__ = (
        CheckConstraint(
            "status IN ('open','resolved_buyer','resolved_seller')",
            name="ck_disputes_status",
        ),
        Index("ix_disputes_payment_id", "payment_id"),
        Index("ix_disputes_raised_by", "raised_by"),
        Index("ix_disputes_status", "status"),
        Index("ix_disputes_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
            )
    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=False,
    )
    raised_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, server_default="open"
    )
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=None,
        default=datetime.utcnow,
    )

    # Relationships
    payment: Mapped["Payment"] = relationship(
        "Payment", back_populates="disputes", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<Dispute id={self.id} payment_id={self.payment_id} "
            f"status={self.status}>"
        )


class FraudScore(Base):
    """Audit trail of ML fraud scoring for each payment attempt."""

    __tablename__ = "fraud_scores"
    __table_args__ = (
        CheckConstraint(
            "score >= 0 AND score <= 1",
            name="ck_fraud_scores_score_range",
        ),
        Index("ix_fraud_scores_payment_id", "payment_id"),
        Index("ix_fraud_scores_scored_at", "scored_at"),
        Index("ix_fraud_scores_rejected", "rejected"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
            )
    payment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payments.id", ondelete="CASCADE"),
        nullable=False,
    )
    score: Mapped[float | None] = mapped_column(
        Numeric(5, 4), nullable=True
    )
    model_version: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    rejected: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    scored_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=None,
        default=datetime.utcnow,
    )

    # Relationships
    payment: Mapped["Payment"] = relationship(
        "Payment", back_populates="fraud_scores", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<FraudScore id={self.id} payment_id={self.payment_id} "
            f"score={self.score} rejected={self.rejected}>"
        )
