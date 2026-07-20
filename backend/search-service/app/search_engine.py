"""
Elasticsearch search implementation for the Velontri Search Service.

Provides:
- keyword_search: BM25 multi-match with rich filtering and search_after pagination
- autocomplete: low-latency prefix suggestions

p95 latency targets:
  keyword_search: 500 ms  (request_timeout=0.5 on ES call)
  autocomplete:   200 ms  (request_timeout=0.2 on ES call)
"""
from __future__ import annotations

import base64
import json
import logging
from typing import Any

try:
    from elasticsearch import AsyncElasticsearch
    from elasticsearch.exceptions import ElasticsearchException
except ImportError:  # pragma: no cover — elasticsearch not installed in test env
    AsyncElasticsearch = None  # type: ignore[assignment,misc]

    class ElasticsearchException(Exception):  # type: ignore[no-redef]
        pass

from shared.logging import get_logger

logger = get_logger(__name__)

# ── Type aliases ──────────────────────────────────────────────────────────────

SearchResult = dict[str, Any]
# Shape: {"total": int, "hits": list[dict], "next_cursor": str | None}


# ── Cursor helpers ────────────────────────────────────────────────────────────


def _encode_cursor(sort_values: list[Any]) -> str:
    """Encode search_after values to a URL-safe base64 cursor string."""
    raw = json.dumps(sort_values, default=str)
    return base64.urlsafe_b64encode(raw.encode()).decode()


def _decode_cursor(cursor: str) -> list[Any] | None:
    """Decode a cursor string back to search_after values; returns None on error."""
    try:
        raw = base64.urlsafe_b64decode(cursor.encode()).decode()
        return json.loads(raw)
    except Exception:
        logger.warning("invalid_search_cursor", cursor=cursor)
        return None


# ── Keyword search ────────────────────────────────────────────────────────────


async def keyword_search(
    client: AsyncElasticsearch,
    index_name: str,
    query: str,
    filters: dict[str, Any] | None,
    page: int,
    page_size: int,
    cursor: str | None = None,
) -> SearchResult:
    """
    Full-text BM25 search with optional filters and search_after pagination.

    Supported filters (all optional):
      price_min, price_max, country, state, city,
      radius_km (requires country/state/city to resolve a geo centre — the
      filter uses the city/state/country field as a term filter instead when
      no explicit lat/lon centre is available),
      category, subcategory, brand, condition, status, trust_badge,
      lat, lon (geo centre for radius_km filter)

    Returns::

        {
            "total": int,
            "hits": [{"_id": str, ...source fields...}, ...],
            "next_cursor": str | None
        }
    """
    filters = filters or {}

    # ── Build query ───────────────────────────────────────────────────────────

    must_clauses: list[dict[str, Any]] = []
    filter_clauses: list[dict[str, Any]] = []

    # Full-text query — only added when there is a non-empty query string
    if query.strip():
        must_clauses.append(
            {
                "multi_match": {
                    "query": query,
                    "fields": ["title^3", "description", "brand^2"],
                    "type": "best_fields",
                    "fuzziness": "AUTO",
                    "prefix_length": 1,
                }
            }
        )

    # Status filter — default to "active" when not explicitly provided
    status_value: str = filters.get("status") or "active"
    filter_clauses.append({"term": {"status": status_value}})

    # Keyword term filters
    _TERM_FILTERS = (
        "category",
        "subcategory",
        "condition",
        "country",
        "state",
        "city",
        "currency",
        "listing_type",
    )
    for field in _TERM_FILTERS:
        value = filters.get(field)
        if value:
            filter_clauses.append({"term": {field: value}})

    # Brand — stored as text with keyword sub-field
    brand = filters.get("brand")
    if brand:
        filter_clauses.append({"term": {"brand.keyword": brand}})

    # Trust badge
    trust_badge = filters.get("trust_badge")
    if trust_badge:
        filter_clauses.append({"term": {"seller_trust_badge": trust_badge}})

    # Price range
    price_min = filters.get("price_min")
    price_max = filters.get("price_max")
    if price_min is not None or price_max is not None:
        price_range: dict[str, Any] = {}
        if price_min is not None:
            price_range["gte"] = float(price_min)
        if price_max is not None:
            price_range["lte"] = float(price_max)
        filter_clauses.append({"range": {"price": price_range}})

    # Geo distance filter — requires lat/lon centre + radius_km
    radius_km = filters.get("radius_km")
    lat = filters.get("lat")
    lon = filters.get("lon")
    if radius_km is not None and lat is not None and lon is not None:
        filter_clauses.append(
            {
                "geo_distance": {
                    "distance": f"{radius_km}km",
                    "location": {"lat": float(lat), "lon": float(lon)},
                }
            }
        )

    es_query: dict[str, Any] = {
        "bool": {
            "must": must_clauses if must_clauses else [{"match_all": {}}],
            "filter": filter_clauses,
        }
    }

    # ── Sorting ───────────────────────────────────────────────────────────────

    sort_spec: list[Any] = [
        {"_score": {"order": "desc"}},
        {"created_at": {"order": "desc"}},
        {"id": {"order": "asc"}},  # tiebreaker — must be unique and sortable
    ]

    # ── Pagination ────────────────────────────────────────────────────────────

    # search_after cursor takes precedence over offset-based page
    search_after: list[Any] | None = None
    if cursor:
        search_after = _decode_cursor(cursor)

    from_offset = 0 if search_after else (page - 1) * page_size

    body: dict[str, Any] = {
        "query": es_query,
        "sort": sort_spec,
        "size": page_size,
        "track_total_hits": True,
    }

    if search_after:
        body["search_after"] = search_after
    else:
        body["from"] = from_offset

    # ── Execute ───────────────────────────────────────────────────────────────

    try:
        response = await client.search(
            index=index_name,
            body=body,
            request_timeout=0.5,  # p95 target: 500 ms
        )
    except ElasticsearchException as exc:
        logger.error(
            "keyword_search_failed",
            index=index_name,
            query=query,
            error=str(exc),
            exc_info=True,
        )
        raise

    # ── Parse results ─────────────────────────────────────────────────────────

    total_hits = response["hits"]["total"]
    total = total_hits["value"] if isinstance(total_hits, dict) else int(total_hits)

    hits: list[dict[str, Any]] = []
    last_sort: list[Any] | None = None

    for hit in response["hits"].get("hits", []):
        doc = {"_id": hit["_id"], **hit.get("_source", {})}
        hits.append(doc)
        last_sort = hit.get("sort")

    next_cursor: str | None = None
    if last_sort and len(hits) == page_size:
        next_cursor = _encode_cursor(last_sort)

    return {"total": total, "hits": hits, "next_cursor": next_cursor}


