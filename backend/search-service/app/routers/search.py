"""
Search Service HTTP router.

Exposes:
  GET  /search                    — keyword + filter search
  GET  /search/autocomplete       — prefix autocomplete suggestions
  POST /search/voice              — voice (audio upload) search
  POST /search/ai                 — AI natural-language search (JWT required)
"""
from __future__ import annotations

import re
from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from shared.errors import InvalidInputError, SuccessResponse, UnauthorizedError

from ..dependencies import (
    get_current_user_payload,
    get_es_client,
    get_http_client,
    get_redis,
    get_search_settings,
)
from ..schemas import AISearchRequest, AutocompleteResponse, SearchFilters, SearchResponse
from ..service import SearchService

router = APIRouter(prefix="/search", tags=["search"])


def _build_service(
    es_client=Depends(get_es_client),
    redis=Depends(get_redis),
    settings=Depends(get_search_settings),
    http_client=Depends(get_http_client),
) -> SearchService:
    return SearchService(
        es_client=es_client,
        redis=redis,
        settings=settings,
        http_client=http_client,
    )


# ── Synonym map (African marketplace context) ─────────────────────────────────
# Maps user query terms → canonical DB terms for ILIKE search expansion
_SYNONYMS: dict[str, list[str]] = {
    # Vehicles
    "car":          ["vehicle", "vehicles", "car", "cars"],
    "cars":         ["vehicle", "vehicles", "car", "cars"],
    "auto":         ["vehicle", "vehicles", "car", "automobile"],
    "ride":         ["vehicle", "vehicles", "car"],
    "motor":        ["vehicle", "vehicles", "motorcycle", "motor"],
    "bike":         ["motorcycle", "bike", "bicycle", "vehicles"],
    "truck":        ["truck", "lorry", "vehicle", "vehicles"],
    "bus":          ["bus", "vehicle", "vehicles"],
    "tokunbo":      ["used", "fairly used", "foreign used", "imported"],
    "toks":         ["used", "fairly used", "foreign used"],
    "naija used":   ["used", "locally used"],
    "nigerian used":["used", "locally used"],
    "bend down":    ["used", "second hand"],
    "okrika":       ["used", "second hand", "fashion", "clothing"],
    # Real estate / property
    "house":        ["property", "house", "apartment", "flat", "housing"],
    "houses":       ["property", "house", "apartment", "flat"],
    "home":         ["property", "home", "house", "apartment"],
    "homes":        ["property", "home", "house", "apartment"],
    "flat":         ["apartment", "flat", "property"],
    "flats":        ["apartment", "flat", "property"],
    "apartment":    ["apartment", "flat", "property"],
    "apartments":   ["apartment", "flat", "property"],
    "land":         ["land", "plot", "property"],
    "plot":         ["plot", "land", "property"],
    "duplex":       ["duplex", "property", "house"],
    "bungalow":     ["bungalow", "property", "house"],
    "self contain": ["self contained", "property", "apartment"],
    "self-contain": ["self contained", "property", "apartment"],
    "bedsitter":    ["bedsitter", "self contained", "apartment"],
    "office":       ["office", "commercial", "property"],
    "shop":         ["shop", "commercial", "property"],
    "warehouse":    ["warehouse", "commercial", "property"],
    "rent":         ["rent", "property", "apartment"],
    "real estate":  ["property", "real estate"],
    # Electronics
    "phone":        ["phone", "mobile", "smartphone", "electronics"],
    "phones":       ["phone", "mobile", "smartphone", "electronics"],
    "phon":         ["phone", "mobile", "smartphone"],
    "fone":         ["phone", "mobile", "smartphone"],
    "iphone":       ["iphone", "phone", "mobile", "apple", "electronics"],
    "samsung":      ["samsung", "phone", "mobile", "electronics"],
    "tecno":        ["tecno", "phone", "mobile", "electronics"],
    "infinix":      ["infinix", "phone", "mobile", "electronics"],
    "itel":         ["itel", "phone", "mobile", "electronics"],
    "lappy":        ["laptop", "computer", "electronics"],
    "laptop":       ["laptop", "computer", "electronics"],
    "laptops":      ["laptop", "computer", "electronics"],
    "computer":     ["computer", "laptop", "electronics"],
    "macbook":      ["macbook", "laptop", "apple", "electronics"],
    "tv":           ["television", "tv", "electronics", "screen"],
    "television":   ["television", "tv", "electronics"],
    "generator":    ["generator", "gen", "electronics", "power"],
    "gen":          ["generator", "electronics", "power"],
    "fridge":       ["refrigerator", "fridge", "electronics"],
    "freezer":      ["freezer", "refrigerator", "electronics"],
    "ac":           ["air conditioner", "ac", "electronics", "cooling"],
    "fan":          ["fan", "electronics", "cooling"],
    # Fashion
    "clothes":      ["fashion", "clothing", "clothes", "wear"],
    "clothing":     ["fashion", "clothing", "clothes", "wear"],
    "cloth":        ["fashion", "clothing", "cloth"],
    "shoe":         ["shoes", "footwear", "fashion"],
    "shoes":        ["shoes", "footwear", "fashion"],
    "bag":          ["bag", "handbag", "fashion", "accessories"],
    "bags":         ["bag", "handbag", "fashion", "accessories"],
    "ankara":       ["ankara", "fabric", "fashion", "clothing"],
    "aso ebi":      ["aso ebi", "fabric", "fashion"],
    "lace":         ["lace", "fabric", "fashion"],
    "gown":         ["gown", "dress", "fashion"],
    "agbada":       ["agbada", "fashion", "clothing"],
    "kaftan":       ["kaftan", "fashion", "clothing"],
    "buba":         ["buba", "fashion", "clothing"],
    "senator":      ["senator", "fashion", "clothing"],
    # Furniture
    "furniture":    ["furniture", "sofa", "bed", "chair", "table"],
    "sofa":         ["sofa", "furniture"],
    "bed":          ["bed", "furniture", "bedroom"],
    "chair":        ["chair", "furniture"],
    "table":        ["table", "furniture"],
    # Jobs
    "job":          ["job", "jobs", "work", "employment", "vacancy"],
    "jobs":         ["job", "jobs", "work", "employment", "vacancy"],
    "work":         ["job", "jobs", "work", "employment"],
    "vacancy":      ["vacancy", "job", "jobs", "employment"],
    "vacancies":    ["vacancy", "job", "jobs", "employment"],
    "hiring":       ["hiring", "job", "jobs", "employment"],
    "employment":   ["employment", "job", "jobs"],
    # Services
    "service":      ["service", "services"],
    "services":     ["service", "services"],
    "repair":       ["repair", "service", "services"],
    "fix":          ["repair", "fix", "service", "services"],
    "lesson":       ["lesson", "tutorial", "service", "teaching", "education"],
    "tutorial":     ["tutorial", "lesson", "service", "education"],
    "cleaning":     ["cleaning", "service", "services"],
    "plumber":      ["plumbing", "plumber", "service", "services"],
    "electrician":  ["electrician", "electrical", "service", "services"],
    "photography":  ["photography", "photographer", "service", "services"],
    "transport":    ["transport", "logistics", "delivery", "service"],
    # Agriculture
    "farm":         ["agriculture", "farm", "farming", "food"],
    "farming":      ["agriculture", "farm", "farming", "food"],
    "crop":         ["agriculture", "crops", "farming", "food"],
    "cattle":       ["livestock", "cattle", "animals", "agriculture"],
    "cow":          ["cow", "cattle", "livestock", "animals"],
    "goat":         ["goat", "livestock", "animals"],
    "chicken":      ["chicken", "poultry", "livestock", "animals"],
    # Health
    "health":       ["health", "medical", "pharmacy", "healthcare"],
    "medicine":     ["medicine", "health", "medical", "pharmacy"],
    "drug":         ["drug", "medicine", "pharmacy", "health"],
    # Sports
    "sports":       ["sports", "fitness", "gym", "equipment"],
    "gym":          ["gym", "sports", "fitness"],
    "football":     ["football", "soccer", "sports"],
    # General
    "buy":          [],
    "sell":         [],
    "cheap":        [],
    "affordable":   [],
    "new":          ["new", "brand new"],
    "fairly used":  ["fairly used", "used", "second hand"],
    "second hand":  ["second hand", "used", "fairly used"],
    "used":         ["used", "fairly used", "second hand"],
}

