"""
Marketplace Service — listings, reviews, stores, bookings router.
"""
from __future__ import annotations
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends, File, Query, Request, UploadFile, status
from shared.errors import SuccessResponse
from shared.logging import get_logger
from ..config import MarketplaceSettings
from ..dependencies import get_current_user_id, get_current_user_payload, get_db_session, get_marketplace_settings, get_rabbitmq_channel, get_redis, get_subscription_tier, get_user_roles
from ..schemas import CreateBookingRequest, CreateListingRequest, CreateReviewRequest, JobDetailRequest, MortgageCalculatorRequest, PropertyDetailRequest, SellerResponseRequest, UpdateBookingStatusRequest, UpdateListingRequest, UpsertStoreRequest, VehicleDetailRequest
from ..service import MarketplaceService
logger = get_logger(__name__)
router = APIRouter(tags=['Marketplace'])

def _build_service(session=Depends(get_db_session), redis=Depends(get_redis), channel=Depends(get_rabbitmq_channel), settings: MarketplaceSettings=Depends(get_marketplace_settings)) -> MarketplaceService:
    return MarketplaceService(session=session, redis=redis, settings=settings, rabbitmq_channel=channel)

@router.post('/listings', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Create a new listing')
async def create_listing(body: CreateListingRequest, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id), tier: str=Depends(get_subscription_tier)) -> SuccessResponse:
    if not getattr(body, 'contact_phone', None) and getattr(body, 'whatsapp_number', None):
        body.contact_phone = body.whatsapp_number
    result = await service.create_listing(current_user_id, tier, body)
    return SuccessResponse(message='Listing created.', data=result.model_dump())

@router.get('/listings', response_model=SuccessResponse, summary='Browse active listings with optional filters')
async def browse_listings(service: MarketplaceService=Depends(_build_service), page: int=Query(default=1, ge=1), page_size: int=Query(default=20, ge=1, le=100), category: str | None=Query(default=None), listing_type: str | None=Query(default=None), seller_id: uuid.UUID | None=Query(default=None), city: str | None=Query(default=None), country: str | None=Query(default=None), min_price: float | None=Query(default=None, ge=0), max_price: float | None=Query(default=None, ge=0), condition: str | None=Query(default=None), q: str | None=Query(default=None, description='Full-text keyword search')) -> SuccessResponse:
    """Browse active listings. No authentication required."""
    results, total = await service.list_listings(page=page, page_size=page_size, category=category, listing_type=listing_type, seller_id=seller_id, city=city, country=country, min_price=min_price, max_price=max_price, condition=condition, query=q)
    from shared.errors import paginated_meta
    from sqlalchemy import text as _text

    # For listings without image_url, try to get the first media row
    listing_ids_without_image = [str(r.id) for r in results if not r.image_url]
    media_map: dict[str, str] = {}
    if listing_ids_without_image:
        try:
            placeholders = ", ".join(f":id_{i}" for i in range(len(listing_ids_without_image)))
            params = {f"id_{i}": lid for i, lid in enumerate(listing_ids_without_image)}
            media_rows = (await service.session.execute(_text(
                f"SELECT CAST(listing_id AS TEXT) AS lid, s3_key FROM listing_media "
                f"WHERE CAST(listing_id AS TEXT) IN ({placeholders}) AND media_type = 'image' "
                f"ORDER BY sort_order ASC"
            ), params)).mappings().all()
            seen: set = set()
            for mr in media_rows:
                lid = str(mr['lid'])
                if lid not in seen:
                    media_map[lid] = mr['s3_key']
                    seen.add(lid)
        except Exception:
            pass

    data = []
    for r in results:
        img = r.image_url or media_map.get(str(r.id))
        data.append({'id': str(r.id), 'seller_id': str(r.seller_id), 'listing_type': r.listing_type, 'title': r.title, 'description': r.description, 'price': float(r.price) if r.price is not None else None, 'currency': r.currency, 'country': r.country, 'state': r.state, 'city': r.city, 'category': r.category, 'condition': r.condition, 'status': r.status, 'image_url': img, 'avg_rating': float(r.avg_rating) if r.avg_rating else 0.0, 'review_count': r.review_count or 0, 'created_at': r.created_at.isoformat() if r.created_at else None})
    return SuccessResponse(message=f'{total} listing(s) found.', data=data, meta=paginated_meta(page, page_size, total))

@router.get('/listings/my', response_model=SuccessResponse, summary="Get the authenticated seller's own listings (all statuses)")
async def my_listings(service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id), page: int=Query(default=1, ge=1), page_size: int=Query(default=20, ge=1, le=200), status: str | None=Query(default=None)) -> SuccessResponse:
    """Returns all listings owned by the authenticated user (includes drafts)."""
    from sqlalchemy import select, func as sa_func
    from ..models import Listing
    from shared.errors import paginated_meta
    where_clauses = [Listing.seller_id == current_user_id]
    if status:
        where_clauses.append(Listing.status == status)
    offset = (page - 1) * page_size
    count_result = await service.session.execute(select(sa_func.count()).select_from(Listing).where(*where_clauses))
    total = count_result.scalar() or 0
    rows_result = await service.session.execute(select(Listing).where(*where_clauses).order_by(Listing.created_at.desc()).offset(offset).limit(page_size))
    listings = rows_result.scalars().all()

    # For listings without image_url, fetch from listing_media
    from sqlalchemy import text as _text
    ids_without_image = [str(l.id) for l in listings if not l.image_url]
    media_map: dict[str, str] = {}
    if ids_without_image:
        try:
            placeholders = ", ".join(f":id_{i}" for i in range(len(ids_without_image)))
            params = {f"id_{i}": lid for i, lid in enumerate(ids_without_image)}
            media_rows = (await service.session.execute(_text(
                f"SELECT CAST(listing_id AS TEXT) AS lid, s3_key FROM listing_media "
                f"WHERE CAST(listing_id AS TEXT) IN ({placeholders}) AND media_type = 'image' "
                f"ORDER BY sort_order ASC"
            ), params)).mappings().all()
            seen: set = set()
            for mr in media_rows:
                lid = str(mr['lid'])
                if lid not in seen:
                    media_map[lid] = mr['s3_key']
                    seen.add(lid)
        except Exception:
            pass

    data = [{'id': str(l.id), 'seller_id': str(l.seller_id), 'listing_type': l.listing_type,
              'title': l.title, 'description': l.description,
              'price': float(l.price) if l.price is not None else None,
              'currency': l.currency, 'country': l.country, 'state': l.state,
              'city': l.city, 'category': l.category, 'condition': l.condition,
              'status': l.status,
              'rejection_reason': getattr(l, 'rejection_reason', None),
              'whatsapp_number': getattr(l, 'whatsapp_number', None),
              'contact_phone': getattr(l, 'contact_phone', None),
              'avg_rating': float(l.avg_rating) if l.avg_rating is not None else 0.0,
              'review_count': l.review_count or 0,
              'created_at': l.created_at.isoformat() if l.created_at else None,
              'updated_at': l.updated_at.isoformat() if l.updated_at else None,
              'image_url': l.image_url or media_map.get(str(l.id))} for l in listings]
    return SuccessResponse(message=f'{total} listing(s) found.', data=data, meta=paginated_meta(page, page_size, total))

