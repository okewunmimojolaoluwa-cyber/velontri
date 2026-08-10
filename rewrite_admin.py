import re

with open('backend/analytics-service/app/routers/analytics.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace admin_revenue
admin_revenue_new = """@router.get(
    "/admin/revenue",
    response_model=SuccessResponse,
    summary="Revenue data for admin dashboard",
)
async def admin_revenue(
    request: Request,
    period: str = Query(default="30d"),
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    period_days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}
    days = period_days.get(period, 30)

    import aiosqlite
    from shared.db_path import get_db_path
    db_path = get_db_path()

    data_points = []
    total_revenue = 0
    total_transactions = 0
    active_subscriptions = 0
    
    try:
        async with aiosqlite.connect(str(db_path)) as db:
            db.row_factory = aiosqlite.Row
            rows = await db.execute_fetchall(
                f"SELECT DATE(created_at) as date, COALESCE(SUM(amount), 0) as revenue FROM payments WHERE created_at >= date('now', '-{days} days') GROUP BY DATE(created_at) ORDER BY date ASC"
            )
            data_points = [dict(row) for row in rows]
            total_revenue = sum(p["revenue"] for p in data_points)
            total_transactions = (await db.execute_fetchall(f"SELECT COUNT(*) as cnt FROM payments WHERE created_at >= date('now', '-{days} days')"))[0]["cnt"]
            active_subscriptions = (await db.execute_fetchall("SELECT COUNT(*) as cnt FROM subscriptions WHERE status='active'"))[0]["cnt"]
    except Exception as e:
        print(f"Analytics error: {e}")

    # Fill in missing dates with zero
    from datetime import datetime, timedelta, timezone
    date_map = {p['date']: p['revenue'] for p in data_points}
    full_data = []
    for i in range(days):
        d = (datetime.now(tz=timezone.utc) - timedelta(days=days - i - 1)).date().isoformat()
        full_data.append({"date": d, "revenue": date_map.get(d, 0)})

    platform_fees = round(total_revenue * 0.045)

    return SuccessResponse(
        message="Revenue data retrieved.",
        data={
            "period":                period,
            "data_points":           full_data,
            "total_revenue":         total_revenue,
            "platform_fees":         platform_fees,
            "total_transactions":    total_transactions,
            "active_subscriptions":  active_subscriptions,
            "revenue_change":        0.0,
            "fees_change":           0.0,
            "transactions_change":   0.0,
            "currency":              "NGN",
            "breakdown": [],
            "top_sources": [],
        },
    )"""

content = re.sub(
    r'@router\.get\(\s*"/admin/revenue"[\s\S]*?\]\s*,\s*\}\s*,\s*\)',
    admin_revenue_new,
    content,
    count=1
)

# Replace admin_categories_performance
categories_new = """@router.get(
    "/admin/categories/performance",
    response_model=SuccessResponse,
    summary="Admin category performance metrics",
)
async def admin_categories_performance(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    # Just returning empty array for now since there are no categories
    return SuccessResponse(
        message="Categories performance retrieved.",
        data=[]
    )"""

content = re.sub(
    r'@router\.get\(\s*"/admin/categories/performance"[\s\S]*?\]\s*\)\s*',
    categories_new,
    content,
    count=1
)

# Replace admin_business_summary
business_summary_new = """@router.get(
    "/admin/business/summary",
    response_model=SuccessResponse,
    summary="Admin business summary across cohorts",
)
async def admin_business_summary(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    return SuccessResponse(
        message="Business summary retrieved.",
        data=[]
    )"""

content = re.sub(
    r'@router\.get\(\s*"/admin/business/summary"[\s\S]*?\]\s*\)\s*',
    business_summary_new,
    content,
    count=1
)

# Replace seller_sales_category
seller_sales_cat_new = """@router.get(
    "/seller/sales/by-category",
    response_model=SuccessResponse,
    summary="Seller sales broken down by category",
)
async def seller_sales_category(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    return SuccessResponse(message="Sales by category", data=[])"""

content = re.sub(
    r'@router\.get\(\s*"/seller/sales/by-category"[\s\S]*?\]\s*\)\s*',
    seller_sales_cat_new,
    content,
    count=1
)

# Replace seller_sales_trends
seller_sales_trends_new = """@router.get(
    "/seller/sales/trends",
    response_model=SuccessResponse,
    summary="Sales trends for a seller",
)
async def seller_sales_trends(
    request: Request,
    period: str = Query(default="30d"),
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    return SuccessResponse(message="Sales trends", data={
        "period": period, "currency": "NGN",
        "total_revenue": 0, "total_orders": 0,
        "active_listings": 0, "new_users": 0,
        "data_points": []
    })"""
content = re.sub(
    r'@router\.get\(\s*"/seller/sales/trends"[\s\S]*?\]\s*\}\s*\)\s*',
    seller_sales_trends_new,
    content,
    count=1
)

# Replace seller dashboard
seller_dash_new = """@router.get(
    "/seller/dashboard",
    response_model=SuccessResponse,
    summary="Seller dashboard overview",
)
async def seller_dashboard(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    return SuccessResponse(message="Seller dashboard", data={
        "total_revenue": 0, "active_listings": 0, "unread_messages": 0,
        "pending_orders": 0, "recent_orders": [], "top_listings": []
    })"""
content = re.sub(
    r'@router\.get\(\s*"/seller/dashboard"[\s\S]*?\]\s*\}\s*\)\s*',
    seller_dash_new,
    content,
    count=1
)

with open('backend/analytics-service/app/routers/analytics.py', 'w', encoding='utf-8') as f:
    f.write(content)
