"""
Unit tests for CRM Service (Task 18.3).

Tests:
- Customer record upsert on order.completed event
- Notes creation and length enforcement
- Purchase history retrieval
- Customer search by phone/email
- Idempotency on duplicate order events
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import Base, CustomerRecord, CustomerOrder


@pytest_asyncio.fixture(scope="function")
async def session_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


def _now():
    return datetime.now(tz=timezone.utc)


class TestCustomerUpsert:

    @pytest.mark.asyncio
    async def test_creates_new_customer_record(self, session_factory) -> None:
        from app.repository import get_customer, upsert_customer

        buyer_id = uuid.uuid4()
        seller_id = uuid.uuid4()
        order_id = uuid.uuid4()

        async with session_factory() as session:
            rec = await upsert_customer(
                session, buyer_id, seller_id, None,
                order_id, Decimal("30000"), "Electronics", _now()
            )
            await session.commit()

        async with session_factory() as session:
            fetched = await get_customer(session, buyer_id, seller_id)
        assert fetched is not None
        assert fetched.total_orders == 1
        assert fetched.total_spend == Decimal("30000")

    @pytest.mark.asyncio
    async def test_increments_on_second_order(self, session_factory) -> None:
        from app.repository import get_customer, upsert_customer

        buyer_id = uuid.uuid4()
        seller_id = uuid.uuid4()

        async with session_factory() as session:
            await upsert_customer(session, buyer_id, seller_id, None,
                                  uuid.uuid4(), Decimal("10000"), None, _now())
            await session.commit()

        async with session_factory() as session:
            await upsert_customer(session, buyer_id, seller_id, None,
                                  uuid.uuid4(), Decimal("20000"), None, _now())
            await session.commit()

        async with session_factory() as session:
            fetched = await get_customer(session, buyer_id, seller_id)
        assert fetched.total_orders == 2

    @pytest.mark.asyncio
    async def test_idempotent_on_duplicate_order(self, session_factory) -> None:
        """Processing the same order_id twice must not double-count."""
        from app.repository import upsert_customer
        from sqlalchemy import select

        buyer_id = uuid.uuid4()
        seller_id = uuid.uuid4()
        order_id = uuid.uuid4()

        async with session_factory() as session:
            await upsert_customer(session, buyer_id, seller_id, None,
                                  order_id, Decimal("5000"), None, _now())
            await session.commit()

        async with session_factory() as session:
            await upsert_customer(session, buyer_id, seller_id, None,
                                  order_id, Decimal("5000"), None, _now())
            await session.commit()

        async with session_factory() as session:
            result = await session.execute(
                select(CustomerOrder).where(CustomerOrder.order_id == order_id)
            )
            rows = result.scalars().all()
        assert len(rows) == 1

    @pytest.mark.asyncio
    async def test_different_sellers_have_separate_records(self, session_factory) -> None:
        from app.repository import get_customer, upsert_customer

        buyer_id = uuid.uuid4()
        seller_a = uuid.uuid4()
        seller_b = uuid.uuid4()

        async with session_factory() as session:
            await upsert_customer(session, buyer_id, seller_a, None,
                                  uuid.uuid4(), Decimal("1000"), None, _now())
            await upsert_customer(session, buyer_id, seller_b, None,
                                  uuid.uuid4(), Decimal("2000"), None, _now())
            await session.commit()

        async with session_factory() as session:
            rec_a = await get_customer(session, buyer_id, seller_a)
            rec_b = await get_customer(session, buyer_id, seller_b)
        assert rec_a is not None
        assert rec_b is not None
        assert rec_a.id != rec_b.id


class TestNotes:

    @pytest.mark.asyncio
    async def test_add_note_to_customer_record(self, session_factory) -> None:
        from app.repository import add_note, upsert_customer

        buyer_id = uuid.uuid4()
        seller_id = uuid.uuid4()
        async with session_factory() as session:
            rec = await upsert_customer(session, buyer_id, seller_id, None,
                                        uuid.uuid4(), Decimal("5000"), None, _now())
            await session.commit()

        async with session_factory() as session:
            from app.repository import get_customer
            rec = await get_customer(session, buyer_id, seller_id)
            note = await add_note(session, rec.id, "VIP customer — fast delivery", seller_id)
            await session.commit()
        assert note.note == "VIP customer — fast delivery"

    @pytest.mark.asyncio
    async def test_note_truncated_at_1000_chars(self, session_factory) -> None:
        """Notes exceeding 1000 chars must be silently truncated."""
        from app.repository import add_note, upsert_customer

        buyer_id = uuid.uuid4()
        seller_id = uuid.uuid4()
        async with session_factory() as session:
            rec = await upsert_customer(session, buyer_id, seller_id, None,
                                        uuid.uuid4(), Decimal("1000"), None, _now())
            await session.commit()

        long_note = "x" * 1500  # over the limit

        async with session_factory() as session:
            from app.repository import get_customer
            rec = await get_customer(session, buyer_id, seller_id)
            note = await add_note(session, rec.id, long_note, seller_id)
            await session.commit()
        assert len(note.note) <= 1000


class TestPurchaseHistory:

    @pytest.mark.asyncio
    async def test_get_purchase_history_ordered_by_date(self, session_factory) -> None:
        from app.repository import get_customer_orders, upsert_customer
        from datetime import timedelta

        buyer_id = uuid.uuid4()
        seller_id = uuid.uuid4()
        now = _now()

        async with session_factory() as session:
            rec = await upsert_customer(session, buyer_id, seller_id, None,
                                        uuid.uuid4(), Decimal("10000"), None, now - timedelta(days=2))
            await session.commit()

        # Add a second order on a different date
        async with session_factory() as session:
            await upsert_customer(session, buyer_id, seller_id, None,
                                  uuid.uuid4(), Decimal("20000"), None, now)
            await session.commit()

        async with session_factory() as session:
            from app.repository import get_customer
            rec = await get_customer(session, buyer_id, seller_id)
            orders = await get_customer_orders(session, rec.id)

        assert len(orders) == 2
        # Ordered most-recent first
        assert orders[0].order_date >= orders[1].order_date

    @pytest.mark.asyncio
    async def test_empty_history_returns_empty_list(self, session_factory) -> None:
        from app.repository import get_customer_orders, upsert_customer

        buyer_id = uuid.uuid4()
        seller_id = uuid.uuid4()
        async with session_factory() as session:
            rec = await upsert_customer(session, buyer_id, seller_id, None,
                                        uuid.uuid4(), Decimal("1000"), None, _now())
            await session.commit()
            orders = await get_customer_orders(session, rec.id, page=2)

        # page 2 of a 1-order history — empty
        assert orders == []


class TestConsumerEventHandler:

    @pytest.mark.asyncio
    async def test_handle_order_completed_creates_crm_record(self, session_factory) -> None:
        from app.consumers import handle_order_completed
        from app.repository import get_customer

        buyer_id = uuid.uuid4()
        seller_id = uuid.uuid4()
        order_id = uuid.uuid4()

        payload = {
            "buyer_id": str(buyer_id),
            "seller_id": str(seller_id),
            "order_id": str(order_id),
            "amount": "45000",
            "category": "Fashion",
        }
        await handle_order_completed(payload, session_factory)

        async with session_factory() as session:
            rec = await get_customer(session, buyer_id, seller_id)
        assert rec is not None
        assert rec.total_orders == 1

    @pytest.mark.asyncio
    async def test_handle_missing_fields_does_not_crash(self, session_factory) -> None:
        from app.consumers import handle_order_completed
        # Missing buyer_id — should raise (we want to test it propagates to DLQ)
        with pytest.raises(Exception):
            await handle_order_completed({"seller_id": str(uuid.uuid4())}, session_factory)