# Exact listing_type values in the DB — used for precise filtering
_LISTING_TYPE_MAP: dict[str, list[str]] = {
    "car":          ["vehicle"],
    "cars":         ["vehicle"],
    "auto":         ["vehicle"],
    "vehicle":      ["vehicle"],
    "vehicles":     ["vehicle"],
    "truck":        ["vehicle"],
    "bus":          ["vehicle"],
    "bike":         ["vehicle"],
    "motor":        ["vehicle"],
    "motorcycle":   ["vehicle"],
    "tokunbo":      ["vehicle"],
    "house":        ["property"],
    "houses":       ["property"],
    "home":         ["property"],
    "homes":        ["property"],
    "flat":         ["property"],
    "flats":        ["property"],
    "land":         ["property"],
    "property":     ["property"],
    "properties":   ["property"],
    "apartment":    ["property"],
    "apartments":   ["property"],
    "duplex":       ["property"],
    "bungalow":     ["property"],
    "office":       ["property"],
    "shop":         ["property"],
    "warehouse":    ["property"],
    "rent":         ["property"],
    "real estate":  ["property"],
    "job":          ["job"],
    "jobs":         ["job"],
    "vacancy":      ["job"],
    "vacancies":    ["job"],
    "hiring":       ["job"],
    "employment":   ["job"],
    "service":      ["service"],
    "services":     ["service"],
    "repair":       ["service"],
    "cleaning":     ["service"],
    "plumber":      ["service"],
    "plumbing":     ["service"],
    "electrician":  ["service"],
    "photography":  ["service"],
    "transport":    ["service"],
    "delivery":     ["service"],
    "fashion":      ["physical"],
    "clothes":      ["physical"],
    "clothing":     ["physical"],
    "shoes":        ["physical"],
    "bags":         ["physical"],
    "ankara":       ["physical"],
    "furniture":    ["physical"],
    "sofa":         ["physical"],
    "bed":          ["physical"],
}

