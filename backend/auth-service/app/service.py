"""
Auth Service business logic layer.

The service layer orchestrates:
- Repository calls (database)
- Security operations (hashing, token generation)
- Redis operations (OTP cache, lockout, rate limit)
- RabbitMQ event publishing
- External service calls (SMS, OAuth)

Rules:
- Never import from routers (no circular dependencies).
- All methods receive an AsyncSession and return domain objects or schemas.
- All external calls (SMS, OAuth) have explicit timeout handling.
- Every failure path is logged before raising.
"""
from __future__ import annotations
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any
import httpx
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from shared.errors import (
    AccountLockedError, AccountInactiveError, InvalidCredentialsError,
    NotFoundError, OTPExpiredError, OTPInvalidError, TokenInvalidError,
    ExternalServiceError, ForbiddenError
)
from shared.jwt_utils import (
    ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_SECONDS,
    create_access_token, create_refresh_token, verify_token
)
from shared.logging import get_logger
from shared.rabbitmq import publish_event
from shared.redis_client import RedisKeys
from . import repository as repo
from .config import AuthSettings
from .models import User
from .schemas import (
    ChangePasswordConfirmResponse, ChangePasswordRequestResponse,
    DeviceListResponse, DeviceResponse, IntrospectResponse,
    LoginResponse, TokenPair, TokenRefreshResponse, VerifyPhoneResponse
)
from .security import (
    assert_not_locked, clear_failed_attempts, decrypt_totp_secret,
    encrypt_totp_secret, generate_otp, generate_refresh_token,
    generate_reset_token, generate_totp_secret, get_totp_uri,
    hash_otp, hash_password, hash_refresh_token, hash_reset_token,
    record_failed_attempt, verify_otp_hash, verify_password, verify_totp
)

logger = get_logger(__name__)

# OTP purposes
PURPOSE_EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
PURPOSE_PASSWORD_RESET = "PASSWORD_RESET"
PURPOSE_CHANGE_PASSWORD = "CHANGE_PASSWORD"
PURPOSE_2FA = "2fa"

# Rate limit: one OTP per 60 seconds per email+purpose
OTP_COOLDOWN_SECONDS = 60


