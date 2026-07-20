"""
Pydantic schemas for the Search Service API.

All request/response models are fully typed and validated.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Filter schema ─────────────────────────────────────────────────────────────

class SearchFilters(BaseModel):
    """Optional filters that narrow a keyword or AI search."""

    price_min: float | None = Field(default=None, ge=0.0)
    price_max: float | None = Field(default=None, ge=0.0)
    country: str | None = Field(default=None, max_length=2)
    state: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    radius_km: float | None = Field(default=None, ge=0.1, le=20000.0)
    category: str | None = Field(default=None, max_length=100)
    subcategory: str | None = Field(default=None, max_length=100)
    brand: str | None = Field(default=None, max_length=100)
    condition: str | None = Field(default=None, max_length=20)
    status: str | None = Field(default=None, max_length=30)
    trust_badge: str | None = Field(default=None, max_length=20)

    @model_validator(mode="after")
    def validate_price_range(self) -> "SearchFilters":
        if (
            self.price_min is not None
            and self.price_max is not None
            and self.price_min > self.price_max
        ):
            raise ValueError("price_min must not exceed price_max")
        return self


# ── Request schemas ───────────────────────────────────────────────────────────

class SearchRequest(BaseModel):
    """Keyword search request body (used internally; GET params are parsed separately)."""

    query: str = Field(..., min_length=1, max_length=500, strip_whitespace=True)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    filters: SearchFilters | None = None

    @field_validator("query")
    @classmethod
    def query_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("query must not be blank")
        return v.strip()


class AISearchRequest(BaseModel):
    """AI natural-language search request body."""

    query: str = Field(..., min_length=1, max_length=500, strip_whitespace=True)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @field_validator("query")
    @classmethod
    def query_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("query must not be blank")
        return v.strip()


# ── Result schemas ────────────────────────────────────────────────────────────

class SearchResult(BaseModel):
    """Single listing result returned from search."""

    id: str
    title: str
    price: float | None = None
    currency: str | None = None
    category: str | None = None
    listing_type: str | None = None
    status: str | None = None
    avg_rating: float | None = None
    seller_trust_badge: str | None = None
    created_at: datetime | str | None = None

    @classmethod
    def from_es_hit(cls, hit: dict[str, Any]) -> "SearchResult":
        """Construct a SearchResult from an Elasticsearch hit dict."""
        source: dict[str, Any] = hit.get("_source", {})
        return cls(
            id=source.get("id") or hit.get("_id") or "",
            title=source.get("title") or "",
            price=source.get("price"),
            currency=source.get("currency"),
            category=source.get("category"),
            listing_type=source.get("listing_type"),
            status=source.get("status"),
            avg_rating=source.get("avg_rating"),
            seller_trust_badge=source.get("seller_trust_badge"),
            created_at=source.get("created_at"),
        )


class SearchResponse(BaseModel):
    """Paginated search response."""

    results: list[SearchResult]
    total: int
    page: int
    page_size: int
    next_cursor: str | None = None


class AutocompleteResponse(BaseModel):
    """Autocomplete suggestions response."""

    suggestions: list[str]
