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


def _to_listing_response(listing: Listing) -> ListingResponse:
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
        # Try cache first
        cache_key = RedisKeys.listing_cache(str(listing_id))
        cached = await self.redis.get(cache_key)
        if cached:
            import json
            return ListingResponse.model_validate_json(cached)

        listing = await repo.get_listing(self.session, listing_id)
        if listing is None:
            raise NotFoundError("Listing not found.")

        response = _to_listing_response(listing)
        await self.redis.setex(cache_key, 300, response.model_dump_json())
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

        if self.s3_session:
            await upload_file(
                self.s3_session,
                bucket=self.settings.AWS_S3_BUCKET,
                key=s3_key,
                content=file_content,
                content_type=mime,
            )

        sort_order = current_count  # zero-indexed
        await repo.add_listing_media(
            self.session, listing_id, "image", s3_key, sort_order
        )
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
        if listing.status not in ("draft",):
            raise InvalidInputError(
                f"Listing with status '{listing.status}' cannot be published."
            )

        # Go straight to active — moderators can reject later if needed.
        # In production, change this to "pending_review" and enable the moderation queue.
        await repo.update_listing_status(self.session, listing_id, "active")
        await self.redis.delete(RedisKeys.listing_cache(str(listing_id)))

    async def moderate_listing(
        self,
        listing_id: uuid.UUID,
        approved: bool,
        rejection_reason: str | None = None,
    ) -> None:
        listing = await repo.get_listing(self.session, listing_id)
        if listing is None:
            raise NotFoundError("Listing not found.")

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
        else:
            await repo.update_listing_status(self.session, listing_id, "rejected")

        await self.redis.delete(RedisKeys.listing_cache(str(listing_id)))
        await self.redis.delete(
            RedisKeys.seller_listing_count(str(listing.seller_id))
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
        # Verify purchase eligibility
        eligible = await repo.check_review_eligibility(
            self.session, listing_id, reviewer_id
        )
        if not eligible:
            raise ForbiddenError(
                "You can only review a listing after completing an order or booking."
            )

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
        return [
            ReviewResponse(
                id=r.id,
                listing_id=r.listing_id,
                reviewer_id=r.reviewer_id,
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
