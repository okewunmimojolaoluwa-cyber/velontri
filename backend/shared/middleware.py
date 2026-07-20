"""
Shared FastAPI middleware for all Velontri microservices.

Includes:
- X-Request-ID injection (tracing)
- Security headers (HSTS, no-sniff, frame-options)
- CORS configuration
"""
from __future__ import annotations

import uuid

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Inject X-Request-ID into every request and response.
    If the client sends one, propagate it; otherwise generate a new UUID4.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        # Make it available on request.state for downstream handlers
        request.state.request_id = request_id

        import structlog
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to every response."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=()"
        # Remove server identification
        if "server" in response.headers:
            del response.headers["server"]
        return response


def configure_middleware(
    app: FastAPI,
    allowed_origins: list[str] | None = None,
) -> None:
    """
    Register all shared middleware on a FastAPI app.
    Call this before registering any routers.

    CORS rules:
    - Development: allow all localhost origins (with credentials)
    - Production: restrict to ALLOWED_ORIGINS env var
    - allow_credentials + allow_origins=["*"] is INVALID in browsers;
      we never use that combination.
    """
    import os

    # Build the origins list
    if allowed_origins:
        origins = allowed_origins
    else:
        env_origins = os.environ.get("ALLOWED_ORIGINS", "")
        if env_origins:
            origins = [o.strip() for o in env_origins.split(",") if o.strip()]
        else:
            # Development defaults — all common localhost ports
            origins = [
                "http://localhost",
                "http://localhost:3000",
                "http://localhost:3001",
                "http://localhost:4200",
                "http://localhost:5173",
                "http://localhost:8080",
                "http://localhost:8100",
                "http://127.0.0.1:3000",
                "http://127.0.0.1:5173",
                "http://127.0.0.1:8080",
            ]

    # Use allow_credentials=True with explicit origins (never with wildcard)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"https?://.*\.velontri\.com",
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID", "Accept", "Origin"],
        expose_headers=["X-Request-ID", "X-Total-Count"],
        max_age=600,
    )