# ── Autocomplete ──────────────────────────────────────────────────────────────


async def autocomplete(
    client: AsyncElasticsearch,
    index_name: str,
    prefix: str,
    max_results: int = 10,
) -> list[str]:
    """
    Return up to max_results unique title/category suggestions matching prefix.

    Uses a prefix query on the title.keyword and category fields with
    a terms aggregation so duplicates are collapsed.
    Target latency: 200 ms (request_timeout=0.2).
    """
    prefix = prefix.strip()
    if not prefix:
        return []

    # Combine prefix queries on title.keyword and category
    body: dict[str, Any] = {
        "query": {
            "bool": {
                "should": [
                    {"prefix": {"title.keyword": {"value": prefix.lower()}}},
                    {"prefix": {"category": {"value": prefix.lower()}}},
                ],
                "minimum_should_match": 1,
                "filter": [{"term": {"status": "active"}}],
            }
        },
        "size": 0,  # we only need the aggregation
        "aggs": {
            "suggestions": {
                "terms": {
                    "field": "title.keyword",
                    "size": max_results,
                    "include": f"{prefix.lower()}.*",
                    "order": {"_count": "desc"},
                }
            },
            "category_suggestions": {
                "terms": {
                    "field": "category",
                    "size": max_results,
                    "include": f"{prefix.lower()}.*",
                    "order": {"_count": "desc"},
                }
            },
        },
    }

    try:
        response = await client.search(
            index=index_name,
            body=body,
            request_timeout=0.2,  # target: 200 ms
        )
    except ElasticsearchException as exc:
        logger.error(
            "autocomplete_failed",
            index=index_name,
            prefix=prefix,
            error=str(exc),
            exc_info=True,
        )
        return []

    suggestions: list[str] = []
    seen: set[str] = set()

    aggs = response.get("aggregations", {})

    for bucket in aggs.get("suggestions", {}).get("buckets", []):
        key: str = bucket.get("key", "")
        if key and key not in seen:
            suggestions.append(key)
            seen.add(key)

    for bucket in aggs.get("category_suggestions", {}).get("buckets", []):
        key = bucket.get("key", "")
        if key and key not in seen:
            suggestions.append(key)
            seen.add(key)

    return suggestions[:max_results]
