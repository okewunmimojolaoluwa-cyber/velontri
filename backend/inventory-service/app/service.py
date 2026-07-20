"""
Inventory Service business logic layer.

Orchestrates stock records, transfers, damage reports, barcode generation,
S3 uploads, and RabbitMQ event publishing.
"""
from __future__ import annotations

import uuid
from typing import Any

import aioboto3
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from shared.database import get_session
from shared.errors import InvalidInputError, NotFoundError
from shared.logging import get_logger
from shared.rabbitmq import publish_event
from shared.s3 import S3Keys, generate_presigned_url, upload_file

from . import repository as repo
from .barcode_gen import generate_barcode_png, generate_qr_png
from .config import InventorySettings
from .models import StockDamage, StockTransfer
from .schemas import (
    CreateSkuRequest,
    InitiateTransferRequest,
    RecordDamageRequest,
    StockMovementResponse,
    StockResponse,
    StockWithPresignedUrls,
)

logger = get_logger(__name__)

_PNG_MIME = "image/png"


def _to_stock_response(record: Any) -> StockResponse:
    return StockResponse(
        id=record.id,
        sku=record.sku,
        product_id=record.product_id,
        branch_id=record.branch_id,
        quantity_on_hand=record.quantity_on_hand,
        quantity_reserved=record.quantity_reserved,
        quantity_damaged=record.quantity_damaged,
        reorder_threshold=record.reorder_threshold,
        barcode_s3_key=record.barcode_s3_key,
        qr_code_s3_key=record.qr_code_s3_key,
        updated_at=record.updated_at,
    )


def _to_movement_response(movement: Any) -> StockMovementResponse:
    return StockMovementResponse(
        id=movement.id,
        sku=movement.sku,
        branch_id=movement.branch_id,
        movement_type=movement.movement_type,
        quantity_delta=movement.quantity_delta,
        quantity_after=movement.quantity_after,
        reference_id=movement.reference_id,
        created_at=movement.created_at,
    )


