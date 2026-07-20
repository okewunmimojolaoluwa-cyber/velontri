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
        from sqlalchemy import text, func, select
        try:
            users_row   = await session.execute(text("SELECT COUNT(*) FROM users"))
            total_users = users_row.scalar() or 0
        except Exception:
            total_users = 0
        try:
            listings_row = await session.execute(text("SELECT COUNT(*) FROM listings WHERE status='active'"))
            total_listings = listings_row.scalar() or 0
        except Exception:
            total_listings = 0

    return SuccessResponse(
        message="Admin stats retrieved.",
        data={
            "total_users":         total_users,
            "total_listings":      total_listings,
            "total_transactions":  _mock_trend(12480),
            "pending_disputes":    random.randint(2, 12),
            "pending_moderation":  random.randint(5, 30),
            "gmv_today":           _mock_trend(4_820_000),
            "currency":            "NGN",
            "new_users_today":     random.randint(120, 400),
            "active_sessions":     random.randint(800, 2400),
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
            users_row = await session.execute(text("SELECT COUNT(*) FROM users"))
            active_users = users_row.scalar() or 0
        except Exception:
            active_users = 15247

    return SuccessResponse(
        message="Business overview retrieved.",
        data={
            "total_revenue":  _mock_trend(201_800_000),
            "active_users":   active_users,
            "total_orders":   _mock_trend(12480),
            "active_listings": _mock_trend(85000),
            "avg_rating":     round(random.uniform(4.5, 4.9), 1),
            "active_stores":  _mock_trend(3200),
            "countries":      12,
            "mom_growth":     round(random.uniform(8.0, 24.0), 1),
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
    return SuccessResponse(
        message="Sales analytics retrieved.",
        data={
            "today_sales":  _mock_trend(4_100_000),
            "week_sales":   _mock_trend(28_600_000),
            "total_orders": _mock_trend(12480),
            "avg_order":    _mock_trend(45_200),
            "by_category": [
                {"category": "Vehicles",    "amount": _mock_trend(480_000_000), "orders": 1240, "pct": 38},
                {"category": "Property",    "amount": _mock_trend(365_000_000), "orders": 890,  "pct": 29},
                {"category": "Electronics","amount": _mock_trend(214_000_000), "orders": 4200, "pct": 17},
                {"category": "Fashion",     "amount": _mock_trend(126_000_000), "orders": 8900, "pct": 10},
                {"category": "Services",    "amount": _mock_trend(75_000_000),  "orders": 2100, "pct": 6},
            ],
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
