"""Pydantic request/response schemas for the Inventory Service."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


# ── Request schemas ───────────────────────────────────────────────────────────

class CreateSkuRequest(BaseModel):
    """Create a new SKU stock record with barcode generation."""
    sku: str = Field(..., min_length=1, max_length=100)
    product_id: uuid.UUID
    branch_id: uuid.UUID
    initial_qty: int = Field(default=0, ge=0, description="Initial quantity on hand")
    reorder_threshold: int = Field(default=0, ge=0)


# Keep backwards compat alias used internally
class CreateStockRequest(BaseModel):
    sku: str = Field(..., min_length=1, max_length=100)
    product_id: uuid.UUID
    branch_id: uuid.UUID
    quantity_on_hand: int = Field(default=0, ge=0)
    reorder_threshold: int = Field(default=0, ge=0)


class InitiateTransferRequest(BaseModel):
    sku: str = Field(..., min_length=1, max_length=100)
    from_branch_id: uuid.UUID
    to_branch_id: uuid.UUID
    quantity: int = Field(..., gt=0)


class ConfirmTransferRequest(BaseModel):
    """Body is empty — transfer_id comes from the path parameter."""
    pass


class RecordDamageRequest(BaseModel):
    sku: str = Field(..., min_length=1, max_length=100)
    branch_id: uuid.UUID
    quantity_damaged: int = Field(..., gt=0, alias="quantity_damaged")
    reason: str = Field(..., min_length=1, max_length=1000)

    model_config = {"populate_by_name": True}


# ── Response schemas ──────────────────────────────────────────────────────────

class StockResponse(BaseModel):
    id: uuid.UUID
    sku: str
    product_id: uuid.UUID
    branch_id: uuid.UUID
    quantity_on_hand: int
    quantity_reserved: int
    quantity_damaged: int
    reorder_threshold: int
    barcode_s3_key: str | None
    qr_code_s3_key: str | None
    updated_at: datetime

    model_config = {"from_attributes": True}


class StockWithPresignedUrls(StockResponse):
    """Stock response extended with presigned S3 download URLs."""
    barcode_url: str | None = None
    qr_url: str | None = None


class TransferResponse(BaseModel):
    id: uuid.UUID
    sku: str
    from_branch_id: uuid.UUID
    to_branch_id: uuid.UUID
    quantity: int
    status: str
    initiated_by: uuid.UUID | None
    confirmed_by: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DamageResponse(BaseModel):
    id: uuid.UUID
    sku: str
    branch_id: uuid.UUID
    quantity_damaged: int
    reason: str | None
    recorded_by: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class StockMovementResponse(BaseModel):
    id: uuid.UUID
    sku: str
    branch_id: uuid.UUID
    movement_type: str
    quantity_delta: int
    quantity_after: int
    reference_id: uuid.UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class BarcodeUrlResponse(BaseModel):
    barcode_url: str
    qr_url: str