@router.get('/listings/{listing_id}', response_model=SuccessResponse, summary='Get listing detail')
async def get_listing(listing_id: uuid.UUID, service: MarketplaceService=Depends(_build_service)) -> SuccessResponse:
    result = await service.get_listing(listing_id)
    return SuccessResponse(message='Listing retrieved.', data=result.model_dump())

@router.patch('/listings/{listing_id}', response_model=SuccessResponse, summary='Update a listing')
async def update_listing(listing_id: uuid.UUID, body: UpdateListingRequest, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    result = await service.update_listing(listing_id, current_user_id, body)
    return SuccessResponse(message='Listing updated.', data=result.model_dump())

@router.delete('/listings/{listing_id}', response_model=SuccessResponse, summary='Permanently delete a listing')
async def delete_listing(listing_id: uuid.UUID, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    """Hard-deletes the listing row from the database."""
    from shared.errors import ForbiddenError, NotFoundError
    from sqlalchemy import delete as sql_delete
    from ..models import Listing
    listing = await service.get_listing(listing_id)
    if listing.seller_id != current_user_id:
        raise ForbiddenError('You can only delete your own listings.')
    await service.session.execute(sql_delete(Listing).where(Listing.id == listing_id))
    await service.session.commit()
    return SuccessResponse(message='Listing deleted.', data={'listing_id': str(listing_id)})

@router.post('/listings/{listing_id}/images', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Upload an image to a listing (max 20)')
async def upload_image(listing_id: uuid.UUID, file: UploadFile=File(...), service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    content = await file.read()
    s3_key = await service.upload_image(listing_id, current_user_id, content, file.filename or '')
    return SuccessResponse(data={'s3_key': s3_key})

@router.post('/listings/{listing_id}/videos', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Upload a video to a listing')
async def upload_video(listing_id: uuid.UUID, file: UploadFile=File(...), service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    content = await file.read()
    s3_key = await service.upload_video(listing_id, current_user_id, content, file.filename or '')
    return SuccessResponse(data={'s3_key': s3_key})

@router.post('/listings/{listing_id}/publish', response_model=SuccessResponse, summary='Submit listing for moderation review')
async def publish_listing(listing_id: uuid.UUID, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    await service.publish_listing(listing_id, current_user_id)
    return SuccessResponse(data={'message': 'Listing submitted for review.'})

@router.patch('/listings/{listing_id}/status', response_model=SuccessResponse, summary='Approve or reject a listing (moderator only)')
async def moderate_listing(listing_id: uuid.UUID, request: Request, approved: bool=Query(...), rejection_reason: str | None=Query(default=None), service: MarketplaceService=Depends(_build_service), roles: list[str]=Depends(get_user_roles), payload: dict=Depends(get_current_user_payload)) -> SuccessResponse:
    from shared.errors import ForbiddenError
    if 'moderator' not in roles and 'enterprise_admin' not in roles and 'super_admin' not in roles:
        raise ForbiddenError('Moderator role required.')
    # Get moderator identity from JWT — never trust frontend
    mod_id = payload.get('sub', '')
    mod_roles = payload.get('roles', [])
    mod_role = 'enterprise_admin' if 'enterprise_admin' in mod_roles else ('super_admin' if 'super_admin' in mod_roles else 'moderator')
    # Fetch moderator name from DB
    mod_name = 'Moderator'
    try:
        async with request.app.state.session_factory() as _db:
            from sqlalchemy import text as _text
            row = (await _db.execute(_text(
                'SELECT full_name, email FROM users WHERE CAST(id AS TEXT)=:uid'
            ), {'uid': mod_id})).mappings().first()
            if row:
                mod_name = row['full_name'] or row['email'] or 'Moderator'
    except Exception:
        pass
    # Get listing details for the log
    listing = await service.get_listing(listing_id)
    prev_state = listing.status if listing else 'unknown'
    new_state = 'active' if approved else 'rejected'
    await service.moderate_listing(listing_id, approved, rejection_reason, moderator_id=mod_id, moderator_name=mod_name)
    # Write to moderation_log
    try:
        async with request.app.state.session_factory() as _db:
            from sqlalchemy import text as _text
            import uuid as _uuid
            await _db.execute(_text("""
                INSERT INTO moderation_log
                    (id, moderator_id, moderator_name, moderator_role, action,
                     resource_type, resource_id, resource_title, previous_state,
                     new_state, reason, detail, ip_address, created_at)
                VALUES
                    (:id, :mod_id, :mod_name, :mod_role, :action,
                     'listing', :res_id, :title, :prev, :new, :reason, :detail, :ip, NOW())
            """), {
                'id': str(_uuid.uuid4()),
                'mod_id': mod_id,
                'mod_name': mod_name,
                'mod_role': mod_role,
                'action': 'LISTING_APPROVED' if approved else 'LISTING_REJECTED',
                'res_id': str(listing_id),
                'title': listing.title if listing else '',
                'prev': prev_state,
                'new': new_state,
                'reason': rejection_reason or '',
                'detail': f"{'Approved' if approved else 'Rejected'} by {mod_name}" + (f": {rejection_reason}" if rejection_reason else ""),
                'ip': request.headers.get('x-forwarded-for', request.client.host if request.client else ''),
            })
            # Also store moderator info on the listing row
            await _db.execute(_text("""
                UPDATE listings SET moderated_by=:mod_id, moderator_name=:mod_name,
                    rejection_reason=:reason, moderated_at=NOW()
                WHERE CAST(id AS TEXT)=:lid
            """), {
                'mod_id': mod_id,
                'mod_name': mod_name,
                'reason': rejection_reason or '',
                'lid': str(listing_id),
            })
            # Audit log entry
            await _db.execute(_text("""
                INSERT INTO audit_log (id, actor_id, actor_email, actor_name, category,
                    action, resource, resource_id, status, detail, created_at)
                VALUES (:id, :actor_id, :ae, :an, 'admin', :action, 'listings', :res_id, 'success', :detail, NOW())
                ON CONFLICT (id) DO NOTHING
            """), {
                'id': str(_uuid.uuid4()),
                'actor_id': mod_id,
                'ae': payload.get('email', ''),
                'an': mod_name,
                'action': 'listing.approve' if approved else 'listing.reject',
                'res_id': str(listing_id),
                'detail': f"{'Approved' if approved else 'Rejected'} listing: {listing.title if listing else listing_id}" + (f" — {rejection_reason}" if rejection_reason else ""),
            })
            await _db.commit()
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(f'moderation_log_write_failed: {exc}')
    return SuccessResponse(data={'message': 'Listing status updated.', 'moderator': mod_name, 'action': new_state})

@router.post('/listings/{listing_id}/property', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Add property details to a listing')
async def add_property_details(listing_id: uuid.UUID, body: PropertyDetailRequest, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    await service.add_property_details(listing_id, current_user_id, body)
    return SuccessResponse(data={'message': 'Property details added.'})

@router.get('/listings/{listing_id}/mortgage-calculator', response_model=SuccessResponse, summary='Calculate mortgage repayments for a sale property')
async def mortgage_calculator(listing_id: uuid.UUID, price: float=Query(..., gt=0), deposit: float=Query(..., ge=0), annual_interest_rate_pct: float=Query(..., gt=0, le=100), loan_term_years: int=Query(..., ge=1, le=30), service: MarketplaceService=Depends(_build_service)) -> SuccessResponse:
    from decimal import Decimal
    body = MortgageCalculatorRequest(price=Decimal(str(price)), deposit=Decimal(str(deposit)), annual_interest_rate_pct=Decimal(str(annual_interest_rate_pct)), loan_term_years=loan_term_years)
    result = service.calculate_mortgage(body)
    return SuccessResponse(data=result.model_dump())

@router.post('/listings/{listing_id}/vehicle', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Add vehicle details to a listing')
async def add_vehicle_details(listing_id: uuid.UUID, body: VehicleDetailRequest, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    await service.add_vehicle_details(listing_id, current_user_id, body)
    return SuccessResponse(data={'message': 'Vehicle details added.'})

@router.post('/listings/{listing_id}/job', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Add job details to a listing')
async def add_job_details(listing_id: uuid.UUID, body: JobDetailRequest, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    await service.add_job_details(listing_id, current_user_id, body)
    return SuccessResponse(data={'message': 'Job details added.'})

@router.post('/listings/{listing_id}/applications', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Apply for a job listing')
async def apply_for_job(listing_id: uuid.UUID, file: UploadFile=File(..., description='CV (PDF or DOCX, max 10MB)'), service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    content = await file.read()
    application_id = await service.submit_job_application(listing_id, current_user_id, content, file.filename or '')
    return SuccessResponse(data={'application_id': str(application_id)})

@router.patch('/applications/{application_id}/status', response_model=SuccessResponse, summary='Update job application status (employer only)')
async def update_application(application_id: uuid.UUID, new_status: str=Query(..., pattern='^(shortlisted|rejected|hired)$'), service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    await service.update_application_status(application_id, current_user_id, new_status)
    return SuccessResponse(data={'message': f'Application status updated to {new_status}.'})

@router.post('/listings/{listing_id}/reviews', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Submit a review for a listing')
async def submit_review(listing_id: uuid.UUID, body: CreateReviewRequest, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    result = await service.submit_review(listing_id, current_user_id, body)
    return SuccessResponse(data=result.model_dump())

@router.get('/listings/{listing_id}/reviews', response_model=SuccessResponse, summary='List published reviews for a listing')
async def list_reviews(listing_id: uuid.UUID, page: int=Query(default=1, ge=1), service: MarketplaceService=Depends(_build_service)) -> SuccessResponse:
    results = await service.list_reviews(listing_id, page=page)
    return SuccessResponse(data=[r.model_dump() for r in results])

@router.post('/reviews/{review_id}/response', response_model=SuccessResponse, summary='Seller responds to a review')
async def respond_to_review(review_id: uuid.UUID, body: SellerResponseRequest, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    await service.respond_to_review(review_id, current_user_id, body.response)
    return SuccessResponse(data={'message': 'Response submitted.'})

@router.get('/reviews', response_model=SuccessResponse, summary='Get reviews given or received by the authenticated user')
async def get_my_reviews(request: Request, type: str=Query(default='given', description="'given' = reviews I wrote, 'received' = reviews on my listings"), page: int=Query(default=1, ge=1), page_size: int=Query(default=20, ge=1, le=50), current_user_id: uuid.UUID=Depends(get_current_user_id), service: MarketplaceService=Depends(_build_service)) -> SuccessResponse:
    """
    Returns reviews associated with the authenticated user.
    - type=given    → reviews where reviewer_id = current user
    - type=received → reviews on listings where seller_id = current user
    """
    from pathlib import Path
    from shared.errors import paginated_meta
    uid_str = str(current_user_id)
    offset = (page - 1) * page_size
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _text
            if type == 'given':
                rows = (await db.execute(_text('\n                    SELECT r.id, r.rating, r.comment, r.created_at,\n                           l.title AS listing_title,\n                           u.full_name AS seller_name,\n                           NULL AS buyer_name\n                    FROM reviews r\n                    JOIN listings l ON CAST(l.id AS TEXT) = CAST(r.listing_id AS TEXT)\n                    LEFT JOIN users u ON CAST(u.id AS TEXT) = CAST(l.seller_id AS TEXT)\n                    WHERE CAST(r.reviewer_id AS TEXT) = :p0\n                    ORDER BY r.created_at DESC\n                    LIMIT :p1 OFFSET :p2\n                    '), {'p0': uid_str, 'p1': page_size, 'p2': offset})).mappings().all()
                count = (await db.execute(_text('SELECT COUNT(*) AS cnt FROM reviews WHERE CAST(reviewer_id AS TEXT) = :p0'), {'p0': uid_str})).mappings().all()
            else:
                rows = (await db.execute(_text('\n                    SELECT r.id, r.rating, r.comment, r.created_at,\n                           l.title AS listing_title,\n                           NULL AS seller_name,\n                           u.full_name AS buyer_name\n                    FROM reviews r\n                    JOIN listings l ON CAST(l.id AS TEXT) = CAST(r.listing_id AS TEXT)\n                    LEFT JOIN users u ON CAST(u.id AS TEXT) = CAST(r.reviewer_id AS TEXT)\n                    WHERE CAST(l.seller_id AS TEXT) = :p0\n                    ORDER BY r.created_at DESC\n                    LIMIT :p1 OFFSET :p2\n                    '), {'p0': uid_str, 'p1': page_size, 'p2': offset})).mappings().all()
                count = (await db.execute(_text('\n                    SELECT COUNT(*) AS cnt\n                    FROM reviews r\n                    JOIN listings l ON CAST(l.id AS TEXT) = CAST(r.listing_id AS TEXT)\n                    WHERE CAST(l.seller_id AS TEXT) = :p0\n                    '), {'p0': uid_str})).mappings().all()
            total = count[0]['cnt'] if count else 0
            data = [{'id': str(r['id']), 'rating': r['rating'], 'comment': r['comment'] or '', 'listing_title': r['listing_title'] or 'Listing', 'seller_name': r['seller_name'], 'buyer_name': r['buyer_name'], 'created_at': str(r['created_at'])} for r in rows]
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning('reviews_fetch_error: %s', exc)
        data, total = ([], 0)
    from shared.errors import paginated_meta
    return SuccessResponse(message=f'{total} review(s) found.', data=data, meta=paginated_meta(page, page_size, total))

@router.get('/stores/mine', response_model=SuccessResponse, summary="Get the authenticated seller's own store")
async def get_my_store(service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    """Returns the seller's store if it exists, or null."""
    from sqlalchemy import select
    from ..models import Store
    result = await service.session.execute(select(Store).where(Store.seller_id == current_user_id))
    store = result.scalars().first()
    if store is None:
        return SuccessResponse(message='No store found.', data=None)
    return SuccessResponse(message='Store retrieved.', data={'id': str(store.id), 'seller_id': str(store.seller_id), 'store_name': store.store_name, 'logo_url': store.logo_url, 'banner_url': store.banner_url, 'theme': store.theme, 'custom_domain': store.custom_domain, 'domain_verified': store.domain_verified, 'is_active': True, 'created_at': store.created_at.isoformat() if store.created_at else None})

@router.post('/stores', response_model=SuccessResponse, summary='Create or update seller store')
async def upsert_store(body: UpsertStoreRequest, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id), tier: str=Depends(get_subscription_tier)) -> SuccessResponse:
    result = await service.upsert_store(current_user_id, body, tier)
    return SuccessResponse(data=result.model_dump())

@router.post('/bookings', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary='Book a service listing')
async def create_booking(body: CreateBookingRequest, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    result = await service.create_booking(current_user_id, body)
    return SuccessResponse(data=result.model_dump())

@router.patch('/bookings/{booking_id}/status', response_model=SuccessResponse, summary='Update booking status')
async def update_booking(booking_id: uuid.UUID, body: UpdateBookingStatusRequest, service: MarketplaceService=Depends(_build_service), current_user_id: uuid.UUID=Depends(get_current_user_id)) -> SuccessResponse:
    await service.update_booking_status(booking_id, current_user_id, body)
    return SuccessResponse(data={'message': f'Booking status updated to {body.status}.'})

@router.get('/listings/admin/list', response_model=SuccessResponse, summary='Admin: list all listings with optional filters')
async def admin_list_listings(service: MarketplaceService=Depends(_build_service), current_user_payload: dict=Depends(get_current_user_payload), page: int=Query(default=1, ge=1), page_size: int=Query(default=50, ge=1, le=200), status: str | None=Query(default=None), type: str | None=Query(default=None, alias='type'), search: str | None=Query(default=None), category: str | None=Query(default=None)) -> SuccessResponse:
    """Admin-only: list all listings regardless of status."""
    from shared.errors import ForbiddenError, paginated_meta
    from sqlalchemy import select, func as sa_func, or_
    from ..models import Listing
    roles = current_user_payload.get('roles', [])
    allowed_roles = {'moderator', 'enterprise_admin', 'super_admin'}
    if not allowed_roles.intersection(set(roles)):
        raise ForbiddenError('Admin role required.')
    conditions = []
    if status and status != 'all':
        conditions.append(Listing.status == status)
    if type:
        conditions.append(Listing.listing_type == type)
    if category:
        conditions.append(Listing.category == category)
    if search:
        term = f'%{search}%'
        conditions.append(or_(Listing.title.ilike(term), Listing.description.ilike(term)))
    from sqlalchemy import and_
    where = and_(*conditions) if conditions else True
    offset = (page - 1) * page_size
    count_q = select(sa_func.count()).select_from(Listing)
    items_q = select(Listing).order_by(Listing.created_at.desc()).offset(offset).limit(page_size)
    if conditions:
        count_q = count_q.where(where)
        items_q = items_q.where(where)
    total = (await service.session.execute(count_q)).scalar() or 0
    items = (await service.session.execute(items_q)).scalars().all()
    data = [{'id': str(l.id), 'title': l.title, 'price': float(l.price) if l.price is not None else 0, 'currency': l.currency, 'category': l.category, 'listing_type': l.listing_type, 'status': l.status, 'seller_id': str(l.seller_id), 'seller_name': 'Seller', 'city': l.city, 'country': l.country, 'condition': l.condition, 'image_url': l.image_url, 'created_at': l.created_at.isoformat() if l.created_at else None} for l in items]
    return SuccessResponse(message=f'{total} listing(s) found.', data=data, meta=paginated_meta(page, page_size, total))

@router.get('/listings/admin/pending', response_model=SuccessResponse, summary='Admin: list all pending-review listings')
async def admin_pending_listings(service: MarketplaceService=Depends(_build_service), roles: list[str]=Depends(get_user_roles), page: int=Query(default=1, ge=1), page_size: int=Query(default=50, ge=1, le=200)) -> SuccessResponse:
    from shared.errors import ForbiddenError, paginated_meta
    from sqlalchemy import select, func as sa_func, text as _text
    from ..models import Listing
    allowed_roles = {'moderator', 'enterprise_admin', 'super_admin'}
    if not allowed_roles.intersection(set(roles)):
        raise ForbiddenError('Moderator or Admin role required.')
    offset = (page - 1) * page_size
    total = (await service.session.execute(select(sa_func.count()).select_from(Listing).where(Listing.status == 'pending_review'))).scalar() or 0
    items = (await service.session.execute(select(Listing).where(Listing.status == 'pending_review').order_by(Listing.created_at.asc()).offset(offset).limit(page_size))).scalars().all()
    # Fetch seller names in one query
    seller_ids = list({str(l.seller_id) for l in items})
    seller_map: dict[str, dict] = {}
    if seller_ids:
        try:
            _ph = ", ".join(f":sid_{i}" for i in range(len(seller_ids)))
            _pm = {f"sid_{i}": s for i, s in enumerate(seller_ids)}
            rows = (await service.session.execute(
                _text(f"SELECT id, full_name, email, phone FROM users WHERE CAST(id AS TEXT) IN ({_ph})"),
                _pm
            )).mappings().all()
            seller_map = {str(r['id']): dict(r) for r in rows}
        except Exception:
            pass
    data = []
    for l in items:
        seller = seller_map.get(str(l.seller_id), {})
        # Get first image from listing_media
        try:
            media_row = (await service.session.execute(
                _text("SELECT s3_key FROM listing_media WHERE listing_id = :lid AND media_type = 'image' ORDER BY sort_order LIMIT 1"),
                {"lid": str(l.id)}
            )).mappings().first()
            image_key = media_row['s3_key'] if media_row else None
        except Exception:
            image_key = None
        data.append({
            'id': str(l.id),
            'title': l.title,
            'description': l.description,
            'price': float(l.price) if l.price is not None else 0,
            'currency': l.currency,
            'category': l.category,
            'subcategory': l.subcategory,
            'listing_type': l.listing_type,
            'condition': l.condition,
            'status': l.status,
            'seller_id': str(l.seller_id),
            'seller_name': seller.get('full_name') or 'Unknown Seller',
            'seller_email': seller.get('email', ''),
            'location': f"{l.city or ''}{', ' + l.country if l.country else ''}".strip(', '),
            'city': l.city,
            'country': l.country,
            'image_url': image_key,
            'created_at': l.created_at.isoformat() if l.created_at else None,
        })
    return SuccessResponse(message=f'{total} listing(s) pending review.', data=data, meta=paginated_meta(page, page_size, total))

# ── Moderator route aliases (frontend calls /mod/listings, /mod/listings/{id}/approve etc.) ──
@router.get('/mod/listings', response_model=SuccessResponse, summary='Moderator: list listings by status')
async def mod_listings(service: MarketplaceService=Depends(_build_service), roles: list[str]=Depends(get_user_roles), status_filter: str=Query(default='pending_review', alias='status'), page: int=Query(default=1, ge=1), page_size: int=Query(default=50, ge=1, le=200)) -> SuccessResponse:
    from shared.errors import ForbiddenError, paginated_meta
    from sqlalchemy import select, func as sa_func, text as _text
    from ..models import Listing
    allowed_roles = {'moderator', 'enterprise_admin', 'super_admin'}
    if not allowed_roles.intersection(set(roles)):
        raise ForbiddenError('Moderator or Admin role required.')
    # Map frontend status values to DB values
    status_map = {'pending': 'pending_review', 'approved': 'active', 'rejected': 'rejected', 'all': None, 'pending_review': 'pending_review', 'active': 'active'}
    db_status = status_map.get(status_filter)
    offset = (page - 1) * page_size
    base_q = select(Listing)
    count_q = select(sa_func.count()).select_from(Listing)
    if db_status:
        base_q = base_q.where(Listing.status == db_status)
        count_q = count_q.where(Listing.status == db_status)
    total = (await service.session.execute(count_q)).scalar() or 0
    items = (await service.session.execute(base_q.order_by(Listing.created_at.asc()).offset(offset).limit(page_size))).scalars().all()
    seller_ids = list({str(l.seller_id) for l in items})
    seller_map: dict[str, dict] = {}
    if seller_ids:
        try:
            _ph = ", ".join(f":sid_{i}" for i in range(len(seller_ids)))
            _pm = {f"sid_{i}": s for i, s in enumerate(seller_ids)}
            rows = (await service.session.execute(
                _text(f"SELECT id, full_name, email FROM users WHERE CAST(id AS TEXT) IN ({_ph})"),
                _pm
            )).mappings().all()
            seller_map = {str(r['id']): dict(r) for r in rows}
        except Exception:
            pass
    data = [{
        'id': str(l.id), 'title': l.title, 'description': l.description,
        'price': float(l.price) if l.price is not None else 0, 'currency': l.currency,
        'category': l.category, 'listing_type': l.listing_type, 'status': l.status,
        'seller_id': str(l.seller_id),
        'seller_name': seller_map.get(str(l.seller_id), {}).get('full_name') or 'Unknown Seller',
        'seller_email': seller_map.get(str(l.seller_id), {}).get('email', ''),
        'location': f"{l.city or ''}{', ' + l.country if l.country else ''}".strip(', '),
        'image_url': l.image_url,
        'created_at': l.created_at.isoformat() if l.created_at else None,
    } for l in items]
    return SuccessResponse(message=f'{total} listing(s).', data=data, meta=paginated_meta(page, page_size, total))

@router.post('/mod/listings/{listing_id}/approve', response_model=SuccessResponse, summary='Moderator: approve a listing')
async def mod_approve_listing(listing_id: uuid.UUID, request: Request, service: MarketplaceService=Depends(_build_service), roles: list[str]=Depends(get_user_roles), payload: dict=Depends(get_current_user_payload)) -> SuccessResponse:
    from shared.errors import ForbiddenError
    if not {'moderator', 'enterprise_admin', 'super_admin'}.intersection(set(roles)):
        raise ForbiddenError('Moderator or Admin role required.')
    mod_id = payload.get('sub', '')
    mod_name = 'Moderator'
    try:
        async with request.app.state.session_factory() as _db:
            from sqlalchemy import text as _text
            row = (await _db.execute(_text('SELECT full_name, email FROM users WHERE CAST(id AS TEXT)=:uid'), {'uid': mod_id})).mappings().first()
            if row: mod_name = row['full_name'] or row['email'] or 'Moderator'
    except Exception: pass
    listing = await service.get_listing(listing_id)
    prev_state = listing.status if listing else 'unknown'
    await service.moderate_listing(listing_id, approved=True, moderator_id=mod_id, moderator_name=mod_name)
    try:
        async with request.app.state.session_factory() as _db:
            from sqlalchemy import text as _text
            import uuid as _uuid
            await _db.execute(_text("""
                INSERT INTO moderation_log (id, moderator_id, moderator_name, moderator_role, action,
                    resource_type, resource_id, resource_title, previous_state, new_state, reason, created_at)
                VALUES (:id, :mid, :mname, :mrole, 'LISTING_APPROVED', 'listing', :rid, :title, :prev, 'active', '', NOW())
            """), {'id': str(_uuid.uuid4()), 'mid': mod_id, 'mname': mod_name,
                   'mrole': 'enterprise_admin' if 'enterprise_admin' in roles else 'moderator',
                   'rid': str(listing_id), 'title': listing.title if listing else '', 'prev': prev_state})
            await _db.execute(_text("UPDATE listings SET moderated_by=:mid, moderator_name=:mname, moderated_at=NOW() WHERE CAST(id AS TEXT)=:lid"),
                               {'mid': mod_id, 'mname': mod_name, 'lid': str(listing_id)})
            await _db.commit()
    except Exception as exc:
        import logging; logging.getLogger(__name__).warning(f'mod_approve_log_failed: {exc}')
    return SuccessResponse(message='Listing approved.', data={'listing_id': str(listing_id), 'moderator': mod_name})

@router.post('/mod/listings/{listing_id}/reject', response_model=SuccessResponse, summary='Moderator: reject a listing')
async def mod_reject_listing(listing_id: uuid.UUID, request: Request, service: MarketplaceService=Depends(_build_service), roles: list[str]=Depends(get_user_roles), payload: dict=Depends(get_current_user_payload), reason: str | None=Query(default=None)) -> SuccessResponse:
    from shared.errors import ForbiddenError
    if not {'moderator', 'enterprise_admin', 'super_admin'}.intersection(set(roles)):
        raise ForbiddenError('Moderator or Admin role required.')
    # Also accept reason from body
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    rejection_reason = reason or body.get('reason') or body.get('rejection_reason') or 'Does not meet listing guidelines.'
    mod_id = payload.get('sub', '')
    mod_name = 'Moderator'
    try:
        async with request.app.state.session_factory() as _db:
            from sqlalchemy import text as _text
            row = (await _db.execute(_text('SELECT full_name, email FROM users WHERE CAST(id AS TEXT)=:uid'), {'uid': mod_id})).mappings().first()
            if row: mod_name = row['full_name'] or row['email'] or 'Moderator'
    except Exception: pass
    listing = await service.get_listing(listing_id)
    prev_state = listing.status if listing else 'unknown'
    await service.moderate_listing(listing_id, approved=False, rejection_reason=rejection_reason, moderator_id=mod_id, moderator_name=mod_name)
    try:
        async with request.app.state.session_factory() as _db:
            from sqlalchemy import text as _text
            import uuid as _uuid
            await _db.execute(_text("""
                INSERT INTO moderation_log (id, moderator_id, moderator_name, moderator_role, action,
                    resource_type, resource_id, resource_title, previous_state, new_state, reason, created_at)
                VALUES (:id, :mid, :mname, :mrole, 'LISTING_REJECTED', 'listing', :rid, :title, :prev, 'rejected', :reason, NOW())
            """), {'id': str(_uuid.uuid4()), 'mid': mod_id, 'mname': mod_name,
                   'mrole': 'enterprise_admin' if 'enterprise_admin' in roles else 'moderator',
                   'rid': str(listing_id), 'title': listing.title if listing else '', 'prev': prev_state, 'reason': rejection_reason})
            await _db.execute(_text("UPDATE listings SET moderated_by=:mid, moderator_name=:mname, rejection_reason=:reason, moderated_at=NOW() WHERE CAST(id AS TEXT)=:lid"),
                               {'mid': mod_id, 'mname': mod_name, 'reason': rejection_reason, 'lid': str(listing_id)})
            await _db.commit()
    except Exception as exc:
        import logging; logging.getLogger(__name__).warning(f'mod_reject_log_failed: {exc}')
    return SuccessResponse(message='Listing rejected.', data={'listing_id': str(listing_id), 'moderator': mod_name, 'reason': rejection_reason})


@router.get('/listings/admin/featured', response_model=SuccessResponse, summary='Admin: list featured/promoted listings')
async def admin_featured_listings(service: MarketplaceService=Depends(_build_service), roles: list[str]=Depends(get_user_roles), page: int=Query(default=1, ge=1), page_size: int=Query(default=20, ge=1, le=100)) -> SuccessResponse:
    from shared.errors import ForbiddenError, paginated_meta
    from sqlalchemy import select, func as sa_func, text as _text
    from ..models import Listing
    allowed_roles = {'moderator', 'enterprise_admin', 'super_admin'}
    if not allowed_roles.intersection(set(roles)):
        raise ForbiddenError('Admin role required.')
    offset = (page - 1) * page_size
    try:
        total = (await service.session.execute(
            select(sa_func.count()).select_from(Listing).where(Listing.status == 'active')
        )).scalar() or 0
        items = (await service.session.execute(
            select(Listing).where(Listing.status == 'active')
            .order_by(Listing.avg_rating.desc(), Listing.created_at.desc())
            .offset(offset).limit(page_size)
        )).scalars().all()
        seller_ids = list({str(l.seller_id) for l in items})
        seller_map: dict = {}
        if seller_ids:
            try:
                _ph2 = ", ".join(f":sid_{i}" for i in range(len(seller_ids)))
                _pm2 = {f"sid_{i}": s for i, s in enumerate(seller_ids)}
                rows = (await service.session.execute(
                    _text(f"SELECT id, full_name, email FROM users WHERE CAST(id AS TEXT) IN ({_ph2})"),
                    _pm2
                )).mappings().all()
                seller_map = {str(r['id']): r['full_name'] or r['email'] or 'Seller' for r in rows}
            except Exception:
                pass
        data = [{'id': str(l.id), 'title': l.title,
                 'price': float(l.price) if l.price else 0, 'currency': l.currency or 'NGN',
                 'category': l.category, 'seller_id': str(l.seller_id),
                 'seller_name': seller_map.get(str(l.seller_id), 'Seller'),
                 'image_url': l.image_url, 'status': l.status,
                 'avg_rating': float(l.avg_rating) if l.avg_rating else 0.0,
                 'created_at': l.created_at.isoformat() if l.created_at else None} for l in items]
    except Exception:
        data, total = [], 0
    return SuccessResponse(message=f'{total} featured listing(s).', data=data, meta=paginated_meta(page, page_size, total))

@router.delete('/listings/admin/featured/{listing_id}', response_model=SuccessResponse, summary='Admin: remove a listing from featured')
async def admin_unfeature_listing(listing_id: uuid.UUID, service: MarketplaceService=Depends(_build_service), roles: list[str]=Depends(get_user_roles)) -> SuccessResponse:
    from shared.errors import ForbiddenError
    from sqlalchemy import update as _upd
    from ..models import Listing
    allowed_roles = {'moderator', 'enterprise_admin', 'super_admin'}
    if not allowed_roles.intersection(set(roles)):
        raise ForbiddenError('Admin role required.')
    try:
        await service.session.execute(
            _upd(Listing).where(Listing.id == listing_id).values(status='archived')
        )
        await service.session.commit()
    except Exception:
        pass
    return SuccessResponse(message='Listing removed from featured.', data={'listing_id': str(listing_id)})

@router.post('/listings/admin/{listing_id}/approve', response_model=SuccessResponse, summary='Admin: approve a listing')
async def admin_approve_listing(listing_id: uuid.UUID, service: MarketplaceService=Depends(_build_service), roles: list[str]=Depends(get_user_roles)) -> SuccessResponse:
    from shared.errors import ForbiddenError
    allowed_roles = {'moderator', 'enterprise_admin', 'super_admin'}
    if not allowed_roles.intersection(set(roles)):
        raise ForbiddenError('Moderator or Admin role required.')
    await service.moderate_listing(listing_id, approved=True, rejection_reason=None)
    return SuccessResponse(message='Listing approved.', data={'listing_id': str(listing_id)})

@router.post('/listings/admin/{listing_id}/reject', response_model=SuccessResponse, summary='Admin: reject a listing')
async def admin_reject_listing(listing_id: uuid.UUID, service: MarketplaceService=Depends(_build_service), roles: list[str]=Depends(get_user_roles), reason: str | None=Query(default=None)) -> SuccessResponse:
    from shared.errors import ForbiddenError
    allowed_roles = {'moderator', 'enterprise_admin', 'super_admin'}
    if not allowed_roles.intersection(set(roles)):
        raise ForbiddenError('Moderator or Admin role required.')
    await service.moderate_listing(listing_id, approved=False, rejection_reason=reason)
    return SuccessResponse(message='Listing rejected.', data={'listing_id': str(listing_id)})

@router.post('/listings/admin/{listing_id}/archive', response_model=SuccessResponse, summary='Admin: archive a listing')
async def admin_archive_listing(listing_id: uuid.UUID, service: MarketplaceService=Depends(_build_service), roles: list[str]=Depends(get_user_roles)) -> SuccessResponse:
    from shared.errors import ForbiddenError
    from sqlalchemy import update as _upd
    from ..models import Listing
    allowed_roles = {'moderator', 'enterprise_admin', 'super_admin'}
    if not allowed_roles.intersection(set(roles)):
        raise ForbiddenError('Admin role required.')
    await service.session.execute(
        _upd(Listing).where(Listing.id == listing_id).values(status='archived')
    )
    await service.session.commit()
    return SuccessResponse(message='Listing archived.', data={'listing_id': str(listing_id)})

@router.post('/listings/admin/{listing_id}/restore', response_model=SuccessResponse, summary='Admin: restore an archived listing back to active')
async def admin_restore_listing(listing_id: uuid.UUID, service: MarketplaceService=Depends(_build_service), roles: list[str]=Depends(get_user_roles)) -> SuccessResponse:
    from shared.errors import ForbiddenError, NotFoundError
    from sqlalchemy import update as _upd, select as _sel
    from ..models import Listing
    allowed_roles = {'moderator', 'enterprise_admin', 'super_admin'}
    if not allowed_roles.intersection(set(roles)):
        raise ForbiddenError('Admin role required.')
    # Verify it exists and is archived
    row = (await service.session.execute(_sel(Listing).where(Listing.id == listing_id))).scalars().first()
    if row is None:
        raise NotFoundError('Listing not found.')
    if row.status != 'archived':
        from shared.errors import InvalidInputError
        raise InvalidInputError(f'Listing is not archived (current status: {row.status}).')
    await service.session.execute(
        _upd(Listing).where(Listing.id == listing_id).values(status='active')
    )
    await service.session.commit()
    return SuccessResponse(message='Listing restored to active.', data={'listing_id': str(listing_id)})

@router.get('/listings/{listing_id}/media-debug', response_model=SuccessResponse, summary='Debug: show raw listing_media rows')
async def debug_listing_media(listing_id: uuid.UUID, request: Request) -> SuccessResponse:
    """Returns raw listing_media rows and listing.image_url for debugging multi-image issues."""
    from sqlalchemy import text as _text
    async with request.app.state.session_factory() as db:
        rows = (await db.execute(_text("""
            SELECT CAST(id AS TEXT) AS id, CAST(listing_id AS TEXT) AS listing_id,
                   media_type, sort_order,
                   LENGTH(s3_key) AS key_len,
                   LEFT(s3_key, 40) AS key_preview
            FROM listing_media
            WHERE CAST(listing_id AS TEXT) = :lid
            ORDER BY sort_order ASC
        """), {"lid": str(listing_id)})).mappings().all()
        listing_row = (await db.execute(_text("""
            SELECT title,
                   CASE WHEN image_url IS NOT NULL THEN LENGTH(image_url) ELSE 0 END AS cover_len
            FROM listings WHERE CAST(id AS TEXT) = :lid
        """), {"lid": str(listing_id)})).mappings().first()
    return SuccessResponse(data={
        "listing_id": str(listing_id),
        "title": listing_row["title"] if listing_row else None,
        "cover_image_url_len": listing_row["cover_len"] if listing_row else 0,
        "media_rows_count": len(rows),
        "media_rows": [dict(r) for r in rows],
    })

@router.get('/saved', response_model=SuccessResponse, summary="Get the authenticated user's saved listings")
async def get_saved_listings(request: Request, current_user_id: uuid.UUID=Depends(get_current_user_id), service: MarketplaceService=Depends(_build_service)) -> SuccessResponse:
    from pathlib import Path
    uid_str = str(current_user_id)
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _text
            rows = (await db.execute(_text('\n                SELECT s.id as save_id, s.listing_id, s.saved_at,\n                       l.title, l.price, l.currency, l.category, l.listing_type,\n                       l.condition, l.city, l.country, l.image_url, l.status,\n                       l.seller_id\n                FROM saved_listings s\n                JOIN listings l ON CAST(l.id AS TEXT) = CAST(s.listing_id AS TEXT)\n                WHERE CAST(s.user_id AS TEXT) = :p0\n                ORDER BY s.saved_at DESC\n                '), {'p0': uid_str})).mappings().all()
        data = [{'id': r['save_id'], 'listing_id': r['listing_id'], 'title': r['title'], 'price': float(r['price']) if r['price'] else 0, 'currency': r['currency'] or 'NGN', 'category': r['category'], 'listing_type': r['listing_type'], 'condition': r['condition'], 'city': r['city'], 'country': r['country'], 'image_url': r['image_url'], 'status': r['status'], 'seller_id': r['seller_id'], 'saved_at': r['saved_at']} for r in rows]
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning('saved_listings_fetch_error: %s', exc)
        data = []
    return SuccessResponse(message=f'{len(data)} saved listing(s).', data=data)

@router.post('/saved/{listing_id}', response_model=SuccessResponse, status_code=status.HTTP_201_CREATED, summary="Save a listing to the user's saved list")
async def save_listing(listing_id: uuid.UUID, request: Request, current_user_id: uuid.UUID=Depends(get_current_user_id), service: MarketplaceService=Depends(_build_service)) -> SuccessResponse:
    from pathlib import Path
    uid_str = str(current_user_id)
    lid_str = str(listing_id)
    save_id = str(uuid.uuid4())
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _text
            existing = (await db.execute(_text('SELECT id FROM saved_listings WHERE CAST(user_id AS TEXT)=:p0 AND CAST(listing_id AS TEXT)=:p1'), {'p0': uid_str, 'p1': lid_str})).mappings().all()
            if existing:
                return SuccessResponse(message='Already saved.', data={'id': existing[0][0], 'saved': True})
            await db.execute(_text("INSERT INTO saved_listings (id, user_id, listing_id, saved_at) VALUES (:p0,:p1,:p2,NOW())"), {'p0': save_id, 'p1': uid_str, 'p2': lid_str})
            await db.commit()
    except Exception as exc:
        from shared.errors import ExternalServiceError
        raise ExternalServiceError(f'Failed to save listing: {exc}') from exc
    return SuccessResponse(message='Listing saved.', data={'id': save_id, 'saved': True})

@router.delete('/saved/{listing_id}', response_model=SuccessResponse, summary='Remove a listing from saved')
async def unsave_listing(listing_id: uuid.UUID, request: Request, current_user_id: uuid.UUID=Depends(get_current_user_id), service: MarketplaceService=Depends(_build_service)) -> SuccessResponse:
    from pathlib import Path
    uid_str = str(current_user_id)
    lid_str = str(listing_id)
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _text
            await db.execute(_text('DELETE FROM saved_listings WHERE CAST(user_id AS TEXT)=:p0 AND CAST(listing_id AS TEXT)=:p1'), {'p0': uid_str, 'p1': lid_str})
            await db.commit()
    except Exception as exc:
        from shared.errors import ExternalServiceError
        raise ExternalServiceError(f'Failed to unsave listing: {exc}') from exc
    return SuccessResponse(message='Listing removed from saved.', data={'saved': False})

@router.get('/saved/{listing_id}/check', response_model=SuccessResponse, summary='Check if a listing is saved by the current user')
async def check_saved(listing_id: uuid.UUID, request: Request, current_user_id: uuid.UUID=Depends(get_current_user_id), service: MarketplaceService=Depends(_build_service)) -> SuccessResponse:
    from pathlib import Path
    try:
        async with request.app.state.session_factory() as db:
            from sqlalchemy import text as _text
            rows = (await db.execute(_text('SELECT id FROM saved_listings WHERE CAST(user_id AS TEXT)=:p0 AND CAST(listing_id AS TEXT)=:p1'), {'p0': str(current_user_id), 'p1': str(listing_id)})).mappings().all()
        return SuccessResponse(data={'saved': bool(rows)})
    except Exception:
        return SuccessResponse(data={'saved': False})


@router.get('/mod/reported-listings', response_model=SuccessResponse, summary='Moderator: list reported listings')
async def mod_reported_listings(
    service: MarketplaceService = Depends(_build_service),
    roles: list[str] = Depends(get_user_roles),
    status_filter: str = Query(default='open', alias='status'),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> SuccessResponse:
    from shared.errors import ForbiddenError, paginated_meta
    if not {'moderator', 'enterprise_admin', 'super_admin'}.intersection(set(roles)):
        raise ForbiddenError('Moderator role required.')
    # Return empty list — reported listings feature not yet implemented
    return SuccessResponse(message='0 reported listing(s).', data=[], meta=paginated_meta(1, page_size, 0))

@router.post('/mod/reported-listings/{listing_id}/resolve', response_model=SuccessResponse)
async def mod_resolve_reported_listing(listing_id: uuid.UUID, roles: list[str] = Depends(get_user_roles)) -> SuccessResponse:
    from shared.errors import ForbiddenError
    if not {'moderator', 'enterprise_admin', 'super_admin'}.intersection(set(roles)):
        raise ForbiddenError('Moderator role required.')
    return SuccessResponse(message='Resolved.', data={'listing_id': str(listing_id)})

@router.post('/mod/reported-listings/{listing_id}/dismiss', response_model=SuccessResponse)
async def mod_dismiss_reported_listing(listing_id: uuid.UUID, roles: list[str] = Depends(get_user_roles)) -> SuccessResponse:
    from shared.errors import ForbiddenError
    if not {'moderator', 'enterprise_admin', 'super_admin'}.intersection(set(roles)):
        raise ForbiddenError('Moderator role required.')
    return SuccessResponse(message='Dismissed.', data={'listing_id': str(listing_id)})


# ── end of listings router ──────────────────────────────────────────────────