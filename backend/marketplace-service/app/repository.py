"""
Marketplace Service data access layer.

All database operations go through this layer.
The service layer never constructs raw SQL or ORM queries directly.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from shared.errors import NotFoundError
from shared.logging import get_logger

from .models import (
    Booking,
    JobApplication,
    JobDetail,
    Listing,
    ListingMedia,
    ListingSpec,
    ListingVariant,
    PropertyDetail,
    Review,
    ReviewEligibility,
    ReviewMedia,
    ShortletAvailability,
    Store,
    VehicleDetail,
)

logger = get_logger(__name__)


# ── Listing ───────────────────────────────────────────────────────────────────

async def create_listing(
    session: AsyncSession,
    seller_id: uuid.UUID,
    listing_type: str,
    title: str,
    description: str | None,
    price: Decimal | None,
    currency: str,
    country: str | None,
    state: str | None,
    city: str | None,
    latitude: float | None,
    longitude: float | None,
    category: str | None,
    subcategory: str | None,
    condition: str | None,
    brand: str | None,
    image_url: str | None = None,
    whatsapp_number: str | None = None,
    contact_phone: str | None = None,
) -> Listing:
    listing = Listing(
        seller_id=seller_id,
        listing_type=listing_type,
        title=title,
        description=description,
        price=price,
        currency=currency,
        country=country,
        state=state,
        city=city,
        latitude=latitude,
        longitude=longitude,
        category=category,
        subcategory=subcategory,
        condition=condition,
        brand=brand,
        image_url=image_url,
        status="draft",
    )
    # Store whatsapp_number / contact_phone via setattr so missing columns don't crash
    if whatsapp_number is not None:
        try: setattr(listing, 'whatsapp_number', whatsapp_number)
        except Exception: pass
    if contact_phone is not None:
        try: setattr(listing, 'contact_phone', contact_phone)
        except Exception: pass
    session.add(listing)
    await session.flush()
    return listing


async def get_listing(
    session: AsyncSession, listing_id: uuid.UUID
) -> Listing | None:
    result = await session.execute(
        select(Listing).where(Listing.id == listing_id)
    )
    return result.scalars().first()


async def update_listing_status(
    session: AsyncSession, listing_id: uuid.UUID, status: str
) -> None:
    await session.execute(
        update(Listing)
        .where(Listing.id == listing_id)
        .values(status=status, updated_at=datetime.now(tz=timezone.utc))
    )


async def count_active_listings(
    session: AsyncSession, seller_id: uuid.UUID
) -> int:
    result = await session.execute(
        select(func.count(Listing.id)).where(
            and_(
                Listing.seller_id == seller_id,
                Listing.status == "active",
            )
        )
    )
    return result.scalar_one()


async def list_listings(
    session: AsyncSession,
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
) -> tuple[list[Listing], int]:
    """Browse active listings with optional filters. Returns (items, total)."""
    conditions = [Listing.status == "active"]
    if category:
        conditions.append(Listing.category == category)
    if listing_type:
        conditions.append(Listing.listing_type == listing_type)
    if seller_id:
        conditions.append(Listing.seller_id == seller_id)
    if city:
        conditions.append(Listing.city.ilike(f"%{city}%"))
    if country:
        conditions.append(Listing.country.ilike(f"%{country}%"))
    if min_price is not None:
        conditions.append(Listing.price >= min_price)
    if max_price is not None:
        conditions.append(Listing.price <= max_price)
    if condition:
        conditions.append(Listing.condition == condition)
    if query:
        search_term = f"%{query}%"
        from sqlalchemy import or_
        conditions.append(
            or_(
                Listing.title.ilike(search_term),
                Listing.description.ilike(search_term),
                Listing.category.ilike(search_term),
                Listing.brand.ilike(search_term),
            )
        )

    where_clause = and_(*conditions)
    offset = (page - 1) * page_size

    total_result = await session.execute(
        select(func.count(Listing.id)).where(where_clause)
    )
    total = total_result.scalar_one()

    items_result = await session.execute(
        select(Listing)
        .where(where_clause)
        .order_by(Listing.created_at.desc())
        .limit(page_size)
        .offset(offset)
    )
    items = list(items_result.scalars().all())
    return items, total


async def update_listing_fields(
    session: AsyncSession, listing_id: uuid.UUID, updates: dict
) -> Listing:
    listing = await get_listing(session, listing_id)
    if listing is None:
        raise NotFoundError("Listing not found.")
    for k, v in updates.items():
        if v is not None:
            setattr(listing, k, v)
    listing.updated_at = datetime.now(tz=timezone.utc)
    await session.flush()
    return listing


async def update_listing_avg_rating(
    session: AsyncSession, listing_id: uuid.UUID
) -> None:
    """Recalculate rolling average rating from all published reviews."""
    result = await session.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            and_(
                Review.listing_id == listing_id,
                Review.status == "published",
            )
        )
    )
    row = result.fetchone()
    avg = float(row[0]) if row[0] else 0.0
    count = row[1] or 0
    await session.execute(
        update(Listing)
        .where(Listing.id == listing_id)
        .values(avg_rating=round(avg, 2), review_count=count)
    )


# ── Listing media ─────────────────────────────────────────────────────────────

async def add_listing_media(
    session: AsyncSession,
    listing_id: uuid.UUID,
    media_type: str,
    s3_key: str,
    sort_order: int = 0,
) -> ListingMedia:
    media = ListingMedia(
        listing_id=listing_id,
        media_type=media_type,
        s3_key=s3_key,
        sort_order=sort_order,
    )
    session.add(media)
    await session.flush()
    return media


async def count_listing_images(
    session: AsyncSession, listing_id: uuid.UUID
) -> int:
    result = await session.execute(
        select(func.count(ListingMedia.id)).where(
            and_(
                ListingMedia.listing_id == listing_id,
                ListingMedia.media_type == "image",
            )
        )
    )
    return result.scalar_one()


# ── Listing specs and variants ────────────────────────────────────────────────

async def upsert_listing_specs(
    session: AsyncSession, listing_id: uuid.UUID, specs: dict[str, str]
) -> None:
    for key, value in specs.items():
        result = await session.execute(
            select(ListingSpec).where(
                and_(ListingSpec.listing_id == listing_id, ListingSpec.spec_key == key)
            )
        )
        existing = result.scalars().first()
        if existing:
            existing.spec_value = value
        else:
            session.add(ListingSpec(listing_id=listing_id, spec_key=key, spec_value=value))
    await session.flush()


async def create_variant(
    session: AsyncSession,
    listing_id: uuid.UUID,
    sku: str,
    attributes: dict,
    price: Decimal | None,
    stock_quantity: int,
) -> ListingVariant:
    variant = ListingVariant(
        listing_id=listing_id,
        sku=sku,
        attributes=attributes,
        price=price,
        stock_quantity=stock_quantity,
    )
    session.add(variant)
    await session.flush()
    return variant


async def get_zero_stock_variants(
    session: AsyncSession, listing_id: uuid.UUID
) -> list[ListingVariant]:
    result = await session.execute(
        select(ListingVariant).where(
            and_(
                ListingVariant.listing_id == listing_id,
                ListingVariant.stock_quantity == 0,
            )
        )
    )
    return list(result.scalars().all())


# ── Property details ──────────────────────────────────────────────────────────

async def create_property_detail(
    session: AsyncSession, listing_id: uuid.UUID, **kwargs
) -> PropertyDetail:
    pd = PropertyDetail(listing_id=listing_id, **kwargs)
    session.add(pd)
    await session.flush()
    return pd


async def add_shortlet_blocked_dates(
    session: AsyncSession, listing_id: uuid.UUID, dates: list
) -> None:
    for d in dates:
        result = await session.execute(
            select(ShortletAvailability).where(
                and_(
                    ShortletAvailability.listing_id == listing_id,
                    ShortletAvailability.blocked_date == d,
                )
            )
        )
        if result.scalars().first() is None:
            session.add(ShortletAvailability(listing_id=listing_id, blocked_date=d))
    await session.flush()


# ── Vehicle details ───────────────────────────────────────────────────────────

async def create_vehicle_detail(
    session: AsyncSession, listing_id: uuid.UUID, **kwargs
) -> VehicleDetail:
    vd = VehicleDetail(listing_id=listing_id, **kwargs)
    session.add(vd)
    await session.flush()
    return vd


async def get_vehicle_detail(
    session: AsyncSession, listing_id: uuid.UUID
) -> VehicleDetail | None:
    result = await session.execute(
        select(VehicleDetail).where(VehicleDetail.listing_id == listing_id)
    )
    return result.scalars().first()


async def update_vehicle_vin_status(
    session: AsyncSession,
    listing_id: uuid.UUID,
    status: str,
    history_data: dict | None,
    error_reason: str | None,
) -> None:
    await session.execute(
        update(VehicleDetail)
        .where(VehicleDetail.listing_id == listing_id)
        .values(
            vin_history_status=status,
            vin_history_data=history_data,
            vin_error_reason=error_reason,
        )
    )


# ── Job details ───────────────────────────────────────────────────────────────

async def create_job_detail(
    session: AsyncSession, listing_id: uuid.UUID, employer_id: uuid.UUID, **kwargs
) -> JobDetail:
    jd = JobDetail(listing_id=listing_id, employer_id=employer_id, **kwargs)
    session.add(jd)
    await session.flush()
    return jd


async def get_job_detail(
    session: AsyncSession, listing_id: uuid.UUID
) -> JobDetail | None:
    result = await session.execute(
        select(JobDetail).where(JobDetail.listing_id == listing_id)
    )
    return result.scalars().first()


async def create_job_application(
    session: AsyncSession,
    listing_id: uuid.UUID,
    applicant_id: uuid.UUID,
    cv_s3_key: str,
) -> JobApplication:
    app = JobApplication(
        listing_id=listing_id,
        applicant_id=applicant_id,
        cv_s3_key=cv_s3_key,
        status="pending",
    )
    session.add(app)
    await session.flush()
    return app


async def get_application(
    session: AsyncSession, application_id: uuid.UUID
) -> JobApplication | None:
    result = await session.execute(
        select(JobApplication).where(JobApplication.id == application_id)
    )
    return result.scalars().first()


async def update_application_status(
    session: AsyncSession,
    application_id: uuid.UUID,
    status: str,
    reviewer_id: uuid.UUID,
) -> None:
    await session.execute(
        update(JobApplication)
        .where(JobApplication.id == application_id)
        .values(
            status=status,
            reviewed_by=reviewer_id,
            reviewed_at=datetime.now(tz=timezone.utc),
        )
    )


async def update_application_ai_score(
    session: AsyncSession,
    application_id: uuid.UUID,
    score: int,
    missing_skills: list[str],
) -> None:
    await session.execute(
        update(JobApplication)
        .where(JobApplication.id == application_id)
        .values(ai_score=score, ai_missing_skills=missing_skills)
    )


# ── Reviews ───────────────────────────────────────────────────────────────────

async def check_review_eligibility(
    session: AsyncSession, listing_id: uuid.UUID, buyer_id: uuid.UUID
) -> bool:
    result = await session.execute(
        select(ReviewEligibility).where(
            and_(
                ReviewEligibility.listing_id == listing_id,
                ReviewEligibility.buyer_id == buyer_id,
            )
        )
    )
    return result.scalars().first() is not None


async def grant_review_eligibility(
    session: AsyncSession,
    listing_id: uuid.UUID,
    buyer_id: uuid.UUID,
    order_id: uuid.UUID,
) -> None:
    existing = await check_review_eligibility(session, listing_id, buyer_id)
    if not existing:
        session.add(
            ReviewEligibility(
                listing_id=listing_id, buyer_id=buyer_id, order_id=order_id
            )
        )
        await session.flush()


async def create_review(
    session: AsyncSession,
    listing_id: uuid.UUID,
    reviewer_id: uuid.UUID,
    rating: int,
    comment: str | None,
    status: str = "published",
) -> Review:
    review = Review(
        listing_id=listing_id,
        reviewer_id=reviewer_id,
        rating=rating,
        comment=comment,
        status=status,
    )
    session.add(review)
    await session.flush()
    return review


async def get_review(
    session: AsyncSession, review_id: uuid.UUID
) -> Review | None:
    result = await session.execute(
        select(Review).where(Review.id == review_id)
    )
    return result.scalars().first()


async def list_reviews(
    session: AsyncSession,
    listing_id: uuid.UUID,
    status: str = "published",
    page: int = 1,
    page_size: int = 20,
) -> list[Review]:
    result = await session.execute(
        select(Review)
        .where(and_(Review.listing_id == listing_id, Review.status == status))
        .order_by(Review.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return list(result.scalars().all())


async def set_seller_response(
    session: AsyncSession,
    review_id: uuid.UUID,
    seller_id: uuid.UUID,
    response: str,
) -> bool:
    """Set seller response. Verifies seller owns the listing."""
    result = await session.execute(
        select(Review)
        .join(Listing, Review.listing_id == Listing.id)
        .where(
            and_(
                Review.id == review_id,
                Listing.seller_id == seller_id,
                Review.seller_response.is_(None),  # only one response allowed
            )
        )
    )
    review = result.scalars().first()
    if review is None:
        return False
    review.seller_response = response
    await session.flush()
    return True


async def add_review_media(
    session: AsyncSession,
    review_id: uuid.UUID,
    media_type: str,
    s3_key: str,
) -> None:
    session.add(ReviewMedia(review_id=review_id, media_type=media_type, s3_key=s3_key))
    await session.flush()


async def count_review_images(
    session: AsyncSession, review_id: uuid.UUID
) -> int:
    result = await session.execute(
        select(func.count(ReviewMedia.id)).where(
            and_(ReviewMedia.review_id == review_id, ReviewMedia.media_type == "image")
        )
    )
    return result.scalar_one()


# ── Store ─────────────────────────────────────────────────────────────────────

async def get_or_create_store(
    session: AsyncSession, seller_id: uuid.UUID, store_name: str
) -> Store:
    result = await session.execute(
        select(Store).where(Store.seller_id == seller_id)
    )
    store = result.scalars().first()
    if store:
        return store
    store = Store(seller_id=seller_id, store_name=store_name)
    session.add(store)
    await session.flush()
    return store


async def update_store(
    session: AsyncSession, seller_id: uuid.UUID, updates: dict
) -> Store:
    result = await session.execute(
        select(Store).where(Store.seller_id == seller_id)
    )
    store = result.scalars().first()
    if store is None:
        raise NotFoundError("Store not found.")
    for k, v in updates.items():
        if v is not None:
            setattr(store, k, v)
    await session.flush()
    return store


# ── Booking ───────────────────────────────────────────────────────────────────

async def create_booking(
    session: AsyncSession,
    listing_id: uuid.UUID,
    buyer_id: uuid.UUID,
    seller_id: uuid.UUID,
    scheduled_at: datetime,
    duration_minutes: int | None,
) -> Booking:
    booking = Booking(
        listing_id=listing_id,
        buyer_id=buyer_id,
        seller_id=seller_id,
        scheduled_at=scheduled_at,
        duration_minutes=duration_minutes,
        status="pending",
    )
    session.add(booking)
    await session.flush()
    return booking


async def get_booking(
    session: AsyncSession, booking_id: uuid.UUID
) -> Booking | None:
    result = await session.execute(
        select(Booking).where(Booking.id == booking_id)
    )
    return result.scalars().first()


async def update_booking_status(
    session: AsyncSession, booking_id: uuid.UUID, status: str
) -> None:
    await session.execute(
        update(Booking).where(Booking.id == booking_id).values(status=status)
    )
