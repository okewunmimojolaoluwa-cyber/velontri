import re

with open('backend/analytics-service/app/routers/analytics.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace category_gmv
category_gmv_new = """@router.get(
    "/analytics/categories/gmv",
    response_model=SuccessResponse,
    summary="GMV (Gross Merchandise Value) by category for admin",
)
async def category_gmv(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    return SuccessResponse(
        message="Category GMV retrieved.",
        data=[],
    )"""

content = re.sub(
    r'@router\.get\(\s*"/analytics/categories/gmv"[\s\S]*?\]\s*\n\s*return SuccessResponse[\s\S]*?\)\s*',
    category_gmv_new,
    content,
    count=1
)

# Replace top_countries
top_countries_new = """@router.get(
    "/analytics/countries/top",
    response_model=SuccessResponse,
    summary="Top countries by GMV and listing count for admin",
)
async def top_countries(
    request: Request,
    payload: Annotated[dict, Depends(get_user_payload)] = None,
) -> SuccessResponse:
    return SuccessResponse(
        message="Top countries retrieved.",
        data=[],
    )"""

content = re.sub(
    r'@router\.get\(\s*"/analytics/countries/top"[\s\S]*?\]\s*\n\s*return SuccessResponse[\s\S]*?\)\s*',
    top_countries_new,
    content,
    count=1
)

with open('backend/analytics-service/app/routers/analytics.py', 'w', encoding='utf-8') as f:
    f.write(content)
