"""
Shared JWT authentication dependency for all Velontri microservices.

Usage in any service router:
    from shared.auth import require_auth, get_user_id, get_user_payload

    @router.get("/something")
    async def my_endpoint(payload: dict = Depends(get_user_payload)) -> ...:
        user_id = payload["sub"]
        roles = payload.get("roles", [])
"""
from __future__ import annotations

import os
import uuid
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from shared.errors import ForbiddenError, UnauthorizedError
from shared.jwt_utils import verify_token

_bearer = HTTPBearer(auto_error=False)


def _get_public_key_path() -> str:
    return os.environ.get("JWT_PUBLIC_KEY_PATH", "/run/secrets/jwt_public_key")


def get_user_payload(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ],
) -> dict:
    """
    Extract and verify the JWT Bearer token from the Authorization header.
    Returns the decoded payload dict.
    Raises UnauthorizedError if missing or invalid.
    """
    if credentials is None:
        raise UnauthorizedError(
            "Authentication required. Include 'Authorization: Bearer <token>' header."
        )
    public_key = _get_public_key_path()
    return verify_token(public_key, credentials.credentials)


def get_optional_user_payload(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ],
) -> dict | None:
    """Like get_user_payload but returns None instead of raising for unauthenticated requests."""
    if credentials is None:
        return None
    try:
        public_key = _get_public_key_path()
        return verify_token(public_key, credentials.credentials)
    except Exception:
        return None


def get_user_id(
    payload: Annotated[dict, Depends(get_user_payload)],
) -> uuid.UUID:
    """Return the authenticated user's UUID from the JWT sub claim."""
    return uuid.UUID(payload["sub"])


def get_user_roles(
    payload: Annotated[dict, Depends(get_user_payload)],
) -> list[str]:
    """Return the authenticated user's roles list from the JWT."""
    return payload.get("roles", [])


def get_subscription_tier(
    payload: Annotated[dict, Depends(get_user_payload)],
) -> str:
    """Return the subscription tier from the JWT."""
    return payload.get("subscription_tier", "starter")


def require_roles(*required_roles: str):
    """
    Dependency factory that raises ForbiddenError if the user does not have
    at least one of the required roles.

    Usage:
        @router.delete("/admin/thing")
        async def delete(
            _: None = Depends(require_roles("enterprise_admin", "ops"))
        ):
            ...
    """
    def _check(payload: Annotated[dict, Depends(get_user_payload)]) -> None:
        user_roles: list[str] = payload.get("roles", [])
        if not any(r in user_roles for r in required_roles):
            raise ForbiddenError(
                f"Required role(s): {', '.join(required_roles)}."
            )
    return _check
