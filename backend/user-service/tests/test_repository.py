"""
User Service repository tests.

Validates:
- Profile creation and retrieval
- Trust badge state machine (forward-only)
- Business/branch entity creation and ownership enforcement
- Role granting (idempotency)
- KYC document creation
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base
from app.repository import (
    create_branch,
    create_business,
    create_kyc_document,
    create_profile,
    get_branches_by_business,
    get_business,
    get_businesses_by_owner,
    get_profile,
    get_user_roles,
    grant_role,
    set_trust_badge,
    update_profile,
    update_subscription_tier,
)


@pytest_asyncio.fixture(scope="function")
async def async_session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()
    await engine.dispose()


async def _make_profile(session: AsyncSession, suffix: str = "1") -> uuid.UUID:
    user_id = uuid.uuid4()
    await create_profile(
        session,
        user_id=user_id,
        full_name=f"Test User {suffix}",
        email=f"test{suffix}@example.com",
        phone=f"+234801{suffix.zfill(7)}",
        country_code="NG",
    )
    await session.commit()
    return user_id


# ── Profile ───────────────────────────────────────────────────────────────────

class TestProfileRepository:

    @pytest.mark.asyncio
    async def test_create_and_retrieve_profile(self, async_session) -> None:
        user_id = await _make_profile(async_session)
        profile = await get_profile(async_session, user_id)
        assert profile is not None
        assert profile.trust_badge == "none"
        assert profile.subscription_tier == "starter"
        assert profile.default_currency == "NGN"

    @pytest.mark.asyncio
    async def test_get_nonexistent_profile_returns_none(self, async_session) -> None:
        profile = await get_profile(async_session, uuid.uuid4())
        assert profile is None

    @pytest.mark.asyncio
    async def test_update_profile_fields(self, async_session) -> None:
        user_id = await _make_profile(async_session, "upd")
        await update_profile(
            async_session, user_id, {"bio": "Lagos based seller", "city": "Lagos"}
        )
        await async_session.commit()
        profile = await get_profile(async_session, user_id)
        assert profile.bio == "Lagos based seller"
        assert profile.city == "Lagos"

    @pytest.mark.asyncio
    async def test_update_subscription_tier(self, async_session) -> None:
        user_id = await _make_profile(async_session, "tier")
        await update_subscription_tier(async_session, user_id, "growth")
        await async_session.commit()
        profile = await get_profile(async_session, user_id)
        assert profile.subscription_tier == "growth"


# ── Trust badge state machine ─────────────────────────────────────────────────

class TestTrustBadgeStateMachine:
    """
    The trust badge must only move forward (none→bronze→silver→gold→diamond).
    It must never be demoted by a later event.
    """

    @pytest.mark.asyncio
    async def test_promote_none_to_bronze(self, async_session) -> None:
        user_id = await _make_profile(async_session, "b1")
        await set_trust_badge(async_session, user_id, "bronze")
        await async_session.commit()
        p = await get_profile(async_session, user_id)
        assert p.trust_badge == "bronze"

    @pytest.mark.asyncio
    async def test_promote_bronze_to_silver(self, async_session) -> None:
        user_id = await _make_profile(async_session, "b2")
        await set_trust_badge(async_session, user_id, "bronze")
        await set_trust_badge(async_session, user_id, "silver")
        await async_session.commit()
        p = await get_profile(async_session, user_id)
        assert p.trust_badge == "silver"

    @pytest.mark.asyncio
    async def test_cannot_demote_silver_to_bronze(self, async_session) -> None:
        user_id = await _make_profile(async_session, "b3")
        await set_trust_badge(async_session, user_id, "silver")
        await set_trust_badge(async_session, user_id, "bronze")  # attempt demotion
        await async_session.commit()
        p = await get_profile(async_session, user_id)
        assert p.trust_badge == "silver"  # unchanged

    @pytest.mark.asyncio
    async def test_full_progression(self, async_session) -> None:
        user_id = await _make_profile(async_session, "b4")
        for badge in ["bronze", "silver", "gold", "diamond"]:
            await set_trust_badge(async_session, user_id, badge)
        await async_session.commit()
        p = await get_profile(async_session, user_id)
        assert p.trust_badge == "diamond"

    @pytest.mark.asyncio
    async def test_cannot_skip_backwards_from_diamond(self, async_session) -> None:
        user_id = await _make_profile(async_session, "b5")
        await set_trust_badge(async_session, user_id, "diamond")
        await set_trust_badge(async_session, user_id, "none")  # attempt full demotion
        await async_session.commit()
        p = await get_profile(async_session, user_id)
        assert p.trust_badge == "diamond"


# ── Roles ─────────────────────────────────────────────────────────────────────

class TestRoleRepository:

    @pytest.mark.asyncio
    async def test_grant_role(self, async_session) -> None:
        user_id = await _make_profile(async_session, "r1")
        await grant_role(async_session, user_id, "seller", None)
        await async_session.commit()
        roles = await get_user_roles(async_session, user_id)
        assert any(r.role == "seller" for r in roles)

    @pytest.mark.asyncio
    async def test_grant_role_idempotent(self, async_session) -> None:
        user_id = await _make_profile(async_session, "r2")
        await grant_role(async_session, user_id, "buyer", None)
        await grant_role(async_session, user_id, "buyer", None)  # duplicate
        await async_session.commit()
        roles = await get_user_roles(async_session, user_id)
        buyer_roles = [r for r in roles if r.role == "buyer"]
        assert len(buyer_roles) == 1

    @pytest.mark.asyncio
    async def test_grant_scoped_role(self, async_session) -> None:
        user_id = await _make_profile(async_session, "r3")
        scope = uuid.uuid4()
        await grant_role(async_session, user_id, "branch_manager", scope)
        await async_session.commit()
        roles = await get_user_roles(async_session, user_id)
        scoped = [r for r in roles if r.role == "branch_manager" and r.scope_id == scope]
        assert len(scoped) == 1


# ── Business and Branch ───────────────────────────────────────────────────────

class TestBusinessBranchRepository:

    @pytest.mark.asyncio
    async def test_create_business(self, async_session) -> None:
        user_id = await _make_profile(async_session, "biz1")
        biz = await create_business(
            async_session, user_id, "TechHub Ltd", "RC12345", "NG"
        )
        await async_session.commit()
        assert biz.id is not None
        assert biz.owner_user_id == user_id

    @pytest.mark.asyncio
    async def test_list_businesses_by_owner(self, async_session) -> None:
        user_id = await _make_profile(async_session, "biz2")
        await create_business(async_session, user_id, "Biz A", None, "NG")
        await create_business(async_session, user_id, "Biz B", None, "GH")
        await async_session.commit()
        businesses = await get_businesses_by_owner(async_session, user_id)
        assert len(businesses) == 2

    @pytest.mark.asyncio
    async def test_create_branch(self, async_session) -> None:
        user_id = await _make_profile(async_session, "br1")
        biz = await create_business(async_session, user_id, "Company X", None, "NG")
        await async_session.commit()

        branch = await create_branch(
            async_session, biz.id, "Lagos Branch", "123 Street", "Lagos", "NG"
        )
        await async_session.commit()
        assert branch.business_id == biz.id

    @pytest.mark.asyncio
    async def test_list_branches_by_business(self, async_session) -> None:
        user_id = await _make_profile(async_session, "br2")
        biz = await create_business(async_session, user_id, "Company Y", None, "NG")
        await async_session.commit()

        await create_branch(async_session, biz.id, "Lagos", None, None, None)
        await create_branch(async_session, biz.id, "Abuja", None, None, None)
        await async_session.commit()

        branches = await get_branches_by_business(async_session, biz.id)
        assert len(branches) == 2


# ── KYC Documents ─────────────────────────────────────────────────────────────

class TestKYCRepository:

    @pytest.mark.asyncio
    async def test_create_kyc_document(self, async_session) -> None:
        user_id = await _make_profile(async_session, "kyc1")
        doc = await create_kyc_document(
            async_session, user_id, "government_id", "kyc/user/doc.pdf"
        )
        await async_session.commit()
        assert doc.id is not None
        assert doc.status == "pending"
        assert doc.document_type == "government_id"