# Category values stored in the DB — for direct category matching
_CATEGORY_MAP: dict[str, str] = {
    "electronics": "Electronics",
    "electronic":  "Electronics",
    "phone":       "Electronics",
    "phones":      "Electronics",
    "laptop":      "Electronics",
    "laptops":     "Electronics",
    "computer":    "Electronics",
    "tv":          "Electronics",
    "television":  "Electronics",
    "fashion":     "Fashion",
    "clothes":     "Fashion",
    "clothing":    "Fashion",
    "shoes":       "Fashion",
    "bags":        "Fashion",
    "furniture":   "Furniture",
    "sofa":        "Furniture",
    "agriculture": "Agriculture",
    "farm":        "Agriculture",
    "farming":     "Agriculture",
    "health":      "Health & Beauty",
    "beauty":      "Health & Beauty",
    "sports":      "Sports",
    "books":       "Books",
}


def _fuzzy_variants(word: str) -> list[str]:
    """Generate common misspelling variants for a word."""
    variants: set[str] = {word}
    # Transpositions
    for i in range(len(word) - 1):
        t = list(word)
        t[i], t[i + 1] = t[i + 1], t[i]
        variants.add("".join(t))
    # Deletions
    for i in range(len(word)):
        variants.add(word[:i] + word[i + 1:])
    # Double-letter collapse: "caar" → "car"
    variants.add(re.sub(r'(.)\1+', r'\1', word))
    return list(variants)


