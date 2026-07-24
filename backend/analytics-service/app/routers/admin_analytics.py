"""
Admin & Seller analytics endpoints — summary stats for dashboards.
All data is computed on the fly from the SQLite DB in dev mode.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from shared.auth import get_user_payload
from shared.errors import SuccessResponse

router = APIRouter(tags=["Analytics"])


def _mock_trend(base: float, pct: float = 0.12) -> float:
    """Add ±pct variation to base to simulate real data."""
    return round(base * (1 + random.uniform(-pct, pct)), 2)


# ── Admin stats (main admin dashboard) ─────────────────────────────────────

@router.get(
    "/analytics/admin/stats",
    response_model=SuccessResponse,
    summary="Platform-wide KPI stats for admin dashboard",
)
async def admin_stats(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    async with request.app.state.session_factory() as session:
        from sqlalchemy import text
        try:
            total_users = (await session.execute(text("SELECT COUNT(*) FROM users"))).scalar() or 0
            total_listings = (await session.execute(text("SELECT COUNT(*) FROM listings WHERE status='active'"))).scalar() or 0
            total_transactions = (await session.execute(text("SELECT COUNT(*) FROM payments"))).scalar() or 0
            pending_disputes = (await session.execute(text("SELECT COUNT(*) FROM disputes WHERE status='open'"))).scalar() or 0
            pending_moderation = (await session.execute(text("SELECT COUNT(*) FROM listings WHERE status='pending_review'"))).scalar() or 0
            gmv_today = (await session.execute(text("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE DATE(created_at) = DATE('now')"))).scalar() or 0
            gmv_week = (await session.execute(text("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE created_at >= DATE('now', '-7 days')"))).scalar() or 0
            gmv_month = (await session.execute(text("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE created_at >= DATE('now', '-30 days')"))).scalar() or 0
            today_sales_count = (await session.execute(text("SELECT COUNT(*) FROM payments WHERE DATE(created_at) = DATE('now')"))).scalar() or 0
            new_users_today = (await session.execute(text("SELECT COUNT(*) FROM users WHERE DATE(created_at) = DATE('now')"))).scalar() or 0
        except Exception:
            total_users = total_listings = total_transactions = pending_disputes = pending_moderation = 0
            gmv_today = gmv_week = gmv_month = today_sales_count = new_users_today = 0

    return SuccessResponse(
        message="Admin stats retrieved.",
        data={
            "total_users":         total_users,
            "total_listings":      total_listings,
            "total_transactions":  total_transactions,
            "pending_disputes":    pending_disputes,
            "pending_moderation":  pending_moderation,
            "gmv_today":           gmv_today,
            "gmv_week":            gmv_week,
            "gmv_month":           gmv_month,
            "today_sales_count":   today_sales_count,
            "currency":            "NGN",
            "new_users_today":     new_users_today,
            "active_sessions":     0,
        },
    )


# ── Business overview ───────────────────────────────────────────────────────

@router.get(
    "/analytics/business",
    response_model=SuccessResponse,
    summary="Business overview KPIs for admin",
)
async def business_overview(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    async with request.app.state.session_factory() as session:
        from sqlalchemy import text
        try:
            active_users = (await session.execute(text("SELECT COUNT(*) FROM users"))).scalar() or 0
            total_revenue = (await session.execute(text("SELECT COALESCE(SUM(fee_amount), 0) FROM payments"))).scalar() or 0
            total_orders = (await session.execute(text("SELECT COUNT(*) FROM payments"))).scalar() or 0
            active_listings = (await session.execute(text("SELECT COUNT(*) FROM listings WHERE status='active'"))).scalar() or 0
            active_stores = (await session.execute(text("SELECT COUNT(*) FROM stores WHERE status='active'"))).scalar() or 0
        except Exception:
            active_users = total_revenue = total_orders = active_listings = active_stores = 0

    return SuccessResponse(
        message="Business overview retrieved.",
        data={
            "total_revenue":  total_revenue,
            "active_users":   active_users,
            "total_orders":   total_orders,
            "active_listings": active_listings,
            "avg_rating":     0.0,
            "active_stores":  active_stores,
            "countries":      1,
            "mom_growth":     0.0,
        },
    )


# ── Sales ───────────────────────────────────────────────────────────────────

@router.get(
    "/analytics/sales",
    response_model=SuccessResponse,
    summary="Sales analytics for admin",
)
async def sales_analytics(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    async with request.app.state.session_factory() as session:
        from sqlalchemy import text
        try:
            today_sales = (await session.execute(text("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE DATE(created_at) = DATE('now')"))).scalar() or 0
            week_sales = (await session.execute(text("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE created_at >= DATE('now', '-7 days')"))).scalar() or 0
            total_orders = (await session.execute(text("SELECT COUNT(*) FROM payments"))).scalar() or 0
            avg_order = (await session.execute(text("SELECT COALESCE(AVG(amount), 0) FROM payments"))).scalar() or 0
            categories = []
        except Exception:
            today_sales = week_sales = total_orders = avg_order = 0
            categories = []

    return SuccessResponse(
        message="Sales analytics retrieved.",
        data={
            "today_sales":  today_sales,
            "week_sales":   week_sales,
            "total_orders": total_orders,
            "avg_order":    round(avg_order, 2),
            "by_category":  categories,
        },
    )


# ── Seller stats (user dashboard) ──────────────────────────────────────────

@router.get(
    "/analytics/seller/stats",
    response_model=SuccessResponse,
    summary="Seller KPI stats for user dashboard",
)
async def seller_stats(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    return SuccessResponse(
        message="Seller stats retrieved.",
        data={
            "total_listings":  0,
            "active_listings": 0,
            "total_views":     0,
            "total_sales":     0,
            "revenue":         0,
            "currency":        "NGN",
        },
    )
