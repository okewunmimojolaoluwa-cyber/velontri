"""
Health check endpoint builder for all Velontri microservices.

Every service exposes GET /health returning:
{
  "service": "auth-service",
  "version": "1.0.0",
  "status": "ok" | "degraded",
  "dependencies": {
    "database": "ok" | "error",
    "redis":    "ok" | "error",
    "rabbitmq": "ok" | "error"
  }
}

The endpoint must respond within 500ms (requirement 23.4).
Response is HTTP 200 even when dependencies are degraded — this allows
the load balancer to keep the pod in rotation while ops investigates.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import APIRouter
from starlette.requests import Request
from starlette.responses import JSONResponse

HealthCheck = Callable[[], Awaitable[bool]]


def build_health_router(
    service_name: str,
    service_version: str,
    db_check: HealthCheck | None = None,
    redis_check: HealthCheck | None = None,
    rabbitmq_check: HealthCheck | None = None,
) -> APIRouter:
    """
    Build a FastAPI router that exposes GET /health.

    :param service_name: display name of the service
    :param service_version: semver string
    :param db_check: async callable that returns True if DB is healthy
    :param redis_check: async callable that returns True if Redis is healthy
    :param rabbitmq_check: async callable that returns True if RabbitMQ is healthy
    """
    router = APIRouter(tags=["health"])

    @router.get("/health", include_in_schema=False)
    async def health(_request: Request) -> JSONResponse:
        dependencies: dict[str, str] = {}
        overall = "ok"

        if db_check is not None:
            db_ok = await db_check()
            dependencies["database"] = "ok" if db_ok else "error"
            if not db_ok:
                overall = "degraded"

        if redis_check is not None:
            redis_ok = await redis_check()
            dependencies["redis"] = "ok" if redis_ok else "error"
            if not redis_ok:
                overall = "degraded"

        if rabbitmq_check is not None:
            mq_ok = await rabbitmq_check()
            dependencies["rabbitmq"] = "ok" if mq_ok else "error"
            if not mq_ok:
                overall = "degraded"

        body: dict[str, Any] = {
            "service": service_name,
            "version": service_version,
            "status": overall,
            "dependencies": dependencies,
        }
        # Always HTTP 200 — the payload communicates the health state
        return JSONResponse(content=body, status_code=200)

    return router
