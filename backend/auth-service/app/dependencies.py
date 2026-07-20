"""
FastAPI dependency injection for the Auth Service.

Provides:
- Database session (per-request, auto-commit/rollback)
- Redis client (shared pool)
- RabbitMQ channel (shared connection)
- JWT-authenticated user extraction
- IP address extraction
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from shared.errors import TokenExpiredError, TokenInvalidError, UnauthorizedError
from shared.jwt_utils import verify_token
from shared.logging import get_logger

from .config import AuthSettings, get_settings

logger = get_logger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


# ── Settings ──────────────────────────────────────────────────────────────────

def get_auth_settings() -> AuthSettings:
    return get_settings()


# ── Database session ──────────────────────────────────────────────────────────

async def get_db_session(request: Request) -> AsyncSession:  # type: ignore[return]
    """Yield a database session from the app-level session factory.
    Commits on success, rolls back on exception."""
    session_factory = request.app.state.session_factory
    session = session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


# ── Redis client ──────────────────────────────────────────────────────────────

async def get_redis(request: Request):  # type: ignore[return]
    return request.app.state.redis


# ── RabbitMQ channel ──────────────────────────────────────────────────────────

async def get_rabbitmq_channel(request: Request):  # type: ignore[return]
    return request.app.state.rabbitmq_channel


# ── IP address ────────────────────────────────────────────────────────────────

def get_client_ip(request: Request) -> str | None:
    """
    Extract the real client IP address.
    Respects X-Forwarded-For when running behind a trusted proxy.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain (client IP)
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


# ── Authenticated user ────────────────────────────────────────────────────────

async def get_current_user_id(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)
    ],
    settings: Annotated[AuthSettings, Depends(get_auth_settings)],
) -> uuid.UUID:
    """
    Validate the Bearer JWT and return the authenticated user's UUID.
    Raises UnauthorizedError if no token or invalid token.
    """
    if credentials is None:
        raise UnauthorizedError("Authentication required. Please provide a Bearer token.")

    try:
        payload = verify_token(
            public_key_path=settings.JWT_PUBLIC_KEY_PATH,
            token=credentials.credentials,
        )
        return uuid.UUID(payload["sub"])
    except TokenExpiredError as exc:
        raise exc  # Re-raise as-is — error handler maps this to 401
    except TokenInvalidError as exc:
        raise exc
    except Exception as exc:
        raise UnauthorizedError("Invalid authentication token.") from exc
