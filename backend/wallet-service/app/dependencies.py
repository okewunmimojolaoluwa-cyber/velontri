"""Wallet Service dependency injection."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from shared.errors import TokenExpiredError, TokenInvalidError, UnauthorizedError
from shared.jwt_utils import verify_token

from .config import WalletSettings, get_settings

_bearer = HTTPBearer(auto_error=False)


def get_wallet_settings() -> WalletSettings:
    return get_settings()


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


async def get_current_user_payload(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(_bearer)
    ],
    settings: WalletSettings = Depends(get_wallet_settings),
) -> dict:
    if credentials is None:
        raise UnauthorizedError("Authentication required.")
    try:
        return verify_token(settings.JWT_PUBLIC_KEY_PATH, credentials.credentials)
    except (TokenExpiredError, TokenInvalidError):
        raise
    except Exception as exc:
        raise UnauthorizedError("Invalid token.") from exc


async def get_current_user_id(
    payload: Annotated[dict, Depends(get_current_user_payload)],
) -> uuid.UUID:
    return uuid.UUID(payload["sub"])


def get_subscription_tier(
    payload: Annotated[dict, Depends(get_current_user_payload)],
) -> str:
    return payload.get("subscription_tier", "starter")