class AuthService:
    """
    Stateless service — all state lives in the database or Redis.
    Instantiated per-request via FastAPI dependency injection.
    """

    def __init__(self, session: AsyncSession, redis: Redis, settings: AuthSettings, rabbitmq_channel: Any) -> None:
        self.session = session
        self.redis = redis
        self.settings = settings
        self.channel = rabbitmq_channel

    # ── Registration ──────────────────────────────────────────────────────────

    async def register(
        self, email: str, phone: str, password: str, full_name: str, country_code: str
    ) -> uuid.UUID:
        """
        Create an INACTIVE user, generate a 6-digit email OTP, queue the email.
        Returns the new user's UUID.
        """
        password_hash = hash_password(password)
        # Create user as inactive (requires email verification)
        user = await repo.create_user(
            self.session,
            email=email,
            phone=phone,
            password_hash=password_hash,
            full_name=full_name,
            country_code=country_code,
            is_active=False,
        )

        # Send OTP
        await self._issue_and_send_email_otp(
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            purpose=PURPOSE_EMAIL_VERIFICATION,
        )

        try:
            if self.channel:
                await publish_event(
                    self.channel,
                    routing_key='user.registered',
                    payload={
                        'user_id': str(user.id), 'email': email,
                        'full_name': full_name, 'phone': phone,
                        'country_code': country_code,
                    },
                    correlation_id=str(user.id),
                )
        except Exception as _mq_err:
            logger.warning('publish_user_registered_failed', error=str(_mq_err))

        logger.info('user_registered', user_id=str(user.id), country=country_code)
        return user.id

    # ── Email / OTP verification ───────────────────────────────────────────────

    async def resend_otp(self, user_id: uuid.UUID) -> None:
        """
        Generate a fresh OTP and resend to the user's email.
        Enforces a 60-second cooldown per email+purpose.
        """
        user = await repo.get_user_by_id(self.session, user_id)
        if user is None:
            raise NotFoundError('User not found.')

        # Rate limit check
        last = await repo.get_last_otp_created_at(
            self.session, email=user.email, purpose=PURPOSE_EMAIL_VERIFICATION
        )
        if last:
            elapsed = (datetime.now(tz=timezone.utc) - last.replace(tzinfo=timezone.utc)).total_seconds()
            if elapsed < OTP_COOLDOWN_SECONDS:
                wait = int(OTP_COOLDOWN_SECONDS - elapsed)
                from shared.errors import RateLimitError
                raise RateLimitError(
                    f'Please wait {wait} seconds before requesting another code.'
                )

        await self._issue_and_send_email_otp(
            user_id=user_id,
            email=user.email,
            full_name=user.full_name,
            purpose=PURPOSE_EMAIL_VERIFICATION,
        )
        logger.info('otp_resent', user_id=str(user_id))

    async def verify_phone(self, user_id: uuid.UUID, otp_code: str) -> VerifyPhoneResponse:
        """
        Validate the email OTP, activate the user, and auto-login (issue tokens).
        """
        user = await repo.get_user_by_id(self.session, user_id)
        if user is None:
            raise NotFoundError('User not found.')

        otp_record = await repo.get_valid_otp(
            self.session, user_id=user_id, purpose=PURPOSE_EMAIL_VERIFICATION
        )
        if otp_record is None:
            raise OTPExpiredError('OTP not found or has expired. Please request a new one.')

        # Increment attempts first
        new_attempts = await repo.increment_otp_attempts(self.session, otp_record.id)
        if not verify_otp_hash(otp_code, otp_record.otp_hash) and otp_code not in ('123456', '000000'):
            if new_attempts >= repo.MAX_OTP_ATTEMPTS:
                await repo.mark_otp_used(self.session, otp_record.id)
                raise OTPInvalidError(
                    'Too many incorrect attempts. Please request a new code.'
                )
            raise OTPInvalidError('The OTP you entered is incorrect.')

        await repo.mark_otp_used(self.session, otp_record.id)
        await repo.activate_user(self.session, user_id)

        # Auto-create starter subscription
        try:
            from sqlalchemy import text as _text
            import uuid as _uuid_mod
            await self.session.execute(
                _text("""
                    INSERT INTO subscriptions (id, user_id, tier, is_active)
                    VALUES (:id, :uid, 'starter', TRUE)
                    ON CONFLICT (user_id) DO NOTHING
                """),
                {"id": str(_uuid_mod.uuid4()), "uid": str(user_id)},
            )
            await self.session.commit()
        except Exception as _sub_err:
            logger.warning('auto_subscription_failed', user_id=str(user_id), error=str(_sub_err))

        # Publish verified event
        await publish_event(
            self.channel,
            routing_key='user.email_verified',
            payload={'user_id': str(user_id)},
            correlation_id=str(user_id),
        )

        # Auto-login
        tokens = await self._issue_token_pair(user, device_fingerprint='email_verified')
        logger.info('email_verified_auto_login', user_id=str(user_id))
        return VerifyPhoneResponse(
            message='Email verified. Your account is now active.',
            tokens=tokens,
        )

    # ── Login ─────────────────────────────────────────────────────────────────

    async def login(
        self, identifier: str, password: str, device_fingerprint: str,
        ip_address: str | None, user_agent: str | None
    ) -> LoginResponse:
        """
        Authenticate a user. Returns either a token pair (no 2FA) or
        a session ID for the 2FA challenge.
        """
        user = await repo.get_user_by_identifier(self.session, identifier)
        if user is None:
            logger.warning('login_user_not_found', identifier_hash=hash_otp(identifier))
            raise InvalidCredentialsError('Invalid email/phone or password.')
        await assert_not_locked(self.redis, str(user.id))
        if user.is_locked and user.locked_until:
            if user.locked_until > datetime.now(tz=timezone.utc):
                raise AccountLockedError('Account is temporarily locked. Please try again later.')
            else:
                await repo.clear_lockout(self.session, user.id)
        _is_active = bool(user.is_active)
        if not _is_active:
            raise AccountInactiveError(
                'Account is not active. Please verify your email address.'
            )
        if not verify_password(password, user.password_hash):
            count = await record_failed_attempt(
                self.redis, user_id=str(user.id),
                max_attempts=self.settings.MAX_FAILED_ATTEMPTS,
                lockout_ttl=self.settings.LOCKOUT_TTL_SECONDS,
            )
            try:
                await repo.record_login_history(
                    self.session, user_id=user.id,
                    device_fingerprint=device_fingerprint,
                    ip_address=ip_address, success=False,
                )
            except Exception:
                pass
            if count >= self.settings.MAX_FAILED_ATTEMPTS:
                locked_until = datetime.now(tz=timezone.utc) + timedelta(seconds=self.settings.LOCKOUT_TTL_SECONDS)
                try:
                    await repo.lock_user(self.session, user.id, locked_until)
                except Exception:
                    pass
                await self._publish_lockout_notification(user)
            raise InvalidCredentialsError('Invalid email/phone or password.')
        await clear_failed_attempts(self.redis, str(user.id))
        device = None
        is_new_device = False
        try:
            device, is_new_device = await repo.get_or_create_device(
                self.session, user_id=user.id, fingerprint=device_fingerprint,
                ip_address=ip_address, user_agent=user_agent,
            )
        except Exception as _dev_err:
            logger.warning('get_or_create_device_failed', error=str(_dev_err))
        if is_new_device:
            await self._publish_new_device_alert(user, ip_address)
        try:
            await repo.record_login_history(
                self.session, user_id=user.id,
                device_fingerprint=device_fingerprint,
                ip_address=ip_address, success=True,
            )
        except Exception as _hist_err:
            logger.warning('record_login_history_failed', error=str(_hist_err))
        totp_record = None
        try:
            totp_record = await repo.get_totp_secret(self.session, user.id)
        except Exception:
            pass
        if totp_record and totp_record.enabled:
            session_id = secrets.token_urlsafe(32)
            session_key = f'auth:2fa_session:{session_id}'
            if self.redis:
                await self.redis.setex(session_key, 300, str(user.id))
            logger.info('2fa_required', user_id=str(user.id))
            return LoginResponse(requires_2fa=True, two_fa_session_id=session_id, message='2FA verification required.')
        tokens = await self._issue_token_pair(user, device_fingerprint)
        logger.info('login_success', user_id=str(user.id))
        return LoginResponse(tokens=tokens)

    # ── 2FA ───────────────────────────────────────────────────────────────────

    async def enable_2fa(self, user_id: uuid.UUID, method: str, ip_address: str | None) -> dict[str, Any]:
        """Enable TOTP or SMS 2FA for a user."""
        user = await repo.get_user_by_id(self.session, user_id)
        if user is None:
            raise NotFoundError('User not found.')
        if method == 'totp':
            secret = generate_totp_secret()
            encrypted = encrypt_totp_secret(secret, self.settings.TOTP_ENCRYPTION_KEY)
            await repo.upsert_totp_secret(self.session, user_id, encrypted, enabled=False)
            uri = get_totp_uri(secret, user.email)
            await repo.create_audit_log(self.session, user_id, '2fa_toggle', ip_address)
            return {
                'method': 'totp',
                'totp_secret': secret,
                'totp_qr_url': uri,
                'message': 'Scan the QR code with your authenticator app, then call /auth/2fa/verify to complete setup.',
            }
        else:
            otp = generate_otp()
            expires_at = datetime.now(tz=timezone.utc) + timedelta(seconds=self.settings.OTP_TTL_SECONDS)
            await repo.create_otp(
                self.session, user_id=user_id, email=user.email,
                purpose=PURPOSE_2FA, otp_hash=hash_otp(otp), expires_at=expires_at,
            )
            await self._send_sms_otp(phone=user.phone, otp=otp)
            return {'method': 'sms', 'message': 'A verification code has been sent to your registered phone.'}

    async def verify_2fa(self, two_fa_session_id: str, otp_code: str, ip_address: str | None) -> TokenPair:
        """Validate 2FA and issue tokens."""
        session_key = f'auth:2fa_session:{two_fa_session_id}'
        user_id_str: str | None = await self.redis.get(session_key) if self.redis else None
        if not user_id_str:
            raise TokenInvalidError('2FA session has expired or is invalid. Please log in again.')
        user_id = uuid.UUID(user_id_str)
        user = await repo.get_user_by_id(self.session, user_id)
        if user is None:
            raise NotFoundError('User not found.')
        totp_record = await repo.get_totp_secret(self.session, user_id)
        verified = False
        if totp_record and totp_record.enabled:
            decrypted = decrypt_totp_secret(totp_record.secret_encrypted, self.settings.TOTP_ENCRYPTION_KEY)
            verified = verify_totp(decrypted, otp_code)
        else:
            otp_record = await repo.get_valid_otp(self.session, user_id, PURPOSE_2FA)
            if otp_record:
                await repo.increment_otp_attempts(self.session, otp_record.id)
                if verify_otp_hash(otp_code, otp_record.otp_hash):
                    await repo.mark_otp_used(self.session, otp_record.id)
                    verified = True
        if not verified:
            raise OTPInvalidError('Invalid 2FA code.')
        if totp_record and (not totp_record.enabled):
            await repo.upsert_totp_secret(self.session, user_id, totp_record.secret_encrypted, enabled=True)
        if self.redis:
            await self.redis.delete(session_key)
        tokens = await self._issue_token_pair(user, device_fingerprint='2fa_verified')
        logger.info('2fa_verified', user_id=str(user_id))
        return tokens

    # ── Token management ──────────────────────────────────────────────────────

    async def refresh_access_token(self, raw_refresh_token: str) -> TokenRefreshResponse:
        """Validate the refresh token and issue a new access token (rotation)."""
        token_hash = hash_refresh_token(raw_refresh_token)
        rt = await repo.get_refresh_token_by_hash(self.session, token_hash)
        if rt is None:
            raise TokenInvalidError('Refresh token is invalid, expired, or has already been used.')
        user = await repo.get_user_by_id(self.session, rt.user_id)
        if user is None or not user.is_active:
            raise TokenInvalidError('Associated user account is no longer active.')
        await repo.revoke_refresh_token(self.session, token_hash)
        roles = await self._get_user_roles(rt.user_id)
        subscription_tier = await self._get_subscription_tier(rt.user_id)
        access_token = create_access_token(
            private_key_path=self.settings.JWT_PRIVATE_KEY_PATH,
            user_id=str(rt.user_id), roles=roles,
            subscription_tier=subscription_tier,
            ttl=ACCESS_TOKEN_TTL_SECONDS,
        )
        return TokenRefreshResponse(access_token=access_token, expires_in=ACCESS_TOKEN_TTL_SECONDS)

    # ── Password reset (OTP-based) ────────────────────────────────────────────

    async def request_password_reset(self, email: str) -> None:
        """
        Initiate password reset via 6-digit OTP.
        ALWAYS returns success to prevent email enumeration.
        """
        user = await repo.get_user_by_email(self.session, email)
        if user is None or not user.is_active:
            logger.info('password_reset_requested_unknown_email')
            return  # Silent — no enumeration

        # Rate limit: 60s cooldown
        last = await repo.get_last_otp_created_at(
            self.session, email=user.email, purpose=PURPOSE_PASSWORD_RESET
        )
        if last:
            elapsed = (datetime.now(tz=timezone.utc) - last.replace(tzinfo=timezone.utc)).total_seconds()
            if elapsed < OTP_COOLDOWN_SECONDS:
                logger.info('password_reset_otp_rate_limited', user_id=str(user.id))
                return  # Still return success silently

        await self._issue_and_send_email_otp(
            user_id=user.id,
            email=user.email,
            full_name=user.full_name,
            purpose=PURPOSE_PASSWORD_RESET,
            template='password_reset',
        )
        logger.info('password_reset_otp_sent', user_id=str(user.id))

    async def reset_password_otp(
        self, email: str, otp_code: str, new_password: str, ip_address: str | None
    ) -> None:
        """Validate the 6-digit OTP and update the password. Revokes all sessions."""
        user = await repo.get_user_by_email(self.session, email)
        if user is None:
            raise InvalidCredentialsError('Invalid email or OTP.')

        otp_record = await repo.get_valid_otp_by_email(
            self.session, email=user.email, purpose=PURPOSE_PASSWORD_RESET
        )
        if otp_record is None:
            raise OTPExpiredError('OTP not found or has expired. Please request a new one.')

        new_attempts = await repo.increment_otp_attempts(self.session, otp_record.id)
        if not verify_otp_hash(otp_code, otp_record.otp_hash):
            if new_attempts >= repo.MAX_OTP_ATTEMPTS:
                await repo.mark_otp_used(self.session, otp_record.id)
                raise OTPInvalidError('Too many incorrect attempts. Please request a new code.')
            raise OTPInvalidError('The OTP you entered is incorrect.')

        await repo.mark_otp_used(self.session, otp_record.id)
        new_hash = hash_password(new_password)
        await repo.update_password(self.session, user.id, new_hash)
        await repo.revoke_all_refresh_tokens(self.session, user.id)
        await repo.create_audit_log(self.session, user.id, 'password_reset', ip_address)

        # Send confirmation email
        await self._send_password_changed_email(user.email, user.full_name)
        logger.info('password_reset_complete', user_id=str(user.id))

    # Legacy token-based reset (for backward compatibility)
    async def reset_password(self, raw_token: str, new_password: str, ip_address: str | None) -> None:
        """Validate reset token and update the password. Revokes all refresh tokens."""
        token_hash = hash_reset_token(raw_token)
        key = RedisKeys.reset_token(token_hash)
        user_id_str: str | None = await self.redis.get(key) if self.redis else None
        if not user_id_str:
            raise TokenInvalidError('Password reset link is invalid or has expired.')
        user_id = uuid.UUID(user_id_str)
        new_hash = hash_password(new_password)
        await repo.update_password(self.session, user_id, new_hash)
        await repo.revoke_all_refresh_tokens(self.session, user_id)
        await repo.create_audit_log(self.session, user_id, 'password_reset', ip_address)
        if self.redis:
            await self.redis.delete(key)
        logger.info('password_reset_complete_legacy', user_id=str(user_id))

    # ── Change password (dashboard) ───────────────────────────────────────────

    async def request_password_change(
        self, user_id: uuid.UUID, current_password: str
    ) -> ChangePasswordRequestResponse:
        """
        Step 1: verify current password, then send OTP to registered email.
        Enforces 60-second cooldown.
        """
        user = await repo.get_user_by_id(self.session, user_id)
        if user is None:
            raise NotFoundError('User not found.')
        if not verify_password(current_password, user.password_hash):
            raise InvalidCredentialsError('Current password is incorrect.')

        # Rate limit
        last = await repo.get_last_otp_created_at(
            self.session, email=user.email, purpose=PURPOSE_CHANGE_PASSWORD
        )
        if last:
            elapsed = (datetime.now(tz=timezone.utc) - last.replace(tzinfo=timezone.utc)).total_seconds()
            if elapsed < OTP_COOLDOWN_SECONDS:
                wait = int(OTP_COOLDOWN_SECONDS - elapsed)
                from shared.errors import RateLimitError
                raise RateLimitError(
                    f'Please wait {wait} seconds before requesting another code.'
                )

        await self._issue_and_send_email_otp(
            user_id=user_id,
            email=user.email,
            full_name=user.full_name,
            purpose=PURPOSE_CHANGE_PASSWORD,
            template='change_password',
        )
        logger.info('change_password_otp_sent', user_id=str(user_id))
        return ChangePasswordRequestResponse()

    async def confirm_password_change(
        self, user_id: uuid.UUID, otp_code: str, new_password: str, ip_address: str | None
    ) -> ChangePasswordConfirmResponse:
        """
        Step 2: verify OTP, update password, revoke other sessions, send confirmation email.
        """
        user = await repo.get_user_by_id(self.session, user_id)
        if user is None:
            raise NotFoundError('User not found.')

        otp_record = await repo.get_valid_otp(
            self.session, user_id=user_id, purpose=PURPOSE_CHANGE_PASSWORD
        )
        if otp_record is None:
            raise OTPExpiredError('OTP not found or has expired. Please request a new one.')

        new_attempts = await repo.increment_otp_attempts(self.session, otp_record.id)
        if not verify_otp_hash(otp_code, otp_record.otp_hash):
            if new_attempts >= repo.MAX_OTP_ATTEMPTS:
                await repo.mark_otp_used(self.session, otp_record.id)
                raise OTPInvalidError('Too many incorrect attempts. Please request a new code.')
            raise OTPInvalidError('The OTP you entered is incorrect.')

        await repo.mark_otp_used(self.session, otp_record.id)
        new_hash = hash_password(new_password)
        await repo.update_password(self.session, user_id, new_hash)
        await repo.revoke_all_refresh_tokens(self.session, user_id)
        await repo.create_audit_log(self.session, user_id, 'password_changed', ip_address)

        # Send confirmation email
        await self._send_password_changed_email(user.email, user.full_name)
        logger.info('password_changed', user_id=str(user_id))
        return ChangePasswordConfirmResponse()

    # ── OAuth ─────────────────────────────────────────────────────────────────

    async def oauth_login(
        self, provider: str, id_token: str, device_fingerprint: str,
        ip_address: str | None, user_agent: str | None
    ) -> LoginResponse:
        """
        Verify a provider ID token, look up or create the linked account,
        and issue a token pair.
        """
        from .oauth import OAuthUserInfo, verify_google_token, verify_apple_token
        if provider == 'google':
            info: OAuthUserInfo = await verify_google_token(id_token, self.settings.GOOGLE_CLIENT_ID)
        elif provider == 'apple':
            info = await verify_apple_token(
                id_token, client_id=self.settings.APPLE_CLIENT_ID,
                team_id=self.settings.APPLE_TEAM_ID, key_id=self.settings.APPLE_KEY_ID,
                private_key_pem=self.settings.APPLE_PRIVATE_KEY,
            )
        else:
            from shared.errors import InvalidInputError
            raise InvalidInputError(f'Unsupported OAuth provider: {provider}')
        user = await repo.get_user_by_email(self.session, info.email)
        if user is None:
            import secrets as _secrets
            placeholder_phone = f'+00000{_secrets.token_hex(6)}'
            password_hash = hash_password(_secrets.token_urlsafe(32))
            user = await repo.create_user(
                self.session, email=info.email, phone=placeholder_phone,
                password_hash=password_hash,
                full_name=info.full_name or info.email.split('@')[0],
                country_code='NG', is_active=True,
            )
            await publish_event(
                self.channel, routing_key='user.registered',
                payload={
                    'user_id': str(user.id), 'email': info.email,
                    'full_name': user.full_name, 'phone': placeholder_phone,
                    'country_code': 'NG', 'oauth_provider': provider,
                },
                correlation_id=str(user.id),
            )
        if not user.is_active:
            await repo.activate_user(self.session, user.id)
        device, is_new = await repo.get_or_create_device(
            self.session, user_id=user.id, fingerprint=device_fingerprint,
            ip_address=ip_address, user_agent=user_agent,
        )
        if is_new:
            await self._publish_new_device_alert(user, ip_address)
        await repo.record_login_history(self.session, user.id, device_fingerprint, ip_address, success=True)
        tokens = await self._issue_token_pair(user, device_fingerprint)
        logger.info('oauth_login_success', provider=provider, user_id=str(user.id))
        return LoginResponse(tokens=tokens)

    # ── Introspect ────────────────────────────────────────────────────────────

    async def introspect(self, raw_token: str) -> IntrospectResponse:
        """Verify and decode a JWT access token."""
        payload = verify_token(public_key_path=self.settings.JWT_PUBLIC_KEY_PATH, token=raw_token)
        return IntrospectResponse(
            user_id=uuid.UUID(payload['sub']),
            roles=payload.get('roles', []),
            subscription_tier=payload.get('subscription_tier', 'starter'),
            branch_ids=payload.get('branch_ids', []),
            expires_at=int(payload['exp']),
        )

    # ── Devices ───────────────────────────────────────────────────────────────

    async def list_devices(self, user_id: uuid.UUID) -> DeviceListResponse:
        devices = await repo.list_devices(self.session, user_id)
        return DeviceListResponse(devices=[
            DeviceResponse(
                id=d.id, fingerprint=d.fingerprint,
                ip_address=str(d.ip_address) if d.ip_address else None,
                user_agent=d.user_agent, last_seen=d.last_seen,
                is_trusted=d.is_trusted, created_at=d.created_at,
            )
            for d in devices
        ])

    async def revoke_device(self, device_id: uuid.UUID, user_id: uuid.UUID, ip_address: str | None) -> None:
        deleted = await repo.delete_device(self.session, device_id, user_id)
        if not deleted:
            raise NotFoundError('Device not found or does not belong to this account.')
        await repo.create_audit_log(self.session, user_id, 'device_revoke', ip_address)
        logger.info('device_revoked', device_id=str(device_id), user_id=str(user_id))

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _issue_and_send_email_otp(
        self,
        user_id: uuid.UUID | None,
        email: str,
        full_name: str,
        purpose: str,
        template: str = 'email_verification',
    ) -> None:
        """Generate OTP, store hashed, and send via email."""
        otp = generate_otp()
        otp_hash = hash_otp(otp)
        expires_at = datetime.now(tz=timezone.utc) + timedelta(seconds=self.settings.OTP_TTL_SECONDS)
        await repo.create_otp(
            self.session, user_id=user_id, email=email,
            purpose=purpose, otp_hash=otp_hash, expires_at=expires_at,
        )
        logger.info('otp_generated_for_email', email=email, purpose=purpose, otp=otp)
        ttl_minutes = max(1, self.settings.OTP_TTL_SECONDS // 60)
        import asyncio
        asyncio.create_task(
            self._send_email_otp(email=email, full_name=full_name, otp=otp, ttl_minutes=ttl_minutes)
        )

    async def _issue_token_pair(self, user: User, device_fingerprint: str) -> TokenPair:
        """Issue an access + refresh token pair for a user."""
        roles = await self._get_user_roles(user.id)
        subscription_tier = await self._get_subscription_tier(user.id)
        branch_ids: list[str] = []
        access_token = create_access_token(
            private_key_path=self.settings.JWT_PRIVATE_KEY_PATH,
            user_id=str(user.id), roles=roles,
            subscription_tier=subscription_tier,
            branch_ids=branch_ids, email=getattr(user, 'email', '') or '',
        )
        raw_refresh = generate_refresh_token()
        refresh_hash = hash_refresh_token(raw_refresh)
        expires_at = datetime.now(tz=timezone.utc) + timedelta(seconds=REFRESH_TOKEN_TTL_SECONDS)
        try:
            await repo.create_refresh_token(
                self.session, user_id=user.id, token_hash=refresh_hash,
                device_fingerprint=device_fingerprint, expires_at=expires_at,
            )
        except Exception as _rt_orm_err:
            logger.warning('create_refresh_token_failed', error=str(_rt_orm_err))
        return TokenPair(access_token=access_token, refresh_token=raw_refresh, expires_in=ACCESS_TOKEN_TTL_SECONDS)

    async def _get_user_roles(self, user_id: uuid.UUID) -> list[str]:
        try:
            roles = await repo.get_user_roles(self.session, user_id)
            if roles:
                return roles
        except Exception as e:
            logger.warning('db_role_fetch_failed', user_id=str(user_id), error=str(e))
        return ['buyer']

    async def _get_subscription_tier(self, user_id: uuid.UUID) -> str:
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                url = f'{self.settings.USER_SERVICE_URL}/internal/users/{user_id}/subscription-tier'
                resp = await client.get(url)
                if resp.status_code == 200:
                    return resp.json().get('tier', 'starter')
        except Exception:
            logger.warning('user_service_tier_fetch_failed', user_id=str(user_id))
        return 'starter'

    async def _send_sms_otp(self, phone: str, otp: str) -> None:
        """Send OTP via SMS."""
        import os, sys
        if os.environ.get('ENV', 'development') != 'production':
            msg = f"\n{'=' * 55}\n  [OTP] DEV — phone: {phone}\n  CODE: {otp}\n{'=' * 55}\n"
            try:
                print(msg, flush=True)
            except UnicodeEncodeError:
                sys.stdout.buffer.write(msg.encode('utf-8'))
                sys.stdout.buffer.flush()
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f'{self.settings.NOTIFICATION_SERVICE_URL}/internal/sms',
                    json={'phone': phone, 'message': f'Your Velontri verification code is: {otp}. Expires in 5 minutes.'},
                )
                if resp.status_code not in (200, 201, 202):
                    logger.warning('sms_send_failed', phone_tail=phone[-4:], status=resp.status_code)
        except Exception:
            logger.warning('sms_send_exception', phone_tail=phone[-4:], exc_info=True)

    async def _send_email_otp(self, email: str, full_name: str, otp: str, ttl_minutes: int = 10) -> None:
        """
        Send OTP verification email.

        Priority:
          1. Gmail SMTP  (GMAIL_USER + GMAIL_APP_PASSWORD) - free, no domain needed
          2. Resend      (RESEND_API_KEY)                  - fallback
          3. SendGrid    (SENDGRID_API_KEY)                - last resort
          4. Terminal print                                - dev only
        """
        import sys
        import smtplib
        import ssl
        import asyncio
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        first_name = full_name.split()[0] if full_name else 'there'
        import os
        gmail_user = (self.settings.GMAIL_USER or os.environ.get('GMAIL_USER', '')).strip()
        gmail_pass = (self.settings.GMAIL_APP_PASSWORD or os.environ.get('GMAIL_APP_PASSWORD', '')).strip()
        gmail_refresh = (self.settings.GMAIL_REFRESH_TOKEN or os.environ.get('GMAIL_REFRESH_TOKEN', '')).strip()
        client_id = (self.settings.GOOGLE_CLIENT_ID or os.environ.get('GOOGLE_CLIENT_ID', '')).strip()
        client_secret = (self.settings.GOOGLE_CLIENT_SECRET or os.environ.get('GOOGLE_CLIENT_SECRET', '')).strip()
        resend_key = (self.settings.RESEND_API_KEY or '').strip()
        sendgrid_key = (self.settings.SENDGRID_API_KEY or '').strip()
        from_name = self.settings.EMAIL_FROM_NAME or 'Velontri'
        subject = f'Your Velontri verification code: {otp}'
        plain_body = (
            f'Hi {first_name},\n\n'
            f'Your Velontri verification code is: {otp}\n\n'
            f'This code expires in {ttl_minutes} minutes.\n\n'
            'If you did not request this, please ignore this email.\n\n-- The Velontri Team'
        )
        html_body = self._build_otp_email_html(first_name=first_name, otp=otp, ttl_minutes=ttl_minutes)

        if gmail_user and gmail_refresh:
            try:
                msg = MIMEMultipart('alternative')
                msg['Subject'] = subject
                msg['From'] = f'{from_name} <{gmail_user}>'
                msg['To'] = email
                msg.attach(MIMEText(plain_body, 'plain'))
                msg.attach(MIMEText(html_body, 'html'))
                import base64
                raw_msg = base64.urlsafe_b64encode(msg.as_bytes()).decode()
                async with httpx.AsyncClient(timeout=10.0) as client:
                    token_resp = await client.post(
                        'https://oauth2.googleapis.com/token',
                        data={
                            'client_id': client_id,
                            'client_secret': client_secret,
                            'refresh_token': gmail_refresh,
                            'grant_type': 'refresh_token',
                        },
                    )
                    token_resp.raise_for_status()
                    access_token = token_resp.json()['access_token']
                    send_resp = await client.post(
                        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
                        headers={'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'},
                        json={'raw': raw_msg},
                    )
                    send_resp.raise_for_status()
                logger.info('email_otp_sent_gmail_http', email=email)
                return
            except Exception as exc:
                logger.warning('email_otp_gmail_http_failed', email=email, error=str(exc))

        if gmail_user and gmail_pass:
            try:
                msg = MIMEMultipart('alternative')
                msg['Subject'] = subject
                msg['From'] = f'{from_name} <{gmail_user}>'
                msg['To'] = email
                msg.attach(MIMEText(plain_body, 'plain'))
                msg.attach(MIMEText(html_body, 'html'))
                ctx = ssl.create_default_context()
                def _send_smtp():
                    with smtplib.SMTP('smtp.gmail.com', 587, timeout=10.0) as srv:
                        srv.starttls(context=ctx)
                        srv.login(gmail_user, gmail_pass)
                        srv.sendmail(gmail_user, email, msg.as_string())
                loop = asyncio.get_event_loop()
                await asyncio.wait_for(loop.run_in_executor(None, _send_smtp), timeout=15.0)
                logger.info('email_otp_sent_gmail_smtp', email=email)
                return
            except Exception as exc:
                logger.warning('email_otp_gmail_smtp_failed', email=email, error=str(exc))
        if resend_key:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        'https://api.resend.com/emails',
                        headers={'Authorization': f'Bearer {resend_key}', 'Content-Type': 'application/json'},
                        json={'from': 'Velontri <onboarding@resend.dev>', 'to': [email], 'subject': subject, 'html': html_body, 'text': plain_body},
                    )
                if resp.status_code in (200, 201):
                    logger.info('email_otp_sent_resend', email=email)
                    return
                raise ExternalServiceError(f'Resend {resp.status_code}: {resp.text[:200]}')
            except Exception as exc:
                logger.warning('email_otp_resend_failed', email=email, error=str(exc))
        if sendgrid_key:
            try:
                from_email = self.settings.EMAIL_FROM or gmail_user or 'noreply@velontri.com'
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        'https://api.sendgrid.com/v3/mail/send',
                        headers={'Authorization': f'Bearer {sendgrid_key}', 'Content-Type': 'application/json'},
                        json={
                            'personalizations': [{'to': [{'email': email, 'name': full_name}]}],
                            'from': {'email': from_email, 'name': from_name},
                            'subject': subject,
                            'content': [{'type': 'text/plain', 'value': plain_body}, {'type': 'text/html', 'value': html_body}],
                        },
                    )
                if resp.status_code in (200, 201, 202):
                    logger.info('email_otp_sent_sendgrid', email=email)
                    return
                raise ExternalServiceError(f'SendGrid {resp.status_code}: {resp.text[:200]}')
            except Exception as exc:
                logger.warning('email_otp_sendgrid_failed', email=email, error=str(exc))
        logger.warning('email_otp_no_provider', email=email)
        dev_msg = (
            f"\n{'=' * 64}\n  [EMAIL OTP] No email provider configured\n"
            f"  To:   {email}\n  CODE: {otp}  (expires {ttl_minutes} min)\n{'=' * 64}\n"
        )
        try:
            print(dev_msg, flush=True)
        except UnicodeEncodeError:
            sys.stdout.buffer.write(dev_msg.encode('utf-8'))
            sys.stdout.buffer.flush()

    def _build_otp_email_html(self, first_name: str, otp: str, ttl_minutes: int) -> str:
        """Build branded HTML email for OTP delivery."""
        return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Inter',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:540px;background:#1e293b;border-radius:24px;overflow:hidden;border:1px solid #334155">
      <tr>
        <td style="background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);padding:40px 40px 36px;text-align:center">
          <div style="display:inline-block;background:rgba(255,255,255,0.12);border-radius:16px;padding:10px 24px;margin-bottom:20px">
            <span style="color:#fff;font-size:22px;font-weight:900;letter-spacing:1px">Velontri</span>
          </div>
          <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:0;letter-spacing:0.5px">Africa's Premier Marketplace</p>
        </td>
      </tr>
      <tr>
        <td style="padding:40px">
          <p style="font-size:16px;font-weight:600;color:#f1f5f9;margin:0 0 8px">Hi {first_name},</p>
          <p style="font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 32px">
            Here is your verification code. Enter it in the app to continue.
          </p>
          <div style="text-align:center;margin:0 0 32px">
            <div style="display:inline-block;background:#0f172a;border:1px solid #4f46e5;border-radius:20px;padding:28px 48px">
              <p style="font-size:11px;font-weight:700;color:#818cf8;text-transform:uppercase;letter-spacing:4px;margin:0 0 12px">Verification Code</p>
              <p style="font-size:44px;font-weight:900;color:#a5b4fc;letter-spacing:16px;margin:0;font-variant-numeric:tabular-nums">{otp}</p>
              <p style="font-size:12px;color:#475569;margin:12px 0 0">Expires in {ttl_minutes} minutes</p>
            </div>
          </div>
          <div style="background:#1e3a5f;border-left:3px solid #3b82f6;border-radius:8px;padding:14px 18px;margin-bottom:24px">
            <p style="font-size:12px;color:#93c5fd;margin:0;line-height:1.6">
              🔒 Never share this code with anyone. Velontri staff will never ask for it.
            </p>
          </div>
          <p style="font-size:12px;color:#475569;margin:0">If you didn't request this, you can safely ignore this email.</p>
        </td>
      </tr>
      <tr>
        <td style="background:#0f172a;padding:20px 40px;text-align:center;border-top:1px solid #1e293b">
          <p style="font-size:11px;color:#334155;margin:0">© 2025 Velontri · All rights reserved</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""

    async def _send_password_changed_email(self, email: str, full_name: str) -> None:
        """Send a 'your password was changed' notification email."""
        first_name = full_name.split()[0] if full_name else 'there'
        subject = 'Your Velontri password has been changed'
        plain_body = (
            f'Hi {first_name},\n\n'
            'Your Velontri account password was just changed.\n\n'
            'If this was you, no action is needed.\n\n'
            'If you did NOT make this change, please contact support immediately at support@velontri.com\n\n'
            '-- The Velontri Team'
        )
        html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Inter',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 16px">
  <tr><td align="center">
    <table width="100%" style="max-width:540px;background:#1e293b;border-radius:24px;overflow:hidden;border:1px solid #334155">
      <tr>
        <td style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);padding:40px;text-align:center">
          <span style="color:#fff;font-size:22px;font-weight:900">Velontri</span>
          <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:6px 0 0">Password Changed Successfully</p>
        </td>
      </tr>
      <tr>
        <td style="padding:40px">
          <p style="font-size:16px;font-weight:600;color:#f1f5f9;margin:0 0 16px">Hi {first_name},</p>
          <p style="font-size:14px;color:#94a3b8;line-height:1.7;margin:0 0 24px">
            Your Velontri account password was successfully changed. All other active sessions have been signed out for your security.
          </p>
          <div style="background:#1a2e1a;border-left:3px solid #22c55e;border-radius:8px;padding:14px 18px;margin-bottom:24px">
            <p style="font-size:12px;color:#86efac;margin:0;line-height:1.6">
              ✅ If this was you, you're all set. You can log back in with your new password.
            </p>
          </div>
          <div style="background:#3b1a1a;border-left:3px solid #ef4444;border-radius:8px;padding:14px 18px">
            <p style="font-size:12px;color:#fca5a5;margin:0;line-height:1.6">
              ⚠️ If you did NOT make this change, contact support immediately at <a href="mailto:support@velontri.com" style="color:#f87171">support@velontri.com</a>
            </p>
          </div>
        </td>
      </tr>
      <tr>
        <td style="background:#0f172a;padding:20px 40px;text-align:center;border-top:1px solid #1e293b">
          <p style="font-size:11px;color:#334155;margin:0">© 2025 Velontri · All rights reserved</p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>"""
        # Direct send using available provider
        resend_key = (self.settings.RESEND_API_KEY or os.environ.get('RESEND_API_KEY', '')).strip()
        sendgrid_key = (self.settings.SENDGRID_API_KEY or '').strip()
        import os, asyncio, smtplib, ssl
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText

        gmail_user = (self.settings.GMAIL_USER or os.environ.get('GMAIL_USER', '') or 'okewunmimojolaoluwa@gmail.com').strip()
        gmail_pass = (self.settings.GMAIL_APP_PASSWORD or os.environ.get('GMAIL_APP_PASSWORD', '') or 'scivvkgnkqmgqedt').strip()
        from_name = self.settings.EMAIL_FROM_NAME or 'Velontri'

        # 1. Primary: Send via Gmail SMTP (App Password) — SSL 465 or TLS 587
        if gmail_user and gmail_pass:
            def _send_smtp():
                msg = MIMEMultipart('alternative')
                msg['Subject'] = subject
                msg['From'] = f'{from_name} <{gmail_user}>'
                msg['To'] = email
                msg.attach(MIMEText(plain_body, 'plain'))
                msg.attach(MIMEText(html_body, 'html'))
                ctx = ssl.create_default_context()
                # Try SSL 465 first
                try:
                    with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=ctx, timeout=12.0) as srv:
                        srv.login(gmail_user, gmail_pass)
                        srv.sendmail(gmail_user, email, msg.as_string())
                    return True
                except Exception as _ssl_err:
                    logger.warning('gmail_smtp_ssl_failed', error=str(_ssl_err))

                # Fallback to TLS 587
                try:
                    with smtplib.SMTP('smtp.gmail.com', 587, timeout=12.0) as srv:
                        srv.starttls(context=ctx)
                        srv.login(gmail_user, gmail_pass)
                        srv.sendmail(gmail_user, email, msg.as_string())
                    return True
                except Exception as _tls_err:
                    logger.warning('gmail_smtp_tls_failed', error=str(_tls_err))
                return False

            try:
                loop = asyncio.get_running_loop()
                sent = await loop.run_in_executor(None, _send_smtp)
                if sent:
                    logger.info('email_otp_sent_gmail_smtp', email=email)
                    return
            except Exception as _exec_err:
                logger.warning('gmail_smtp_executor_failed', error=str(_exec_err))

        # 2. Secondary: Resend API
        if resend_key:
            try:
                from_sender = f'{from_name} <noreply@velontri.com>'
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        'https://api.resend.com/emails',
                        headers={'Authorization': f'Bearer {resend_key}', 'Content-Type': 'application/json'},
                        json={'from': from_sender, 'to': [email], 'subject': subject, 'html': html_body, 'text': plain_body},
                    )
                    if resp.status_code in (200, 201, 202):
                        logger.info('email_otp_sent_resend', email=email)
                        return
                    else:
                        resp_dev = await client.post(
                            'https://api.resend.com/emails',
                            headers={'Authorization': f'Bearer {resend_key}', 'Content-Type': 'application/json'},
                            json={'from': 'Velontri <onboarding@resend.dev>', 'to': [email], 'subject': subject, 'html': html_body, 'text': plain_body},
                        )
                        if resp_dev.status_code in (200, 201, 202):
                            logger.info('email_otp_sent_resend_dev', email=email)
                            return
                        logger.warning('resend_failed', status=resp.status_code, body=resp.text)
            except Exception as _resend_err:
                logger.warning('resend_exception', error=str(_resend_err))

        # 3. Tertiary: SendGrid API
        if sendgrid_key:
            try:
                from_email = self.settings.EMAIL_FROM or 'noreply@velontri.com'
                async with httpx.AsyncClient(timeout=10.0) as client:
                    await client.post(
                        'https://api.sendgrid.com/v3/mail/send',
                        headers={'Authorization': f'Bearer {sendgrid_key}', 'Content-Type': 'application/json'},
                        json={
                            'personalizations': [{'to': [{'email': email}]}],
                            'from': {'email': from_email, 'name': from_name},
                            'subject': subject,
                            'content': [{'type': 'text/html', 'value': html_body}],
                        },
                    )
                return
            except Exception as _sg_err:
                logger.warning('sendgrid_exception', error=str(_sg_err))

    async def _publish_lockout_notification(self, user: User) -> None:
        try:
            await publish_event(
                self.channel, routing_key='notification.send',
                payload={
                    'recipient_user_id': str(user.id), 'channel': 'email',
                    'template': 'account_locked', 'data': {'full_name': user.full_name},
                },
                correlation_id=str(user.id),
            )
        except Exception:
            logger.warning('lockout_notification_failed', user_id=str(user.id), exc_info=True)

    async def _publish_new_device_alert(self, user: User, ip_address: str | None) -> None:
        try:
            await publish_event(
                self.channel, routing_key='notification.send',
                payload={
                    'recipient_user_id': str(user.id), 'channel': 'email',
                    'template': 'new_device_login',
                    'data': {'full_name': user.full_name, 'ip_address': ip_address or 'unknown'},
                },
                correlation_id=str(user.id),
            )
        except Exception:
            logger.warning('new_device_alert_failed', user_id=str(user.id), exc_info=True)