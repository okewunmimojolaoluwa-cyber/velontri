"""Initial wallet service schema.

Revision ID: 0001
Revises:
Create Date: 2026-06-07
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # ── wallets ────────────────────────────────────────────────────────────────
    op.create_table(
        "wallets",
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            primary_key=True,
        ),
        sa.Column(
            "currency",
            sa.String(3),
            nullable=False,
            server_default="NGN",
        ),
        sa.Column(
            "balance",
            sa.Numeric(18, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "held_balance",
            sa.Numeric(18, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "rewards_points",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("NOW()"),
        ),
        sa.CheckConstraint("balance >= 0", name="ck_wallets_balance_nonneg"),
        sa.CheckConstraint("held_balance >= 0", name="ck_wallets_held_balance_nonneg"),
        sa.CheckConstraint("rewards_points >= 0", name="ck_wallets_rewards_points_nonneg"),
    )

    # ── wallet_transactions ────────────────────────────────────────────────────
    op.create_table(
        "wallet_transactions",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "wallet_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("wallets.user_id", name="fk_wallet_tx_wallet_user_id"),
            nullable=False,
        ),
        sa.Column(
            "type",
            sa.String(30),
            nullable=False,
        ),
        sa.Column(
            "amount",
            sa.Numeric(18, 2),
            nullable=False,
        ),
        sa.Column(
            "balance_after",
            sa.Numeric(18, 2),
            nullable=False,
        ),
        sa.Column(
            "reference_id",
            UUID(as_uuid=True),
            nullable=True,
        ),
        sa.Column(
            "description",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "status",
            sa.String(20),
            nullable=False,
            server_default="completed",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        sa.CheckConstraint("amount > 0", name="ck_wallet_tx_amount_positive"),
        sa.CheckConstraint("balance_after >= 0", name="ck_wallet_tx_balance_after_nonneg"),
    )

    # ── Indexes ────────────────────────────────────────────────────────────────
    op.create_index(
        "ix_wallet_tx_wallet_user_id",
        "wallet_transactions",
        ["wallet_user_id"],
    )
    op.create_index(
        "ix_wallet_tx_created_at",
        "wallet_transactions",
        ["created_at"],
    )


def downgrade() -> None:
    # NOTE: Downgrade drops data. Only run in development.
    # In production, schema changes are forward-only.
    op.drop_index("ix_wallet_tx_created_at", table_name="wallet_transactions")
    op.drop_index("ix_wallet_tx_wallet_user_id", table_name="wallet_transactions")
    op.drop_table("wallet_transactions")
    op.drop_table("wallets")
