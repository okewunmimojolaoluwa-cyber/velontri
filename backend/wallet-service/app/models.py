"""
SQLAlchemy ORM models for the Wallet Service.

Tables
------
wallets              â€” one row per user; holds balance, held amount, rewards
wallet_transactions  â€” immutable ledger entries for every balance change

Non-negativity is enforced at both the application layer (repository) and the
database layer (CHECK constraints).
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
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from shared.database import Base


class Wallet(Base):
    """Per-user wallet: balance, held amount, and rewards points."""

    __tablename__ = "wallets"
    __table_args__ = (
        CheckConstraint("balance >= 0", name="ck_wallets_balance_nonneg"),
        CheckConstraint("held_balance >= 0", name="ck_wallets_held_balance_nonneg"),
        CheckConstraint("rewards_points >= 0", name="ck_wallets_rewards_points_nonneg"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        server_default="NGN",
    )
    balance: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        server_default=text("0"),
    )
    held_balance: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False,
        server_default=text("0"),
    )
    rewards_points: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default=text("0"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("NOW()"),
        onupdate=lambda: datetime.now(tz=timezone.utc),
    )

    # Relationship â€” back-reference to transactions for eager loading when needed
    transactions: Mapped[list[WalletTransaction]] = relationship(
        "WalletTransaction",
        back_populates="wallet",
        lazy="noload",
    )


class WalletTransaction(Base):
    """Immutable ledger entry for every wallet balance change."""

    __tablename__ = "wallet_transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_wallet_tx_amount_positive"),
        CheckConstraint("balance_after >= 0", name="ck_wallet_tx_balance_after_nonneg"),
        Index("ix_wallet_tx_wallet_user_id", "wallet_user_id"),
        Index("ix_wallet_tx_created_at", "created_at"),
        Index("ix_wallet_tx_reference_id", "reference_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    wallet_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("wallets.user_id", name="fk_wallet_tx_wallet_user_id"),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        comment=(
            "credit | debit | hold | release | cashback | "
            "rewards_credit | rewards_redemption | withdrawal"
        ),
    )
    amount: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False,
    )
    balance_after: Mapped[float] = mapped_column(
        Numeric(18, 2),
        nullable=False,
    )
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True,
        comment="payment_id, transfer_id, or other cross-service reference",
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="completed",
        comment="completed | processing | failed",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("NOW()"),
    )

    # Relationship back to the parent wallet
    wallet: Mapped[Wallet] = relationship(
        "Wallet",
        back_populates="transactions",
        lazy="noload",
    )
