"""Initial logistics service schema.

Revision ID: 0001
Revises:
Create Date: 2026-06-07
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # ── shipments ──────────────────────────────────────────────────────────────
    op.create_table(
        "shipments",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("order_id", UUID(as_uuid=True), nullable=False),
        sa.Column("seller_id", UUID(as_uuid=True), nullable=False),
        sa.Column("buyer_id", UUID(as_uuid=True), nullable=False),
        sa.Column("carrier", sa.String(30), nullable=False),
        sa.Column("tracking_number", sa.String(100), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="created"),
        sa.Column("origin_address", JSONB(), nullable=False),
        sa.Column("destination_address", JSONB(), nullable=False),
        sa.Column("weight_kg", sa.Numeric(8, 3), nullable=True),
        sa.Column("dimensions_cm", JSONB(), nullable=True),
        sa.Column("estimated_delivery_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("proof_asset_url", sa.Text(), nullable=True),
        sa.Column("proof_status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("carrier_tracking_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "carrier IN ('gig','dhl','fedex','local_rider')",
            name="ck_shipment_carrier",
        ),
        sa.CheckConstraint(
            "proof_status IN ('pending','collected','unavailable')",
            name="ck_shipment_proof_status",
        ),
    )
    op.create_index("ix_shipments_order_id", "shipments", ["order_id"])
    op.create_index("ix_shipments_tracking_number", "shipments", ["tracking_number"])
    op.create_index("ix_shipments_status", "shipments", ["status"])

    # ── shipment_events ────────────────────────────────────────────────────────
    op.create_table(
        "shipment_events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("shipment_id", UUID(as_uuid=True), nullable=False),
        sa.Column("carrier_status", sa.String(100), nullable=False),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("event_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("raw_payload", JSONB(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.ForeignKeyConstraint(
            ["shipment_id"], ["shipments.id"],
            name="fk_shipment_events_shipment_id", ondelete="CASCADE",
        ),
    )
    op.create_index("ix_shipment_events_shipment_id", "shipment_events", ["shipment_id"])
    op.create_index("ix_shipment_events_event_time", "shipment_events", ["event_time"])


def downgrade() -> None:
    op.drop_table("shipment_events")
    op.drop_table("shipments")
