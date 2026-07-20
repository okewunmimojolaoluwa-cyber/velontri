"""
User Service business logic layer.

Orchestrates:
- Profile CRUD
- KYC document upload and badge promotion
- Business / branch entity management
- RBAC role grants
- RabbitMQ event publishing (branch.created)
"""
from __future__ import annotations

import uuid
from typing import Any

import aioboto3
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from shared.errors import ForbiddenError, NotFoundError
from shared.logging import get_logger
from shared.rabbitmq import publish_event
from shared.s3 import S3Keys, UploadCategory, validate_upload, upload_file

from . import repository as repo
from .config import UserSettings
from .models import Branch, Business, KYCDocument, Profile
from .schemas import (
    BranchResponse,
    BusinessResponse,
    CreateBranchRequest,
    CreateBusinessRequest,
    KYCDocumentResponse,
    ProfileResponse,
    UpdateProfileRequest,
    UserRolesResponse,
    SubscriptionTierResponse,
)

logger = get_logger(__name__)


def _to_profile_response(p: Profile) -> ProfileResponse:
    return ProfileResponse(
        user_id=p.user_id,
        full_name=p.full_name,
        profile_photo_url=p.profile_photo_url,
        bio=p.bio,
        country=p.country,
        state=p.state,
        city=p.city,
        phone=p.phone,
        email=p.email,
        default_currency=p.default_currency,
        trust_badge=p.trust_badge,
        subscription_tier=p.subscription_tier,
        registered_at=p.registered_at,
        updated_at=p.updated_at,
    )


def _to_business_response(b: Business) -> BusinessResponse:
    return BusinessResponse(
        id=b.id,
        owner_user_id=b.owner_user_id,
        business_name=b.business_name,
        registration_number=b.registration_number,
        logo_url=b.logo_url,
        country=b.country,
        created_at=b.created_at,
    )


def _to_branch_response(b: Branch) -> BranchResponse:
    return BranchResponse(
        id=b.id,
        business_id=b.business_id,
        branch_name=b.branch_name,
        address=b.address,
        city=b.city,
        country=b.country,
        created_at=b.created_at,
    )


