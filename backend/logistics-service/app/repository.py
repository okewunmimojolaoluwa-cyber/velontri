"""Logistics Service data access."""
from __future__ import annotations
import uuid
from datetime import datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Shipment, ShipmentEvent


async def create_shipment(session: AsyncSession, order_id: uuid.UUID, seller_id: uuid.UUID, buyer_id: uuid.UUID, carrier: str, tracking_number: str | None, tracking_url: str | None, origin: dict, destination: dict, weight_kg: float | None, dimensions_cm: dict | None) -> Shipment:
    s = Shipment(order_id=order_id, seller_id=seller_id, buyer_id=buyer_id, carrier=carrier, tracking_number=tracking_number, carrier_tracking_url=tracking_url, origin_address=origin, destination_address=destination, weight_kg=weight_kg, dimensions_cm=dimensions_cm, status="created", proof_status="pending")
    session.add(s)
    await session.flush()
    return s


async def get_shipment_by_tracking(session: AsyncSession, tracking_number: str) -> Shipment | None:
    result = await session.execute(select(Shipment).where(Shipment.tracking_number == tracking_number))
    return result.scalars().first()


async def update_shipment_status(session: AsyncSession, shipment_id: uuid.UUID, status: str, delivered_at: datetime | None = None, proof_url: str | None = None) -> None:
    values: dict = {"status": status}
    if delivered_at:
        values["delivered_at"] = delivered_at
    if proof_url:
        values["proof_asset_url"] = proof_url
        values["proof_status"] = "collected"
    await session.execute(update(Shipment).where(Shipment.id == shipment_id).values(**values))


async def add_shipment_event(session: AsyncSession, shipment_id: uuid.UUID, carrier_status: str, location: str | None, raw_payload: dict | None) -> ShipmentEvent:
    from datetime import timezone
    event = ShipmentEvent(shipment_id=shipment_id, carrier_status=carrier_status, location=location, event_time=datetime.now(tz=timezone.utc), raw_payload=raw_payload)
    session.add(event)
    await session.flush()
    return event
