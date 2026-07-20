"""
Inventory Service — REST API router.

All endpoints require a valid JWT Bearer token.
Branch Managers are scoped to their assigned branch_ids from the JWT claim.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, status

from shared.errors import SuccessResponse
from shared.logging import get_logger

from ..config import InventorySettings
from ..dependencies import (
    enforce_branch_access,
    get_branch_ids_from_token,
    get_current_user_id,
    get_inventory_settings,
    get_rabbitmq_channel,
    get_user_roles,
)
from ..schemas import (
    BarcodeUrlResponse,
    ConfirmTransferRequest,
    CreateSkuRequest,
    InitiateTransferRequest,
    RecordDamageRequest,
    StockMovementResponse,
    StockResponse,
    TransferResponse,
    DamageResponse,
)
from ..service import InventoryService

logger = get_logger(__name__)

router = APIRouter(prefix="/inventory", tags=["Inventory"])


# ── Service factory ───────────────────────────────────────────────────────────

def _build_service(
    request: Request,
    channel=Depends(get_rabbitmq_channel),
    settings: InventorySettings = Depends(get_inventory_settings),
) -> InventoryService:
    return InventoryService(
        session_factory=request.app.state.session_factory,
        settings=settings,
        rabbitmq_channel=channel,
        s3_session=getattr(request.app.state, "s3_session", None),
    )


# ── Branch stock ──────────────────────────────────────────────────────────────

@router.get(
    "/{branch_id}/stock",
    response_model=SuccessResponse,
    summary="List all stock records for a branch",
)
async def list_branch_stock(
    branch_id: uuid.UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: InventoryService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    roles: list[str] = Depends(get_user_roles),
    allowed_branches: list[uuid.UUID] = Depends(get_branch_ids_from_token),
) -> SuccessResponse:
    enforce_branch_access(branch_id, roles, allowed_branches)
    records = await service.list_branch_stock(branch_id, page=page, page_size=page_size)
    return SuccessResponse(data=[r.model_dump() for r in records])


@router.get(
    "/{branch_id}/sku/{sku}",
    response_model=SuccessResponse,
    summary="Get stock detail for a specific SKU at a branch",
)
async def get_branch_sku_stock(
    branch_id: uuid.UUID,
    sku: str,
    service: InventoryService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    roles: list[str] = Depends(get_user_roles),
    allowed_branches: list[uuid.UUID] = Depends(get_branch_ids_from_token),
) -> SuccessResponse:
    enforce_branch_access(branch_id, roles, allowed_branches)
    record = await service.get_stock(branch_id=branch_id, sku=sku)
    return SuccessResponse(data=record.model_dump())


# ── SKU creation ──────────────────────────────────────────────────────────────

@router.post(
    "/sku",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new SKU with barcode and QR code generation",
)
async def create_sku(
    body: CreateSkuRequest,
    service: InventoryService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    roles: list[str] = Depends(get_user_roles),
    allowed_branches: list[uuid.UUID] = Depends(get_branch_ids_from_token),
) -> SuccessResponse:
    enforce_branch_access(body.branch_id, roles, allowed_branches)
    result = await service.create_stock(body)
    return SuccessResponse(data=result.model_dump())


# ── Transfers ─────────────────────────────────────────────────────────────────

@router.post(
    "/transfers",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Initiate a stock transfer between branches",
)
async def initiate_transfer(
    body: InitiateTransferRequest,
    service: InventoryService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    roles: list[str] = Depends(get_user_roles),
    allowed_branches: list[uuid.UUID] = Depends(get_branch_ids_from_token),
) -> SuccessResponse:
    enforce_branch_access(body.from_branch_id, roles, allowed_branches)
    transfer = await service.initiate_transfer(body, initiated_by=current_user_id)
    return SuccessResponse(
        data=TransferResponse(
            id=transfer.id,
            sku=transfer.sku,
            from_branch_id=transfer.from_branch_id,
            to_branch_id=transfer.to_branch_id,
            quantity=transfer.quantity,
            status=transfer.status,
            initiated_by=transfer.initiated_by,
            confirmed_by=transfer.confirmed_by,
            created_at=transfer.created_at,
        ).model_dump()
    )


@router.patch(
    "/transfers/{transfer_id}/confirm",
    response_model=SuccessResponse,
    summary="Confirm and execute a pending stock transfer",
)
async def confirm_transfer(
    transfer_id: uuid.UUID,
    service: InventoryService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    await service.confirm_transfer(transfer_id, confirmed_by=current_user_id)
    return SuccessResponse(data={"message": "Transfer confirmed and stock moved."})


# ── Damage recording ──────────────────────────────────────────────────────────

@router.post(
    "/damage",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Record damaged stock at a branch",
)
async def record_damage(
    body: RecordDamageRequest,
    service: InventoryService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    roles: list[str] = Depends(get_user_roles),
    allowed_branches: list[uuid.UUID] = Depends(get_branch_ids_from_token),
) -> SuccessResponse:
    enforce_branch_access(body.branch_id, roles, allowed_branches)
    damage = await service.record_damage(body, recorded_by=current_user_id)
    return SuccessResponse(
        data=DamageResponse(
            id=damage.id,
            sku=damage.sku,
            branch_id=damage.branch_id,
            quantity_damaged=damage.quantity_damaged,
            reason=damage.reason,
            recorded_by=damage.recorded_by,
            created_at=damage.created_at,
        ).model_dump()
    )


# ── Movement history ──────────────────────────────────────────────────────────

@router.get(
    "/sku/{sku}/history",
    response_model=SuccessResponse,
    summary="Get paginated stock movement history for a SKU",
)
async def get_movement_history(
    sku: str,
    branch_id: uuid.UUID = Query(..., description="Branch UUID to scope history to"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    service: InventoryService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    roles: list[str] = Depends(get_user_roles),
    allowed_branches: list[uuid.UUID] = Depends(get_branch_ids_from_token),
) -> SuccessResponse:
    enforce_branch_access(branch_id, roles, allowed_branches)
    movements = await service.list_movements(sku, branch_id, page=page, page_size=page_size)
    return SuccessResponse(data=[m.model_dump() for m in movements])


# ── Barcode / QR presigned URLs ───────────────────────────────────────────────

@router.get(
    "/sku/{sku}/barcode",
    response_model=SuccessResponse,
    summary="Get presigned S3 URLs for barcode and QR code images",
)
async def get_barcode_urls(
    sku: str,
    service: InventoryService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    urls = await service.get_barcode_urls(sku)
    return SuccessResponse(data=urls)
