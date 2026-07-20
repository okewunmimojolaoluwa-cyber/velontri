"""Subscription Service data access."""
from __future__ import annotations
import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Any
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from shared.rabbitmq import publish_event
from .models import Invoice, Subscription


async def get_or_create_subscription(session: AsyncSession, user_id: uuid.UUID) -> Subscription:
    result = await session.execute(select(Subscription).where(Subscription.user_id == user_id))
    sub = result.scalars().first()
    if sub is None:
        sub = Subscription(user_id=user_id, tier="starter", is_active=True)
        session.add(sub)
        await session.flush()
    return sub


async def upgrade_subscription(session: AsyncSession, user_id: uuid.UUID, new_tier: str, channel: Any) -> Subscription:
    sub = await get_or_create_subscription(session, user_id)
    tier_order = {"starter": 0, "growth": 1, "pro": 2, "enterprise": 3}
    if tier_order.get(new_tier, 0) <= tier_order.get(sub.tier, 0):
        return sub
    sub.tier = new_tier
    sub.is_active = True
    sub.retry_count = 0
    now = datetime.now(tz=timezone.utc)
    sub.current_period_start = now
    sub.current_period_end = now + timedelta(days=30)
    await session.flush()
    await publish_event(channel, "subscription.tier_changed", {"user_id": str(user_id), "tier": new_tier}, correlation_id=str(user_id))
    return sub


async def get_invoices(session: AsyncSession, user_id: uuid.UUID, page: int = 1, page_size: int = 20) -> list[Invoice]:
    result = await session.execute(select(Invoice).where(Invoice.user_id == user_id).order_by(Invoice.invoice_date.desc()).offset((page - 1) * page_size).limit(page_size))
    return list(result.scalars().all())


async def create_invoice(session: AsyncSession, user_id: uuid.UUID, tier: str, amount: Decimal, currency: str, fx_rate: Decimal | None) -> Invoice:
    inv = Invoice(user_id=user_id, tier=tier, amount=amount, currency=currency, fx_rate=fx_rate, status="pending")
    session.add(inv)
    await session.flush()
    return inv
