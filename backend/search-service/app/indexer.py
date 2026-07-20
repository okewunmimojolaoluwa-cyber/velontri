"""
Elasticsearch index management for the Velontri Search Service.

Handles index creation with the canonical listings mapping, and
provides upsert / partial-update / delete helpers consumed by
both the lifespan startup and the RabbitMQ consumers.
"""
from __future__ import annotations

from typing import Any

from elasticsearch import AsyncElasticsearch
from elasticsearch.exceptions import ElasticsearchException

from shared.logging import get_logger

logger = get_logger(__name__)

# ── Index mapping ─────────────────────────────────────────────────────────────

_LISTINGS_MAPPING: dict[str, Any] = {
    "settings": {
        "number_of_shards": 3,
        "number_of_replicas": 1,
        "analysis": {
            "analyzer": {
                "standard_lower": {
                    "type": "custom",
                    "tokenizer": "standard",
                    "filter": ["lowercase", "asciifolding"],
                }
            }
        },
    },
    "mappings": {
        "properties": {
            "id": {"type": "keyword"},
            "title": {
                "type": "text",
                "analyzer": "standard_lower",
                "fields": {
                    "keyword": {"type": "keyword", "ignore_above": 512}
                },
            },
            "description": {"type": "text", "analyzer": "standard_lower"},
            "category": {"type": "keyword"},
            "subcategory": {"type": "keyword"},
            "brand": {
                "type": "text",
                "analyzer": "standard_lower",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
            },
            "condition": {"type": "keyword"},
            "listing_type": {"type": "keyword"},
            "status": {"type": "keyword"},
            "price": {
                "type": "scaled_float",
                "scaling_factor": 100,
            },
            "currency": {"type": "keyword"},
            "country": {"type": "keyword"},
            "state": {"type": "keyword"},
            "city": {"type": "keyword"},
            "location": {"type": "geo_point"},
            "seller_trust_badge": {"type": "keyword"},
            "avg_rating": {"type": "half_float"},
            "created_at": {"type": "date"},
        }
    },
}


# ── Index lifecycle ───────────────────────────────────────────────────────────


async def ensure_index_exists(
    client: AsyncElasticsearch,
    index_name: str,
) -> None:
    """
    Create the listings index with its mapping if it doesn't already exist.
    Safe to call on every startup — idempotent.
    """
    try:
        exists = await client.indices.exists(index=index_name)
        if not exists:
            await client.indices.create(index=index_name, body=_LISTINGS_MAPPING)
            logger.info("elasticsearch_index_created", index=index_name)
        else:
            logger.debug("elasticsearch_index_exists", index=index_name)
    except ElasticsearchException as exc:
        logger.error(
            "elasticsearch_index_ensure_failed",
            index=index_name,
            error=str(exc),
            exc_info=True,
        )
        raise


# ── Document operations ───────────────────────────────────────────────────────


async def index_listing(
    client: AsyncElasticsearch,
    index_name: str,
    payload: dict[str, Any],
) -> None:
    """
    Upsert a listing document into the index.

    :param payload: must contain an 'id' key used as the document _id.
    """
    doc_id: str | None = payload.get("id") or payload.get("listing_id")
    if not doc_id:
        logger.error("index_listing_missing_id", payload_keys=list(payload.keys()))
        return

    # Normalise geo_point if lat/lon are provided as separate fields
    doc = dict(payload)
    lat = doc.pop("latitude", None)
    lon = doc.pop("longitude", None)
    if lat is not None and lon is not None:
        doc["location"] = {"lat": float(lat), "lon": float(lon)}

    # Ensure the canonical id field is present in the document body
    doc.setdefault("id", doc_id)

    try:
        await client.index(
            index=index_name,
            id=doc_id,
            document=doc,
        )
        logger.debug("listing_indexed", listing_id=doc_id, index=index_name)
    except ElasticsearchException as exc:
        logger.error(
            "listing_index_failed",
            listing_id=doc_id,
            index=index_name,
            error=str(exc),
            exc_info=True,
        )
        raise


async def update_listing(
    client: AsyncElasticsearch,
    index_name: str,
    listing_id: str,
    updates: dict[str, Any],
) -> None:
    """
    Partially update an existing listing document.
    Only the supplied fields are modified; all others are left unchanged.
    """
    if not updates:
        logger.debug("update_listing_noop", listing_id=listing_id)
        return

    # Normalise geo_point if provided
    lat = updates.pop("latitude", None)
    lon = updates.pop("longitude", None)
    if lat is not None and lon is not None:
        updates["location"] = {"lat": float(lat), "lon": float(lon)}

    try:
        await client.update(
            index=index_name,
            id=listing_id,
            doc=updates,
        )
        logger.debug("listing_updated", listing_id=listing_id, index=index_name)
    except ElasticsearchException as exc:
        logger.error(
            "listing_update_failed",
            listing_id=listing_id,
            index=index_name,
            error=str(exc),
            exc_info=True,
        )
        raise


async def delete_listing(
    client: AsyncElasticsearch,
    index_name: str,
    listing_id: str,
) -> None:
    """
    Delete a listing document from the index.
    A 404 (document not found) is logged as a warning but not re-raised,
    since idempotent deletes are acceptable.
    """
    try:
        await client.delete(index=index_name, id=listing_id)
        logger.debug("listing_deleted", listing_id=listing_id, index=index_name)
    except ElasticsearchException as exc:
        # NotFoundError is a subclass of ElasticsearchException
        if getattr(exc, "status_code", None) == 404:
            logger.warning(
                "listing_delete_not_found",
                listing_id=listing_id,
                index=index_name,
            )
        else:
            logger.error(
                "listing_delete_failed",
                listing_id=listing_id,
                index=index_name,
                error=str(exc),
                exc_info=True,
            )
            raise
