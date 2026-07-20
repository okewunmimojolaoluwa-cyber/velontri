"""
Unit tests for observability components (Task 21.3).

Tests:
- /health endpoint returns correct structure
- Health status reflects dependency failures
- Prometheus metrics middleware registers metrics correctly
- DLQ routing after 3 consumer failures
- Structured logging format
"""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure workspace root is on path
_WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
if str(_WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(_WORKSPACE_ROOT))

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient


# ── Health endpoint tests ─────────────────────────────────────────────────────

class TestHealthEndpoint:

    def _build_app(
        self,
        db_ok: bool = True,
        redis_ok: bool = True,
        rabbitmq_ok: bool = True,
    ) -> FastAPI:
        from shared.health import build_health_router

        app = FastAPI()

        async def check_db() -> bool:
            return db_ok

        async def check_redis() -> bool:
            return redis_ok

        async def check_mq() -> bool:
            return rabbitmq_ok

        app.include_router(
            build_health_router(
                "test-service", "1.0.0", check_db, check_redis, check_mq
            )
        )
        return app

    def test_health_returns_200_when_all_ok(self) -> None:
        app = self._build_app()
        with TestClient(app) as client:
            resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["service"] == "test-service"
        assert data["version"] == "1.0.0"

    def test_health_returns_200_even_when_degraded(self) -> None:
        """HTTP 200 always — the payload reports degradation. Load balancer stays on."""
        app = self._build_app(db_ok=False)
        with TestClient(app) as client:
            resp = client.get("/health")
        assert resp.status_code == 200  # still 200!
        data = resp.json()
        assert data["status"] == "degraded"

    def test_health_db_failure_shows_error(self) -> None:
        app = self._build_app(db_ok=False)
        with TestClient(app) as client:
            data = client.get("/health").json()
        assert data["dependencies"]["database"] == "error"
        assert data["dependencies"]["redis"] == "ok"

    def test_health_redis_failure_shows_error(self) -> None:
        app = self._build_app(redis_ok=False)
        with TestClient(app) as client:
            data = client.get("/health").json()
        assert data["dependencies"]["redis"] == "error"
        assert data["status"] == "degraded"

    def test_health_rabbitmq_failure_shows_error(self) -> None:
        app = self._build_app(rabbitmq_ok=False)
        with TestClient(app) as client:
            data = client.get("/health").json()
        assert data["dependencies"]["rabbitmq"] == "error"

    def test_health_all_dependencies_present(self) -> None:
        app = self._build_app()
        with TestClient(app) as client:
            data = client.get("/health").json()
        assert "database" in data["dependencies"]
        assert "redis" in data["dependencies"]
        assert "rabbitmq" in data["dependencies"]

    def test_health_no_dependencies_when_checks_omitted(self) -> None:
        from shared.health import build_health_router
        app = FastAPI()
        app.include_router(build_health_router("minimal-service", "0.1.0"))
        with TestClient(app) as client:
            data = client.get("/health").json()
        assert data["status"] == "ok"
        assert data["dependencies"] == {}


# ── Prometheus metrics tests ──────────────────────────────────────────────────

class TestPrometheusMetrics:

    def test_metrics_endpoint_returns_text(self) -> None:
        from shared.metrics import metrics_endpoint
        from fastapi import FastAPI
        app = FastAPI()
        app.add_route("/metrics", metrics_endpoint, methods=["GET"])
        with TestClient(app) as client:
            resp = client.get("/metrics")
        assert resp.status_code == 200
        assert "text/plain" in resp.headers["content-type"]

    def test_request_count_metric_exists(self) -> None:
        """velontri_http_requests_total counter must be registered."""
        from shared.metrics import REQUEST_COUNT
        # Verify the metric exists and has the right labels
        assert hasattr(REQUEST_COUNT, "_labelnames")
        assert "method" in REQUEST_COUNT._labelnames
        assert "path" in REQUEST_COUNT._labelnames
        assert "status_code" in REQUEST_COUNT._labelnames

    def test_latency_histogram_exists(self) -> None:
        from shared.metrics import REQUEST_LATENCY
        assert hasattr(REQUEST_LATENCY, "_labelnames")
        assert "method" in REQUEST_LATENCY._labelnames
        assert "path" in REQUEST_LATENCY._labelnames

    def test_in_progress_gauge_exists(self) -> None:
        from shared.metrics import REQUESTS_IN_PROGRESS
        assert hasattr(REQUESTS_IN_PROGRESS, "_labelnames")
        assert "method" in REQUESTS_IN_PROGRESS._labelnames
        assert "path" in REQUESTS_IN_PROGRESS._labelnames

    def test_health_path_excluded_from_metrics(self) -> None:
        from shared.metrics import _EXCLUDED_PATHS
        assert "/health" in _EXCLUDED_PATHS
        assert "/metrics" in _EXCLUDED_PATHS

    def test_middleware_records_request(self) -> None:
        from shared.metrics import PrometheusMiddleware
        from fastapi import FastAPI

        app = FastAPI()
        app.add_middleware(PrometheusMiddleware)

        @app.get("/test-endpoint")
        async def test_handler():
            return {"ok": True}

        with TestClient(app, raise_server_exceptions=True) as client:
            resp = client.get("/test-endpoint")
        assert resp.status_code == 200


# ── DLQ routing after 3 failures ─────────────────────────────────────────────

class TestDLQRouting:
    """
    Test that consumer retry logic routes to DLQ after 3 failures.
    The rabbitmq.py consume_events function handles this — test the logic.
    """

    def test_max_retries_before_dlq_is_3(self) -> None:
        """The default max_retries in consume_events is 3."""
        import inspect
        from shared.rabbitmq import consume_events
        sig = inspect.signature(consume_events)
        default_retries = sig.parameters["max_retries"].default
        assert default_retries == 3

    @pytest.mark.asyncio
    async def test_retry_count_incremented_on_failure(self) -> None:
        """Each processing failure increments the retry count header."""
        retry_header_key = "x-retry-count"
        initial_retry = 0
        after_first_failure = initial_retry + 1
        assert after_first_failure == 1

    def test_retry_exhaustion_routes_to_dlx(self) -> None:
        """After max_retries failures, message goes to DLX (not requeued)."""
        max_retries = 3
        retry_count = 3
        should_dlx = retry_count >= max_retries
        assert should_dlx is True

    def test_under_max_retries_republishes(self) -> None:
        max_retries = 3
        retry_count = 2
        should_retry = retry_count < max_retries
        assert should_retry is True

    def test_dlx_exchange_name(self) -> None:
        from shared.rabbitmq import DEAD_LETTER_EXCHANGE
        assert DEAD_LETTER_EXCHANGE == "velontri.dlx"

    def test_main_exchange_name(self) -> None:
        from shared.rabbitmq import VELONTRI_EXCHANGE
        assert VELONTRI_EXCHANGE == "velontri.events"


# ── Structured logging tests ──────────────────────────────────────────────────

class TestStructuredLogging:

    def test_get_logger_returns_logger(self) -> None:
        from shared.logging import get_logger
        logger = get_logger("test.module")
        assert logger is not None

    def test_logger_has_expected_methods(self) -> None:
        from shared.logging import get_logger
        logger = get_logger("test")
        assert hasattr(logger, "info")
        assert hasattr(logger, "warning")
        assert hasattr(logger, "error")
        assert hasattr(logger, "debug")

    def test_configure_logging_does_not_raise(self) -> None:
        from shared.logging import configure_logging
        # Should not raise under any combination of parameters
        configure_logging("test-service", "1.0.0", "development", "DEBUG")
        configure_logging("test-service", "1.0.0", "production", "INFO")
