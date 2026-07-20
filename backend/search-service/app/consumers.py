"""
RabbitMQ event consumers for the Search Service.

Handles:
  listing.created  → index new listing document in Elasticsearch
  listing.updated  → update existing listing document
  listing.deleted  → remove listing document from index

All handlers are idempotent — receiving the same event multiple times
produces the same final state. Missing or invalid fields are handled
gracefully without crashing the consumer.
"""
from __future__ import annotations

from typing import Any

from elasticsearch import AsyncElasticsearch

from shared.logging import get_logger

from .config import SearchSettings
from .service import SearchService

logger = get_logger(__name__)


def _get_listing_id(payload: dict[str, Any], event: str) -> str | None:
    """Extract and validate the listing ID from an event payload."""
    listing_id = (payload.get("id") or payload.get("listing_id") or "").strip()
    if not listing_id:
        logger.warning(
            "consumer_missing_listing_id",
            event=event,
            payload_keys=list(payload.keys()),
        )
        return None
    return listing_id


async def handle_listing_created(
    payload: dict[str, Any],
    es_client: AsyncElasticsearch,
    settings: SearchSettings,
) -> None:
    """
    Index a new listing document when `listing.created` is received.

    Idempotent — if the document already exists in ES it will be overwritten
    (upsert behaviour via the index API).

    :param payload: event payload dict from RabbitMQ
    :param es_client: AsyncElasticsearch client
    :param settings: search service settings
    """
    listing_id = _get_listing_id(payload, "listing.created")
    if listing_id is None:
        return

    # Ensure canonical "id" field is present in the document
    if "id" not in payload or not payload["id"]:
        payload = {**payload, "id": listing_id}

    svc = SearchService(
        es_client=es_client,
        redis=None,  # type: ignore[arg-type] — not needed for indexing
        settings=settings,
        http_client=None,  # type: ignore[arg-type] — not needed for indexing
    )

    try:
        await svc.index_listing(payload)
        logger.info("listing_created_indexed", listing_id=listing_id)
    except Exception as exc:
        logger.error(
            "handle_listing_created_failed",
            listing_id=listing_id,
            error=str(exc),
            exc_info=True,
        )
        raise  # Re-raise so the RabbitMQ consumer can handle retry/DLX


async def handle_listing_updated(
    payload: dict[str, Any],
    es_client: AsyncElasticsearch,
    settings: SearchSettings,
) -> None:
    """
    Update an existing listing document when `listing.updated` is received.

    Uses upsert semantics — if the document is not found in ES (e.g., index
    was rebuilt), it is created.

    :param payload: event payload dict from RabbitMQ
    :param es_client: AsyncElasticsearch client
    :param settings: search service settings
    """
    listing_id = _get_listing_id(payload, "listing.updated")
    if listing_id is None:
        return

    if "id" not in payload or not payload["id"]:
        payload = {**payload, "id": listing_id}

    svc = SearchService(
        es_client=es_client,
        redis=None,  # type: ignore[arg-type]
        settings=settings,
        http_client=None,  # type: ignore[arg-type]
    )

    try:
        await svc.update_listing(payload)
        logger.info("listing_updated_indexed", listing_id=listing_id)
    except Exception as exc:
        logger.error(
            "handle_listing_updated_failed",
            listing_id=listing_id,
            error=str(exc),
            exc_info=True,
        )
        raise


async def handle_listing_deleted(
    payload: dict[str, Any],
    es_client: AsyncElasticsearch,
    settings: SearchSettings,
) -> None:
    """
    Remove a listing document from the index when `listing.deleted` is received.

    Idempotent — if the document is already absent, the operation succeeds
    silently.

    :param payload: event payload dict from RabbitMQ
    :param es_client: AsyncElasticsearch client
    :param settings: search service settings
    """
    listing_id = _get_listing_id(payload, "listing.deleted")
    if listing_id is None:
        return

    svc = SearchService(
        es_client=es_client,
        redis=None,  # type: ignore[arg-type]
        settings=settings,
        http_client=None,  # type: ignore[arg-type]
    )

    try:
        await svc.delete_listing(listing_id)
        logger.info("listing_deleted_from_index", listing_id=listing_id)
    except Exception as exc:
        logger.error(
            "handle_listing_deleted_failed",
            listing_id=listing_id,
            error=str(exc),
            exc_info=True,
        )
        raise
