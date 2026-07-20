"""
Search Service HTTP router.

Exposes:
  GET  /search                    — keyword + filter search
  GET  /search/autocomplete       — prefix autocomplete suggestions
  POST /search/voice              — voice (audio upload) search
  POST /search/ai                 — AI natural-language search (JWT required)
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile
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


@router.get(
    "",
    response_model=SuccessResponse,
    summary="Keyword + filter listing search",
)
async def keyword_search(
    q: str = Query(..., min_length=1, max_length=500, description="Search query"),
    page: int = Query(default=1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Results per page"),
    # Filter params — all optional
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
    sort_by: str | None = Query(default=None, description="Sort: relevance, newest, price_asc, price_desc"),
    svc: SearchService = Depends(_build_service),
) -> SuccessResponse:
    from fastapi import Request

    q = q.strip()
    if not q:
        raise InvalidInputError("Search query must not be empty.")

    if price_min is not None and price_max is not None and price_min > price_max:
        raise InvalidInputError("price_min must not exceed price_max.")

    filters: dict = {
        k: v
        for k, v in {
            "price_min": price_min,
            "price_max": price_max,
            "country": country,
            "state": state,
            "city": city,
            "radius_km": radius_km,
            "lat": lat,
            "lon": lon,
            "category": category,
            "subcategory": subcategory,
            "brand": brand,
            "condition": condition,
            "status": status,
            "trust_badge": trust_badge,
        }.items()
        if v is not None
    }

    try:
        result = await svc.keyword_search(
            query=q,
            filters=filters,
            page=page,
            page_size=page_size,
        )
        # Normalise to unified response shape
        items = result.get("results", [])
        total = result.get("total", len(items))
        total_pages = max(1, -(-total // page_size))
        return SuccessResponse(
            message=f"{total} result(s) found.",
            data=items,
            meta={
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "has_prev": page > 1,
                "has_next": page < total_pages,
            },
        )
    except Exception:
        # Elasticsearch unavailable in dev — fall back to SQLite full-text search
        return await _sqlite_search_fallback(q, category, condition, page, page_size, sort_by)


async def _sqlite_search_fallback(
    q: str,
    category: str | None,
    condition: str | None,
    page: int,
    page_size: int,
    sort_by: str | None = None,
) -> SuccessResponse:
    """
    SQLite fallback search used when Elasticsearch is not available.

    Features:
    - Synonym expansion: "cars" → also searches "vehicle/vehicles"
    - African slang & local terms: "tokunbo" → used, imported
    - Fuzzy tolerance: common typos (e.g. "phon" → "phone")
    - Multi-term expansion: each word in the query is expanded separately
    - Falls back to a broad OR match so users always get results
    """
    from pathlib import Path

    # ── Synonym map (African marketplace context) ─────────────────────────
    # Maps common search terms → canonical DB terms to match against
    SYNONYMS: dict[str, list[str]] = {
        # Vehicles
        "car":        ["vehicle", "vehicles", "car", "cars"],
        "cars":       ["vehicle", "vehicles", "car", "cars"],
        "auto":       ["vehicle", "vehicles", "car", "automobile"],
        "ride":       ["vehicle", "vehicles", "car"],
        "motor":      ["vehicle", "vehicles", "motorcycle", "motor"],
        "bike":       ["motorcycle", "bike", "bicycle", "vehicles"],
        "truck":      ["truck", "lorry", "vehicle", "vehicles"],
        "bus":        ["bus", "vehicle", "vehicles"],
        "tokunbo":    ["used", "fairly used", "foreign used", "imported"],
        "toks":       ["used", "fairly used", "foreign used"],
        "nigerian used": ["used", "locally used"],
        "naija used": ["used", "locally used"],
        "bend down":  ["used", "second hand"],
        "okrika":     ["used", "second hand", "fashion", "clothing"],
        # Real estate / property
        "house":      ["property", "house", "apartment", "flat", "housing"],
        "flat":       ["apartment", "flat", "property"],
        "apartment":  ["apartment", "flat", "property"],
        "land":       ["land", "plot", "property"],
        "plot":       ["plot", "land", "property"],
        "duplex":     ["duplex", "property", "house"],
        "self contain": ["self contained", "property", "apartment"],
        "self-contain": ["self contained", "property", "apartment"],
        "bedsitter":  ["bedsitter", "self contained", "apartment"],
        "face me i face you": ["face me i face you", "apartment", "property"],
        "bungalow":   ["bungalow", "property", "house"],
        # Electronics
        "phone":      ["phone", "mobile", "smartphone", "electronics"],
        "phon":       ["phone", "mobile", "smartphone"],
        "fone":       ["phone", "mobile", "smartphone"],
        "iphone":     ["iphone", "phone", "mobile", "apple", "electronics"],
        "samsung":    ["samsung", "phone", "mobile", "electronics"],
        "tecno":      ["tecno", "phone", "mobile", "electronics"],
        "infinix":    ["infinix", "phone", "mobile", "electronics"],
        "itel":       ["itel", "phone", "mobile", "electronics"],
        "lappy":      ["laptop", "computer", "electronics"],
        "laptop":     ["laptop", "computer", "electronics"],
        "tv":         ["television", "tv", "electronics", "screen"],
        "generator":  ["generator", "gen", "electronics", "power"],
        "gen":        ["generator", "electronics", "power"],
        "fridge":     ["refrigerator", "fridge", "electronics"],
        "freezer":    ["freezer", "refrigerator", "electronics"],
        "ac":         ["air conditioner", "ac", "electronics", "cooling"],
        "fan":        ["fan", "electronics", "cooling"],
        "pressing iron": ["iron", "pressing iron", "electronics"],
        # Fashion
        "clothes":    ["fashion", "clothing", "clothes", "wear"],
        "cloth":      ["fashion", "clothing", "cloth"],
        "shoe":       ["shoes", "footwear", "fashion"],
        "shoes":      ["shoes", "footwear", "fashion"],
        "bag":        ["bag", "handbag", "fashion", "accessories"],
        "ankara":     ["ankara", "fabric", "fashion", "clothing"],
        "aso ebi":    ["aso ebi", "fabric", "fashion"],
        "lace":       ["lace", "fabric", "fashion"],
        "gown":       ["gown", "dress", "fashion"],
        "agbada":     ["agbada", "fashion", "clothing"],
        "kaftan":     ["kaftan", "fashion", "clothing"],
        "buba":       ["buba", "fashion", "clothing"],
        "senator":    ["senator", "fashion", "clothing"],
        # Jobs
        "job":        ["job", "jobs", "work", "employment", "vacancy"],
        "jobs":       ["job", "jobs", "work", "employment", "vacancy"],
        "work":       ["job", "jobs", "work", "employment"],
        "vacancy":    ["vacancy", "job", "jobs", "employment"],
        "hiring":     ["hiring", "job", "jobs", "employment"],
        # Services
        "service":    ["service", "services"],
        "repair":     ["repair", "service", "services"],
        "fix":        ["repair", "fix", "service", "services"],
        "lesson":     ["lesson", "tutorial", "service", "teaching", "education"],
        "tutorial":   ["tutorial", "lesson", "service", "education"],
        "cleaning":   ["cleaning", "service", "services"],
        "plumber":    ["plumbing", "plumber", "service", "services"],
        "electrician":["electrician", "electrical", "service", "services"],
        # Agriculture
        "farm":       ["agriculture", "farm", "farming", "food"],
        "crop":       ["agriculture", "crops", "farming", "food"],
        "cattle":     ["livestock", "cattle", "animals", "agriculture"],
        "cow":        ["cow", "cattle", "livestock", "animals"],
        "goat":       ["goat", "livestock", "animals"],
        "chicken":    ["chicken", "poultry", "livestock", "animals"],
        # General
        "buy":        [],  # broad — don't restrict
        "sell":       [],
        "cheap":      [],
        "affordable": [],
        "new":        ["new", "brand new"],
        "fairly used":["fairly used", "used", "second hand"],
        "second hand":["second hand", "used", "fairly used"],
    }

    def _fuzzy_variants(word: str) -> list[str]:
        """
        Generate common typo variants of a word using simple edit-distance rules.
        Keeps it fast (no heavy libraries) while covering the most common mistakes.
        """
        variants = {word}
        # Transpose adjacent chars: "phoen" -> "phone"
        for i in range(len(word) - 1):
            t = list(word)
            t[i], t[i+1] = t[i+1], t[i]
            variants.add("".join(t))
        # Remove one char: "carrs" -> "cars"
        for i in range(len(word)):
            variants.add(word[:i] + word[i+1:])
        # Double-letter collapse: "caar" -> "car"
        import re
        variants.add(re.sub(r'(.)\1+', r'\1', word))
        return list(variants)

    def _expand_query(raw: str) -> list[str]:
        """
        Returns a deduplicated list of all search terms to use in LIKE queries.
        Handles: synonyms, local terms, fuzzy variants, multi-word phrases.
        """
        q_lower = raw.lower().strip()
        all_terms: set[str] = {q_lower}  # always include original

        # Check full phrase first
        if q_lower in SYNONYMS:
            all_terms.update(SYNONYMS[q_lower])

        # Then expand each word
        for word in q_lower.split():
            all_terms.add(word)
            if word in SYNONYMS:
                all_terms.update(SYNONYMS[word])
            # Fuzzy variants for words >= 4 chars
            if len(word) >= 4:
                for v in _fuzzy_variants(word):
                    if len(v) >= 3:
                        all_terms.add(v)
                        if v in SYNONYMS:
                            all_terms.update(SYNONYMS[v])

        # Filter out empty strings and very short noise words
        return [t for t in all_terms if t and len(t) >= 2]

    try:
        import aiosqlite
        db_path = __import__("shared.db_path", fromlist=["get_db_path"]).get_db_path()

        expanded = _expand_query(q)

        # Build OR conditions for each expanded term across all searchable columns
        search_clauses = []
        params: list = []
        for term in expanded:
            like = f"%{term}%"
            search_clauses.append(
                "(title LIKE ? OR description LIKE ? OR category LIKE ? OR listing_type LIKE ?)"
            )
            params.extend([like, like, like, like])

        search_condition = "(" + " OR ".join(search_clauses) + ")"

        # Always filter for active listings
        extra_conditions = [f"status = 'active'", search_condition]
        extra_params: list = []

        if category:
            extra_conditions.append("category = ?")
            extra_params.append(category)
        if condition:
            extra_conditions.append("condition = ?")
            extra_params.append(condition)

        where = " AND ".join(extra_conditions)
        all_params = params + extra_params
        offset = (page - 1) * page_size

        order = "created_at DESC"
        if sort_by == "price_asc":
            order = "CAST(price AS REAL) ASC"
        elif sort_by == "price_desc":
            order = "CAST(price AS REAL) DESC"
        elif sort_by == "newest":
            order = "created_at DESC"

        async with aiosqlite.connect(str(db_path)) as db:
            db.row_factory = aiosqlite.Row
            count_rows = await db.execute_fetchall(
                f"SELECT COUNT(*) as cnt FROM listings WHERE {where}", all_params
            )
            total = count_rows[0]["cnt"] if count_rows else 0

            rows = await db.execute_fetchall(
                f"""SELECT id, seller_id, listing_type, title, description, price,
                           currency, country, state, city, category, condition,
                           status, avg_rating, review_count, image_url, created_at
                    FROM listings WHERE {where}
                    ORDER BY {order} LIMIT ? OFFSET ?""",
                all_params + [page_size, offset],
            )

        total_pages = max(1, -(-total // page_size))
        data = [
            {
                "id": r["id"],
                "title": r["title"],
                "description": r["description"],
                "price": float(r["price"]) if r["price"] is not None else 0,
                "currency": r["currency"] or "NGN",
                "category": r["category"],
                "listing_type": r["listing_type"],
                "condition": r["condition"],
                "city": r["city"],
                "country": r["country"],
                "image_url": r["image_url"],
                "avg_rating": float(r["avg_rating"]) if r["avg_rating"] else 0.0,
                "review_count": r["review_count"] or 0,
                "seller_id": r["seller_id"],
                "status": r["status"],
            }
            for r in rows
        ]
        return SuccessResponse(
            message=f"{total} result(s) found.",
            data=data,
            meta={
                "total": total,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "has_prev": page > 1,
                "has_next": page < total_pages,
            },
        )
    except Exception:
        return SuccessResponse(
            message="0 results found.",
            data=[],
            meta={"total": 0, "page": page, "page_size": page_size,
                  "total_pages": 1, "has_prev": False, "has_next": False},
        )


@router.get(
    "/autocomplete",
    response_model=SuccessResponse,
    summary="Autocomplete suggestions by prefix",
)
async def autocomplete(
    q: str = Query(..., description="Search prefix (min 2 chars)"),
    svc: SearchService = Depends(_build_service),
) -> SuccessResponse:
    prefix = (q or "").strip()
    if len(prefix) < 2:
        # Spec: prefix shorter than 2 chars returns empty, not an error
        return SuccessResponse(data=AutocompleteResponse(suggestions=[]).model_dump())

    suggestions = await svc.autocomplete(prefix)
    return SuccessResponse(data=AutocompleteResponse(suggestions=suggestions).model_dump())


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

    # Validate MIME type loosely — AI service does the real validation
    allowed_prefixes = ("audio/", "application/octet-stream")
    if not any(content_type.startswith(p) for p in allowed_prefixes):
        raise InvalidInputError(
            f"Unsupported content type '{content_type}'. Expected an audio file."
        )

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
