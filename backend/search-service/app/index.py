"""
Elasticsearch index management for the Search Service.

Defines the listings index mapping and provides a helper to ensure
the index exists at startup. All operations are idempotent.
"""
from __future__ import annotations

from elasticsearch import AsyncElasticsearch, NotFoundError

from shared.logging import get_logger

logger = get_logger(__name__)

# ── Index mapping ─────────────────────────────────────────────────────────────

LISTINGS_INDEX_MAPPING: dict = {
    "mappings": {
        "properties": {
            "id": {"type": "keyword"},
            "title": {"type": "text", "analyzer": "standard"},
            "description": {"type": "text"},
            "category": {"type": "keyword"},
            "subcategory": {"type": "keyword"},
            "brand": {"type": "keyword"},
            "condition": {"type": "keyword"},
            "listing_type": {"type": "keyword"},
            "status": {"type": "keyword"},
            "price": {"type": "scaled_float", "scaling_factor": 100},
            "currency": {"type": "keyword"},
            "country": {"type": "keyword"},
            "state": {"type": "keyword"},
            "city": {"type": "keyword"},
            "location": {"type": "geo_point"},
            "seller_trust_badge": {"type": "keyword"},
            "avg_rating": {"type": "half_float"},
            "created_at": {"type": "date"},
            "seller_id": {"type": "keyword"},
        }
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 1,
    },
}


async def ensure_index_exists(es_client: AsyncElasticsearch, index_name: str) -> None:
    """
    Create the Elasticsearch index with the listings mapping if it does not
    already exist. Safe to call on every startup (idempotent).

    :param es_client: AsyncElasticsearch client instance
    :param index_name: target index name from settings
    """
    try:
        exists = await es_client.indices.exists(index=index_name)
        if exists:
            logger.info("elasticsearch_index_exists", index=index_name)
            return

        await es_client.indices.create(
            index=index_name,
            body=LISTINGS_INDEX_MAPPING,
        )
        logger.info("elasticsearch_index_created", index=index_name)
    except Exception as exc:
        # Log and re-raise — startup should fail loudly if ES is misconfigured
        logger.error(
            "elasticsearch_index_create_failed",
            index=index_name,
            error=str(exc),
            exc_info=True,
        )
        raise
