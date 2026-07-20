"""
Prometheus metrics middleware for all Velontri microservices.

Every service mounts this middleware to expose:
- velontri_http_requests_total (counter, labels: method, path, status_code)
- velontri_http_request_duration_seconds (histogram, labels: method, path)
- velontri_http_requests_in_progress (gauge, labels: method, path)

The /metrics and /health paths are excluded from instrumentation to avoid
polluting dashboards with internal traffic.
"""
from __future__ import annotations

import time

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

# ── Metric definitions ────────────────────────────────────────────────────────

REQUEST_COUNT = Counter(
    "velontri_http_requests_total",
    "Total HTTP requests",
    ["method", "path", "status_code"],
)

REQUEST_LATENCY = Histogram(
    "velontri_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

REQUESTS_IN_PROGRESS = Gauge(
    "velontri_http_requests_in_progress",
    "HTTP requests currently being processed",
    ["method", "path"],
)

# Paths excluded from metrics collection
_EXCLUDED_PATHS: frozenset[str] = frozenset({"/metrics", "/health"})


class PrometheusMiddleware(BaseHTTPMiddleware):
    """
    Starlette middleware that records Prometheus metrics for every request.
    Skips /metrics and /health to avoid noise.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        path = request.url.path
        method = request.method

        if path in _EXCLUDED_PATHS:
            return await call_next(request)

        REQUESTS_IN_PROGRESS.labels(method=method, path=path).inc()
        start_time = time.perf_counter()

        try:
            response = await call_next(request)
            status_code = str(response.status_code)
        except Exception:
            status_code = "500"
            raise
        finally:
            duration = time.perf_counter() - start_time
            REQUESTS_IN_PROGRESS.labels(method=method, path=path).dec()
            REQUEST_COUNT.labels(
                method=method, path=path, status_code=status_code
            ).inc()
            REQUEST_LATENCY.labels(method=method, path=path).observe(duration)

        return response


async def metrics_endpoint(_request: Request) -> Response:
    """Handler for GET /metrics — returns Prometheus text format."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
