"""User Service data access layer."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from shared.errors import AlreadyExistsError, NotFoundError
from shared.logging import get_logger

from .models import Branch, BranchStaff, Business, KYCDocument, Profile, UserRole

logger = get_logger(__name__)

# ── Profile ───────────────────────────────────────────────────────────────────

async def create_profile(
    session: AsyncSession,
    user_id: uuid.UUID,
    full_name: str,
    email: str,
    phone: str,
    country_code: str,
) -> Profile:
    profile = Profile(
        user_id=user_id,
        full_name=full_name,
        email=email,
        phone=phone,
        country=country_code,
        trust_badge="none",
        subscription_tier="starter",
        default_currency="NGN",
    )
    session.add(profile)
    await session.flush()
    return profile


async def get_profile(
    session: AsyncSession, user_id: uuid.UUID
) -> Profile | None:
    result = await session.execute(
        select(Profile).where(Profile.user_id == user_id)
    )
    return result.scalars().first()


async def update_profile(
    session: AsyncSession,
    user_id: uuid.UUID,
    updates: dict,
) -> Profile:
    profile = await get_profile(session, user_id)
    if profile is None:
        raise NotFoundError("Profile not found.")
    for key, value in updates.items():
        if value is not None:
            setattr(profile, key, value)
    profile.updated_at = datetime.now(tz=timezone.utc)
    await session.flush()
    return profile


async def set_trust_badge(
    session: AsyncSession, user_id: uuid.UUID, badge: str
) -> None:
    """
    Promote trust badge. Only allows forward progression —
    never demotes an existing badge.
    """
    badge_order = {"none": 0, "bronze": 1, "silver": 2, "gold": 3, "diamond": 4}
    profile = await get_profile(session, user_id)
    if profile is None:
        return
    current_level = badge_order.get(profile.trust_badge, 0)
    new_level = badge_order.get(badge, 0)
    if new_level > current_level:
        await session.execute(
            update(Profile)
            .where(Profile.user_id == user_id)
            .values(trust_badge=badge, updated_at=datetime.now(tz=timezone.utc))
        )


async def update_subscription_tier(
    session: AsyncSession, user_id: uuid.UUID, tier: str
) -> None:
    await session.execute(
        update(Profile)
        .where(Profile.user_id == user_id)
        .values(subscription_tier=tier, updated_at=datetime.now(tz=timezone.utc))
    )


# ── Roles ─────────────────────────────────────────────────────────────────────

async def get_user_roles(
    session: AsyncSession, user_id: uuid.UUID
) -> list[UserRole]:
    result = await session.execute(
        select(UserRole).where(UserRole.user_id == user_id)
    )
    return list(result.scalars().all())


async def grant_role(
    session: AsyncSession,
    user_id: uuid.UUID,
    role: str,
    scope_id: uuid.UUID | None = None,
) -> UserRole:
    # Ensure the role isn't already granted
    result = await session.execute(
        select(UserRole).where(
            and_(
                UserRole.user_id == user_id,
                UserRole.role == role,
                UserRole.scope_id == scope_id,
            )
        )
    )
    existing = result.scalars().first()
    if existing:
        return existing

    ur = UserRole(user_id=user_id, role=role, scope_id=scope_id)
    session.add(ur)
    await session.flush()
    return ur


# ── Business ──────────────────────────────────────────────────────────────────

async def create_business(
    session: AsyncSession,
    owner_user_id: uuid.UUID,
    business_name: str,
    registration_number: str | None,
    country: str,
) -> Business:
    biz = Business(
        owner_user_id=owner_user_id,
        business_name=business_name,
        registration_number=registration_number,
        country=country.upper(),
    )
    session.add(biz)
    await session.flush()
    return biz


async def get_business(
    session: AsyncSession, business_id: uuid.UUID
) -> Business | None:
    result = await session.execute(
        select(Business).where(Business.id == business_id)
    )
    return result.scalars().first()


async def get_businesses_by_owner(
    session: AsyncSession, owner_user_id: uuid.UUID
) -> list[Business]:
    result = await session.execute(
        select(Business).where(Business.owner_user_id == owner_user_id)
    )
    return list(result.scalars().all())


# ── Branch ────────────────────────────────────────────────────────────────────

async def create_branch(
    session: AsyncSession,
    business_id: uuid.UUID,
    branch_name: str,
    address: str | None,
    city: str | None,
    country: str | None,
) -> Branch:
    branch = Branch(
        business_id=business_id,
        branch_name=branch_name,
        address=address,
        city=city,
        country=country,
    )
    session.add(branch)
    await session.flush()
    return branch


async def get_branches_by_business(
    session: AsyncSession, business_id: uuid.UUID
) -> list[Branch]:
    result = await session.execute(
        select(Branch).where(Branch.business_id == business_id)
    )
    return list(result.scalars().all())


async def get_branch(
    session: AsyncSession, branch_id: uuid.UUID
) -> Branch | None:
    result = await session.execute(
        select(Branch).where(Branch.id == branch_id)
    )
    return result.scalars().first()


# ── KYC Documents ─────────────────────────────────────────────────────────────

async def create_kyc_document(
    session: AsyncSession,
    user_id: uuid.UUID,
    document_type: str,
    s3_key: str,
) -> KYCDocument:
    doc = KYCDocument(
        user_id=user_id,
        document_type=document_type,
        s3_key=s3_key,
        status="pending",
    )
    session.add(doc)
    await session.flush()
    return doc


async def get_pending_kyc(
    session: AsyncSession,
    user_id: uuid.UUID,
    document_type: str,
) -> KYCDocument | None:
    result = await session.execute(
        select(KYCDocument).where(
            and_(
                KYCDocument.user_id == user_id,
                KYCDocument.document_type == document_type,
                KYCDocument.status == "pending",
            )
        )
    )
    return result.scalars().first()
