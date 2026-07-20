"""
Structured JSON logging for all Velontri microservices.

Uses structlog with a consistent processor chain that:
- Redacts sensitive fields before any output
- Adds service name, version, and environment to every log entry
- Outputs JSON in production, coloured console in development
"""
from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

# Fields that must NEVER appear in log output
_REDACTED_FIELDS: frozenset[str] = frozenset(
    {
        "password",
        "password_hash",
        "token",
        "access_token",
        "refresh_token",
        "secret",
        "api_key",
        "authorization",
        "otp",
        "code",
        "credit_card",
        "card_number",
        "cvv",
        "totp_secret",
        "private_key",
        "aws_secret_access_key",
    }
)

_REDACTED_SENTINEL: str = "**REDACTED**"


def _redact_sensitive(
    logger: Any,  # noqa: ANN401
    method: str,
    event_dict: dict[str, Any],
) -> dict[str, Any]:
    """Processor: replace sensitive field values with a sentinel."""
    for key in list(event_dict.keys()):
        if key.lower() in _REDACTED_FIELDS:
            event_dict[key] = _REDACTED_SENTINEL
    return event_dict


def configure_logging(
    service_name: str,
    service_version: str,
    environment: str,
    log_level: str = "INFO",
) -> None:
    """
    Configure structlog for the calling service.
    Call once at application startup.
    """
    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        _redact_sensitive,
        structlog.stdlib.ExtraAdder(),
    ]

    # Bind fixed fields to every log entry for this service
    structlog.contextvars.bind_contextvars(
        service=service_name,
        version=service_version,
        environment=environment,
    )

    is_production = environment == "production"

    if is_production:
        # JSON output for log aggregation
        renderer = structlog.processors.JSONRenderer()
    else:
        # Pretty coloured output for local development
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=shared_processors,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.addHandler(handler)
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Suppress noisy third-party loggers in production
    if is_production:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Return a structlog logger bound to *name*."""
    return structlog.get_logger(name)