def _expand_query(raw: str) -> tuple[list[str], list[str], list[str]]:
    """
    Expand a raw search query into:
      text_terms   — used in ILIKE against title/description/category/listing_type
      exact_types  — exact listing_type IN (...) matches
      exact_cats   — exact category IN (...) matches

    This is the SINGLE authoritative expand function.
    """
    q_lower = raw.lower().strip()
    all_terms: set[str] = {q_lower}
    exact_types: set[str] = set()
    exact_cats:  set[str] = set()

    # Check full phrase first
    if q_lower in _SYNONYMS:
        all_terms.update(_SYNONYMS[q_lower])
    if q_lower in _LISTING_TYPE_MAP:
        exact_types.update(_LISTING_TYPE_MAP[q_lower])
    if q_lower in _CATEGORY_MAP:
        exact_cats.add(_CATEGORY_MAP[q_lower])

    # Expand each word individually
    for word in q_lower.split():
        all_terms.add(word)
        if word in _SYNONYMS:
            all_terms.update(_SYNONYMS[word])
        if word in _LISTING_TYPE_MAP:
            exact_types.update(_LISTING_TYPE_MAP[word])
        if word in _CATEGORY_MAP:
            exact_cats.add(_CATEGORY_MAP[word])
        # Fuzzy variants for words >= 4 chars
        if len(word) >= 4:
            for v in _fuzzy_variants(word):
                if len(v) >= 3:
                    all_terms.add(v)
                    if v in _SYNONYMS:
                        all_terms.update(_SYNONYMS[v])
                    if v in _LISTING_TYPE_MAP:
                        exact_types.update(_LISTING_TYPE_MAP[v])

    text_terms = [t for t in all_terms if t and len(t) >= 2]
    return text_terms, list(exact_types), list(exact_cats)


