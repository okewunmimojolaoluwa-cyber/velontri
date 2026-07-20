"""Initial CRM service schema.

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
    # ── customer_records ───────────────────────────────────────────────────────
    op.create_table(
        "customer_records",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("first_contact_date", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("total_orders", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_spend", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("phone", sa.String(20), nullable=True),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("buyer_id", "seller_id", name="uq_crm_buyer_seller"),
        sa.CheckConstraint("total_orders >= 0", name="ck_crm_total_orders_nonneg"),
        sa.CheckConstraint("total_spend >= 0", name="ck_crm_total_spend_nonneg"),
    )
    op.create_index("ix_crm_seller_id", "customer_records", ["seller_id"])
    op.create_index("ix_crm_buyer_id", "customer_records", ["buyer_id"])

    # ── customer_notes ─────────────────────────────────────────────────────────
    op.create_table(
        "customer_notes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_record_id", UUID(as_uuid=True), nullable=False),
        sa.Column("note", sa.String(1000), nullable=False),
        sa.Column("created_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(
            ["customer_record_id"], ["customer_records.id"],
            name="fk_customer_notes_record_id", ondelete="CASCADE",
        ),
    )
    op.create_index("ix_customer_notes_record_id", "customer_notes", ["customer_record_id"])

    # ── customer_orders ────────────────────────────────────────────────────────
    op.create_table(
        "customer_orders",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("customer_record_id", UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", UUID(as_uuid=True), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("order_date", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["customer_record_id"], ["customer_records.id"],
            name="fk_customer_orders_record_id", ondelete="CASCADE",
        ),
        sa.UniqueConstraint("order_id", name="uq_customer_orders_order_id"),
    )
    op.create_index("ix_customer_orders_record_id", "customer_orders", ["customer_record_id"])


def downgrade() -> None:
    op.drop_table("customer_orders")
    op.drop_table("customer_notes")
    op.drop_table("customer_records")
