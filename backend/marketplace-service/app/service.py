"""
Marketplace Service business logic layer.

Orchestrates listings, media, property/vehicle/job/service details,
reviews, stores, bookings, and quota enforcement.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import aioboto3
import httpx
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from shared.errors import (
    ForbiddenError,
    FeatureNotAvailableError,
    InvalidInputError,
    NotFoundError,
    QuotaExceededError,
    ExternalServiceError,
)
from shared.logging import get_logger
from shared.rabbitmq import publish_event
from shared.redis_client import RedisKeys
from shared.s3 import S3Keys, UploadCategory, upload_file, validate_upload

from . import repository as repo
from .calculator import financing_monthly_repayment, monthly_mortgage_repayment
from .config import MarketplaceSettings
from .models import Booking, Listing, Review, Store
from .schemas import (
    BookingResponse,
    CreateBookingRequest,
    CreateListingRequest,
    CreateReviewRequest,
    JobDetailRequest,
    ListingResponse,
    MortgageCalculatorRequest,
    MortgageCalculatorResponse,
    PropertyDetailRequest,
    ReviewResponse,
    StoreResponse,
    UpdateBookingStatusRequest,
    UpdateListingRequest,
    UpsertStoreRequest,
    VehicleDetailRequest,
)

logger = get_logger(__name__)

# Listing quota map: tier → max active listings (0 = unlimited)
QUOTA_MAP = {
    "starter": 10,
    "growth": 100,
    "pro": 0,
    "enterprise": 0,
}


def _to_listing_response(listing: Listing, media_urls: list[str] | None = None) -> ListingResponse:
    urls = media_urls if media_urls is not None else (
        [listing.image_url] if listing.image_url else []
    )
    return ListingResponse(
        id=listing.id,
        seller_id=listing.seller_id,
        listing_type=listing.listing_type,
        title=listing.title,
        description=listing.description,
        price=listing.price,
        currency=listing.currency,
        country=listing.country,
        state=listing.state,
        city=listing.city,
        category=listing.category,
        subcategory=listing.subcategory,
        condition=listing.condition,
        brand=listing.brand,
        status=listing.status,
        avg_rating=float(listing.avg_rating) if listing.avg_rating else 0.0,
        review_count=listing.review_count,
        image_url=listing.image_url,
        media_urls=urls,
        whatsapp_number=getattr(listing, 'whatsapp_number', None),
        contact_phone=getattr(listing, 'contact_phone', None),
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )


class MarketplaceService:
    def __init__(
        self,
        session: AsyncSession,
        redis: Redis,
        settings: MarketplaceSettings,
        rabbitmq_channel: Any,
        s3_session: aioboto3.Session | None = None,
    ) -> None:
        self.session = session
        self.redis = redis
        self.settings = settings
        self.channel = rabbitmq_channel
        self.s3_session = s3_session

    # ── Listing CRUD ──────────────────────────────────────────────────────────

    async def list_listings(
        self,
        page: int = 1,
        page_size: int = 20,
        category: str | None = None,
        listing_type: str | None = None,
        seller_id: uuid.UUID | None = None,
        city: str | None = None,
        country: str | None = None,
        min_price: float | None = None,
        max_price: float | None = None,
        condition: str | None = None,
        query: str | None = None,
    ) -> tuple:
        return await repo.list_listings(
            self.session,
            page=page,
            page_size=page_size,
            category=category,
            listing_type=listing_type,
            seller_id=seller_id,
            city=city,
            country=country,
            min_price=min_price,
            max_price=max_price,
            condition=condition,
            query=query,
        )

    async def create_listing(
        self,
        seller_id: uuid.UUID,
        subscription_tier: str,
        body: CreateListingRequest,
    ) -> ListingResponse:
        """Create a listing and enforce tier quota."""
        await self._enforce_quota(seller_id, subscription_tier)

        listing = await repo.create_listing(
            self.session,
            seller_id=seller_id,
            listing_type=body.listing_type,
            title=body.title,
            description=body.description,
            price=body.price,
            currency=body.currency,
            country=body.country,
            state=body.state,
            city=body.city,
            latitude=getattr(body, 'latitude', None),
            longitude=getattr(body, 'longitude', None),
            category=body.category,
            subcategory=getattr(body, 'subcategory', None),
            condition=body.condition,
            brand=getattr(body, 'brand', None),
            image_url=body.image_url,
            whatsapp_number=getattr(body, 'whatsapp_number', None),
            contact_phone=getattr(body, 'contact_phone', None),
        )

        # Persist specs if provided
        if body.specs:
            await repo.upsert_listing_specs(self.session, listing.id, body.specs)

        # Persist variants if provided
        if body.variants:
            for v in body.variants:
                await repo.create_variant(
                    self.session, listing.id, v.sku, v.attributes, v.price, v.stock_quantity
                )

        # Invalidate quota cache so next check reads fresh DB count
        await self.redis.delete(RedisKeys.seller_listing_count(str(seller_id)))

        logger.info(
            "listing_created",
            listing_id=str(listing.id),
            seller_id=str(seller_id),
            type=body.listing_type,
        )
        return _to_listing_response(listing)

    async def get_listing(self, listing_id: uuid.UUID) -> ListingResponse:
        # Try cache first — but only if it has valid media_urls
        cache_key = RedisKeys.listing_cache(str(listing_id))
        cached = await self.redis.get(cache_key)
        if cached:
            try:
                cached_resp = ListingResponse.model_validate_json(cached)
                # Only use cache if it has images or the listing itself has no image
                if cached_resp.media_urls or not cached_resp.image_url:
                    return cached_resp
                # Cache has image_url but empty media_urls — stale, re-fetch
            except Exception:
                pass

        listing = await repo.get_listing(self.session, listing_id)
        if listing is None:
            raise NotFoundError("Listing not found.")

        # Load all media in sort order
        media_rows = await repo.get_listing_media(self.session, listing_id)
        media_urls: list[str] = [m.s3_key for m in media_rows if m.media_type == "image" and m.s3_key]

        # Deduplicate while preserving order (media_rows may contain the cover too)
        seen: set[str] = set()
        deduped: list[str] = []
        for url in media_urls:
            if url not in seen:
                seen.add(url)
                deduped.append(url)
        media_urls = deduped

        # Ensure cover image is in the list and is first.
        if listing.image_url:
            if not media_urls:
                media_urls = [listing.image_url]
            elif media_urls[0] != listing.image_url:
                # Cover not first — remove it from wherever it is and prepend it
                media_urls = [listing.image_url] + [u for u in media_urls if u != listing.image_url]
            # else: media_urls[0] == image_url — already in the right place

        response = _to_listing_response(listing, media_urls)
        await self.redis.setex(cache_key, 60, response.model_dump_json())
        return response

    async def update_listing(
        self,
        listing_id: uuid.UUID,
        seller_id: uuid.UUID,
        body: UpdateListingRequest,
    ) -> ListingResponse:
        listing = await repo.get_listing(self.session, listing_id)
        if listing is None:
            raise NotFoundError("Listing not found.")
        if listing.seller_id != seller_id:
            raise ForbiddenError("You can only update your own listings.")

        updates = body.model_dump(exclude_none=True)
        updated = await repo.update_listing_fields(self.session, listing_id, updates)

        # Invalidate cache
        await self.redis.delete(RedisKeys.listing_cache(str(listing_id)))
        return _to_listing_response(updated)

    # ── Media upload ──────────────────────────────────────────────────────────

    async def upload_image(
        self,
        listing_id: uuid.UUID,
        seller_id: uuid.UUID,
        file_content: bytes,
        filename: str,
    ) -> str:
        """Upload a listing image. Enforces 20-image max per listing."""
        listing = await repo.get_listing(self.session, listing_id)
        if listing is None:
            raise NotFoundError("Listing not found.")
        if listing.seller_id != seller_id:
            raise ForbiddenError("You can only upload images to your own listings.")

        current_count = await repo.count_listing_images(self.session, listing_id)
        if current_count >= 20:
            raise QuotaExceededError(
                "Maximum of 20 images per listing. Remove an image before uploading."
            )

        mime = validate_upload(file_content, UploadCategory.LISTING_IMAGE, filename)
        s3_key = S3Keys.listing_image(str(listing_id))

        # Do the heavy I/O (S3 upload or base64 encoding) BEFORE touching the DB
        # so the connection is not held open during the slow operation.
        if self.s3_session:
            await upload_file(
                self.s3_session,
                bucket=self.settings.AWS_S3_BUCKET,
                key=s3_key,
                content=file_content,
                content_type=mime,
            )
            image_url: str | None = None  # served via S3/CDN key
        else:
            # No S3 — store as a base64 data URL directly on the listing so the
            # image is still visible. The frontend compresses to ~60 KB first.
            import base64 as _b64
            image_url = f"data:{mime};base64,{_b64.b64encode(file_content).decode()}"

        # Now write to DB in a single flush so the connection is released quickly
        sort_order = current_count  # zero-indexed
        media_url = s3_key if self.s3_session else (image_url or s3_key)

        if not self.s3_session and current_count == 0 and not listing.image_url:
            # Only set cover image on the listing row if one isn't already set.
            # The cover is usually embedded at create time via image_url in the
            # create request — we must not overwrite it with the first uploadImage call.
            from sqlalchemy import update as _update
            from .models import Listing as _Listing
            await self.session.execute(
                _update(_Listing)
                .where(_Listing.id == listing_id)
                .values(image_url=image_url)
            )
        await repo.add_listing_media(self.session, listing_id, "image", media_url, sort_order)
        await self.session.flush()  # flush immediately so connection returns to pool sooner

        # Always invalidate cache so next get_listing returns fresh media_urls
        await self.redis.delete(RedisKeys.listing_cache(str(listing_id)))

        await self.redis.delete(RedisKeys.listing_cache(str(listing_id)))
        return s3_key


    async def upload_video(
        self,
        listing_id: uuid.UUID,
        seller_id: uuid.UUID,
        file_content: bytes,
        filename: str,
    ) -> str:
        listing = await repo.get_listing(self.session, listing_id)
        if listing is None:
            raise NotFoundError("Listing not found.")
        if listing.seller_id != seller_id:
            raise ForbiddenError("You can only upload videos to your own listings.")

        mime = validate_upload(file_content, UploadCategory.LISTING_VIDEO, filename)
        s3_key = S3Keys.listing_video(str(listing_id))

        if self.s3_session:
            await upload_file(
                self.s3_session, self.settings.AWS_S3_BUCKET, s3_key, file_content, mime
            )

        await repo.add_listing_media(self.session, listing_id, "video", s3_key)
        await self.redis.delete(RedisKeys.listing_cache(str(listing_id)))
        return s3_key

    # ── Publishing / moderation ───────────────────────────────────────────────

    async def publish_listing(
        self, listing_id: uuid.UUID, seller_id: uuid.UUID
    ) -> None:
        listing = await repo.get_listing(self.session, listing_id)
        if listing is None:
            raise NotFoundError("Listing not found.")
        if listing.seller_id != seller_id:
            raise ForbiddenError("You can only publish your own listings.")
        if listing.status not in ("draft", "rejected"):
            raise InvalidInputError(
                f"Listing with status '{listing.status}' cannot be submitted for review."
            )

        # Submit listing to the moderation queue — goes live only after approval.
        await repo.update_listing_status(self.session, listing_id, "pending_review")
        await self.redis.delete(RedisKeys.listing_cache(str(listing_id)))

    async def moderate_listing(
        self,
        listing_id: uuid.UUID,
        approved: bool,
        rejection_reason: str | None = None,
        moderator_notes: str | None = None,
        moderator_id: str | None = None,
        moderator_name: str | None = None,
    ) -> None:
        listing = await repo.get_listing(self.session, listing_id)
        if listing is None:
            raise NotFoundError("Listing not found.")
        if listing.status != "pending_review":
            raise InvalidInputError(
                f"Only listings with status 'pending_review' can be moderated (current: '{listing.status}')."
            )

        if approved:
            await repo.update_listing_status(self.session, listing_id, "active")
            # Publish for Search Service to index
            try:
                await publish_event(
                    self.channel,
                    routing_key="listing.created",
                    payload={
                        "listing_id": str(listing_id),
                        "seller_id": str(listing.seller_id),
                        "title": listing.title,
                        "description": listing.description,
                        "category": listing.category,
                        "subcategory": listing.subcategory,
                        "brand": listing.brand,
                        "listing_type": listing.listing_type,
                        "status": "active",
                        "price": str(listing.price) if listing.price else None,
                        "currency": listing.currency,
                        "country": listing.country,
                        "state": listing.state,
                        "city": listing.city,
                        "latitude": float(listing.latitude) if listing.latitude else None,
                        "longitude": float(listing.longitude) if listing.longitude else None,
                    },
                    correlation_id=str(listing_id),
                )
            except Exception:
                logger.error(
                    "listing_created_event_failed",
                    listing_id=str(listing_id),
                    exc_info=True,
                )
            # Notify seller — listing approved
            await self._notify_seller(
                seller_id=str(listing.seller_id),
                title="🎉 Listing Approved!",
                message=(
                    f"Your listing \"{listing.title}\" has been approved and is now live on Velontri."
                ),
                notification_type="listing_approved",
                listing_id=str(listing_id),
                sender_id=moderator_id,
                sender_role=moderator_name,
                action_url=f"/listings/{listing_id}",
            )
        else:
            await repo.update_listing_status(self.session, listing_id, "rejected")
            # Store rejection reason on the listing for the seller to see
            try:
                from sqlalchemy import text as _text
                await self.session.execute(
                    _text(
                        "UPDATE listings SET rejection_reason = :reason WHERE id = :lid"
                    ),
                    {"reason": rejection_reason or "Does not meet our listing guidelines.", "lid": str(listing_id)},
                )
                await self.session.commit()
            except Exception:
                logger.warning("rejection_reason_store_failed", listing_id=str(listing_id), exc_info=True)
            # Notify seller — listing rejected
            reason_text = rejection_reason or "Does not meet our listing guidelines."
            mod_display = moderator_name or "A Velontri moderator"
            await self._notify_seller(
                seller_id=str(listing.seller_id),
                title="❌ Listing Needs Attention",
                message=(
                    f"Your listing \"{listing.title}\" was not approved.\n"
                    f"Reason: {reason_text}\n"
                    f"You can edit your listing and resubmit for review."
                ),
                notification_type="listing_rejected",
                listing_id=str(listing_id),
                sender_id=moderator_id,
                sender_role=mod_display,
                action_url=f"/dashboard/listings",
            )

        await self.redis.delete(RedisKeys.listing_cache(str(listing_id)))
        await self.redis.delete(
            RedisKeys.seller_listing_count(str(listing.seller_id))
        )

    async def _notify_seller(
        self,
        seller_id: str,
        title: str,
        message: str,
        notification_type: str,
        listing_id: str,
        sender_id: str | None = None,
        sender_role: str | None = None,
        action_url: str | None = None,
    ) -> None:
        """Create an in-app notification record for the seller with full attribution."""
        import json as _json
        from sqlalchemy import text as _text
        try:
            notif_id = str(uuid.uuid4())
            await self.session.execute(
                _text(
                    "INSERT INTO notifications "
                    "(id, user_id, type, title, message, is_read, "
                    " sender_user_id, sender_role, related_resource_type, related_resource_id, action_url, "
                    " created_at) "
                    "VALUES (:id, :uid, 'system', :title, :message, FALSE, "
                    "        :sender_id, :sender_role, 'listing', :listing_id, :action_url, "
                    "        NOW())"
                ),
                {
                    "id": notif_id,
                    "uid": seller_id,
                    "title": title,
                    "message": message,
                    "sender_id": sender_id,
                    "sender_role": sender_role,
                    "listing_id": listing_id,
                    "action_url": action_url or "/dashboard/listings",
                },
            )
            await self.session.commit()
        except Exception:
            logger.warning(
                "seller_notification_failed",
                seller_id=seller_id,
                notification_type=notification_type,
                exc_info=True,
            )

    # ── Property listing ──────────────────────────────────────────────────────

    async def add_property_details(
        self,
        listing_id: uuid.UUID,
        seller_id: uuid.UUID,
        body: PropertyDetailRequest,
    ) -> None:
        listing = await repo.get_listing(self.session, listing_id)
        if listing is None or listing.seller_id != seller_id:
            raise ForbiddenError("Listing not found or access denied.")

        await repo.create_property_detail(
            self.session,
            listing_id=listing_id,
            property_type=body.property_type,
            bedrooms=body.bedrooms,
            bathrooms=body.bathrooms,
            area_sqm=body.area_sqm,
            furnishing_status=body.furnishing_status,
            amenities=body.amenities,
            tour_asset_url=body.tour_asset_url,
            price_per_night=body.price_per_night,
        )

        if body.blocked_dates:
            await repo.add_shortlet_blocked_dates(
                self.session, listing_id, body.blocked_dates
            )

    def calculate_mortgage(
        self, body: MortgageCalculatorRequest
    ) -> MortgageCalculatorResponse:
        principal = body.price - body.deposit
        if principal <= 0:
            return MortgageCalculatorResponse(
                monthly_repayment=Decimal("0.00"),
                total_repayment=body.deposit,
                total_interest=Decimal("0.00"),
            )

        monthly, total, interest = monthly_mortgage_repayment(
            principal=principal,
            annual_interest_rate_pct=body.annual_interest_rate_pct,
            loan_term_years=body.loan_term_years,
        )
        return MortgageCalculatorResponse(
            monthly_repayment=monthly,
            total_repayment=total,
            total_interest=interest,
        )

    # ── Vehicle listing ───────────────────────────────────────────────────────

    async def add_vehicle_details(
        self,
        listing_id: uuid.UUID,
        seller_id: uuid.UUID,
        body: VehicleDetailRequest,
    ) -> None:
        listing = await repo.get_listing(self.session, listing_id)
        if listing is None or listing.seller_id != seller_id:
            raise ForbiddenError("Listing not found or access denied.")

        await repo.create_vehicle_detail(
            self.session,
            listing_id=listing_id,
            make=body.make,
            model=body.model,
            year=body.year,
            mileage_km=body.mileage_km,
            fuel_type=body.fuel_type,
            transmission=body.transmission,
            colour=body.colour,
            engine_size_cc=body.engine_size_cc,
            vin=body.vin,
            vin_history_status="pending" if body.vin else "not_applicable",
        )

        # Trigger async VIN lookup if VIN provided
        if body.vin:
            import asyncio
            asyncio.create_task(self._lookup_vin(listing_id, body.vin))

    async def _lookup_vin(self, listing_id: uuid.UUID, vin: str) -> None:
        """Non-blocking VIN history lookup. Updates vehicle_detail record."""
        if not self.settings.VIN_LOOKUP_API_KEY:
            await repo.update_vehicle_vin_status(
                self.session, listing_id, "unavailable", None, "VIN lookup not configured"
            )
            return

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(
                    f"{self.settings.VIN_LOOKUP_PROVIDER_URL}/decode/{vin}/specs",
                    headers={"Authorization": f"Bearer {self.settings.VIN_LOOKUP_API_KEY}"},
                )
                if resp.status_code == 200:
                    await repo.update_vehicle_vin_status(
                        self.session, listing_id, "available", resp.json(), None
                    )
                else:
                    await repo.update_vehicle_vin_status(
                        self.session, listing_id, "unavailable", None,
                        f"Provider returned HTTP {resp.status_code}"
                    )
        except Exception as exc:
            await repo.update_vehicle_vin_status(
                self.session, listing_id, "unavailable", None, str(exc)
            )
        finally:
            try:
                await self.session.commit()
            except Exception:
                pass

    # ── Job listing ───────────────────────────────────────────────────────────

    async def add_job_details(
        self,
        listing_id: uuid.UUID,
        seller_id: uuid.UUID,
        body: JobDetailRequest,
    ) -> None:
        listing = await repo.get_listing(self.session, listing_id)
        if listing is None or listing.seller_id != seller_id:
            raise ForbiddenError("Listing not found or access denied.")

        await repo.create_job_detail(
            self.session,
            listing_id=listing_id,
            employer_id=seller_id,
            job_type=body.job_type,
            salary_min=body.salary_min,
            salary_max=body.salary_max,
            salary_currency=body.salary_currency,
            required_skills=body.required_skills,
            application_deadline=body.application_deadline,
        )

    async def submit_job_application(
        self,
        listing_id: uuid.UUID,
        applicant_id: uuid.UUID,
        cv_content: bytes,
        filename: str,
    ) -> uuid.UUID:
        listing = await repo.get_listing(self.session, listing_id)
        if listing is None or listing.listing_type != "job":
            raise NotFoundError("Job listing not found.")

        mime = validate_upload(cv_content, UploadCategory.CV, filename)
        application = await repo.create_job_application(
            self.session, listing_id, applicant_id, f"cv/{uuid.uuid4()}"
        )

        if self.s3_session:
            s3_key = S3Keys.cv(str(application.id))
            await upload_file(
                self.s3_session, self.settings.AWS_S3_BUCKET, s3_key, cv_content, mime
            )
            await repo.update_application_ai_score(self.session, application.id, 0, [])

        # Publish for AI Service to score CV
        job_detail = await repo.get_job_detail(self.session, listing_id)
        await publish_event(
            self.channel,
            routing_key="cv.uploaded",
            payload={
                "application_id": str(application.id),
                "listing_id": str(listing_id),
                "required_skills": job_detail.required_skills or [],
                "cv_s3_key": application.cv_s3_key,
            },
        )

        logger.info(
            "job_application_submitted",
            application_id=str(application.id),
            listing_id=str(listing_id),
        )
        return application.id

    async def update_application_status(
        self,
        application_id: uuid.UUID,
        employer_id: uuid.UUID,
        new_status: str,
    ) -> None:
        application = await repo.get_application(self.session, application_id)
        if application is None:
            raise NotFoundError("Application not found.")

        await repo.update_application_status(
            self.session, application_id, new_status, employer_id
        )
        await publish_event(
            self.channel,
            routing_key="job_application.status_changed",
            payload={
                "application_id": str(application_id),
                "applicant_id": str(application.applicant_id),
                "listing_id": str(application.listing_id),
                "new_status": new_status,
            },
        )

    # ── Reviews ───────────────────────────────────────────────────────────────

    async def submit_review(
        self,
        listing_id: uuid.UUID,
        reviewer_id: uuid.UUID,
        body: CreateReviewRequest,
    ) -> ReviewResponse:
        # Check the listing exists and reviewer is not the seller
        listing = await repo.get_listing(self.session, listing_id)
        if listing is None:
            raise NotFoundError("Listing not found.")
        if listing.seller_id == reviewer_id:
            raise ForbiddenError("You cannot review your own listing.")

        # Prevent duplicate reviews — one per user per listing
        from sqlalchemy import select as _select, and_ as _and_
        from .models import Review as _Review
        existing = (await self.session.execute(
            _select(_Review).where(
                _and_(_Review.listing_id == listing_id, _Review.reviewer_id == reviewer_id)
            )
        )).scalars().first()
        if existing:
            raise ForbiddenError("You have already reviewed this listing.")

        # AI spam check (async call to AI Service)
        status = "published"
        if body.comment:
            status = await self._check_spam(body.comment)

        review = await repo.create_review(
            self.session, listing_id, reviewer_id, body.rating, body.comment, status
        )

        # Update rolling average
        await repo.update_listing_avg_rating(self.session, listing_id)

        # Publish for listing update in Search
        await publish_event(
            self.channel,
            routing_key="listing.updated",
            payload={"listing_id": str(listing_id), "field": "avg_rating"},
        )

        logger.info(
            "review_submitted",
            review_id=str(review.id),
            listing_id=str(listing_id),
            status=status,
        )

        return ReviewResponse(
            id=review.id,
            listing_id=review.listing_id,
            reviewer_id=review.reviewer_id,
            rating=review.rating,
            comment=review.comment,
            status=review.status,
            seller_response=review.seller_response,
            created_at=review.created_at,
        )

    async def list_reviews(
        self, listing_id: uuid.UUID, page: int = 1
    ) -> list[ReviewResponse]:
        reviews = await repo.list_reviews(self.session, listing_id, page=page)
        # Fetch reviewer names in one query
        reviewer_ids = list({str(r.reviewer_id) for r in reviews})
        name_map: dict[str, str] = {}
        if reviewer_ids:
            try:
                from sqlalchemy import text as _text
                # Build IN clause manually — avoids ANY() dialect differences
                placeholders = ", ".join(f":id_{i}" for i in range(len(reviewer_ids)))
                params = {f"id_{i}": rid for i, rid in enumerate(reviewer_ids)}
                rows = (await self.session.execute(
                    _text(
                        f"SELECT CAST(id AS TEXT) AS id, full_name FROM users "
                        f"WHERE CAST(id AS TEXT) IN ({placeholders})"
                    ),
                    params,
                )).mappings().all()
                name_map = {str(r["id"]): r["full_name"] for r in rows if r["full_name"]}
            except Exception:
                pass
        return [
            ReviewResponse(
                id=r.id,
                listing_id=r.listing_id,
                reviewer_id=r.reviewer_id,
                reviewer_name=name_map.get(str(r.reviewer_id)),
                rating=r.rating,
                comment=r.comment,
                status=r.status,
                seller_response=r.seller_response,
                created_at=r.created_at,
            )
            for r in reviews
        ]

    async def respond_to_review(
        self, review_id: uuid.UUID, seller_id: uuid.UUID, response: str
    ) -> None:
        success = await repo.set_seller_response(
            self.session, review_id, seller_id, response
        )
        if not success:
            raise ForbiddenError(
                "Review not found, not on your listing, or already responded to."
            )

    async def _check_spam(self, text: str) -> str:
        """Call AI Service to classify review text. Returns 'published' or 'quarantined'."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self.settings.AI_SERVICE_URL}/ai/review/moderate",
                    json={"text": text},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    confidence = data.get("confidence", 0.0)
                    if confidence > 0.85:
                        return "quarantined"
        except Exception:
            logger.warning("spam_check_failed", exc_info=True)
        return "published"

    # ── Store ─────────────────────────────────────────────────────────────────

    async def upsert_store(
        self,
        seller_id: uuid.UUID,
        body: UpsertStoreRequest,
        subscription_tier: str,
    ) -> StoreResponse:
        # Custom domain requires Pro or Enterprise
        if body.custom_domain and subscription_tier not in ("pro", "enterprise"):
            raise FeatureNotAvailableError(
                "Custom domains require a Pro or Enterprise subscription."
            )

        store = await repo.get_or_create_store(
            self.session, seller_id, body.store_name
        )

        updates: dict[str, Any] = {"store_name": body.store_name}
        if body.theme:
            updates["theme"] = body.theme

        if body.custom_domain and body.custom_domain != store.custom_domain:
            domain_ok = await self._verify_cname(body.custom_domain)
            updates["custom_domain"] = body.custom_domain
            updates["domain_verified"] = domain_ok

        await repo.update_store(self.session, seller_id, updates)

        return StoreResponse(
            id=store.id,
            seller_id=store.seller_id,
            store_name=body.store_name,
            logo_url=store.logo_url,
            banner_url=store.banner_url,
            theme=body.theme or store.theme,
            custom_domain=body.custom_domain or store.custom_domain,
            domain_verified=updates.get("domain_verified", store.domain_verified),
            created_at=store.created_at,
        )

    async def _verify_cname(self, domain: str) -> bool:
        """Verify DNS CNAME for the custom domain points to velontri.com."""
        try:
            import dns.resolver  # dnspython
            answers = dns.resolver.resolve(domain, "CNAME")
            for rdata in answers:
                if "velontri.com" in str(rdata.target).lower():
                    return True
        except Exception:
            pass
        return False

    # ── Booking ───────────────────────────────────────────────────────────────

    async def create_booking(
        self,
        buyer_id: uuid.UUID,
        body: CreateBookingRequest,
    ) -> BookingResponse:
        listing = await repo.get_listing(self.session, body.listing_id)
        if listing is None or listing.listing_type != "service":
            raise NotFoundError("Service listing not found.")
        if listing.status != "active":
            raise InvalidInputError("This listing is not currently available.")

        booking = await repo.create_booking(
            self.session,
            listing_id=body.listing_id,
            buyer_id=buyer_id,
            seller_id=listing.seller_id,
            scheduled_at=body.scheduled_at,
            duration_minutes=body.duration_minutes,
        )

        await publish_event(
            self.channel,
            routing_key="booking.status_changed",
            payload={
                "booking_id": str(booking.id),
                "listing_id": str(body.listing_id),
                "buyer_id": str(buyer_id),
                "seller_id": str(listing.seller_id),
                "status": "pending",
            },
        )

        return BookingResponse(
            id=booking.id,
            listing_id=booking.listing_id,
            buyer_id=booking.buyer_id,
            seller_id=booking.seller_id,
            scheduled_at=booking.scheduled_at,
            duration_minutes=booking.duration_minutes,
            status=booking.status,
            created_at=booking.created_at,
        )

    async def update_booking_status(
        self,
        booking_id: uuid.UUID,
        requesting_user_id: uuid.UUID,
        body: UpdateBookingStatusRequest,
    ) -> None:
        booking = await repo.get_booking(self.session, booking_id)
        if booking is None:
            raise NotFoundError("Booking not found.")

        # Only buyer can cancel; only seller can confirm/done
        if body.status == "cancelled" and booking.buyer_id != requesting_user_id:
            raise ForbiddenError("Only the buyer can cancel a booking.")
        if body.status in ("confirmed", "done") and booking.seller_id != requesting_user_id:
            raise ForbiddenError("Only the seller can confirm or complete a booking.")

        await repo.update_booking_status(self.session, booking_id, body.status)

        await publish_event(
            self.channel,
            routing_key="booking.status_changed",
            payload={
                "booking_id": str(booking_id),
                "listing_id": str(booking.listing_id),
                "buyer_id": str(booking.buyer_id),
                "seller_id": str(booking.seller_id),
                "status": body.status,
            },
        )

    # ── RabbitMQ event handler ────────────────────────────────────────────────

    async def handle_order_completed(self, payload: dict) -> None:
        """Grant review eligibility when an order is completed."""
        listing_id = payload.get("listing_id")
        buyer_id = payload.get("buyer_id")
        order_id = payload.get("order_id")

        if not all([listing_id, buyer_id, order_id]):
            return

        await repo.grant_review_eligibility(
            self.session,
            uuid.UUID(listing_id),
            uuid.UUID(buyer_id),
            uuid.UUID(order_id),
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _enforce_quota(
        self, seller_id: uuid.UUID, subscription_tier: str
    ) -> None:
        """Check active listing count against tier quota using Redis + DB."""
        max_listings = QUOTA_MAP.get(subscription_tier, 10)
        if max_listings == 0:
            return  # unlimited

        cache_key = RedisKeys.seller_listing_count(str(seller_id))
        cached = await self.redis.get(cache_key)

        if cached is not None:
            count = int(cached)
        else:
            count = await repo.count_active_listings(self.session, seller_id)
            await self.redis.setex(cache_key, 3600, str(count))

        if count >= max_listings:
            raise QuotaExceededError(
                f"Your {subscription_tier} plan allows a maximum of "
                f"{max_listings} active listings. "
                "Upgrade your subscription to add more."
            )