async def _search_fallback(
    request: Request,
    q: str,
    category: str | None,
    condition: str | None,
    city: str | None,
    price_min: float | None,
    price_max: float | None,
    page: int,
    page_size: int,
    sort_by: str | None = None,
) -> SuccessResponse:
    """
    PostgreSQL fallback search (used when Elasticsearch is not available).

    Strategy:
    1. Always include listings where listing_type or category matches exactly
       (e.g. "property" → listing_type = 'property')
    2. Also ILIKE search across title, description, category, listing_type
    3. Combined with synonym expansion so "cars" finds vehicle listings
    """
    from sqlalchemy import text as _text

    expanded, exact_types, exact_cats = _expand_query(q)

    search_clauses: list[str] = []
    all_params: dict = {}

    # 1. ILIKE text search across all relevant columns
    for i, term in enumerate(expanded):
        like = f"%{term}%"
        search_clauses.append(
            f"(title ILIKE :q_{i} OR description ILIKE :q_{i} "
            f"OR category ILIKE :q_{i} OR COALESCE(listing_type,'') ILIKE :q_{i})"
        )
        all_params[f"q_{i}"] = like

    # 2. Exact listing_type matches — "cars" → listing_type IN ('vehicle')
    if exact_types:
        ph = ", ".join(f":et_{i}" for i in range(len(exact_types)))
        search_clauses.append(f"listing_type IN ({ph})")
        for i, et in enumerate(exact_types):
            all_params[f"et_{i}"] = et

    # 3. Exact category matches — "electronics" → category = 'Electronics'
    if exact_cats:
        ph = ", ".join(f":ec_{i}" for i in range(len(exact_cats)))
        search_clauses.append(f"category IN ({ph})")
        for i, ec in enumerate(exact_cats):
            all_params[f"ec_{i}"] = ec

    # Combine search clauses with OR so any match returns the listing
    search_condition = "(" + " OR ".join(search_clauses) + ")" if search_clauses else "TRUE"

    # Base filter: active listings only
    extra_conditions = ["status = 'active'", search_condition]

    # Optional explicit filters from request params
    if category:
        extra_conditions.append("category ILIKE :cat")
        all_params["cat"] = f"%{category}%"
    if condition:
        extra_conditions.append("condition = :cond")
        all_params["cond"] = condition
    if city:
        extra_conditions.append("city ILIKE :city")
        all_params["city"] = f"%{city}%"
    if price_min is not None:
        extra_conditions.append("CAST(price AS NUMERIC) >= :pmin")
        all_params["pmin"] = price_min
    if price_max is not None:
        extra_conditions.append("CAST(price AS NUMERIC) <= :pmax")
        all_params["pmax"] = price_max

    where  = " AND ".join(extra_conditions)
    offset = (page - 1) * page_size

    order = "created_at DESC"
    if sort_by == "price_asc":
        order = "CAST(price AS NUMERIC) ASC"
    elif sort_by == "price_desc":
        order = "CAST(price AS NUMERIC) DESC"

    try:
        async with request.app.state.session_factory() as db:
            count_row = (await db.execute(
                _text(f"SELECT COUNT(*) AS cnt FROM listings WHERE {where}"),
                all_params,
            )).mappings().first()
            total = count_row["cnt"] if count_row else 0

            all_params["lim"] = page_size
            all_params["off"] = offset

            rows = (await db.execute(_text(f"""
                SELECT id, seller_id, listing_type, title, description, price,
                       currency, country, state, city, category, condition,
                       status, avg_rating, review_count, image_url, created_at, updated_at
                FROM listings
                WHERE {where}
                ORDER BY {order}
                LIMIT :lim OFFSET :off
            """), all_params)).mappings().all()

        total_pages = max(1, -(-total // page_size))
        data = [
            {
                "id":           str(r["id"]),
                "title":        r["title"],
                "description":  r["description"],
                "price":        float(r["price"]) if r["price"] is not None else 0,
                "currency":     r["currency"] or "NGN",
                "category":     r["category"],
                "listing_type": r["listing_type"],
                "condition":    r["condition"],
                "city":         r["city"],
                "country":      r["country"],
                "image_url":    r["image_url"],
                "avg_rating":   float(r["avg_rating"]) if r["avg_rating"] else 0.0,
                "review_count": r["review_count"] or 0,
                "seller_id":    str(r["seller_id"]),
                "status":       r["status"],
                "updated_at":   str(r["updated_at"]) if r.get("updated_at") else None,
            }
            for r in rows
        ]

        # Build smart "did you mean" suggestions when no results found
        suggestions: list[str] = []
        if total == 0:
            try:
                async with request.app.state.session_factory() as db2:
                    seen: set[str] = set()
                    for term in expanded[:8]:
                        if len(term) < 3:
                            continue
                        sugg_rows = (await db2.execute(_text(
                            "SELECT DISTINCT title FROM listings "
                            "WHERE (title ILIKE :t OR category ILIKE :t) "
                            "AND status = 'active' ORDER BY title LIMIT 3"
                        ), {"t": f"%{term}%"})).fetchall()
                        for sr in sugg_rows:
                            s = sr[0]
                            if s and s not in seen:
                                seen.add(s)
                                suggestions.append(s)
                            if len(suggestions) >= 6:
                                break
                        if len(suggestions) >= 6:
                            break
            except Exception:
                pass

        return SuccessResponse(
            message=f"{total} result(s) found.",
            data=data,
            meta={
                "total":       total,
                "page":        page,
                "page_size":   page_size,
                "total_pages": total_pages,
                "has_prev":    page > 1,
                "has_next":    page < total_pages,
                "suggestions": suggestions,
            },
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("search_fallback_error: %s", exc)
        return SuccessResponse(
            message="0 results found.",
            data=[],
            meta={
                "total": 0, "page": page, "page_size": page_size,
                "total_pages": 1, "has_prev": False, "has_next": False,
                "suggestions": [],
            },
        )


@router.get(
    "",
    response_model=SuccessResponse,
    summary="Keyword + filter listing search",
)
async def keyword_search(
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    price_min: float | None = Query(default=None, ge=0.0),
    price_max: float | None = Query(default=None, ge=0.0),
    country: str | None = Query(default=None, max_length=2),
    state: str | None = Query(default=None, max_length=100),
    city: str | None = Query(default=None, max_length=100),
    radius_km: float | None = Query(default=None, ge=0.1, le=20000.0),
    lat: float | None = Query(default=None, ge=-90.0, le=90.0),
    lon: float | None = Query(default=None, ge=-180.0, le=180.0),
    category: str | None = Query(default=None, max_length=100),
    subcategory: str | None = Query(default=None, max_length=100),
    brand: str | None = Query(default=None, max_length=100),
    condition: str | None = Query(default=None, max_length=20),
    status: str | None = Query(default=None, max_length=30),
    trust_badge: str | None = Query(default=None, max_length=20),
    sort_by: str | None = Query(default=None, description="newest|price_asc|price_desc|relevance"),
    request: Request = None,
    svc: SearchService = Depends(_build_service),
) -> SuccessResponse:

    q = q.strip()
    if not q:
        raise InvalidInputError("Search query must not be empty.")
    if price_min is not None and price_max is not None and price_min > price_max:
        raise InvalidInputError("price_min must not exceed price_max.")

    # Try Elasticsearch first
    try:
        filters: dict = {
            k: v for k, v in {
                "price_min": price_min, "price_max": price_max,
                "country": country, "state": state, "city": city,
                "radius_km": radius_km, "lat": lat, "lon": lon,
                "category": category, "subcategory": subcategory,
                "brand": brand, "condition": condition,
                "status": status, "trust_badge": trust_badge,
            }.items() if v is not None
        }
        result = await svc.keyword_search(query=q, filters=filters, page=page, page_size=page_size)
        items = result.get("results", [])
        total = result.get("total", len(items))
        if total > 0:
            total_pages = max(1, -(-total // page_size))
            return SuccessResponse(
                message=f"{total} result(s) found.",
                data=items,
                meta={
                    "total": total, "page": page, "page_size": page_size,
                    "total_pages": total_pages,
                    "has_prev": page > 1, "has_next": page < total_pages,
                },
            )
    except Exception:
        pass

    # Always fall back to PostgreSQL — this is the primary search in production
    return await _search_fallback(
        request=request,
        q=q,
        category=category,
        condition=condition,
        city=city,
        price_min=price_min,
        price_max=price_max,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
    )


@router.get(
    "/autocomplete",
    response_model=SuccessResponse,
    summary="Autocomplete suggestions by prefix",
)
async def autocomplete(
    q: str = Query(..., description="Search prefix (min 2 chars)"),
    request: Request = None,
    svc: SearchService = Depends(_build_service),
) -> SuccessResponse:
    prefix = (q or "").strip()
    if len(prefix) < 2:
        return SuccessResponse(data=AutocompleteResponse(suggestions=[]).model_dump())

    try:
        suggestions = await svc.autocomplete(prefix)
        if suggestions:
            return SuccessResponse(data=AutocompleteResponse(suggestions=suggestions).model_dump())
    except Exception:
        pass

    suggestions = []
    try:
        from sqlalchemy import text as _text
        async with request.app.state.session_factory() as db:
            like = f"{prefix}%"
            rows = (await db.execute(_text("""
                SELECT DISTINCT title FROM listings
                WHERE title ILIKE :like AND status = 'active'
                ORDER BY title ASC LIMIT 8
            """), {"like": like})).fetchall()
            suggestions = [r[0] for r in rows if r[0]]

            if len(suggestions) < 8:
                cat_rows = (await db.execute(_text("""
                    SELECT DISTINCT category FROM listings
                    WHERE category ILIKE :like AND status = 'active'
                    ORDER BY category ASC LIMIT 4
                """), {"like": like})).fetchall()
                for r in cat_rows:
                    if r[0] and r[0] not in suggestions:
                        suggestions.append(r[0])
    except Exception:
        pass

    return SuccessResponse(data=AutocompleteResponse(suggestions=suggestions[:8]).model_dump())


@router.post(
    "/voice",
    response_model=SuccessResponse,
    summary="Voice search via audio upload",
)
async def voice_search(
    audio: UploadFile = File(..., description="Audio file (wav, mp3, ogg, webm)"),
    svc: SearchService = Depends(_build_service),
) -> SuccessResponse:
    content_type = audio.content_type or "application/octet-stream"
    allowed_prefixes = ("audio/", "application/octet-stream")
    if not any(content_type.startswith(p) for p in allowed_prefixes):
        raise InvalidInputError(f"Unsupported content type '{content_type}'. Expected an audio file.")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise InvalidInputError("Uploaded audio file is empty.")

    result = await svc.voice_search(audio_bytes=audio_bytes, content_type=content_type)
    return SuccessResponse(data=result)


@router.post(
    "/ai",
    response_model=SuccessResponse,
    summary="AI natural-language search (JWT required)",
)
async def ai_search(
    body: AISearchRequest,
    user_payload: Annotated[dict | None, Depends(get_current_user_payload)],
    svc: SearchService = Depends(_build_service),
) -> SuccessResponse:
    if user_payload is None:
        raise UnauthorizedError("Authentication required for AI search.")

    result = await svc.ai_search(
        query=body.query,
        page=body.page,
        page_size=body.page_size,
    )
    return SuccessResponse(data=result)
