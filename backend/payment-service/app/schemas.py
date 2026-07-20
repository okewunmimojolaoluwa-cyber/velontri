"""Payment Service Pydantic schemas."""
from __future__ import annotations
import uuid
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator

VALID_CURRENCIES = {"NGN", "GHS", "KES", "ZAR", "XOF"}
VALID_GATEWAYS = {"paystack", "flutterwave", "mpesa", "wallet"}


class InitiatePaymentRequest(BaseModel):
    order_id: uuid.UUID
    buyer_id: uuid.UUID
    seller_id: uuid.UUID
    amount: Decimal = Field(..., gt=0)
    currency: str
    gateway: str | None = None
    seller_tier: str = "starter"
    buyer_email: EmailStr

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        v = v.upper()
        if v not in VALID_CURRENCIES:
            raise ValueError(f"currency must be one of {sorted(VALID_CURRENCIES)}")
        return v


class ConfirmDeliveryRequest(BaseModel):
    payment_id: uuid.UUID


class RaiseDisputeRequest(BaseModel):
    payment_id: uuid.UUID
    reason: str = Field(..., min_length=1, max_length=2000)


class ResolveDisputeRequest(BaseModel):
    dispute_id: uuid.UUID
    in_favour_of: Literal["buyer", "seller"]


class PaymentResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    buyer_id: uuid.UUID
    seller_id: uuid.UUID
    amount: Decimal
    fee_amount: Decimal
    currency: str
    gateway: str
    status: str
    created_at: str
