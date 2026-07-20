"""Initial subscription service schema.

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
    # ── subscriptions ──────────────────────────────────────────────────────────
    op.create_table(
        "subscriptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tier", sa.String(20), nullable=False, server_default="starter"),
        sa.Column("pending_downgrade_tier", sa.String(20), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("user_id", name="uq_subscriptions_user_id"),
        sa.CheckConstraint(
            "tier IN ('starter','growth','pro','enterprise')",
            name="ck_sub_tier",
        ),
        sa.CheckConstraint("retry_count >= 0", name="ck_sub_retry_nonneg"),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
    op.create_index("ix_subscriptions_tier", "subscriptions", ["tier"])

    # ── invoices ───────────────────────────────────────────────────────────────
    op.create_table(
        "invoices",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), nullable=False),
        sa.Column("tier", sa.String(20), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("fx_rate", sa.Numeric(18, 6), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("payment_ref", sa.Text(), nullable=True),
        sa.Column("invoice_date", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "tier IN ('starter','growth','pro','enterprise')",
            name="ck_invoice_tier",
        ),
        sa.CheckConstraint(
            "status IN ('pending','paid','failed','void')",
            name="ck_invoice_status",
        ),
        sa.CheckConstraint("amount > 0", name="ck_invoice_amount_positive"),
    )
    op.create_index("ix_invoices_user_id", "invoices", ["user_id"])
    op.create_index("ix_invoices_status", "invoices", ["status"])


def downgrade() -> None:
    op.drop_table("invoices")
    op.drop_table("subscriptions")
