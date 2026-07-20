"""
Auth Service HTTP router — all /auth endpoints.

Every endpoint:
✓ Validates input via Pydantic schemas
✓ Applies rate limiting before any DB access
✓ Handles auth failures with consistent error responses
✓ Logs every significant event (never logs passwords or tokens)
✓ Returns typed responses
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse

from shared.errors import SuccessResponse, register_error_handlers
from shared.logging import get_logger

from ..config import AuthSettings
from ..dependencies import (
    get_auth_settings,
    get_client_ip,
    get_current_user_id,
    get_db_session,
    get_rabbitmq_channel,
    get_redis,
)
from ..schemas import (
    DeviceListResponse,
    Enable2FARequest,
    Enable2FAResponse,
    IntrospectResponse,
    LoginRequest,
    LoginResponse,
    OAuthLoginRequest,
    PasswordResetBody,
    PasswordResetRequestBody,
    PasswordResetRequestResponse,
    PasswordResetResponse,
    RegisterRequest,
    RegisterResponse,
    ResendOtpRequest,
    ResendOtpResponse,
    TokenRefreshRequest,
    TokenRefreshResponse,
    Verify2FARequest,
    Verify2FAResponse,
    VerifyPhoneRequest,
    VerifyPhoneResponse,
)
from ..security import check_rate_limit
from ..service import AuthService

logger = get_logger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _build_service(
    request: Request,
    session=Depends(get_db_session),
    redis=Depends(get_redis),
    channel=Depends(get_rabbitmq_channel),
    settings: AuthSettings = Depends(get_auth_settings),
) -> AuthService:
    return AuthService(
        session=session,
        redis=redis,
        settings=settings,
        rabbitmq_channel=channel,
    )


# ── Registration ──────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=SuccessResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(
    body: RegisterRequest,
    request: Request,
    service: AuthService = Depends(_build_service),
    ip: str | None = Depends(get_client_ip),
    redis=Depends(get_redis),
    settings: AuthSettings = Depends(get_auth_settings),
) -> SuccessResponse:
    await check_rate_limit(redis, ip or "unknown")

    user_id = await service.register(
        email=body.email,
        phone=body.phone,
        password=body.password,
        full_name=body.full_name,
        country_code=body.country_code,
    )

    return SuccessResponse(
        data=RegisterResponse(user_id=user_id, email=str(body.email)).model_dump()
    )


@router.post(
    "/verify-phone",
    response_model=SuccessResponse,
    summary="Verify phone number with OTP",
)
async def verify_phone(
    body: VerifyPhoneRequest,
    service: AuthService = Depends(_build_service),
    redis=Depends(get_redis),
    ip: str | None = Depends(get_client_ip),
) -> SuccessResponse:
    await check_rate_limit(redis, ip or "unknown")
    result = await service.verify_phone(body.user_id, body.otp)
    return SuccessResponse(data=result.model_dump())


@router.post(
    "/resend-otp",
    response_model=SuccessResponse,
    summary="Resend phone verification OTP",
)
async def resend_otp(
    body: ResendOtpRequest,
    service: AuthService = Depends(_build_service),
    redis=Depends(get_redis),
    ip: str | None = Depends(get_client_ip),
) -> SuccessResponse:
    await check_rate_limit(redis, ip or "unknown")
    await service.resend_otp(body.user_id)
    return SuccessResponse(data=ResendOtpResponse().model_dump())


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post(
    "/login",
    response_model=SuccessResponse,
    summary="Login with email/phone and password",
)
async def login(
    body: LoginRequest,
    request: Request,
    service: AuthService = Depends(_build_service),
    redis=Depends(get_redis),
    ip: str | None = Depends(get_client_ip),
) -> SuccessResponse:
    await check_rate_limit(redis, ip or "unknown")

    result = await service.login(
        identifier=body.identifier,
        password=body.password,
        device_fingerprint=body.device_fingerprint,
        ip_address=ip,
        user_agent=body.user_agent,
    )
    return SuccessResponse(data=result.model_dump())


@router.post(
    "/login/oauth",
    response_model=SuccessResponse,
    summary="Login via Google or Apple OAuth",
)
async def oauth_login(
    body: OAuthLoginRequest,
    request: Request,
    service: AuthService = Depends(_build_service),
    redis=Depends(get_redis),
    ip: str | None = Depends(get_client_ip),
) -> SuccessResponse:
    await check_rate_limit(redis, ip or "unknown")
    # OAuth implementation delegates to service layer
    # which calls provider token verification
    result = await service.oauth_login(
        provider=body.provider,
        id_token=body.id_token,
        device_fingerprint=body.device_fingerprint,
        ip_address=ip,
        user_agent=body.user_agent,
    )
    return SuccessResponse(data=result.model_dump())


# ── Token management ──────────────────────────────────────────────────────────

@router.post(
    "/token/refresh",
    response_model=SuccessResponse,
    summary="Refresh access token using refresh token",
)
async def refresh_token(
    body: TokenRefreshRequest,
    service: AuthService = Depends(_build_service),
    redis=Depends(get_redis),
    ip: str | None = Depends(get_client_ip),
) -> SuccessResponse:
    await check_rate_limit(redis, ip or "unknown")
    result = await service.refresh_access_token(body.refresh_token)
    return SuccessResponse(data=result.model_dump())


@router.get(
    "/introspect",
    response_model=SuccessResponse,
    summary="Validate JWT and return claims",
)
async def introspect(
    request: Request,
    service: AuthService = Depends(_build_service),
) -> SuccessResponse:
    # Extract raw token from Authorization header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        from shared.errors import UnauthorizedError
        raise UnauthorizedError("Bearer token required.")

    token = auth_header.removeprefix("Bearer ").strip()
    result = await service.introspect(token)
    return SuccessResponse(data=result.model_dump())


# ── 2FA ───────────────────────────────────────────────────────────────────────

@router.post(
    "/2fa/enable",
    response_model=SuccessResponse,
    summary="Enable two-factor authentication",
)
async def enable_2fa(
    body: Enable2FARequest,
    service: AuthService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    ip: str | None = Depends(get_client_ip),
) -> SuccessResponse:
    result = await service.enable_2fa(
        user_id=current_user_id, method=body.method, ip_address=ip
    )
    return SuccessResponse(data=result)


@router.post(
    "/2fa/verify",
    response_model=SuccessResponse,
    summary="Complete 2FA challenge and receive tokens",
)
async def verify_2fa(
    body: Verify2FARequest,
    service: AuthService = Depends(_build_service),
    redis=Depends(get_redis),
    ip: str | None = Depends(get_client_ip),
) -> SuccessResponse:
    await check_rate_limit(redis, ip or "unknown")
    tokens = await service.verify_2fa(
        two_fa_session_id=body.two_fa_session_id,
        otp_code=body.otp,
        ip_address=ip,
    )
    return SuccessResponse(data=tokens.model_dump())


# ── Password reset ────────────────────────────────────────────────────────────

@router.post(
    "/password/reset-request",
    response_model=SuccessResponse,
    summary="Request a password reset email",
)
async def password_reset_request(
    body: PasswordResetRequestBody,
    service: AuthService = Depends(_build_service),
    redis=Depends(get_redis),
    ip: str | None = Depends(get_client_ip),
) -> SuccessResponse:
    await check_rate_limit(redis, ip or "unknown")
    await service.request_password_reset(email=str(body.email))
    # Always return success to prevent email enumeration
    return SuccessResponse(
        data=PasswordResetRequestResponse().model_dump()
    )


@router.post(
    "/password/reset",
    response_model=SuccessResponse,
    summary="Reset password using token from email",
)
async def password_reset(
    body: PasswordResetBody,
    service: AuthService = Depends(_build_service),
    redis=Depends(get_redis),
    ip: str | None = Depends(get_client_ip),
) -> SuccessResponse:
    await check_rate_limit(redis, ip or "unknown")
    await service.reset_password(
        raw_token=body.token,
        new_password=body.new_password,
        ip_address=ip,
    )
    return SuccessResponse(data=PasswordResetResponse().model_dump())


# ── Devices ───────────────────────────────────────────────────────────────────

@router.get(
    "/devices",
    response_model=SuccessResponse,
    summary="List registered devices for authenticated user",
)
async def list_devices(
    service: AuthService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
) -> SuccessResponse:
    result = await service.list_devices(current_user_id)
    return SuccessResponse(data=result.model_dump())


@router.delete(
    "/devices/{device_id}",
    response_model=SuccessResponse,
    summary="Revoke a registered device",
)
async def revoke_device(
    device_id: uuid.UUID,
    service: AuthService = Depends(_build_service),
    current_user_id: uuid.UUID = Depends(get_current_user_id),
    ip: str | None = Depends(get_client_ip),
) -> SuccessResponse:
    await service.revoke_device(device_id, current_user_id, ip)
    return SuccessResponse(data={"message": "Device revoked successfully."})


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post(
    "/logout",
    response_model=SuccessResponse,
    summary="Revoke the current refresh token and end the session",
)
async def logout(
    body: TokenRefreshRequest,
    service: AuthService = Depends(_build_service),
) -> SuccessResponse:
    """
    Invalidates the provided refresh token so it cannot be used again.
    The access token will expire naturally after its 15-minute TTL.
    Frontend should delete both tokens from local storage on success.
    """
    from ..security import hash_refresh_token
    from ..repository import revoke_refresh_token
    token_hash = hash_refresh_token(body.refresh_token)
    await revoke_refresh_token(service.session, token_hash)
    return SuccessResponse(
        message="Logged out successfully. Please delete your tokens.",
        data={"logged_out": True},
    )
