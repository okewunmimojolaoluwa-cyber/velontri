"""Analytics Service data access layer."""
from __future__ import annotations
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import OrderFact


async def record_order(session: AsyncSession, order_id: uuid.UUID, seller_id: uuid.UUID, buyer_id: uuid.UUID, branch_id: uuid.UUID | None, business_id: uuid.UUID | None, listing_id: uuid.UUID | None, amount: Decimal, currency: str, category: str | None, order_date: datetime) -> OrderFact:
    # Idempotent — skip if already recorded
    result = await session.execute(select(OrderFact).where(OrderFact.order_id == order_id))
    existing = result.scalars().first()
    if existing:
        return existing
    fact = OrderFact(order_id=order_id, seller_id=seller_id, buyer_id=buyer_id, branch_id=branch_id, business_id=business_id, listing_id=listing_id, amount=amount, currency=currency, category=category, order_date=order_date)
    session.add(fact)
    await session.flush()
    return fact


async def get_seller_summary(session: AsyncSession, seller_id: uuid.UUID, start: datetime, end: datetime) -> dict:
    result = await session.execute(
        select(func.sum(OrderFact.amount).label("total_revenue"), func.count(OrderFact.id).label("total_orders"), func.avg(OrderFact.amount).label("avg_order_value"), func.count(func.distinct(OrderFact.buyer_id)).label("unique_customers"))
        .where(and_(OrderFact.seller_id == seller_id, OrderFact.order_date >= start, OrderFact.order_date <= end))
    )
    row = result.fetchone()
    return {"total_revenue": float(row.total_revenue or 0), "total_orders": row.total_orders or 0, "avg_order_value": float(row.avg_order_value or 0), "unique_customers": row.unique_customers or 0}


async def get_branch_summary(session: AsyncSession, branch_id: uuid.UUID, start: datetime, end: datetime) -> dict:
    result = await session.execute(
        select(func.sum(OrderFact.amount).label("total_revenue"), func.count(OrderFact.id).label("total_orders"), func.avg(OrderFact.amount).label("avg_order_value"))
        .where(and_(OrderFact.branch_id == branch_id, OrderFact.order_date >= start, OrderFact.order_date <= end))
    )
    row = result.fetchone()
    return {"total_revenue": float(row.total_revenue or 0), "total_orders": row.total_orders or 0, "avg_order_value": float(row.avg_order_value or 0)}


async def get_top_listings(session: AsyncSession, seller_id: uuid.UUID, start: datetime, end: datetime, limit: int = 20) -> list[dict]:
    result = await session.execute(
        select(OrderFact.listing_id, func.sum(OrderFact.amount).label("revenue"), func.count(OrderFact.id).label("orders"))
        .where(and_(OrderFact.seller_id == seller_id, OrderFact.listing_id.isnot(None), OrderFact.order_date >= start, OrderFact.order_date <= end))
        .group_by(OrderFact.listing_id)
        .order_by(func.sum(OrderFact.amount).desc())
        .limit(limit)
    )
    return [{"listing_id": str(r.listing_id), "revenue": float(r.revenue), "orders": r.orders} for r in result.fetchall()]
