"""
Payment Service data access layer.

All functions accept an AsyncSession and return ORM objects.
No business logic lives here — only SQL operations.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Dispute, FraudScore, Payment


# ── Fee rate mapping by seller tier ──────────────────────────────────────────

_FEE_RATES: dict[str, Decimal] = {
    "starter": Decimal("0.025"),
    "growth": Decimal("0.020"),
    "pro": Decimal("0.015"),
    "enterprise": Decimal("0.010"),
}


def _calculate_fee(amount: Decimal, seller_tier: str) -> Decimal:
    """Return the platform fee for the given amount and seller tier."""
    rate = _FEE_RATES.get(seller_tier.lower(), _FEE_RATES["starter"])
    # Round to 2 decimal places using banker's rounding
    return (amount * rate).quantize(Decimal("0.01"))


# ── Payment CRUD ──────────────────────────────────────────────────────────────

async def create_payment(
    session: AsyncSession,
    order_id: uuid.UUID,
    buyer_id: uuid.UUID,
    seller_id: uuid.UUID,
    amount: Decimal,
    currency: str,
    gateway: str,
    seller_tier: str,
    status: str = "pending",
    gateway_ref: str | None = None,
    escrow_held_at: datetime | None = None,
    auto_release_at: datetime | None = None,
) -> Payment:
    """
    Persist a new Payment record.

    Fee amount is automatically computed from seller_tier.
    """
    fee_amount = _calculate_fee(amount, seller_tier)

    payment = Payment(
        order_id=order_id,
        buyer_id=buyer_id,
        seller_id=seller_id,
        amount=amount,
        fee_amount=fee_amount,
        currency=currency.upper(),
        gateway=gateway,
        gateway_ref=gateway_ref,
        status=status,
        escrow_held_at=escrow_held_at,
        auto_release_at=auto_release_at,
    )
    session.add(payment)
    await session.flush()  # populate PK without committing
    return payment


async def get_payment_by_id(
    session: AsyncSession,
    payment_id: uuid.UUID,
) -> Payment | None:
    """Fetch a single payment by its primary key."""
    result = await session.execute(
        select(Payment).where(Payment.id == payment_id)
    )
    return result.scalar_one_or_none()


async def get_payment_by_order_id(
    session: AsyncSession,
    order_id: uuid.UUID,
) -> Payment | None:
    """Fetch a payment by its associated order ID (idempotency check)."""
    result = await session.execute(
        select(Payment).where(Payment.order_id == order_id)
    )
    return result.scalar_one_or_none()


async def update_payment_status(
    session: AsyncSession,
    payment_id: uuid.UUID,
    status: str,
    **kwargs: object,
) -> None:
    """
    Update the status of an existing payment.

    Additional keyword arguments are applied as column updates, e.g.:
        gateway_ref="ref_123"
        delivery_confirmed_at=datetime.utcnow()
        escrow_held_at=datetime.utcnow()
        auto_release_at=datetime.utcnow() + timedelta(hours=72)
    """
    values: dict[str, object] = {"status": status, **kwargs}
    await session.execute(
        update(Payment).where(Payment.id == payment_id).values(**values)
    )


# ── Dispute CRUD ──────────────────────────────────────────────────────────────

async def create_dispute(
    session: AsyncSession,
    payment_id: uuid.UUID,
    raised_by: uuid.UUID,
    reason: str | None,
) -> Dispute:
    """Open a new dispute against a payment."""
    dispute = Dispute(
        payment_id=payment_id,
        raised_by=raised_by,
        reason=reason,
        status="open",
    )
    session.add(dispute)
    await session.flush()
    return dispute


async def get_dispute_by_payment(
    session: AsyncSession,
    payment_id: uuid.UUID,
) -> Dispute | None:
    """Return the most-recent dispute for a payment (open disputes first)."""
    result = await session.execute(
        select(Dispute)
        .where(Dispute.payment_id == payment_id)
        .order_by(Dispute.created_at.desc())
    )
    return result.scalar_one_or_none()


async def get_dispute_by_id(
    session: AsyncSession,
    dispute_id: uuid.UUID,
) -> Dispute | None:
    """Fetch a dispute by its primary key."""
    result = await session.execute(
        select(Dispute).where(Dispute.id == dispute_id)
    )
    return result.scalar_one_or_none()


async def resolve_dispute(
    session: AsyncSession,
    dispute_id: uuid.UUID,
    resolved_by: uuid.UUID,
    in_favour_of: str,  # "buyer" or "seller"
) -> None:
    """
    Mark the dispute as resolved.

    ``in_favour_of`` must be "buyer" or "seller".
    Sets status to resolved_buyer or resolved_seller accordingly.
    """
    if in_favour_of not in ("buyer", "seller"):
        raise ValueError(
            f"in_favour_of must be 'buyer' or 'seller', got {in_favour_of!r}"
        )
    new_status = f"resolved_{in_favour_of}"
    now = datetime.now(tz=timezone.utc)
    await session.execute(
        update(Dispute)
        .where(Dispute.id == dispute_id)
        .values(
            status=new_status,
            resolved_by=resolved_by,
            resolved_at=now,
        )
    )


# ── Fraud score CRUD ──────────────────────────────────────────────────────────

async def create_fraud_score(
    session: AsyncSession,
    payment_id: uuid.UUID,
    score: float,
    model_version: str,
    rejected: bool,
) -> FraudScore:
    """Persist a fraud scoring result."""
    fraud_score = FraudScore(
        payment_id=payment_id,
        score=Decimal(str(score)),
        model_version=model_version,
        rejected=rejected,
    )
    session.add(fraud_score)
    await session.flush()
    return fraud_score


# ── Scheduled task queries ────────────────────────────────────────────────────

async def get_payments_ready_for_auto_release(
    session: AsyncSession,
) -> list[Payment]:
    """
    Return payments held in escrow whose auto-release timer has expired.

    Criteria:
    - status = 'held_in_escrow'
    - auto_release_at <= NOW()
    """
    now = datetime.now(tz=timezone.utc)
    result = await session.execute(
        select(Payment)
        .where(Payment.status == "held_in_escrow")
        .where(Payment.auto_release_at <= now)
    )
    return list(result.scalars().all())
