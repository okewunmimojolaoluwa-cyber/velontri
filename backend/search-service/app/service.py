"""
Search Service — core business logic.

All search, autocomplete, voice, AI and index management operations are
implemented here. The class is stateless beyond its injected dependencies
and is safe to use concurrently.
"""
from __future__ import annotations

import asyncio
import base64
import json
from typing import Any

import httpx
from elasticsearch import AsyncElasticsearch, NotFoundError as ESNotFoundError
from redis.asyncio import Redis

from shared.errors import ExternalServiceError, InvalidInputError
from shared.logging import get_logger
from shared.redis_client import RedisKeys

from .config import SearchSettings
from .schemas import SearchFilters, SearchResponse, SearchResult

logger = get_logger(__name__)

# Page size limits
_MIN_PAGE_SIZE: int = 1
_MAX_PAGE_SIZE: int = 100
_DEFAULT_PAGE_SIZE: int = 20

# Autocomplete settings
_AUTOCOMPLETE_MAX_RESULTS: int = 10
_AUTOCOMPLETE_TIMEOUT_S: float = 0.2  # 200 ms SLA

# Autocomplete Redis TTL
_AUTOCOMPLETE_TTL: int = 60


class SearchService:
    """Provides keyword, autocomplete, voice, and AI-powered listing search."""

    def __init__(
        self,
        es_client: AsyncElasticsearch,
        redis: Redis,
        settings: SearchSettings,
        http_client: httpx.AsyncClient,
    ) -> None:
        self._es = es_client
        self._redis = redis
        self._settings = settings
        self._http = http_client

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _clamp_page_size(self, page_size: int) -> int:
        return max(_MIN_PAGE_SIZE, min(page_size, _MAX_PAGE_SIZE))

    def _build_filter_clauses(self, filters: dict[str, Any]) -> list[dict]:
        """Convert a flat filters dict into Elasticsearch filter clauses."""
        clauses: list[dict] = []

        # Always restrict to active/published listings when no explicit status
        status = filters.get("status")
        if status:
            clauses.append({"term": {"status": status}})
        else:
            clauses.append({"term": {"status": "active"}})

        price_min = filters.get("price_min")
        price_max = filters.get("price_max")
        if price_min is not None or price_max is not None:
            price_range: dict[str, Any] = {}
            if price_min is not None:
                price_range["gte"] = float(price_min)
            if price_max is not None:
                price_range["lte"] = float(price_max)
            clauses.append({"range": {"price": price_range}})

        for kw_field in ("country", "state", "city", "category", "subcategory", "brand", "condition"):
            val = filters.get(kw_field)
            if val:
                clauses.append({"term": {kw_field: str(val)}})

        trust_badge = filters.get("trust_badge")
        if trust_badge:
            clauses.append({"term": {"seller_trust_badge": str(trust_badge)}})

        return clauses

    def _build_geo_filter(self, filters: dict[str, Any]) -> dict | None:
        """Build a geo_distance filter if lat/lon/radius_km are present in filters."""
        lat = filters.get("lat")
        lon = filters.get("lon")
        radius_km = filters.get("radius_km")
        if lat is not None and lon is not None and radius_km is not None:
            return {
                "geo_distance": {
                    "distance": f"{float(radius_km)}km",
                    "location": {"lat": float(lat), "lon": float(lon)},
                }
            }
        return None

    def _compute_next_cursor(self, page: int, page_size: int, total: int) -> str | None:
        """Return the next page number as a string cursor, or None if no more pages."""
        if page * page_size < total:
            return str(page + 1)
        return None

    def _safe_float(self, value: Any) -> float | None:
        """Coerce value to float, returning None on failure."""
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    # ── Public API ────────────────────────────────────────────────────────────

    async def keyword_search(
        self,
        query: str,
        filters: dict[str, Any],
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        """
        BM25 keyword search over the listings index with optional filters.

        :param query: search query string (min 1 char)
        :param filters: flat dict of filter parameters (price_min, price_max,
            country, state, city, category, subcategory, brand, condition,
            status, trust_badge, radius_km, lat, lon)
        :param page: 1-based page number
        :param page_size: results per page (clamped to [1, 100])
        :returns: dict with results, total, page, page_size, next_cursor
        """
        query = (query or "").strip()
        if not query:
            raise InvalidInputError("Search query must not be empty.")

        page = max(1, page)
        page_size = self._clamp_page_size(page_size)
        from_offset = (page - 1) * page_size

        filter_clauses = self._build_filter_clauses(filters)
        geo_filter = self._build_geo_filter(filters)
        if geo_filter:
            filter_clauses.append(geo_filter)

        es_query: dict[str, Any] = {
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["title^3", "description", "category", "brand"],
                                "type": "best_fields",
                                "fuzziness": "AUTO",
                            }
                        }
                    ],
                    "filter": filter_clauses,
                }
            },
            "from": from_offset,
            "size": page_size,
            "sort": [
                {"_score": {"order": "desc"}},
                {"created_at": {"order": "desc"}},
            ],
        }

        try:
            response = await self._es.search(
                index=self._settings.ELASTICSEARCH_INDEX,
                body=es_query,
            )
        except Exception as exc:
            logger.error("elasticsearch_search_failed", query=query, error=str(exc), exc_info=True)
            raise ExternalServiceError(f"Search backend unavailable: {exc}") from exc

        hits = response.get("hits", {})
        total_value = hits.get("total", {})
        total: int = total_value.get("value", 0) if isinstance(total_value, dict) else int(total_value or 0)

        results = [SearchResult.from_es_hit(hit) for hit in hits.get("hits", [])]

        return {
            "results": [r.model_dump() for r in results],
            "total": total,
            "page": page,
            "page_size": page_size,
            "next_cursor": self._compute_next_cursor(page, page_size, total),
        }

    async def autocomplete(self, prefix: str) -> list[str]:
        """
        Return up to 10 autocomplete suggestions for the given prefix.

        Results are cached in Redis for 60 seconds under the key
        `search:autocomplete:{prefix}`. The entire operation must complete
        within 200 ms; on timeout an empty list is returned gracefully.

        :param prefix: search prefix string (should be at least 2 chars)
        :returns: list of suggestion strings (max 10)
        """
        prefix = (prefix or "").strip()
        if len(prefix) < 2:
            return []

        cache_key = RedisKeys.autocomplete(prefix)

        try:
            cached = await self._redis.get(cache_key)
            if cached:
                data = json.loads(cached)
                if isinstance(data, list):
                    return data[:_AUTOCOMPLETE_MAX_RESULTS]
        except Exception as exc:
            logger.warning("autocomplete_cache_read_failed", prefix=prefix, error=str(exc))

        es_query: dict[str, Any] = {
            "query": {
                "bool": {
                    "should": [
                        {
                            "prefix": {
                                "title": {
                                    "value": prefix.lower(),
                                    "boost": 2.0,
                                }
                            }
                        },
                        {
                            "prefix": {
                                "category": {
                                    "value": prefix.lower(),
                                    "boost": 1.0,
                                }
                            }
                        },
                    ],
                    "filter": [{"term": {"status": "active"}}],
                    "minimum_should_match": 1,
                }
            },
            "size": _AUTOCOMPLETE_MAX_RESULTS,
            "_source": ["title", "category"],
            "collapse": {"field": "title.keyword"} if False else None,  # disabled — field not mapped as keyword
        }

        # Remove None collapse to keep query clean
        es_query.pop("collapse", None)

        # Re-build without the collapsed field
        es_query_clean: dict[str, Any] = {
            "query": {
                "bool": {
                    "should": [
                        {"prefix": {"title": {"value": prefix.lower(), "boost": 2.0}}},
                        {"prefix": {"category": {"value": prefix.lower(), "boost": 1.0}}},
                    ],
                    "filter": [{"term": {"status": "active"}}],
                    "minimum_should_match": 1,
                }
            },
            "size": _AUTOCOMPLETE_MAX_RESULTS,
            "_source": ["title"],
        }

        try:
            response = await asyncio.wait_for(
                self._es.search(
                    index=self._settings.ELASTICSEARCH_INDEX,
                    body=es_query_clean,
                ),
                timeout=_AUTOCOMPLETE_TIMEOUT_S,
            )
        except asyncio.TimeoutError:
            logger.warning("autocomplete_timeout", prefix=prefix)
            return []
        except Exception as exc:
            logger.error("autocomplete_es_failed", prefix=prefix, error=str(exc), exc_info=True)
            return []

        suggestions: list[str] = []
        seen: set[str] = set()
        for hit in response.get("hits", {}).get("hits", []):
            title: str | None = hit.get("_source", {}).get("title")
            if title and title not in seen:
                suggestions.append(title)
                seen.add(title)
            if len(suggestions) >= _AUTOCOMPLETE_MAX_RESULTS:
                break

        try:
            await self._redis.setex(cache_key, _AUTOCOMPLETE_TTL, json.dumps(suggestions))
        except Exception as exc:
            logger.warning("autocomplete_cache_write_failed", prefix=prefix, error=str(exc))

        return suggestions

    async def voice_search(self, audio_bytes: bytes, content_type: str) -> dict[str, Any]:
        """
        Transcribe audio bytes via the AI Service and run a keyword search.

        :param audio_bytes: raw audio content
        :param content_type: MIME type of the audio (e.g. audio/wav)
        :returns: same dict shape as keyword_search
        :raises ExternalServiceError: if the AI service returns an error
        """
        if not audio_bytes:
            raise InvalidInputError("Audio content must not be empty.")
        if not content_type:
            raise InvalidInputError("Content-Type must be provided for voice search.")

        transcribe_url = f"{self._settings.AI_SERVICE_URL}/ai/search/transcribe"

        try:
            response = await self._http.post(
                transcribe_url,
                content=audio_bytes,
                headers={"Content-Type": content_type},
                timeout=self._settings.AI_TIMEOUT,
            )
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "ai_transcribe_http_error",
                status=exc.response.status_code,
                error=str(exc),
            )
            raise ExternalServiceError(
                f"AI transcription service returned {exc.response.status_code}."
            ) from exc
        except httpx.RequestError as exc:
            logger.error("ai_transcribe_request_error", error=str(exc))
            raise ExternalServiceError("AI transcription service unavailable.") from exc

        transcript: str = (payload.get("transcript") or "").strip()
        if not transcript:
            raise InvalidInputError("Could not transcribe audio — no text recognised.")

        return await self.keyword_search(
            query=transcript,
            filters={},
            page=1,
            page_size=_DEFAULT_PAGE_SIZE,
        )

    async def ai_search(
        self,
        query: str,
        page: int,
        page_size: int,
    ) -> dict[str, Any]:
        """
        Parse a natural-language query via the AI Service and run a keyword
        search with the returned structured filters.

        Falls back to plain keyword_search (no AI filters) if the AI service
        is unavailable or returns an unusable response.

        :param query: natural-language search query
        :param page: 1-based page number
        :param page_size: results per page
        :returns: same dict shape as keyword_search
        """
        query = (query or "").strip()
        if not query:
            raise InvalidInputError("Search query must not be empty.")

        parse_url = f"{self._settings.AI_SERVICE_URL}/ai/search/parse"
        ai_filters: dict[str, Any] = {}

        try:
            response = await self._http.post(
                parse_url,
                json={"query": query},
                timeout=self._settings.AI_TIMEOUT,
            )
            response.raise_for_status()
            payload = response.json()
            raw_filters = payload.get("filters") or {}
            if isinstance(raw_filters, dict):
                ai_filters = {k: v for k, v in raw_filters.items() if v is not None}
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            logger.warning(
                "ai_parse_unavailable",
                query=query,
                error=str(exc),
            )
            # Graceful fallback — proceed with no AI filters
            ai_filters = {}

        return await self.keyword_search(
            query=query,
            filters=ai_filters,
            page=page,
            page_size=page_size,
        )

    async def index_listing(self, payload: dict[str, Any]) -> None:
        """
        Index a listing document in Elasticsearch.

        The operation is idempotent — re-indexing with the same ID is safe.

        :param payload: listing dict; must contain at least "id"
        """
        listing_id = (payload.get("id") or "").strip()
        if not listing_id:
            logger.warning("index_listing_missing_id", payload_keys=list(payload.keys()))
            return

        doc = self._sanitise_document(payload)

        try:
            await self._es.index(
                index=self._settings.ELASTICSEARCH_INDEX,
                id=listing_id,
                document=doc,
            )
            logger.debug("listing_indexed", listing_id=listing_id)
        except Exception as exc:
            logger.error("listing_index_failed", listing_id=listing_id, error=str(exc), exc_info=True)
            raise

    async def update_listing(self, payload: dict[str, Any]) -> None:
        """
        Update an existing listing document in Elasticsearch.

        If the document does not exist (e.g., event received before index),
        the document is created (upsert semantics).

        :param payload: listing dict; must contain at least "id"
        """
        listing_id = (payload.get("id") or "").strip()
        if not listing_id:
            logger.warning("update_listing_missing_id", payload_keys=list(payload.keys()))
            return

        doc = self._sanitise_document(payload)

        try:
            await self._es.update(
                index=self._settings.ELASTICSEARCH_INDEX,
                id=listing_id,
                body={"doc": doc, "doc_as_upsert": True},
            )
            logger.debug("listing_updated", listing_id=listing_id)
        except Exception as exc:
            logger.error("listing_update_failed", listing_id=listing_id, error=str(exc), exc_info=True)
            raise

    async def delete_listing(self, listing_id: str) -> None:
        """
        Delete a listing document from Elasticsearch.

        If the document does not exist, the operation is silently ignored
        (idempotent).

        :param listing_id: UUID string of the listing to remove
        """
        listing_id = (listing_id or "").strip()
        if not listing_id:
            logger.warning("delete_listing_empty_id")
            return

        try:
            await self._es.delete(
                index=self._settings.ELASTICSEARCH_INDEX,
                id=listing_id,
            )
            logger.debug("listing_deleted", listing_id=listing_id)
        except ESNotFoundError:
            # Already gone — treat as success
            logger.debug("listing_delete_not_found", listing_id=listing_id)
        except Exception as exc:
            logger.error("listing_delete_failed", listing_id=listing_id, error=str(exc), exc_info=True)
            raise

    async def check_es_health(self) -> bool:
        """
        Ping Elasticsearch to verify connectivity.

        :returns: True if Elasticsearch responds to ping, False otherwise
        """
        try:
            return await self._es.ping()
        except Exception:
            logger.warning("elasticsearch_health_check_failed", exc_info=True)
            return False

    # ── Document helpers ──────────────────────────────────────────────────────

    def _sanitise_document(self, payload: dict[str, Any]) -> dict[str, Any]:
        """
        Strip unmapped or null fields and coerce types to match the ES mapping.
        Only known mapping fields are included in the output document.
        """
        known_fields = {
            "id", "title", "description", "category", "subcategory", "brand",
            "condition", "listing_type", "status", "price", "currency",
            "country", "state", "city", "location", "seller_trust_badge",
            "avg_rating", "created_at", "seller_id",
        }

        doc: dict[str, Any] = {}
        for field in known_fields:
            value = payload.get(field)
            if value is None:
                continue
            # Coerce numeric fields
            if field == "price":
                coerced = self._safe_float(value)
                if coerced is not None:
                    doc[field] = coerced
            elif field == "avg_rating":
                coerced = self._safe_float(value)
                if coerced is not None:
                    doc[field] = coerced
            elif field == "location":
                # Accept {"lat": ..., "lon": ...} or a list/tuple [lat, lon]
                if isinstance(value, dict) and "lat" in value and "lon" in value:
                    doc[field] = {"lat": float(value["lat"]), "lon": float(value["lon"])}
                elif isinstance(value, (list, tuple)) and len(value) == 2:
                    doc[field] = {"lat": float(value[0]), "lon": float(value[1])}
            else:
                doc[field] = value

        return doc

    def _safe_float(self, value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