class InventoryService:
    """
    Stateless service class. Each public method opens its own DB session
    via the injected session_factory.
    """

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        settings: InventorySettings,
        rabbitmq_channel: Any,
        s3_session: aioboto3.Session | None = None,
    ) -> None:
        self._session_factory = session_factory
        self._settings = settings
        self._channel = rabbitmq_channel
        self._s3_session = s3_session

    # ── SKU / Stock record ────────────────────────────────────────────────────

    async def create_stock(
        self,
        body: CreateSkuRequest,
        s3_session: aioboto3.Session | None = None,
    ) -> StockWithPresignedUrls:
        """
        Create a new stock record.

        Generates a Code128 barcode and QR code PNG, uploads both to S3,
        persists the record with the resulting S3 keys, and returns
        a response with presigned download URLs.
        """
        effective_s3 = s3_session or self._s3_session

        barcode_key: str | None = None
        qr_key: str | None = None
        barcode_url: str | None = None
        qr_url: str | None = None

        if effective_s3:
            barcode_bytes = generate_barcode_png(body.sku)
            qr_bytes = generate_qr_png(body.sku)

            barcode_key = S3Keys.barcode(body.sku)
            qr_key = S3Keys.qr_code(body.sku)

            await upload_file(
                effective_s3,
                bucket=self._settings.AWS_S3_BUCKET,
                key=barcode_key,
                content=barcode_bytes,
                content_type=_PNG_MIME,
            )
            await upload_file(
                effective_s3,
                bucket=self._settings.AWS_S3_BUCKET,
                key=qr_key,
                content=qr_bytes,
                content_type=_PNG_MIME,
            )

            barcode_url = await generate_presigned_url(
                effective_s3,
                bucket=self._settings.AWS_S3_BUCKET,
                key=barcode_key,
                ttl=3600,
            )
            qr_url = await generate_presigned_url(
                effective_s3,
                bucket=self._settings.AWS_S3_BUCKET,
                key=qr_key,
                ttl=3600,
            )

        async with get_session(self._session_factory) as session:
            record = await repo.create_stock_record(
                session,
                sku=body.sku,
                product_id=body.product_id,
                branch_id=body.branch_id,
                quantity_on_hand=body.initial_qty,
                reorder_threshold=body.reorder_threshold,
                barcode_s3_key=barcode_key,
                qr_code_s3_key=qr_key,
            )

        base = _to_stock_response(record)
        return StockWithPresignedUrls(
            **base.model_dump(),
            barcode_url=barcode_url,
            qr_url=qr_url,
        )

    async def get_stock(
        self,
        branch_id: uuid.UUID,
        sku: str,
    ) -> StockResponse:
        async with get_session(self._session_factory) as session:
            record = await repo.get_stock_record(session, sku, branch_id)
            if record is None:
                raise NotFoundError(
                    f"Stock record not found for SKU '{sku}' at branch {branch_id}."
                )
            return _to_stock_response(record)

    async def list_branch_stock(
        self,
        branch_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> list[StockResponse]:
        async with get_session(self._session_factory) as session:
            records = await repo.list_branch_stock(
                session,
                branch_id=branch_id,
                page=page,
                page_size=page_size,
            )
            return [_to_stock_response(r) for r in records]

    # ── Barcode / QR presigned URLs ───────────────────────────────────────────

    async def get_barcode_urls(
        self,
        sku: str,
    ) -> dict[str, str]:
        """Return presigned S3 URLs for the barcode and QR code images (TTL 3600s)."""
        if self._s3_session is None:
            raise InvalidInputError("S3 is not configured — cannot generate presigned URLs.")

        barcode_url = await generate_presigned_url(
            self._s3_session,
            bucket=self._settings.AWS_S3_BUCKET,
            key=S3Keys.barcode(sku),
            ttl=3600,
        )
        qr_url = await generate_presigned_url(
            self._s3_session,
            bucket=self._settings.AWS_S3_BUCKET,
            key=S3Keys.qr_code(sku),
            ttl=3600,
        )
        return {"barcode_url": barcode_url, "qr_url": qr_url}

    # ── Transfers ─────────────────────────────────────────────────────────────

    async def initiate_transfer(
        self,
        body: InitiateTransferRequest,
        initiated_by: uuid.UUID,
    ) -> StockTransfer:
        """Create a pending transfer record without moving stock."""
        async with get_session(self._session_factory) as session:
            transfer = await repo.create_transfer_record(
                session,
                sku=body.sku,
                from_branch_id=body.from_branch_id,
                to_branch_id=body.to_branch_id,
                quantity=body.quantity,
                initiated_by=initiated_by,
            )
            return transfer

    async def confirm_transfer(
        self,
        transfer_id: uuid.UUID,
        confirmed_by: uuid.UUID,
    ) -> None:
        """
        Execute the pending transfer atomically.

        Locks source and destination in consistent UUID order to prevent
        deadlocks when concurrent transfers touch the same pair of branches.
        """
        async with get_session(self._session_factory) as session:
            transfer = await repo.get_transfer(session, transfer_id)
            if transfer is None:
                raise NotFoundError(f"Transfer {transfer_id} not found.")
            if transfer.status != "pending":
                raise InvalidInputError(
                    f"Transfer {transfer_id} cannot be confirmed (status: {transfer.status})."
                )

            await repo.atomic_transfer(
                session,
                sku=transfer.sku,
                from_branch_id=transfer.from_branch_id,
                to_branch_id=transfer.to_branch_id,
                quantity=transfer.quantity,
                confirmed_by=confirmed_by,
                transfer_id=transfer_id,
            )
            await repo.update_transfer_status(
                session,
                transfer_id=transfer_id,
                status="confirmed",
                confirmed_by=confirmed_by,
            )

    # ── Damage ────────────────────────────────────────────────────────────────

    async def record_damage(
        self,
        body: RecordDamageRequest,
        recorded_by: uuid.UUID,
    ) -> StockDamage:
        """
        Record damaged stock and publish a low-stock alert if the
        on-hand quantity falls below the reorder threshold.
        """
        async with get_session(self._session_factory) as session:
            damage = await repo.record_damage(
                session,
                sku=body.sku,
                branch_id=body.branch_id,
                quantity_damaged=body.quantity_damaged,
                reason=body.reason,
                recorded_by=recorded_by,
            )
            await self._check_and_alert_low_stock(session, body.sku, body.branch_id)
            return damage

    # ── Movement history ──────────────────────────────────────────────────────

    async def list_movements(
        self,
        sku: str,
        branch_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> list[StockMovementResponse]:
        """Return paginated movement history (max 100 per page)."""
        page_size = min(page_size, 100)
        async with get_session(self._session_factory) as session:
            movements = await repo.list_stock_movements(
                session,
                sku=sku,
                branch_id=branch_id,
                page=page,
                page_size=page_size,
            )
            return [_to_movement_response(m) for m in movements]

    # ── Event handlers ────────────────────────────────────────────────────────

    async def handle_order_confirmed(
        self,
        payload: dict[str, Any],
        session_factory: async_sessionmaker[AsyncSession] | None = None,
    ) -> None:
        """
        Consume order.confirmed event.
        Decrements quantity_reserved for the ordered SKU at the branch.
        """
        sf = session_factory or self._session_factory
        sku: str | None = payload.get("sku")
        raw_branch = payload.get("branch_id")
        raw_qty = payload.get("quantity")

        if not sku or not raw_branch or not raw_qty:
            logger.warning("handle_order_confirmed_missing_fields", payload=payload)
            return

        branch_id = uuid.UUID(str(raw_branch))
        quantity = int(raw_qty)

        async with get_session(sf) as session:
            record = await repo.decrement_reserved(session, sku, branch_id, quantity)
            await self._check_and_alert_low_stock_in_session(
                session, record, sku, branch_id
            )

        logger.info(
            "order_confirmed_reserved_decremented",
            sku=sku,
            branch_id=str(branch_id),
            quantity=quantity,
        )

    async def handle_branch_created(
        self,
        payload: dict[str, Any],
        session_factory: async_sessionmaker[AsyncSession] | None = None,
    ) -> None:
        """Consume branch.created event. Initialises the branch ledger."""
        sf = session_factory or self._session_factory
        raw_branch = payload.get("branch_id")
        if not raw_branch:
            logger.warning("handle_branch_created_missing_branch_id", payload=payload)
            return

        branch_id = uuid.UUID(str(raw_branch))
        async with get_session(sf) as session:
            await repo.init_branch_ledger(session, branch_id)

        logger.info("branch_ledger_initialised", branch_id=str(branch_id))

    async def init_branch_stock(
        self,
        branch_id: uuid.UUID,
        product_ids: list[uuid.UUID],
    ) -> None:
        """
        Initialise empty stock records for a new branch (branch.created handler).

        Called for each product_id that should have a stock record at the branch.
        Existing records are not overwritten.
        """
        async with get_session(self._session_factory) as session:
            await repo.init_branch_ledger(session, branch_id)

        logger.info(
            "branch_stock_initialised",
            branch_id=str(branch_id),
            product_count=len(product_ids),
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _check_and_alert_low_stock(
        self,
        session: AsyncSession,
        sku: str,
        branch_id: uuid.UUID,
    ) -> None:
        """Fetch record and publish low-stock event if threshold breached."""
        record = await repo.get_stock_record(session, sku, branch_id)
        if record is None:
            return
        await self._check_and_alert_low_stock_in_session(session, record, sku, branch_id)

    async def _check_and_alert_low_stock_in_session(
        self,
        session: AsyncSession,  # noqa: ARG002
        record: Any,
        sku: str,
        branch_id: uuid.UUID,
    ) -> None:
        """Publish inventory.low_stock event if on_hand < reorder_threshold."""
        if record.reorder_threshold > 0 and record.quantity_on_hand < record.reorder_threshold:
            try:
                await publish_event(
                    self._channel,
                    routing_key="inventory.low_stock",
                    payload={
                        "sku": sku,
                        "branch_id": str(branch_id),
                        "quantity_on_hand": record.quantity_on_hand,
                        "reorder_threshold": record.reorder_threshold,
                    },
                )
                logger.warning(
                    "low_stock_alert_published",
                    sku=sku,
                    branch_id=str(branch_id),
                    quantity_on_hand=record.quantity_on_hand,
                    reorder_threshold=record.reorder_threshold,
                )
            except Exception:
                logger.error(
                    "low_stock_event_publish_failed",
                    sku=sku,
                    branch_id=str(branch_id),
                    exc_info=True,
                )
