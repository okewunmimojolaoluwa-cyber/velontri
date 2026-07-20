"""Initial analytics service schema.

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
    # ── order_facts ────────────────────────────────────────────────────────────
    op.create_table(
        "order_facts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id", UUID(as_uuid=True), nullable=False),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("business_id", UUID(as_uuid=True), nullable=True),
        sa.Column("listing_id", UUID(as_uuid=True), nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("order_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("order_id", name="uq_order_facts_order_id"),
        sa.CheckConstraint("amount > 0", name="ck_order_facts_amount_positive"),
    )
    op.create_index("ix_order_facts_seller_id", "order_facts", ["seller_id"])
    op.create_index("ix_order_facts_branch_id", "order_facts", ["branch_id"])
    op.create_index("ix_order_facts_order_date", "order_facts", ["order_date"])
    op.create_index("ix_order_facts_buyer_id", "order_facts", ["buyer_id"])

    # ── analytics_snapshots ────────────────────────────────────────────────────
    op.create_table(
        "analytics_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("entity_type", sa.String(20), nullable=False),   # seller|branch|business
        sa.Column("entity_id", UUID(as_uuid=True), nullable=False),
        sa.Column("granularity", sa.String(10), nullable=False),   # daily|weekly|monthly
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("total_revenue", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("total_orders", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("avg_order_value", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("unique_customers", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("refreshed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("entity_type", "entity_id", "granularity", "period_start", name="uq_snapshots_entity_period"),
        sa.CheckConstraint("entity_type IN ('seller','branch','business')", name="ck_snapshots_entity_type"),
        sa.CheckConstraint("granularity IN ('daily','weekly','monthly')", name="ck_snapshots_granularity"),
    )
    op.create_index("ix_analytics_snapshots_entity_id", "analytics_snapshots", ["entity_id"])
    op.create_index("ix_analytics_snapshots_period_start", "analytics_snapshots", ["period_start"])


def downgrade() -> None:
    op.drop_table("analytics_snapshots")
    op.drop_table("order_facts")
