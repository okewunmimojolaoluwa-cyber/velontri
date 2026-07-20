"""Search Service dependency injection."""
from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from shared.errors import TokenExpiredError, TokenInvalidError, UnauthorizedError
from shared.jwt_utils import verify_token

from .config import SearchSettings, get_settings

_bearer = HTTPBearer(auto_error=False)


def get_search_settings() -> SearchSettings:
    return get_settings()


def get_es_client(request: Request):  # type: ignore[return]
    """Return the AsyncElasticsearch client stored on app state."""
    return request.app.state.es_client


def get_redis(request: Request):  # type: ignore[return]
    """Return the Redis client stored on app state."""
    return request.app.state.redis


def get_http_client(request: Request):  # type: ignore[return]
    """Return the shared httpx.AsyncClient stored on app state."""
    return request.app.state.http_client


async def get_current_user_payload(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ],
    settings: SearchSettings = Depends(get_search_settings),
) -> dict | None:
    """
    Verify the Bearer JWT and return the decoded payload.

    Returns None if no token is provided (anonymous request).
    Raises UnauthorizedError / TokenExpiredError / TokenInvalidError for
    malformed or expired tokens.
    """
    if credentials is None:
        return None
    try:
        return verify_token(settings.JWT_PUBLIC_KEY_PATH, credentials.credentials)
    except (TokenExpiredError, TokenInvalidError):
        raise
    except Exception as exc:
        raise UnauthorizedError("Invalid token.") from exc