class UserService:
    def __init__(
        self,
        session: AsyncSession,
        redis: Redis,
        settings: UserSettings,
        rabbitmq_channel: Any,
        s3_session: aioboto3.Session | None = None,
    ) -> None:
        self.session = session
        self.redis = redis
        self.settings = settings
        self.channel = rabbitmq_channel
        self.s3_session = s3_session

    # ── Profile ───────────────────────────────────────────────────────────────

    async def get_profile(self, user_id: uuid.UUID) -> ProfileResponse:
        profile = await repo.get_profile(self.session, user_id)
        if profile is None:
            raise NotFoundError("Profile not found.")
        return _to_profile_response(profile)

    async def update_profile(
        self, user_id: uuid.UUID, body: UpdateProfileRequest
    ) -> ProfileResponse:
        updates = body.model_dump(exclude_none=True)
        profile = await repo.update_profile(self.session, user_id, updates)
        return _to_profile_response(profile)

    # ── KYC ───────────────────────────────────────────────────────────────────

    async def submit_kyc_document(
        self,
        user_id: uuid.UUID,
        document_type: str,
        file_content: bytes,
        filename: str,
    ) -> KYCDocumentResponse:
        """
        Upload a KYC document to S3, create a KYCDocument record.
        Badge promotion happens asynchronously via a background task.
        """
        # Validate file type and size
        validate_upload(file_content, UploadCategory.KYC_DOCUMENT, filename)

        s3_key = S3Keys.kyc_document(str(user_id))

        if self.s3_session:
            await upload_file(
                self.s3_session,
                bucket=self.settings.AWS_S3_BUCKET,
                key=s3_key,
                content=file_content,
                content_type="application/pdf",
                metadata={"user_id": str(user_id), "document_type": document_type},
            )

        doc = await repo.create_kyc_document(
            self.session, user_id, document_type, s3_key
        )

        logger.info(
            "kyc_document_submitted",
            user_id=str(user_id),
            document_type=document_type,
        )

        return KYCDocumentResponse(
            id=doc.id,
            user_id=doc.user_id,
            document_type=doc.document_type,
            status=doc.status,
            submitted_at=doc.submitted_at,
            reviewed_at=doc.reviewed_at,
        )

    async def promote_trust_badge(
        self, user_id: uuid.UUID, badge: str
    ) -> None:
        """
        Called by the admin KYC review flow or automated validation.
        Enforces forward-only badge progression.
        """
        await repo.set_trust_badge(self.session, user_id, badge)
        logger.info("trust_badge_promoted", user_id=str(user_id), badge=badge)

    # ── Business ──────────────────────────────────────────────────────────────

    async def create_business(
        self,
        owner_user_id: uuid.UUID,
        body: CreateBusinessRequest,
    ) -> BusinessResponse:
        biz = await repo.create_business(
            self.session,
            owner_user_id=owner_user_id,
            business_name=body.business_name,
            registration_number=body.registration_number,
            country=body.country,
        )
        # Grant business_owner role scoped to this business
        await repo.grant_role(
            self.session, owner_user_id, "business_owner", scope_id=biz.id
        )
        logger.info(
            "business_created",
            business_id=str(biz.id),
            owner=str(owner_user_id),
        )
        return _to_business_response(biz)

    async def list_businesses(
        self, owner_user_id: uuid.UUID
    ) -> list[BusinessResponse]:
        businesses = await repo.get_businesses_by_owner(self.session, owner_user_id)
        return [_to_business_response(b) for b in businesses]

    # ── Branch ────────────────────────────────────────────────────────────────

    async def create_branch(
        self,
        business_id: uuid.UUID,
        requesting_user_id: uuid.UUID,
        body: CreateBranchRequest,
    ) -> BranchResponse:
        """
        Create a branch under a business.
        Validates that the requesting user owns the business.
        Publishes branch.created event so Inventory Service initialises a ledger.
        """
        biz = await repo.get_business(self.session, business_id)
        if biz is None:
            raise NotFoundError("Business not found.")
        if biz.owner_user_id != requesting_user_id:
            raise ForbiddenError(
                "Only the business owner can create branches."
            )

        branch = await repo.create_branch(
            self.session,
            business_id=business_id,
            branch_name=body.branch_name,
            address=body.address,
            city=body.city,
            country=body.country,
        )

        # Publish event for Inventory Service to init stock ledger
        await publish_event(
            self.channel,
            routing_key="branch.created",
            payload={
                "branch_id": str(branch.id),
                "business_id": str(business_id),
                "branch_name": body.branch_name,
            },
            correlation_id=str(branch.id),
        )

        logger.info(
            "branch_created",
            branch_id=str(branch.id),
            business_id=str(business_id),
        )
        return _to_branch_response(branch)

    async def list_branches(
        self,
        business_id: uuid.UUID,
        requesting_user_id: uuid.UUID,
        requesting_user_roles: list[str],
    ) -> list[BranchResponse]:
        """
        Business owners see all branches.
        Branch managers see only their assigned branch.
        """
        if "business_owner" in requesting_user_roles or "enterprise_admin" in requesting_user_roles:
            branches = await repo.get_branches_by_business(self.session, business_id)
        else:
            raise ForbiddenError(
                "You do not have permission to list branches for this business."
            )
        return [_to_branch_response(b) for b in branches]

    # ── Roles ─────────────────────────────────────────────────────────────────

    async def elevate_role(
        self,
        target_user_id: uuid.UUID,
        role: str,
        scope_id: uuid.UUID | None,
    ) -> None:
        await repo.grant_role(self.session, target_user_id, role, scope_id)
        logger.info(
            "role_granted",
            user_id=str(target_user_id),
            role=role,
            scope_id=str(scope_id) if scope_id else None,
        )

    # ── Internal endpoints ────────────────────────────────────────────────────

    async def get_user_roles(self, user_id: uuid.UUID) -> UserRolesResponse:
        roles = await repo.get_user_roles(self.session, user_id)
        role_names = [r.role for r in roles]
        if not role_names:
            role_names = ["buyer"]  # default role for all users
        return UserRolesResponse(user_id=user_id, roles=role_names)

    async def get_subscription_tier(
        self, user_id: uuid.UUID
    ) -> SubscriptionTierResponse:
        profile = await repo.get_profile(self.session, user_id)
        tier = profile.subscription_tier if profile else "starter"
        return SubscriptionTierResponse(user_id=user_id, tier=tier)
