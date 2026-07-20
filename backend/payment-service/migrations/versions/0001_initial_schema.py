"""Initial payment service schema.

Revision ID: 0001
Revises:
Create Date: 2026-06-07
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # ── payments ───────────────────────────────────────────────────────────────
    op.create_table(
        "payments",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("order_id", UUID(as_uuid=True), nullable=False),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column(
            "fee_amount",
            sa.Numeric(18, 2),
            nullable=False,
            server_default="0",
        ),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("gateway", sa.String(20), nullable=False),
        sa.Column("gateway_ref", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.String(30),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("escrow_held_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("auto_release_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivery_confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        # Constraints
        sa.UniqueConstraint("order_id", name="uq_payments_order_id"),
        sa.CheckConstraint(
            "status IN ('pending','processing','held_in_escrow','released','refunded','failed')",
            name="ck_payments_status",
        ),
        sa.CheckConstraint(
            "gateway IN ('paystack','flutterwave','mpesa','wallet')",
            name="ck_payments_gateway",
        ),
        sa.CheckConstraint(
            "amount > 0",
            name="ck_payments_amount_positive",
        ),
        sa.CheckConstraint(
            "fee_amount >= 0",
            name="ck_payments_fee_amount_nonneg",
        ),
        sa.CheckConstraint(
            "char_length(currency) = 3",
            name="ck_payments_currency_len",
        ),
    )
    op.create_index("ix_payments_order_id", "payments", ["order_id"])
    op.create_index("ix_payments_buyer_id", "payments", ["buyer_id"])
    op.create_index("ix_payments_seller_id", "payments", ["seller_id"])
    op.create_index("ix_payments_status", "payments", ["status"])
    op.create_index("ix_payments_auto_release_at", "payments", ["auto_release_at"])
    op.create_index("ix_payments_created_at", "payments", ["created_at"])

    # ── disputes ───────────────────────────────────────────────────────────────
    op.create_table(
        "disputes",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("payment_id", UUID(as_uuid=True), nullable=False),
        sa.Column("raised_by", UUID(as_uuid=True), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(30),
            nullable=False,
            server_default="open",
        ),
        sa.Column("resolved_by", UUID(as_uuid=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        # Constraints
        sa.ForeignKeyConstraint(
            ["payment_id"],
            ["payments.id"],
            name="fk_disputes_payment_id",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "status IN ('open','resolved_buyer','resolved_seller')",
            name="ck_disputes_status",
        ),
    )
    op.create_index("ix_disputes_payment_id", "disputes", ["payment_id"])
    op.create_index("ix_disputes_raised_by", "disputes", ["raised_by"])
    op.create_index("ix_disputes_status", "disputes", ["status"])
    op.create_index("ix_disputes_created_at", "disputes", ["created_at"])

    # ── fraud_scores ───────────────────────────────────────────────────────────
    op.create_table(
        "fraud_scores",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("payment_id", UUID(as_uuid=True), nullable=False),
        sa.Column("score", sa.Numeric(5, 4), nullable=True),
        sa.Column("model_version", sa.String(50), nullable=True),
        sa.Column(
            "rejected",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
        sa.Column(
            "scored_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("NOW()"),
        ),
        # Constraints
        sa.ForeignKeyConstraint(
            ["payment_id"],
            ["payments.id"],
            name="fk_fraud_scores_payment_id",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            "score >= 0 AND score <= 1",
            name="ck_fraud_scores_score_range",
        ),
    )
    op.create_index("ix_fraud_scores_payment_id", "fraud_scores", ["payment_id"])
    op.create_index("ix_fraud_scores_scored_at", "fraud_scores", ["scored_at"])
    op.create_index("ix_fraud_scores_rejected", "fraud_scores", ["rejected"])


def downgrade() -> None:
    # NOTE: Downgrade drops data. Only run in development.
    # In production, schema changes are forward-only.
    op.drop_table("fraud_scores")
    op.drop_table("disputes")
    op.drop_table("payments")
