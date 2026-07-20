"""Payment Service router — uses Authorization: Bearer JWT."""
from __future__ import annotations

import uuid
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from shared.auth import get_user_payload, require_roles
from shared.errors import ForbiddenError, SuccessResponse

from ..config import PaymentSettings, get_settings
from ..schemas import (
    ConfirmDeliveryRequest,
    InitiatePaymentRequest,
    RaiseDisputeRequest,
    ResolveDisputeRequest,
)
from ..service import PaymentService

router = APIRouter(tags=["Payments"])


def _settings() -> PaymentSettings:
    return get_settings()


async def get_db_session(request: Request) -> AsyncGenerator[AsyncSession, None]:
    session = request.app.state.session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def _svc(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    request: Request,
    settings: Annotated[PaymentSettings, Depends(_settings)],
) -> PaymentService:
    return PaymentService(
        session=session,
        redis=request.app.state.redis,
        settings=settings,
        rabbitmq_channel=request.app.state.rabbitmq_channel,
    )


@router.post(
    "/payments/initiate",
    response_model=SuccessResponse,
    status_code=201,
    summary="Initiate an escrow payment for an order",
)
async def initiate_payment(
    body: InitiatePaymentRequest,
    svc: Annotated[PaymentService, Depends(_svc)],
    payload: Annotated[dict, Depends(get_user_payload)],
) -> SuccessResponse:
    result = await svc.initiate_payment(
        order_id=body.order_id,
        buyer_id=body.buyer_id,
        seller_id=body.seller_id,
        amount=body.amount,
        currency=body.currency,
        gateway_override=body.gateway,
        seller_tier=body.seller_tier,
        buyer_email=str(body.buyer_email),
    )
    return SuccessResponse(
        message="Payment initiated. Funds held in escrow.",
        data=result,
    )


@router.post(
    "/payments/webhook/{gateway}",
    response_model=SuccessResponse,
    summary="Receive payment gateway webhook (HMAC-verified)",
    include_in_schema=False,
)
async def gateway_webhook(
    gateway: str,
    request: Request,
    svc: Annotated[PaymentService, Depends(_svc)],
) -> SuccessResponse:
    body_bytes = await request.body()
    signature = (
        request.headers.get("X-Signature", "")
        or request.headers.get("x-paystack-signature", "")
        or request.headers.get("verif-hash", "")
    )
    await svc.handle_gateway_webhook(gateway, body_bytes, signature)
    return SuccessResponse(message="Webhook received.", data={"received": True})


@router.post(
    "/payments/{payment_id}/confirm-delivery",
    response_model=SuccessResponse,
    summary="Buyer confirms delivery — releases escrow to seller",
)
async def confirm_delivery(
    payment_id: uuid.UUID,
    svc: Annotated[PaymentService, Depends(_svc)],
    payload: Annotated[dict, Depends(get_user_payload)],
) -> SuccessResponse:
    buyer_id = uuid.UUID(payload["sub"])
    await svc.confirm_delivery(payment_id, buyer_id)
    return SuccessResponse(
        message="Delivery confirmed. Funds released to seller.",
        data={"payment_id": str(payment_id)},
    )


@router.post(
    "/payments/{payment_id}/dispute",
    response_model=SuccessResponse,
    status_code=201,
    summary="Raise a dispute — freezes escrow funds",
)
async def raise_dispute(
    payment_id: uuid.UUID,
    body: RaiseDisputeRequest,
    svc: Annotated[PaymentService, Depends(_svc)],
    payload: Annotated[dict, Depends(get_user_payload)],
) -> SuccessResponse:
    buyer_id = uuid.UUID(payload["sub"])
    await svc.raise_dispute(payment_id, buyer_id, body.reason)
    return SuccessResponse(
        message="Dispute raised. Funds frozen pending resolution.",
        data={"payment_id": str(payment_id)},
    )


@router.patch(
    "/disputes/{dispute_id}/resolve",
    response_model=SuccessResponse,
    summary="Resolve a dispute (admin only)",
)
async def resolve_dispute(
    dispute_id: uuid.UUID,
    body: ResolveDisputeRequest,
    svc: Annotated[PaymentService, Depends(_svc)],
    payload: Annotated[dict, Depends(get_user_payload)],
    _: None = Depends(require_roles("enterprise_admin", "ops")),
) -> SuccessResponse:
    resolver_id = uuid.UUID(payload["sub"])
    await svc.resolve_dispute(dispute_id, resolver_id, body.in_favour_of)
    return SuccessResponse(
        message=f"Dispute resolved in favour of {body.in_favour_of}.",
        data={"dispute_id": str(dispute_id), "in_favour_of": body.in_favour_of},
    )


@router.get(
    "/payments/{payment_id}",
    response_model=SuccessResponse,
    summary="Get payment status and details",
)
async def get_payment(
    payment_id: uuid.UUID,
    svc: Annotated[PaymentService, Depends(_svc)],
    payload: Annotated[dict, Depends(get_user_payload)],
) -> SuccessResponse:
    user_id = uuid.UUID(payload["sub"])
    result = await svc.get_payment(payment_id, user_id)
    return SuccessResponse(message="Payment retrieved.", data=result)
