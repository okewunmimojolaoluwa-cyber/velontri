"""
Pydantic request/response schemas for the Wallet Service.
All monetary amounts use Decimal for precision; never float.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field


# ── Request schemas ───────────────────────────────────────────────────────────

class TopUpRequest(BaseModel):
    amount: Annotated[Decimal, Field(gt=0, decimal_places=2)]
    currency: str = Field(default="NGN", min_length=3, max_length=3)
    payment_reference: uuid.UUID  # router uses payment_reference


class WithdrawRequest(BaseModel):
    amount: Annotated[Decimal, Field(gt=0, decimal_places=2)]
    bank_code: str = Field(default="", description="Bank/mobile money code")
    bank_account_number: str = Field(default="", description="Account number or phone")
    description: str | None = None


class TransferRequest(BaseModel):
    recipient_user_id: uuid.UUID  # service uses recipient_user_id
    amount: Annotated[Decimal, Field(gt=0, decimal_places=2)]
    description: str | None = None


class RedeemPointsRequest(BaseModel):
    points: Annotated[int, Field(gt=0)]

# Alias
RedeemRewardsRequest = RedeemPointsRequest


class CreditWalletRequest(BaseModel):
    """Internal — called by Payment Service."""
    user_id: uuid.UUID
    amount: Annotated[Decimal, Field(gt=0, decimal_places=2)]
    currency: str = Field(default="NGN", min_length=3, max_length=3)
    reference_id: uuid.UUID | None = None
    description: str | None = None
    transaction_type: str = Field(default="credit", alias="tx_type")

    model_config = {"populate_by_name": True}

# Alias
InternalCreditRequest = CreditWalletRequest


# ── Response schemas ──────────────────────────────────────────────────────────

class BalanceResponse(BaseModel):
    balance: Decimal
    held_balance: Decimal
    available_balance: Decimal
    rewards_points: int
    currency: str
    pending_count: int = 0
    user_id: uuid.UUID | None = None


class TransactionResponse(BaseModel):
    id: uuid.UUID
    type: str
    amount: Decimal
    balance_after: Decimal
    reference_id: uuid.UUID | None
    description: str | None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TransferResponse(BaseModel):
    debit_transaction_id: uuid.UUID
    credit_transaction_id: uuid.UUID
    amount: Decimal
    from_user_id: uuid.UUID
    to_user_id: uuid.UUID
    status: str = "completed"
