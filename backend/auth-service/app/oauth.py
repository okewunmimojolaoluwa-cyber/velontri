"""
OAuth provider token verification.

Supports:
  - Google Identity Services (id_token from GIS)
  - Apple Sign In (future)

Uses Google's tokeninfo endpoint for dev simplicity.
In production, use google-auth library for local JWT verification.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

import httpx

from shared.errors import ExternalServiceError
from shared.logging import get_logger

logger = get_logger(__name__)


@dataclass
class OAuthUserInfo:
    email: str
    full_name: str | None
    provider_user_id: str
    avatar_url: str | None = None
    email_verified: bool = True


async def verify_google_token(id_token: str, client_id: str) -> OAuthUserInfo:
    """
    Verify a Google ID token and extract user info.

    Uses Google's tokeninfo endpoint — works in dev without the google-auth package.
    For production with high traffic, switch to offline verification via google-auth.

    Raises ExternalServiceError if token is invalid.
    """
    if not id_token:
        raise ExternalServiceError("Google ID token is required.")

    # If no client_id configured, we cannot verify the audience claim
    # Return a permissive dev mode (still verifies with Google)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
            )

            if resp.status_code != 200:
                logger.warning(
                    "google_token_invalid",
                    status=resp.status_code,
                    body=resp.text[:200],
                )
                raise ExternalServiceError(
                    "Invalid Google token. Please try signing in again."
                )

            data = resp.json()

            # Validate audience if client_id is configured
            if client_id:
                aud = data.get("aud", "")
                if aud != client_id:
                    logger.warning(
                        "google_token_wrong_audience",
                        expected=client_id,
                        got=aud,
                    )
                    raise ExternalServiceError(
                        "Google token was issued for a different application."
                    )

            # Validate token hasn't expired
            if data.get("error"):
                raise ExternalServiceError(
                    f"Google token error: {data.get('error_description', data['error'])}"
                )

            email = data.get("email")
            if not email:
                raise ExternalServiceError(
                    "Google account has no email address. Please use a different account."
                )

            email_verified = data.get("email_verified", "false").lower() == "true"
            if not email_verified:
                raise ExternalServiceError(
                    "Google account email is not verified. Please verify your Google email first."
                )

            # Build full name from given_name + family_name
            given  = data.get("given_name", "")
            family = data.get("family_name", "")
            full_name = f"{given} {family}".strip() or data.get("name") or email.split("@")[0]

            logger.info("google_token_verified", email=email)

            return OAuthUserInfo(
                email=email,
                full_name=full_name,
                provider_user_id=data.get("sub", ""),
                avatar_url=data.get("picture"),
                email_verified=email_verified,
            )

    except ExternalServiceError:
        raise
    except Exception as exc:
        logger.warning("google_token_verify_exception", error=str(exc))
        raise ExternalServiceError(
            "Could not verify Google identity. Please try again."
        ) from exc


async def verify_apple_token(
    id_token: str,
    client_id: str,
    team_id: str,
    key_id: str,
    private_key_pem: str,
) -> OAuthUserInfo:
    """
    Apple Sign In token verification (stub — not yet implemented).
    """
    raise ExternalServiceError("Apple Sign In is not yet supported.")
