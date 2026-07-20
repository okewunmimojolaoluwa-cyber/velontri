"""CRM Service router — uses Authorization: Bearer JWT."""
from __future__ import annotations

import uuid
from typing import Annotated

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query, Request

from shared.auth import get_user_id, get_user_payload
from shared.errors import NotFoundError, SuccessResponse

from ..repository import add_note, get_customer, get_customer_orders, search_customers

router = APIRouter(tags=["CRM"])


class AddNoteRequest(BaseModel):
    note: str = Field(..., max_length=1000, description="Note text (max 1000 chars)")


@router.get(
    "/crm/customers",
    response_model=SuccessResponse,
    summary="Search CRM customer records by phone or email",
)
async def search_crm(
    request: Request,
    q: str = Query(..., min_length=1, description="Search query (phone or email)"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    seller_id = uuid.UUID(payload["sub"])
    async with request.app.state.session_factory() as session:
        records = await search_customers(session, seller_id, q, page=page, page_size=page_size)
    data = [
        {
            "id": str(r.id),
            "buyer_id": str(r.buyer_id),
            "total_orders": r.total_orders,
            "total_spend": str(r.total_spend),
            "phone": r.phone,
            "email": r.email,
            "first_contact_date": r.first_contact_date.isoformat() if r.first_contact_date else None,
        }
        for r in records
    ]
    return SuccessResponse(
        message=f"{len(data)} customer(s) found.",
        data=data,
        meta={"page": page, "page_size": page_size, "count": len(data)},
    )


@router.get(
    "/crm/customers/{buyer_id}",
    response_model=SuccessResponse,
    summary="Get full customer record with purchase history",
)
async def get_crm_customer(
    buyer_id: uuid.UUID,
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    seller_id = uuid.UUID(payload["sub"])
    async with request.app.state.session_factory() as session:
        record = await get_customer(session, buyer_id, seller_id)
        if record is None:
            raise NotFoundError("Customer record not found.")
        orders = await get_customer_orders(session, record.id)
    return SuccessResponse(
        message="Customer retrieved.",
        data={
            "id": str(record.id),
            "buyer_id": str(record.buyer_id),
            "total_orders": record.total_orders,
            "total_spend": str(record.total_spend),
            "phone": record.phone,
            "email": record.email,
            "first_contact_date": record.first_contact_date.isoformat() if record.first_contact_date else None,
            "orders": [
                {
                    "order_id": str(o.order_id),
                    "amount": str(o.amount),
                    "category": o.category,
                    "order_date": o.order_date.isoformat() if o.order_date else None,
                }
                for o in orders
            ],
        },
    )


@router.post(
    "/crm/customers/{buyer_id}/notes",
    response_model=SuccessResponse,
    status_code=201,
    summary="Add a note to a customer record",
)
async def add_customer_note(
    buyer_id: uuid.UUID,
    body: AddNoteRequest,
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    seller_id = uuid.UUID(payload["sub"])
    staff_id = uuid.UUID(payload["sub"])
    async with request.app.state.session_factory() as session:
        record = await get_customer(session, buyer_id, seller_id)
        if record is None:
            raise NotFoundError("Customer not found.")
        note = await add_note(session, record.id, body.note, staff_id)
        await session.commit()
    return SuccessResponse(
        message="Note added.",
        data={
            "id": str(note.id),
            "note": note.note,
            "created_by": str(note.created_by),
            "created_at": note.created_at.isoformat(),
        },
    )
