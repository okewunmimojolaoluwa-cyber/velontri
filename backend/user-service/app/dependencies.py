"""
User Service FastAPI dependency injection.

Provides:
- Database session (per-request)
- Redis client
- RabbitMQ channel
- Authenticated user ID (via JWT introspection)
- IP address extraction
- RBAC scope enforcement
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from shared.errors import ForbiddenError, UnauthorizedError
from shared.jwt_utils import verify_token
from shared.errors import TokenExpiredError, TokenInvalidError
from shared.logging import get_logger

from .config import UserSettings, get_settings

logger = get_logger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


def get_user_settings() -> UserSettings:
    return get_settings()


async def get_db_session(request: Request):  # type: ignore[return]
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


async def get_redis(request: Request):
    return request.app.state.redis


async def get_rabbitmq_channel(request: Request):
    return request.app.state.rabbitmq_channel


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


async def get_current_user_payload(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)
    ],
    settings: Annotated[UserSettings, Depends(get_user_settings)],
) -> dict:
    """Verify JWT and return the full decoded payload."""
    if credentials is None:
        raise UnauthorizedError("Authentication required.")
    try:
        return verify_token(
            public_key_path=settings.JWT_PUBLIC_KEY_PATH,
            token=credentials.credentials,
        )
    except TokenExpiredError:
        raise
    except TokenInvalidError:
        raise
    except Exception as exc:
        raise UnauthorizedError("Invalid authentication token.") from exc


async def get_current_user_id(
    payload: Annotated[dict, Depends(get_current_user_payload)],
) -> uuid.UUID:
    return uuid.UUID(payload["sub"])


async def require_role(
    required_role: str,
    payload: Annotated[dict, Depends(get_current_user_payload)],
) -> dict:
    """Raise ForbiddenError if the authenticated user does not hold required_role."""
    roles: list[str] = payload.get("roles", [])
    if required_role not in roles:
        raise ForbiddenError(
            f"This action requires the '{required_role}' role."
        )
    return payload
