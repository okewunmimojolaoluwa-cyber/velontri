"""
Payment Service business logic layer.

PaymentService orchestrates:
- Fraud scoring
- Gateway selection and charge
- Escrow lifecycle (hold → confirm → release)
- Dispute management
- Wallet Service integration
- RabbitMQ event publishing
- Scheduled auto-release
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

import httpx
from aio_pika.abc import AbstractChannel
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from shared.database import get_session
from shared.errors import (
    AlreadyExistsError,
    ConflictError,
    ExternalServiceError,
    ForbiddenError,
    NotFoundError,
)
from shared.logging import get_logger
from shared.rabbitmq import publish_event

from .config import PaymentSettings
from .fraud import flag_dispute_for_pair, score_transaction, update_buyer_average
from .gateways import (
    GatewayResult,
    charge_flutterwave,
    charge_mpesa,
    charge_paystack,
    get_gateway_for_currency,
)
from .models import Dispute, FraudScore, Payment
from .repository import (
    create_dispute,
    create_fraud_score,
    create_payment,
    get_dispute_by_id,
    get_dispute_by_payment,
    get_payment_by_id,
    get_payment_by_order_id,
    get_payments_ready_for_auto_release,
    resolve_dispute,
    update_payment_status,
)

logger = get_logger(__name__)

_WALLET_CREDIT_TIMEOUT = 10.0  # seconds


class PaymentService:
    """
    Orchestrates the complete payment lifecycle for Velontri.

    Must be constructed with an open AsyncSession; the session is committed/
    rolled back by the calling context (FastAPI dependency or background task).
    """

    def __init__(
        self,
        session: AsyncSession,
        redis: Redis,
        settings: PaymentSettings,
        rabbitmq_channel: AbstractChannel,
    ) -> None:
        self._session = session
        self._redis = redis
        self._settings = settings
        self._channel = rabbitmq_channel

    # ── Initiate payment ──────────────────────────────────────────────────────

    async def initiate_payment(
        self,
        order_id: uuid.UUID,
        buyer_id: uuid.UUID,
        seller_id: uuid.UUID,
        amount: Decimal,
        currency: str,
        gateway_override: str | None,
        seller_tier: str,
        buyer_email: str,
    ) -> dict[str, Any]:
        """
        Initiate an escrow payment for an order.

        Steps:
        1. Idempotency check — return existing record if order_id already exists
        2. Fraud score — reject if score > threshold
        3. Determine gateway (override or currency-based routing)
        4. Call gateway charge endpoint
        5. On success: create payment with held_in_escrow, publish order.confirmed
        6. On failure: create payment with failed status, raise ExternalServiceError
        """
        # 1. Idempotency: check for duplicate order_id
        existing = await get_payment_by_order_id(self._session, order_id)
        if existing:
            if existing.status in ("held_in_escrow", "released", "processing"):
                raise AlreadyExistsError(
                    f"Payment for order {order_id} already exists with "
                    f"status={existing.status}"
                )
            # Allow retry for failed payments
            if existing.status != "failed":
                raise AlreadyExistsError(
                    f"Payment for order {order_id} already exists"
                )

        # 2. Fraud scoring
        fraud_score, model_version = await score_transaction(
            amount=amount,
            currency=currency,
            buyer_id=str(buyer_id),
            seller_id=str(seller_id),
            redis=self._redis,
        )

        if fraud_score > self._settings.FRAUD_SCORE_THRESHOLD:
            # Persist a fraud-rejected record (without a full payment row)
            # We need a payment ID to attach the fraud score, so create a
            # failed payment first.
            rejected_payment = await create_payment(
                session=self._session,
                order_id=order_id,
                buyer_id=buyer_id,
                seller_id=seller_id,
                amount=amount,
                currency=currency,
                gateway=gateway_override or get_gateway_for_currency(currency),
                seller_tier=seller_tier,
                status="failed",
            )
            await create_fraud_score(
                session=self._session,
                payment_id=rejected_payment.id,
                score=fraud_score,
                model_version=model_version,
                rejected=True,
            )
            await publish_event(
                self._channel,
                routing_key="payment.fraud_flagged",
                payload={
                    "payment_id": str(rejected_payment.id),
                    "order_id": str(order_id),
                    "buyer_id": str(buyer_id),
                    "seller_id": str(seller_id),
                    "fraud_score": fraud_score,
                    "model_version": model_version,
                },
            )
            logger.warning(
                "payment_fraud_rejected",
                order_id=str(order_id),
                buyer_id=str(buyer_id),
                score=fraud_score,
            )
            raise ForbiddenError(
                "Payment was declined due to fraud risk assessment. "
                "Please contact support if you believe this is an error."
            )

        # 3. Determine gateway
        gateway = gateway_override or get_gateway_for_currency(currency)

        # 4. Call gateway
        metadata = {
            "order_id": str(order_id),
            "buyer_id": str(buyer_id),
            "seller_id": str(seller_id),
            "seller_tier": seller_tier,
        }

        result: GatewayResult = await self._call_gateway(
            gateway=gateway,
            amount=amount,
            currency=currency,
            email=buyer_email,
            metadata=metadata,
        )

        now = datetime.now(tz=timezone.utc)
        auto_release_at = now + timedelta(hours=self._settings.ESCROW_AUTO_RELEASE_HOURS)

        if result.success:
            # 5. Create payment held in escrow
            payment = await create_payment(
                session=self._session,
                order_id=order_id,
                buyer_id=buyer_id,
                seller_id=seller_id,
                amount=amount,
                currency=currency,
                gateway=gateway,
                seller_tier=seller_tier,
                status="held_in_escrow",
                gateway_ref=result.gateway_ref,
                escrow_held_at=now,
                auto_release_at=auto_release_at,
            )

            # Persist fraud score for audit
            await create_fraud_score(
                session=self._session,
                payment_id=payment.id,
                score=fraud_score,
                model_version=model_version,
                rejected=False,
            )

            # Update buyer's rolling average for future fraud scoring
            await update_buyer_average(self._redis, str(buyer_id), amount)

            await publish_event(
                self._channel,
                routing_key="order.confirmed",
                payload={
                    "payment_id": str(payment.id),
                    "order_id": str(order_id),
                    "buyer_id": str(buyer_id),
                    "seller_id": str(seller_id),
                    "amount": str(amount),
                    "fee_amount": str(payment.fee_amount),
                    "currency": currency,
                    "gateway": gateway,
                    "gateway_ref": result.gateway_ref,
                },
            )

            logger.info(
                "payment_initiated",
                payment_id=str(payment.id),
                order_id=str(order_id),
                gateway=gateway,
                status="held_in_escrow",
            )

            return self._payment_to_dict(payment)

        else:
            # 6. Gateway failure — persist failed record
            payment = await create_payment(
                session=self._session,
                order_id=order_id,
                buyer_id=buyer_id,
                seller_id=seller_id,
                amount=amount,
                currency=currency,
                gateway=gateway,
                seller_tier=seller_tier,
                status="failed",
                gateway_ref=result.gateway_ref,
            )

            await create_fraud_score(
                session=self._session,
                payment_id=payment.id,
                score=fraud_score,
                model_version=model_version,
                rejected=False,
            )

            logger.warning(
                "payment_gateway_failed",
                order_id=str(order_id),
                gateway=gateway,
                error=result.error,
            )

            raise ExternalServiceError(
                f"Payment gateway ({gateway}) declined the transaction: "
                f"{result.error or 'unknown error'}"
            )

    async def _call_gateway(
        self,
        gateway: str,
        amount: Decimal,
        currency: str,
        email: str,
        metadata: dict[str, Any],
    ) -> GatewayResult:
        """Dispatch charge to the appropriate gateway client."""
        s = self._settings

        if gateway == "paystack":
            return await charge_paystack(
                amount=amount,
                currency=currency,
                email=email,
                metadata=metadata,
                secret_key=s.PAYSTACK_SECRET_KEY,
            )
        elif gateway == "flutterwave":
            return await charge_flutterwave(
                amount=amount,
                currency=currency,
                email=email,
                metadata=metadata,
                secret_key=s.FLUTTERWAVE_SECRET_KEY,
            )
        elif gateway == "mpesa":
            # For M-Pesa, we use the buyer's phone from metadata if available
            phone = metadata.get("buyer_phone", email)  # email field re-used for phone
            return await charge_mpesa(
                amount=amount,
                phone=str(phone),
                metadata=metadata,
                consumer_key=s.MPESA_CONSUMER_KEY,
                consumer_secret=s.MPESA_CONSUMER_SECRET,
            )
        elif gateway == "wallet":
            # Internal wallet payment — always succeeds if funds available
            # The Wallet Service handles fund reservation; we treat this as success
            return GatewayResult(
                success=True,
                gateway_ref=f"wallet-{uuid.uuid4()}",
            )
        else:
            return GatewayResult(
                success=False,
                error=f"Unsupported gateway: {gateway}",
            )

    # ── Webhook handler ───────────────────────────────────────────────────────

    async def handle_gateway_webhook(
        self,
        gateway: str,
        payload_bytes: bytes,
        signature: str,
    ) -> None:
        """
        Process an inbound webhook from a payment gateway.

        Steps:
        1. Verify HMAC signature (raises ForbiddenError if invalid)
        2. Parse the payload to extract gateway_ref and terminal status
        3. Find and update the matching payment
        """
        import json

        from .gateways import (
            verify_flutterwave_signature,
            verify_mpesa_signature,
            verify_paystack_signature,
        )

        s = self._settings

        # 1. Verify signature
        valid = False
        if gateway == "paystack":
            valid = verify_paystack_signature(
                payload_bytes, signature, s.PAYSTACK_SECRET_KEY
            )
        elif gateway == "flutterwave":
            valid = verify_flutterwave_signature(
                payload_bytes, signature, s.FLUTTERWAVE_SECRET_KEY
            )
        elif gateway == "mpesa":
            valid = verify_mpesa_signature(
                payload_bytes, signature, s.MPESA_CONSUMER_SECRET
            )
        else:
            raise ForbiddenError(f"Unknown gateway: {gateway}")

        if not valid:
            logger.warning(
                "webhook_signature_invalid",
                gateway=gateway,
            )
            raise ForbiddenError("Invalid webhook signature")

        # 2. Parse payload
        try:
            payload = json.loads(payload_bytes.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise ForbiddenError("Malformed webhook payload") from exc

        gateway_ref, terminal_status = self._parse_webhook_payload(
            gateway, payload
        )
        if not gateway_ref:
            logger.warning(
                "webhook_missing_ref",
                gateway=gateway,
                payload_keys=list(payload.keys()),
            )
            return

        # 3. Find payment and update status
        # Note: gateway_ref lookup — query by gateway_ref
        from sqlalchemy import select
        from .models import Payment as PaymentModel

        result = await self._session.execute(
            select(PaymentModel).where(PaymentModel.gateway_ref == gateway_ref)
        )
        payment: Payment | None = result.scalar_one_or_none()

        if not payment:
            logger.warning(
                "webhook_payment_not_found",
                gateway=gateway,
                gateway_ref=gateway_ref,
            )
            return

        # Map gateway-specific terminal status to our internal status
        new_status = self._map_webhook_status(gateway, terminal_status, payment.status)
        if new_status and new_status != payment.status:
            await update_payment_status(self._session, payment.id, new_status)
            logger.info(
                "payment_status_updated_via_webhook",
                payment_id=str(payment.id),
                old_status=payment.status,
                new_status=new_status,
                gateway=gateway,
            )

    def _parse_webhook_payload(
        self, gateway: str, payload: dict[str, Any]
    ) -> tuple[str | None, str | None]:
        """Extract (gateway_ref, terminal_status) from a gateway-specific payload."""
        if gateway == "paystack":
            data = payload.get("data", {})
            ref = data.get("reference")
            status = data.get("status")  # "success", "failed", "abandoned"
            return ref, status

        elif gateway == "flutterwave":
            data = payload.get("data", {})
            ref = str(data.get("tx_ref", ""))
            status = data.get("status")  # "successful", "failed"
            return ref, status

        elif gateway == "mpesa":
            # M-Pesa callback structure
            body = payload.get("Body", {})
            stk_cb = body.get("stkCallback", {})
            ref = stk_cb.get("CheckoutRequestID")
            result_code = stk_cb.get("ResultCode", -1)
            status = "success" if result_code == 0 else "failed"
            return ref, status

        return None, None

    def _map_webhook_status(
        self,
        gateway: str,
        gateway_status: str | None,
        current_status: str,
    ) -> str | None:
        """Map a gateway-specific status string to our internal payment status."""
        if not gateway_status:
            return None

        success_statuses = {"success", "successful", "completed", "captured"}
        failure_statuses = {"failed", "failure", "declined", "abandoned", "cancelled"}

        gs = gateway_status.lower()

        if gs in success_statuses:
            # Only transition to held_in_escrow if currently pending/processing
            if current_status in ("pending", "processing"):
                return "held_in_escrow"
        elif gs in failure_statuses:
            if current_status in ("pending", "processing"):
                return "failed"

        return None

    # ── Confirm delivery ──────────────────────────────────────────────────────

    async def confirm_delivery(
        self,
        payment_id: uuid.UUID,
        buyer_id: uuid.UUID,
    ) -> None:
        """
        Buyer confirms delivery — release escrow funds to seller.

        Steps:
        1. Load payment, verify buyer ownership and escrow status
        2. Credit seller via Wallet Service
        3. Update payment status to released
        4. Publish order.completed
        """
        payment = await get_payment_by_id(self._session, payment_id)
        if not payment:
            raise NotFoundError(f"Payment {payment_id} not found")

        if payment.buyer_id != buyer_id:
            raise ForbiddenError("Only the buyer can confirm delivery")

        if payment.status != "held_in_escrow":
            raise ConflictError(
                f"Payment {payment_id} is not in escrow "
                f"(current status: {payment.status})"
            )

        # 2. Credit seller via Wallet Service (seller receives amount - fee)
        seller_amount = Decimal(str(payment.amount)) - Decimal(str(payment.fee_amount))
        await self._credit_wallet(
            user_id=str(payment.seller_id),
            amount=seller_amount,
            currency=payment.currency,
            reference_id=str(payment.id),
            description=f"Escrow release for payment {payment.id}",
            transaction_type="credit",
        )

        # 3. Update payment
        now = datetime.now(tz=timezone.utc)
        await update_payment_status(
            self._session,
            payment_id,
            "released",
            delivery_confirmed_at=now,
        )

        # 4. Publish order.completed
        await publish_event(
            self._channel,
            routing_key="order.completed",
            payload={
                "payment_id": str(payment.id),
                "order_id": str(payment.order_id),
                "buyer_id": str(payment.buyer_id),
                "seller_id": str(payment.seller_id),
                "amount": str(payment.amount),
                "fee_amount": str(payment.fee_amount),
                "currency": payment.currency,
                "released_at": now.isoformat(),
            },
        )

        logger.info(
            "payment_released_via_delivery_confirmation",
            payment_id=str(payment_id),
            seller_id=str(payment.seller_id),
            seller_amount=float(seller_amount),
        )

    # ── Raise dispute ─────────────────────────────────────────────────────────

    async def raise_dispute(
        self,
        payment_id: uuid.UUID,
        buyer_id: uuid.UUID,
        reason: str,
    ) -> None:
        """
        Buyer raises a dispute against an escrow payment.

        Steps:
        1. Load payment, verify buyer ownership
        2. Verify payment is in escrow and dispute window is valid
        3. Check no open dispute already exists
        4. Create dispute record, freeze payment in held_in_escrow
        5. Flag buyer+seller pair in Redis for fraud scoring
        """
        payment = await get_payment_by_id(self._session, payment_id)
        if not payment:
            raise NotFoundError(f"Payment {payment_id} not found")

        if payment.buyer_id != buyer_id:
            raise ForbiddenError("Only the buyer can raise a dispute")

        if payment.status not in ("held_in_escrow", "released"):
            raise ConflictError(
                f"Cannot raise a dispute on a payment with status={payment.status}"
            )

        # Verify dispute window: within 72h of delivery confirmation or escrow hold
        now = datetime.now(tz=timezone.utc)
        if payment.status == "released":
            if payment.delivery_confirmed_at is None:
                raise ConflictError("Payment was released without delivery confirmation")
            release_time = payment.delivery_confirmed_at
            if release_time.tzinfo is None:
                release_time = release_time.replace(tzinfo=timezone.utc)
            window_end = release_time + timedelta(
                hours=self._settings.ESCROW_AUTO_RELEASE_HOURS
            )
            if now > window_end:
                from shared.errors import ErrorCode
                from shared.errors import VelontriError

                class DisputeWindowClosedError(VelontriError):
                    http_status = 409
                    error_code = ErrorCode.DISPUTE_WINDOW_CLOSED

                raise DisputeWindowClosedError(
                    "The dispute window has closed (72 hours after delivery confirmation)"
                )

        # Check for existing open dispute
        existing_dispute = await get_dispute_by_payment(self._session, payment_id)
        if existing_dispute and existing_dispute.status == "open":
            raise AlreadyExistsError(
                f"An open dispute already exists for payment {payment_id}"
            )

        # 3. Create dispute — freeze payment back to held_in_escrow if released
        await create_dispute(
            session=self._session,
            payment_id=payment_id,
            raised_by=buyer_id,
            reason=reason,
        )

        if payment.status == "released":
            await update_payment_status(
                self._session, payment_id, "held_in_escrow"
            )

        # 4. Flag buyer+seller pair for fraud scoring
        await flag_dispute_for_pair(
            self._redis,
            buyer_id=str(buyer_id),
            seller_id=str(payment.seller_id),
        )

        logger.info(
            "dispute_raised",
            payment_id=str(payment_id),
            buyer_id=str(buyer_id),
        )

    # ── Resolve dispute ───────────────────────────────────────────────────────

    async def resolve_dispute(
        self,
        dispute_id: uuid.UUID,
        resolved_by: uuid.UUID,
        in_favour_of: str,  # "buyer" or "seller"
    ) -> None:
        """
        Admin/ops resolves a dispute.

        Steps:
        1. Load dispute and associated payment
        2. Resolve dispute record
        3. Credit the winning party via Wallet Service
        4. Update payment status to released (seller wins) or refunded (buyer wins)
        5. Publish order.completed or payment.refunded
        """
        dispute = await get_dispute_by_id(self._session, dispute_id)
        if not dispute:
            raise NotFoundError(f"Dispute {dispute_id} not found")

        if dispute.status != "open":
            raise ConflictError(
                f"Dispute {dispute_id} is already resolved (status={dispute.status})"
            )

        payment = await get_payment_by_id(self._session, dispute.payment_id)
        if not payment:
            raise NotFoundError(
                f"Payment {dispute.payment_id} associated with dispute not found"
            )

        # 2. Resolve dispute record
        await resolve_dispute(
            session=self._session,
            dispute_id=dispute_id,
            resolved_by=resolved_by,
            in_favour_of=in_favour_of,
        )

        seller_amount = Decimal(str(payment.amount)) - Decimal(str(payment.fee_amount))

        if in_favour_of == "seller":
            # 3a. Credit seller
            await self._credit_wallet(
                user_id=str(payment.seller_id),
                amount=seller_amount,
                currency=payment.currency,
                reference_id=str(payment.id),
                description=f"Dispute resolved in seller's favour — payment {payment.id}",
                transaction_type="credit",
            )
            await update_payment_status(self._session, payment.id, "released")
            await publish_event(
                self._channel,
                routing_key="order.completed",
                payload={
                    "payment_id": str(payment.id),
                    "order_id": str(payment.order_id),
                    "buyer_id": str(payment.buyer_id),
                    "seller_id": str(payment.seller_id),
                    "amount": str(payment.amount),
                    "dispute_id": str(dispute_id),
                    "resolved_in_favour_of": "seller",
                },
            )
        else:
            # 3b. Refund buyer (full amount — platform keeps no fee on refund)
            await self._credit_wallet(
                user_id=str(payment.buyer_id),
                amount=Decimal(str(payment.amount)),
                currency=payment.currency,
                reference_id=str(payment.id),
                description=f"Dispute resolved in buyer's favour — refund for payment {payment.id}",
                transaction_type="refund",
            )
            await update_payment_status(self._session, payment.id, "refunded")
            await publish_event(
                self._channel,
                routing_key="payment.refunded",
                payload={
                    "payment_id": str(payment.id),
                    "order_id": str(payment.order_id),
                    "buyer_id": str(payment.buyer_id),
                    "seller_id": str(payment.seller_id),
                    "amount": str(payment.amount),
                    "dispute_id": str(dispute_id),
                    "resolved_in_favour_of": "buyer",
                },
            )

        logger.info(
            "dispute_resolved",
            dispute_id=str(dispute_id),
            in_favour_of=in_favour_of,
            payment_id=str(payment.id),
            resolved_by=str(resolved_by),
        )

    # ── Auto-release ──────────────────────────────────────────────────────────

    async def run_auto_release_check(self) -> int:
        """
        Scheduled task: release all escrow payments past their auto_release_at.

        Returns the count of payments successfully released.
        Called every 5 minutes by the APScheduler background task.
        """
        payments = await get_payments_ready_for_auto_release(self._session)
        released_count = 0

        for payment in payments:
            try:
                seller_amount = (
                    Decimal(str(payment.amount)) - Decimal(str(payment.fee_amount))
                )
                await self._credit_wallet(
                    user_id=str(payment.seller_id),
                    amount=seller_amount,
                    currency=payment.currency,
                    reference_id=str(payment.id),
                    description=(
                        f"Auto-release after {self._settings.ESCROW_AUTO_RELEASE_HOURS}h "
                        f"escrow window — payment {payment.id}"
                    ),
                    transaction_type="credit",
                )
                await update_payment_status(
                    self._session, payment.id, "released"
                )
                await publish_event(
                    self._channel,
                    routing_key="order.completed",
                    payload={
                        "payment_id": str(payment.id),
                        "order_id": str(payment.order_id),
                        "buyer_id": str(payment.buyer_id),
                        "seller_id": str(payment.seller_id),
                        "amount": str(payment.amount),
                        "fee_amount": str(payment.fee_amount),
                        "currency": payment.currency,
                        "released_by": "auto_release",
                    },
                )
                released_count += 1
                logger.info(
                    "payment_auto_released",
                    payment_id=str(payment.id),
                    seller_id=str(payment.seller_id),
                )
            except Exception as exc:
                logger.error(
                    "auto_release_failed",
                    payment_id=str(payment.id),
                    error=str(exc),
                    exc_info=True,
                )

        if released_count:
            logger.info("auto_release_batch_complete", count=released_count)

        return released_count

    # ── Get payment ───────────────────────────────────────────────────────────

    async def get_payment(
        self,
        payment_id: uuid.UUID,
        requesting_user_id: uuid.UUID,
    ) -> dict[str, Any]:
        """
        Fetch a payment by ID.
        Buyers, sellers, and admins may read their own payments.
        """
        payment = await get_payment_by_id(self._session, payment_id)
        if not payment:
            raise NotFoundError(f"Payment {payment_id} not found")

        if payment.buyer_id != requesting_user_id and payment.seller_id != requesting_user_id:
            raise ForbiddenError("You do not have access to this payment")

        return self._payment_to_dict(payment)

    # ── Wallet Service integration ────────────────────────────────────────────

    async def _credit_wallet(
        self,
        user_id: str,
        amount: Decimal,
        currency: str,
        reference_id: str,
        description: str,
        transaction_type: str,
    ) -> None:
        """
        Call the Wallet Service to credit funds to a user.

        Raises ExternalServiceError on failure.
        """
        url = f"{self._settings.WALLET_SERVICE_URL}/internal/wallet/credit"
        payload = {
            "user_id": user_id,
            "amount": str(amount),
            "currency": currency,
            "reference_id": reference_id,
            "description": description,
            "transaction_type": transaction_type,
        }

        try:
            async with httpx.AsyncClient(timeout=_WALLET_CREDIT_TIMEOUT) as client:
                response = await client.post(url, json=payload)
                if response.status_code not in (200, 201):
                    raise ExternalServiceError(
                        f"Wallet Service credit failed: HTTP {response.status_code} — "
                        f"{response.text[:200]}"
                    )
        except httpx.TimeoutException as exc:
            raise ExternalServiceError(
                "Wallet Service timed out during credit operation"
            ) from exc
        except ExternalServiceError:
            raise
        except Exception as exc:
            raise ExternalServiceError(
                f"Wallet Service unreachable: {exc}"
            ) from exc

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _payment_to_dict(payment: Payment) -> dict[str, Any]:
        return {
            "id": str(payment.id),
            "order_id": str(payment.order_id),
            "buyer_id": str(payment.buyer_id),
            "seller_id": str(payment.seller_id),
            "amount": str(payment.amount),
            "fee_amount": str(payment.fee_amount),
            "currency": payment.currency,
            "gateway": payment.gateway,
            "gateway_ref": payment.gateway_ref,
            "status": payment.status,
            "escrow_held_at": (
                payment.escrow_held_at.isoformat()
                if payment.escrow_held_at
                else None
            ),
            "auto_release_at": (
                payment.auto_release_at.isoformat()
                if payment.auto_release_at
                else None
            ),
            "delivery_confirmed_at": (
                payment.delivery_confirmed_at.isoformat()
                if payment.delivery_confirmed_at
                else None
            ),
            "created_at": (
                payment.created_at.isoformat()
                if payment.created_at
                else None
            ),
        }
