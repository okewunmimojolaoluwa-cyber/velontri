"""
JWT utilities for the Velontri platform.

- Algorithm: RS256 (asymmetric) — private key signs, public key verifies.
- Only the Auth Service holds the private key.
- All other services verify using the public key.
- Tokens carry: sub, roles, subscription_tier, branch_ids, iat, exp, aud.
- The audience claim is scoped to "velontri-platform" — tokens issued for
  other systems are rejected.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

import jwt
from jwt import ExpiredSignatureError, InvalidAudienceError, InvalidTokenError

from shared.errors import TokenExpiredError, TokenInvalidError
from shared.logging import get_logger

logger = get_logger(__name__)

JWT_ALGORITHM = "RS256"
JWT_AUDIENCE = "velontri-platform"
ACCESS_TOKEN_TTL_SECONDS  = 8 * 60 * 60    # 8 hours (dev-friendly; use 15 min in production)
REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 3600  # 7 days


def _load_key(path: str) -> str:
    """Load a PEM key from disk. Raises FileNotFoundError if missing."""
    key_path = Path(path)
    if not key_path.exists():
        raise FileNotFoundError(
            f"JWT key not found at '{path}'. "
            "Ensure the secret is mounted in the container."
        )
    return key_path.read_text(encoding="utf-8").strip()


def create_access_token(
    private_key_path: str,
    user_id: str,
    roles: list[str],
    subscription_tier: str,
    branch_ids: list[str] | None = None,
    ttl: int = ACCESS_TOKEN_TTL_SECONDS,
) -> str:
    """
    Issue a signed RS256 access token.

    :param private_key_path: filesystem path to the PEM private key
    :param user_id: UUID string of the authenticated user
    :param roles: list of role strings the user holds
    :param subscription_tier: current subscription tier name
    :param branch_ids: list of branch UUIDs for Branch Manager scoping
    :param ttl: token lifetime in seconds
    :returns: signed JWT string
    """
    private_key = _load_key(private_key_path)
    now = int(time.time())

    payload: dict[str, Any] = {
        "sub": user_id,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "exp": now + ttl,
        "roles": roles,
        "subscription_tier": subscription_tier,
        "branch_ids": branch_ids or [],
    }

    token: str = jwt.encode(payload, private_key, algorithm=JWT_ALGORITHM)
    logger.debug("access_token_issued", user_id=user_id, roles=roles, ttl=ttl)
    return token


def create_refresh_token(
    private_key_path: str,
    user_id: str,
    device_fingerprint: str,
    ttl: int = REFRESH_TOKEN_TTL_SECONDS,
) -> str:
    """
    Issue a signed RS256 refresh token.
    Refresh tokens carry minimal claims — only sub and device fingerprint.
    """
    private_key = _load_key(private_key_path)
    now = int(time.time())

    payload: dict[str, Any] = {
        "sub": user_id,
        "aud": JWT_AUDIENCE,
        "iat": now,
        "exp": now + ttl,
        "type": "refresh",
        "device": device_fingerprint,
    }

    token: str = jwt.encode(payload, private_key, algorithm=JWT_ALGORITHM)
    return token


def verify_token(
    public_key_path: str,
    token: str,
) -> dict[str, Any]:
    """
    Verify a JWT access or refresh token.

    :param public_key_path: filesystem path to the PEM public key
    :param token: raw JWT string from Authorization header
    :returns: decoded payload dict
    :raises TokenExpiredError: if the token has expired
    :raises TokenInvalidError: for any other JWT validation failure
    """
    public_key = _load_key(public_key_path)

    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            public_key,
            algorithms=[JWT_ALGORITHM],
            audience=JWT_AUDIENCE,
            options={"verify_exp": True, "require": ["sub", "aud", "exp", "iat"]},
        )
        return payload
    except ExpiredSignatureError as exc:
        raise TokenExpiredError("Access token has expired.") from exc
    except InvalidAudienceError as exc:
        raise TokenInvalidError("Token audience is invalid.") from exc
    except InvalidTokenError as exc:
        raise TokenInvalidError(f"Token validation failed: {exc}") from exc


def decode_token_unverified(token: str) -> dict[str, Any]:
    """
    Decode a JWT without signature verification.
    USE ONLY for extracting the user ID from an expired token to issue
    a new one after refresh token validation — never for authorisation.
    """
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": False},
            algorithms=[JWT_ALGORITHM],
        )
        return payload
    except Exception as exc:
        raise TokenInvalidError(f"Cannot decode token: {exc}") from exc
