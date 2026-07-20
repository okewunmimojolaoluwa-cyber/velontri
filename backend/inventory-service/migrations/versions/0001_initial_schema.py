"""Initial inventory service schema.

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
    # ── stock_records ──────────────────────────────────────────────────────────
    op.create_table(
        "stock_records",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("sku", sa.String(100), nullable=False),
        sa.Column("product_id", UUID(as_uuid=True), nullable=False),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=False),
        sa.Column(
            "quantity_on_hand",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "quantity_reserved",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "quantity_damaged",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "reorder_threshold",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("barcode_s3_key", sa.Text(), nullable=True),
        sa.Column("qr_code_s3_key", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("sku", "branch_id", name="uq_stock_sku_branch"),
        sa.CheckConstraint(
            "quantity_on_hand >= 0", name="ck_stock_on_hand_non_neg"
        ),
        sa.CheckConstraint(
            "quantity_reserved >= 0", name="ck_stock_reserved_non_neg"
        ),
        sa.CheckConstraint(
            "quantity_damaged >= 0", name="ck_stock_damaged_non_neg"
        ),
        sa.CheckConstraint(
            "reorder_threshold >= 0", name="ck_stock_reorder_non_neg"
        ),
    )
    op.create_index("ix_stock_records_branch_id", "stock_records", ["branch_id"])
    op.create_index("ix_stock_records_sku", "stock_records", ["sku"])

    # ── stock_transfers ────────────────────────────────────────────────────────
    op.create_table(
        "stock_transfers",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("sku", sa.String(100), nullable=True),
        sa.Column("from_branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("to_branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=True),
        sa.Column(
            "status",
            sa.String(20),
            nullable=True,
            server_default="pending",
        ),
        sa.Column("initiated_by", UUID(as_uuid=True), nullable=True),
        sa.Column("confirmed_by", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("quantity > 0", name="ck_transfer_quantity_positive"),
    )

    # ── stock_damages ──────────────────────────────────────────────────────────
    op.create_table(
        "stock_damages",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("sku", sa.String(100), nullable=True),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("quantity_damaged", sa.Integer(), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("recorded_by", UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "quantity_damaged > 0", name="ck_damage_quantity_positive"
        ),
    )

    # ── stock_movements ────────────────────────────────────────────────────────
    op.create_table(
        "stock_movements",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("sku", sa.String(100), nullable=True),
        sa.Column("branch_id", UUID(as_uuid=True), nullable=True),
        sa.Column("movement_type", sa.String(30), nullable=True),
        sa.Column("quantity_delta", sa.Integer(), nullable=True),
        sa.Column("quantity_after", sa.Integer(), nullable=True),
        sa.Column("reference_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "quantity_after >= 0", name="ck_movement_quantity_after_non_neg"
        ),
    )
    op.create_index(
        "ix_stock_movements_sku_branch", "stock_movements", ["sku", "branch_id"]
    )
    op.create_index(
        "ix_stock_movements_created_at", "stock_movements", ["created_at"]
    )


def downgrade() -> None:
    op.drop_table("stock_movements")
    op.drop_table("stock_damages")
    op.drop_table("stock_transfers")
    op.drop_table("stock_records")
