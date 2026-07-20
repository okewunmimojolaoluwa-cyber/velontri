"""
User Service consumer tests.

Validates that RabbitMQ event handlers correctly update the database.
Tests use in-memory SQLite for speed.
"""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base
from app.consumers import (
    handle_phone_verified,
    handle_subscription_tier_changed,
    handle_user_registered,
)
from app.repository import create_profile, get_profile


@pytest_asyncio.fixture(scope="function")
async def session_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


class TestHandleUserRegistered:

    @pytest.mark.asyncio
    async def test_creates_profile_on_event(self, session_factory) -> None:
        user_id = str(uuid.uuid4())
        payload = {
            "user_id": user_id,
            "email": "reg@example.com",
            "full_name": "Registered User",
            "phone": "+2348012345678",
            "country_code": "NG",
        }
        await handle_user_registered(payload, session_factory)

        async with session_factory() as session:
            profile = await get_profile(session, uuid.UUID(user_id))
        assert profile is not None
        assert profile.full_name == "Registered User"

    @pytest.mark.asyncio
    async def test_idempotent_on_duplicate_event(self, session_factory) -> None:
        """Processing the same event twice must not raise or create duplicates."""
        user_id = str(uuid.uuid4())
        payload = {
            "user_id": user_id,
            "email": "dup@example.com",
            "full_name": "Dup User",
            "phone": "+2348011111111",
            "country_code": "NG",
        }
        await handle_user_registered(payload, session_factory)
        await handle_user_registered(payload, session_factory)  # second time

        async with session_factory() as session:
            profile = await get_profile(session, uuid.UUID(user_id))
        assert profile is not None

    @pytest.mark.asyncio
    async def test_missing_user_id_does_not_raise(self, session_factory) -> None:
        """Malformed events must be handled gracefully — no crash."""
        await handle_user_registered({}, session_factory)  # no user_id


class TestHandlePhoneVerified:

    @pytest.mark.asyncio
    async def test_sets_bronze_badge(self, session_factory) -> None:
        user_id = uuid.uuid4()
        async with session_factory() as session:
            await create_profile(
                session, user_id, "Phone User", "phone@example.com",
                "+2348099999999", "NG"
            )
            await session.commit()

        await handle_phone_verified({"user_id": str(user_id)}, session_factory)

        async with session_factory() as session:
            profile = await get_profile(session, user_id)
        assert profile.trust_badge == "bronze"

    @pytest.mark.asyncio
    async def test_does_not_demote_higher_badge(self, session_factory) -> None:
        """If user already has Silver, phone_verified must not demote to Bronze."""
        from app.repository import set_trust_badge

        user_id = uuid.uuid4()
        async with session_factory() as session:
            await create_profile(
                session, user_id, "Silver User", "silver@example.com",
                "+2348077777777", "NG"
            )
            await set_trust_badge(session, user_id, "silver")
            await session.commit()

        await handle_phone_verified({"user_id": str(user_id)}, session_factory)

        async with session_factory() as session:
            profile = await get_profile(session, user_id)
        assert profile.trust_badge == "silver"  # NOT demoted to bronze


class TestHandleSubscriptionTierChanged:

    @pytest.mark.asyncio
    async def test_updates_tier(self, session_factory) -> None:
        user_id = uuid.uuid4()
        async with session_factory() as session:
            await create_profile(
                session, user_id, "Sub User", "sub@example.com",
                "+2348055555555", "NG"
            )
            await session.commit()

        await handle_subscription_tier_changed(
            {"user_id": str(user_id), "tier": "pro"}, session_factory
        )

        async with session_factory() as session:
            profile = await get_profile(session, user_id)
        assert profile.subscription_tier == "pro"

    @pytest.mark.asyncio
    async def test_missing_fields_does_not_raise(self, session_factory) -> None:
        await handle_subscription_tier_changed(
            {"user_id": str(uuid.uuid4())},  # missing tier
            session_factory,
        )
