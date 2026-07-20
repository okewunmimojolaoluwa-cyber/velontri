"""
Inventory Service — FastAPI dependency injection.

Provides:
- Database session (per-request, auto-commit/rollback via context manager)
- Redis client (shared pool)
- RabbitMQ channel (shared connection)
- JWT-authenticated user extraction with branch scope enforcement
- Service instance factory
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from shared.errors import ForbiddenError, TokenExpiredError, TokenInvalidError, UnauthorizedError
from shared.jwt_utils import verify_token
from shared.logging import get_logger

from .config import InventorySettings, get_settings

logger = get_logger(__name__)

_bearer = HTTPBearer(auto_error=False)


# ── Settings ──────────────────────────────────────────────────────────────────

def get_inventory_settings() -> InventorySettings:
    return get_settings()


# ── Infrastructure dependencies ───────────────────────────────────────────────

async def get_db_session(request: Request):  # type: ignore[return]
    session = request.app.state.session_factory()
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


# ── JWT payload ───────────────────────────────────────────────────────────────

async def get_current_user_payload(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ],
    settings: InventorySettings = Depends(get_inventory_settings),
) -> dict:
    """Validate the Bearer JWT and return the full decoded payload."""
    if credentials is None:
        raise UnauthorizedError("Authentication required. Please provide a Bearer token.")
    try:
        return verify_token(settings.JWT_PUBLIC_KEY_PATH, credentials.credentials)
    except (TokenExpiredError, TokenInvalidError):
        raise
    except Exception as exc:
        raise UnauthorizedError("Invalid authentication token.") from exc


async def get_current_user_id(
    payload: Annotated[dict, Depends(get_current_user_payload)],
) -> uuid.UUID:
    """Extract the authenticated user UUID from the JWT payload."""
    return uuid.UUID(payload["sub"])


def get_user_roles(
    payload: Annotated[dict, Depends(get_current_user_payload)],
) -> list[str]:
    """Extract roles list from JWT payload."""
    return payload.get("roles", [])


def get_branch_ids_from_token(
    payload: Annotated[dict, Depends(get_current_user_payload)],
) -> list[uuid.UUID]:
    """
    Extract the list of branch UUIDs the caller is scoped to.

    Branch Managers have a non-empty branch_ids claim.
    Admins/Enterprise roles may have an empty list (unrestricted).
    """
    raw: list[str] = payload.get("branch_ids", [])
    result: list[uuid.UUID] = []
    for b in raw:
        try:
            result.append(uuid.UUID(str(b)))
        except ValueError:
            logger.warning("invalid_branch_id_in_token", raw_value=b)
    return result


# ── Branch scope enforcement ──────────────────────────────────────────────────

def enforce_branch_access(
    branch_id: uuid.UUID,
    roles: list[str],
    allowed_branch_ids: list[uuid.UUID],
) -> None:
    """
    Enforce that the calling user can access the given branch.

    Rules:
    - enterprise_admin and moderator roles have unrestricted access.
    - branch_manager may only access branches in their token's branch_ids claim.
    - Raises ForbiddenError if access is denied.
    """
    unrestricted_roles = {"enterprise_admin", "moderator", "admin"}
    if any(r in unrestricted_roles for r in roles):
        return

    # If the token has branch_ids, the user is branch-scoped
    if allowed_branch_ids and branch_id not in allowed_branch_ids:
        raise ForbiddenError(
            f"Access denied to branch {branch_id}. "
            "You are only authorised to manage your assigned branches."
        )
