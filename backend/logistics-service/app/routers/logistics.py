"""Logistics Service router."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from shared.errors import NotFoundError, SuccessResponse
from shared.jwt_utils import verify_token
from shared.rabbitmq import publish_event
from ..carriers import create_shipment_with_carrier, get_all_quotes
from ..config import LogisticsSettings, get_settings
from ..models import Shipment, ShipmentEvent
from ..repository import create_shipment, get_shipment_by_tracking, update_shipment_status, add_shipment_event

router = APIRouter(tags=["Logistics"])
webhook_router = APIRouter(prefix="/logistics/webhook", tags=["Webhooks"])


def _settings() -> LogisticsSettings:
    return get_settings()


def _user(token: str = Query(...), settings: LogisticsSettings = Depends(_settings)) -> dict:
    return verify_token(settings.JWT_PUBLIC_KEY_PATH, token)


class QuoteRequest(BaseModel):
    order_id: uuid.UUID
    origin_address: dict
    destination_address: dict
    weight_kg: float
    dimensions_cm: dict | None = None


class CreateShipmentRequest(BaseModel):
    order_id: uuid.UUID
    carrier: str
    origin_address: dict
    destination_address: dict
    weight_kg: float
    seller_id: uuid.UUID
    buyer_id: uuid.UUID


@router.post("/logistics/quote", response_model=SuccessResponse, summary="Get shipping quotes from all carriers")
async def get_quotes(body: QuoteRequest, settings: LogisticsSettings = Depends(_settings), payload: dict = Depends(_user)) -> SuccessResponse:
    quotes = await get_all_quotes(body.origin_address, body.destination_address, body.weight_kg, body.dimensions_cm, settings)
    return SuccessResponse(data=[{"carrier": q.carrier, "price": str(q.price), "currency": q.currency, "estimated_days": q.estimated_days, "available": q.available, "error": q.error} for q in quotes])


@router.post("/logistics/shipments", response_model=SuccessResponse, status_code=201, summary="Create shipment with selected carrier")
async def create_shipment_endpoint(body: CreateShipmentRequest, request: Request, settings: LogisticsSettings = Depends(_settings), payload: dict = Depends(_user)) -> SuccessResponse:
    result = await create_shipment_with_carrier(body.carrier, str(body.order_id), body.origin_address, body.destination_address, body.weight_kg, settings)
    if not result.success:
        from shared.errors import ExternalServiceError
        raise ExternalServiceError(f"Carrier shipment creation failed: {result.error}")
    async with request.app.state.session_factory() as session:
        shipment = await create_shipment(session, body.order_id, body.seller_id, body.buyer_id, body.carrier, result.tracking_number, result.carrier_tracking_url, body.origin_address, body.destination_address, body.weight_kg, body.dimensions_cm)
        await session.commit()
    return SuccessResponse(data={"shipment_id": str(shipment.id), "tracking_number": result.tracking_number, "tracking_url": result.carrier_tracking_url})


@router.get("/logistics/shipments/{tracking_number}", response_model=SuccessResponse, summary="Get shipment tracking status")
async def track_shipment(tracking_number: str, request: Request, payload: dict = Depends(_user)) -> SuccessResponse:
    async with request.app.state.session_factory() as session:
        shipment = await get_shipment_by_tracking(session, tracking_number)
        if shipment is None:
            raise NotFoundError("Shipment not found.")
    return SuccessResponse(data={"tracking_number": shipment.tracking_number, "status": shipment.status, "carrier": shipment.carrier, "carrier_tracking_url": shipment.carrier_tracking_url, "estimated_delivery_at": str(shipment.estimated_delivery_at) if shipment.estimated_delivery_at else None, "proof_status": shipment.proof_status})


@webhook_router.post("/{carrier}", summary="Receive carrier webhook")
async def carrier_webhook(carrier: str, request: Request, settings: LogisticsSettings = Depends(_settings)) -> SuccessResponse:
    payload = await request.json()
    tracking_number = payload.get("tracking_number") or payload.get("trackingNumber", "")
    new_status = payload.get("status", "in_transit")
    if not tracking_number:
        return SuccessResponse(data={"message": "No tracking number in payload"})
    async with request.app.state.session_factory() as session:
        shipment = await get_shipment_by_tracking(session, tracking_number)
        if shipment is None:
            return SuccessResponse(data={"message": "Unknown tracking number"})
        await update_shipment_status(session, shipment.id, new_status)
        await add_shipment_event(session, shipment.id, new_status, payload.get("location"), payload)
        await session.commit()
        await publish_event(request.app.state.rabbitmq_channel, "shipment.updated", {"shipment_id": str(shipment.id), "order_id": str(shipment.order_id), "tracking_number": tracking_number, "status": new_status, "carrier": carrier}, correlation_id=str(shipment.order_id))
    return SuccessResponse(data={"message": "Webhook received"})
