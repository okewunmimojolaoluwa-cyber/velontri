"""CRM Service data access layer."""
from __future__ import annotations
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from .models import CustomerNote, CustomerOrder, CustomerRecord


async def upsert_customer(session: AsyncSession, buyer_id: uuid.UUID, seller_id: uuid.UUID, branch_id: uuid.UUID | None, order_id: uuid.UUID, amount: Decimal, category: str | None, order_date: datetime) -> CustomerRecord:
    result = await session.execute(select(CustomerRecord).where(and_(CustomerRecord.buyer_id == buyer_id, CustomerRecord.seller_id == seller_id)))
    record = result.scalars().first()
    if record is None:
        record = CustomerRecord(buyer_id=buyer_id, seller_id=seller_id, branch_id=branch_id, total_orders=1, total_spend=amount)
        session.add(record)
        await session.flush()
    else:
        await session.execute(update(CustomerRecord).where(CustomerRecord.id == record.id).values(total_orders=CustomerRecord.total_orders + 1, total_spend=CustomerRecord.total_spend + amount))

    # Record order (idempotent)
    existing = await session.execute(select(CustomerOrder).where(CustomerOrder.order_id == order_id))
    if existing.scalars().first() is None:
        session.add(CustomerOrder(customer_record_id=record.id, order_id=order_id, amount=amount, category=category, order_date=order_date))
    await session.flush()
    return record


async def get_customer(session: AsyncSession, buyer_id: uuid.UUID, seller_id: uuid.UUID) -> CustomerRecord | None:
    result = await session.execute(select(CustomerRecord).where(and_(CustomerRecord.buyer_id == buyer_id, CustomerRecord.seller_id == seller_id)))
    return result.scalars().first()


async def search_customers(session: AsyncSession, seller_id: uuid.UUID, query: str, page: int = 1, page_size: int = 20) -> list[CustomerRecord]:
    q = f"%{query}%"
    result = await session.execute(
        select(CustomerRecord).where(and_(CustomerRecord.seller_id == seller_id, or_(CustomerRecord.phone.ilike(q), CustomerRecord.email.ilike(q))))
        .offset((page - 1) * page_size).limit(page_size)
    )
    return list(result.scalars().all())


async def add_note(session: AsyncSession, record_id: uuid.UUID, note: str, created_by: uuid.UUID) -> CustomerNote:
    n = CustomerNote(customer_record_id=record_id, note=note[:1000], created_by=created_by)
    session.add(n)
    await session.flush()
    return n


async def get_customer_orders(session: AsyncSession, record_id: uuid.UUID, page: int = 1, page_size: int = 20) -> list[CustomerOrder]:
    result = await session.execute(select(CustomerOrder).where(CustomerOrder.customer_record_id == record_id).order_by(CustomerOrder.order_date.desc()).offset((page - 1) * page_size).limit(page_size))
    return list(result.scalars().all())
