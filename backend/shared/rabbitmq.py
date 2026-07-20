"""
RabbitMQ publish/consume helpers for all Velontri microservices.

Design principles:
- Uses aio-pika for async AMQP communication.
- Persistent messages (delivery_mode=2) by default — survive broker restart.
- Publisher confirms enabled — publish only returns after broker ACK.
- Consumer uses manual acknowledgement — message is not removed from queue
  until processing succeeds.
- Dead-letter exchange (DLX) support — after max_retries the message is
  routed to the DLX for ops investigation.
- Exponential backoff on reconnection.
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import Callable, Coroutine
from datetime import datetime, timezone
from typing import Any

import aio_pika
from aio_pika import DeliveryMode, ExchangeType, Message
from aio_pika.abc import AbstractChannel, AbstractConnection, AbstractIncomingMessage

from shared.logging import get_logger

logger = get_logger(__name__)

# ── Exchange / queue naming conventions ───────────────────────────────────────

VELONTRI_EXCHANGE = "velontri.events"
DEAD_LETTER_EXCHANGE = "velontri.dlx"


# ── Connection management ─────────────────────────────────────────────────────

async def connect_with_backoff(
    rabbitmq_url: str,
    reconnect_delay: float = 2.0,
    max_delay: float = 60.0,
    max_attempts: int = 0,  # 0 = infinite
) -> AbstractConnection:
    """
    Connect to RabbitMQ with exponential back-off.
    Raises ConnectionError if max_attempts is exceeded.
    """
    delay = reconnect_delay
    attempt = 0

    while True:
        attempt += 1
        try:
            connection = await aio_pika.connect_robust(rabbitmq_url)
            logger.info("rabbitmq_connected", attempt=attempt)
            return connection
        except Exception as exc:
            if max_attempts and attempt >= max_attempts:
                raise ConnectionError(
                    f"Failed to connect to RabbitMQ after {attempt} attempts"
                ) from exc

            logger.warning(
                "rabbitmq_connect_failed",
                attempt=attempt,
                delay=delay,
                error=str(exc),
            )
            await asyncio.sleep(delay)
            delay = min(delay * 2, max_delay)


async def setup_infrastructure(channel: AbstractChannel) -> None:
    """
    Declare the main events exchange and the dead-letter exchange.
    Idempotent — safe to call on every startup.
    """
    # Main topic exchange — all services publish and subscribe here
    await channel.declare_exchange(
        VELONTRI_EXCHANGE,
        ExchangeType.TOPIC,
        durable=True,
    )
    # DLX — receives messages that exceeded max retry attempts
    await channel.declare_exchange(
        DEAD_LETTER_EXCHANGE,
        ExchangeType.FANOUT,
        durable=True,
    )
    # DLX queue — ops team monitors this
    dlx_queue = await channel.declare_queue(
        "velontri.dead_letters",
        durable=True,
    )
    await dlx_queue.bind(DEAD_LETTER_EXCHANGE)

    logger.info("rabbitmq_infrastructure_ready")


# ── Publisher ─────────────────────────────────────────────────────────────────

async def publish_event(
    channel: AbstractChannel,
    routing_key: str,
    payload: dict[str, Any],
    correlation_id: str | None = None,
) -> None:
    """
    Publish a persistent event to the main Velontri exchange.

    :param channel: aio_pika channel with publisher confirms enabled
    :param routing_key: dot-separated event name, e.g. "user.registered"
    :param payload: dict to serialise as JSON
    :param correlation_id: optional trace ID for distributed tracing
    """
    exchange = await channel.get_exchange(VELONTRI_EXCHANGE)

    body = json.dumps(
        {
            **payload,
            "_meta": {
                "routing_key": routing_key,
                "published_at": datetime.now(tz=timezone.utc).isoformat(),
                "correlation_id": correlation_id,
            },
        },
        default=str,
    ).encode()

    message = Message(
        body=body,
        delivery_mode=DeliveryMode.PERSISTENT,
        content_type="application/json",
        correlation_id=correlation_id,
    )

    await exchange.publish(message, routing_key=routing_key)
    logger.debug(
        "event_published",
        routing_key=routing_key,
        correlation_id=correlation_id,
    )


# ── Consumer ──────────────────────────────────────────────────────────────────

MessageHandler = Callable[
    [dict[str, Any]],
    Coroutine[Any, Any, None],
]


async def consume_events(
    channel: AbstractChannel,
    queue_name: str,
    routing_keys: list[str],
    handler: MessageHandler,
    max_retries: int = 3,
) -> None:
    """
    Declare a durable queue, bind it to the given routing keys, and
    start consuming messages.

    On handler failure the message is requeued up to max_retries times,
    then routed to the DLX.

    :param channel: aio_pika channel
    :param queue_name: unique queue name for this service's consumer
    :param routing_keys: list of topic patterns, e.g. ["user.*", "order.completed"]
    :param handler: async callable that receives the decoded payload dict
    :param max_retries: number of nack-and-requeue attempts before DLX routing
    """
    exchange = await channel.get_exchange(VELONTRI_EXCHANGE)
    dlx = await channel.get_exchange(DEAD_LETTER_EXCHANGE)

    queue = await channel.declare_queue(
        queue_name,
        durable=True,
        arguments={
            "x-dead-letter-exchange": DEAD_LETTER_EXCHANGE,
        },
    )

    for rk in routing_keys:
        await queue.bind(exchange, routing_key=rk)

    logger.info(
        "consumer_started",
        queue=queue_name,
        routing_keys=routing_keys,
    )

    async def _process(message: AbstractIncomingMessage) -> None:
        retry_count: int = int(
            (message.headers or {}).get("x-retry-count", 0)
        )

        try:
            payload = json.loads(message.body.decode())
            await handler(payload)
            await message.ack()
            logger.debug(
                "message_processed",
                queue=queue_name,
                routing_key=message.routing_key,
            )
        except Exception as exc:
            logger.error(
                "message_processing_failed",
                queue=queue_name,
                routing_key=message.routing_key,
                retry_count=retry_count,
                error=str(exc),
                exc_info=True,
            )
            if retry_count < max_retries:
                # Nack without requeue; rely on dead-letter routing + retry headers
                await message.nack(requeue=False)
                # Re-publish with incremented retry counter
                retry_body = message.body
                retry_message = Message(
                    body=retry_body,
                    delivery_mode=DeliveryMode.PERSISTENT,
                    content_type="application/json",
                    headers={
                        **(message.headers or {}),
                        "x-retry-count": retry_count + 1,
                    },
                    routing_key=message.routing_key,
                )
                await exchange.publish(
                    retry_message,
                    routing_key=message.routing_key or "",
                )
            else:
                # Exceeded max retries — route to DLX
                logger.critical(
                    "message_sent_to_dlx",
                    queue=queue_name,
                    routing_key=message.routing_key,
                    retry_count=retry_count,
                )
                await message.nack(requeue=False)

    await queue.consume(_process)
