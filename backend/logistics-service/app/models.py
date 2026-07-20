"""Logistics Service ORM models."""
from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import CheckConstraint, DateTime, Index, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from shared.database import Base

from datetime import timezone as _tz

def _utc_now():
    from datetime import datetime as _dt
    return _dt.now(tz=_tz.utc)


class Shipment(Base):
    __tablename__ = "shipments"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    seller_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    buyer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    carrier: Mapped[str] = mapped_column(String(30), nullable=False)  # gig|dhl|fedex|local_rider
    tracking_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="created")
    origin_address: Mapped[dict] = mapped_column(JSONB, nullable=False)
    destination_address: Mapped[dict] = mapped_column(JSONB, nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(8, 3), nullable=True)
    dimensions_cm: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    estimated_delivery_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    proof_asset_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    proof_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    carrier_tracking_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    __table_args__ = (
        CheckConstraint("carrier IN ('gig','dhl','fedex','local_rider')", name="ck_shipment_carrier"),
        Index("ix_shipments_order_id", "order_id"),
        Index("ix_shipments_tracking_number", "tracking_number"),
    )


class ShipmentEvent(Base):
    __tablename__ = "shipment_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shipment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    carrier_status: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    event_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    raw_payload: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utc_now)
    __table_args__ = (Index("ix_shipment_events_shipment_id", "shipment_id"),)
