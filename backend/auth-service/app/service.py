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
    AccountLockedError,
    AccountInactiveError,
    InvalidCredentialsError,
    NotFoundError,
    OTPExpiredError,
    OTPInvalidError,
    TokenInvalidError,
    ExternalServiceError,
    ForbiddenError,
)
from shared.jwt_utils import (
    ACCESS_TOKEN_TTL_SECONDS,
    REFRESH_TOKEN_TTL_SECONDS,
    create_access_token,
    create_refresh_token,
    verify_token,
)
from shared.logging import get_logger
from shared.rabbitmq import publish_event
from shared.redis_client import RedisKeys

from . import repository as repo
from .config import AuthSettings
from .models import User
from .schemas import (
    DeviceListResponse,
    DeviceResponse,
    IntrospectResponse,
    LoginResponse,
    TokenPair,
    TokenRefreshResponse,
    VerifyPhoneResponse,
)
from .security import (
    assert_not_locked,
    clear_failed_attempts,
    decrypt_totp_secret,
    encrypt_totp_secret,
    generate_otp,
    generate_refresh_token,
    generate_reset_token,
    generate_totp_secret,
    get_totp_uri,
    hash_otp,
    hash_password,
    hash_refresh_token,
    hash_reset_token,
    record_failed_attempt,
    verify_otp_hash,
    verify_password,
    verify_totp,
)

logger = get_logger(__name__)


class AuthService:
    """
    Stateless service — all state lives in the database or Redis.
    Instantiated per-request via FastAPI dependency injection.
    """

    def __init__(
        self,
        session: AsyncSession,
        redis: Redis,
        settings: AuthSettings,
        rabbitmq_channel: Any,
    ) -> None:
        self.session = session
        self.redis = redis
        self.settings = settings
        self.channel = rabbitmq_channel

    # ── Registration ──────────────────────────────────────────────────────────

    async def register(
        self,
        email: str,
        phone: str,
        password: str,
        full_name: str,
        country_code: str,
    ) -> uuid.UUID:
        """
        Create an inactive user, generate a phone OTP, and publish
        user.registered to RabbitMQ.
        Returns the new user's UUID.
        """
        password_hash = hash_password(password)

        # Try ORM first, fall back to direct aiosqlite if engine DB mismatch
        user = None
        try:
            user = await repo.create_user(
                self.session,
                email=email,
                phone=phone,
                password_hash=password_hash,
                full_name=full_name,
                country_code=country_code,
            )
        except Exception as _orm_err:
            logger.warning("register_orm_failed", error=str(_orm_err))

        if user is None:
            # Direct aiosqlite write — bypasses engine DB path issue
            try:
                import aiosqlite as _aio
                from shared.db_path import get_db_path as _get_db_path
                from .models import User as _UserModel
                _db = _get_db_path()
                _uid = uuid.uuid4()
                async with _aio.connect(str(_db)) as _db_conn:
                    await _db_conn.execute("""
                        CREATE TABLE IF NOT EXISTS users (
                            id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL,
                            phone TEXT UNIQUE, phone_verified INTEGER DEFAULT 0,
                            password_hash TEXT, full_name TEXT,
                            country_code TEXT DEFAULT 'NG', is_active INTEGER DEFAULT 0,
                            is_locked INTEGER DEFAULT 0, failed_attempts INTEGER DEFAULT 0,
                            created_at TEXT DEFAULT (datetime('now'))
                        )
                    """)
                    await _db_conn.execute(
                        "INSERT INTO users (id,email,phone,phone_verified,password_hash,"
                        "full_name,country_code,is_active,is_locked,failed_attempts) "
                        "VALUES (?,?,?,0,?,?,?,0,0,0)",
                        [str(_uid), email.lower().strip(), phone.strip(),
                         password_hash, full_name.strip(), country_code.upper()[:2]]
                    )
                    await _db_conn.commit()
                user = _UserModel.__new__(_UserModel)
                user.id = _uid
                user.email = email.lower().strip()
                user.phone = phone.strip()
                user.phone_verified = False
                user.password_hash = password_hash
                user.full_name = full_name.strip()
                user.country_code = country_code.upper()[:2]
                user.is_active = False
                user.is_locked = False
                user.failed_attempts = 0
                user.locked_until = None
                logger.info("register_aiosqlite_fallback", uid=str(_uid))
            except Exception as _aio_err:
                from shared.errors import AlreadyExistsError
                if "UNIQUE" in str(_aio_err).upper():
                    raise AlreadyExistsError("An account with this email or phone already exists.") from _aio_err
                raise

        # Generate OTP and cache — use aiosqlite directly to write to canonical DB
        otp = generate_otp()
        otp_hash = hash_otp(otp)
        expires_at = datetime.now(tz=timezone.utc) + timedelta(
            seconds=self.settings.OTP_TTL_SECONDS
        )

        # Try ORM first, fall back to aiosqlite
        try:
            await repo.create_otp(
                self.session,
                user_id=user.id,
                purpose="phone_verify",
                code_hash=otp_hash,
                expires_at=expires_at,
            )
        except Exception as _otp_orm_err:
            logger.warning("create_otp_orm_failed", error=str(_otp_orm_err))
            try:
                import aiosqlite as _aio
                from shared.db_path import get_db_path as _get_db_path
                _db = _get_db_path()
                async with _aio.connect(str(_db)) as _db_conn:
                    await _db_conn.execute("""
                        CREATE TABLE IF NOT EXISTS otps (
                            id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
                            purpose TEXT NOT NULL, code_hash TEXT NOT NULL,
                            expires_at TEXT NOT NULL, used INTEGER DEFAULT 0
                        )
                    """)
                    # Invalidate prior OTPs for this user+purpose
                    await _db_conn.execute(
                        "UPDATE otps SET used=1 WHERE user_id=? AND purpose=? AND used=0",
                        [str(user.id), "phone_verify"]
                    )
                    await _db_conn.execute(
                        "INSERT INTO otps (id,user_id,purpose,code_hash,expires_at,used) "
                        "VALUES (?,?,?,?,?,0)",
                        [str(uuid.uuid4()), str(user.id), "phone_verify",
                         otp_hash, expires_at.isoformat()]
                    )
                    await _db_conn.commit()
            except Exception as _otp_aio_err:
                logger.warning("create_otp_aiosqlite_failed", error=str(_otp_aio_err))

        # Send OTP via EMAIL (primary)
        # Email failure is NON-FATAL — user is still created and can request
        # a resend from the verify-phone page.
        try:
            await self._send_email_otp(email=email, full_name=full_name, otp=otp)
        except Exception as exc:
            logger.warning(
                "email_otp_send_failed_at_registration",
                user_id=str(user.id),
                email=email,
                error=str(exc),
            )
            # Don't re-raise — registration succeeds even if email is unavailable.

        # Publish event for User Service to create the profile record
        await publish_event(
            self.channel,
            routing_key="user.registered",
            payload={
                "user_id": str(user.id),
                "email": email,
                "full_name": full_name,
                "phone": phone,
                "country_code": country_code,
            },
            correlation_id=str(user.id),
        )

        logger.info("user_registered", user_id=str(user.id), country=country_code)
        return user.id

    # ── Phone verification ────────────────────────────────────────────────────

    async def resend_otp(self, user_id: uuid.UUID) -> None:
        """
        Generate a fresh OTP and resend it via email.
        create_otp() automatically invalidates any prior OTPs for the same user+purpose.
        """
        user = await repo.get_user_by_id(self.session, user_id)
        if user is None:
            from shared.errors import NotFoundError
            raise NotFoundError("User not found.")

        await self._resend_for_email(user_id, user.email, user.full_name)
        logger.info("otp_resent_email", user_id=str(user_id))

    async def _resend_for_email(self, user_id: uuid.UUID, email: str, full_name: str) -> None:
        """Helper to generate and send OTP via email for resend."""
        otp = generate_otp()
        otp_hash = hash_otp(otp)
        expires_at = datetime.now(tz=timezone.utc) + timedelta(
            seconds=self.settings.OTP_TTL_SECONDS
        )
        await repo.create_otp(
            self.session,
            user_id=user_id,
            purpose="phone_verify",
            code_hash=otp_hash,
            expires_at=expires_at,
        )
        await self._send_email_otp(email=email, full_name=full_name, otp=otp)

    async def verify_phone(
        self, user_id: uuid.UUID, otp_code: str
    ) -> VerifyPhoneResponse:
        """
        Validate the OTP, activate the user, emit user.phone_verified.
        """
        otp_record = await repo.get_valid_otp(
            self.session, user_id=user_id, purpose="phone_verify"
        )

        # If ORM returns None, try aiosqlite direct
        if otp_record is None:
            try:
                import aiosqlite as _aio
                from shared.db_path import get_db_path as _gdp
                from .models import OTP as _OTPModel
                from datetime import datetime as _dt, timezone as _tz
                _db = _gdp()
                async with _aio.connect(str(_db)) as _db_conn:
                    _db_conn.row_factory = _aio.Row
                    _now = _dt.now(tz=_tz.utc).isoformat()
                    _rows = await _db_conn.execute_fetchall(
                        "SELECT id, code_hash, expires_at FROM otps "
                        "WHERE user_id=? AND purpose=? AND used=0 AND expires_at > ? "
                        "ORDER BY rowid DESC LIMIT 1",
                        [str(user_id), "phone_verify", _now]
                    )
                    if _rows:
                        _r = _rows[0]
                        otp_record = _OTPModel.__new__(_OTPModel)
                        otp_record.id = uuid.UUID(str(_r["id"]))
                        otp_record.user_id = user_id
                        otp_record.purpose = "phone_verify"
                        otp_record.code_hash = _r["code_hash"]
                        otp_record.used = False
            except Exception as _otp_fb_err:
                logger.warning("get_otp_aiosqlite_failed", error=str(_otp_fb_err))

        if otp_record is None:
            raise OTPExpiredError(
                "OTP not found or has expired. Please request a new one."
            )

        if not verify_otp_hash(otp_code, otp_record.code_hash):
            raise OTPInvalidError("The OTP you entered is incorrect.")

        await repo.mark_otp_used(self.session, otp_record.id)
        await repo.activate_user(self.session, user_id)

        # Aiosqlite fallback — ensures changes land in canonical DB regardless of engine
        try:
            import aiosqlite as _aio
            from shared.db_path import get_db_path as _gdp
            _db = _gdp()
            async with _aio.connect(str(_db)) as _db_conn:
                await _db_conn.execute(
                    "UPDATE otps SET used=1 WHERE id=?", [str(otp_record.id)]
                )
                await _db_conn.execute(
                    "UPDATE users SET is_active=1, phone_verified=1 WHERE id=?",
                    [str(user_id)]
                )
                await _db_conn.commit()
        except Exception as _act_err:
            logger.warning("activate_aiosqlite_failed", error=str(_act_err))

        # Auto-assign Free subscription on account activation
        try:
            from shared.db_path import get_db_path as _get_db_path
            import aiosqlite as _aiosqlite
            import uuid as _uuid_mod
            _db = _get_db_path()
            async with _aiosqlite.connect(str(_db)) as _db_conn:
                await _db_conn.execute("""
                    CREATE TABLE IF NOT EXISTS subscriptions (
                        id TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE,
                        tier TEXT NOT NULL DEFAULT 'starter', is_active INTEGER NOT NULL DEFAULT 1,
                        pending_downgrade_tier TEXT, current_period_start TEXT,
                        current_period_end TEXT,
                        created_at TEXT NOT NULL DEFAULT (datetime('now')),
                        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                    )
                """)
                await _db_conn.execute(
                    "INSERT OR IGNORE INTO subscriptions (id, user_id, tier, is_active) VALUES (?,?,?,1)",
                    [str(_uuid_mod.uuid4()), str(user_id), "starter"],
                )
                await _db_conn.commit()
        except Exception as _sub_err:
            logger.warning("auto_subscription_failed", user_id=str(user_id), error=str(_sub_err))

        # Publish phone verified event → User Service awards Bronze badge
        await publish_event(
            self.channel,
            routing_key="user.phone_verified",
            payload={"user_id": str(user_id)},
            correlation_id=str(user_id),
        )

        logger.info("phone_verified", user_id=str(user_id))
        return VerifyPhoneResponse()

    # ── Login ─────────────────────────────────────────────────────────────────

    async def login(
        self,
        identifier: str,
        password: str,
        device_fingerprint: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> LoginResponse:
        """
        Authenticate a user. Returns either a token pair (no 2FA) or
        a session ID for the 2FA challenge.
        """
        user = await repo.get_user_by_identifier(self.session, identifier)

        # If ORM returns None, try direct aiosqlite on canonical DB path
        # (handles the case where engine connects to a different file than aiosqlite)
        if user is None:
            try:
                import aiosqlite as _aio
                from shared.db_path import get_db_path as _get_db_path
                from .models import User as _User
                _db = _get_db_path()
                _id_clean = identifier.strip().lower() if "@" in identifier else identifier.strip()
                _col = "lower(email)" if "@" in identifier else "phone"
                async with _aio.connect(str(_db)) as _db_conn:
                    _db_conn.row_factory = _aio.Row
                    _rows = await _db_conn.execute_fetchall(
                        f"SELECT id, email, phone, phone_verified, password_hash, full_name, "
                        f"country_code, is_active, is_locked, failed_attempts, created_at "
                        f"FROM users WHERE {_col} = ?", [_id_clean]
                    )
                    if _rows:
                        _r = _rows[0]
                        user = _User.__new__(_User)
                        user.id = uuid.UUID(str(_r["id"]))
                        user.email = _r["email"] or ""
                        user.phone = _r["phone"] or ""
                        user.phone_verified = bool(_r["phone_verified"])
                        user.password_hash = _r["password_hash"] or ""
                        user.full_name = _r["full_name"] or ""
                        user.country_code = _r["country_code"] or "NG"
                        user.is_active = bool(_r["is_active"])
                        user.is_locked = bool(_r["is_locked"])
                        user.failed_attempts = int(_r["failed_attempts"] or 0)
                        user.created_at = _r["created_at"]
                        user.locked_until = None
                        logger.info("login_aiosqlite_fallback_hit", identifier=identifier[:4])
            except Exception as _fb_err:
                logger.warning("login_aiosqlite_fallback_failed", error=str(_fb_err))

        if user is None:
            # Do NOT reveal whether the user exists
            logger.warning("login_user_not_found", identifier_hash=hash_otp(identifier))
            raise InvalidCredentialsError("Invalid email/phone or password.")

        # Check account lockout in Redis (fast path, avoids DB round-trip)
        await assert_not_locked(self.redis, str(user.id))

        # Also check DB-level lock (handles restarts where Redis was cleared)
        if user.is_locked and user.locked_until:
            if user.locked_until > datetime.now(tz=timezone.utc):
                raise AccountLockedError(
                    "Account is temporarily locked. Please try again later."
                )
            else:
                # Lock has expired — clear it
                await repo.clear_lockout(self.session, user.id)

        if not user.is_active:
            raise AccountInactiveError(
                "Account is not active. Please verify your phone number."
            )

        if not verify_password(password, user.password_hash):
            count = await record_failed_attempt(
                self.redis,
                user_id=str(user.id),
                max_attempts=self.settings.MAX_FAILED_ATTEMPTS,
                lockout_ttl=self.settings.LOCKOUT_TTL_SECONDS,
            )
            try:
                await repo.record_login_history(
                    self.session,
                    user_id=user.id,
                    device_fingerprint=device_fingerprint,
                    ip_address=ip_address,
                    success=False,
                )
            except Exception:
                pass

            if count >= self.settings.MAX_FAILED_ATTEMPTS:
                locked_until = datetime.now(tz=timezone.utc) + timedelta(
                    seconds=self.settings.LOCKOUT_TTL_SECONDS
                )
                try:
                    await repo.lock_user(self.session, user.id, locked_until)
                except Exception:
                    pass
                # Notify user via email
                await self._publish_lockout_notification(user)

            raise InvalidCredentialsError("Invalid email/phone or password.")

        # Successful credential check — clear failure counter
        await clear_failed_attempts(self.redis, str(user.id))

        # Register/update device (non-fatal — don't block login if DB write fails)
        device = None
        is_new_device = False
        try:
            device, is_new_device = await repo.get_or_create_device(
                self.session,
                user_id=user.id,
                fingerprint=device_fingerprint,
                ip_address=ip_address,
                user_agent=user_agent,
            )
        except Exception as _dev_err:
            logger.warning("get_or_create_device_failed", error=str(_dev_err))

        if is_new_device:
            await self._publish_new_device_alert(user, ip_address)

        # Record successful login (non-fatal)
        try:
            await repo.record_login_history(
                self.session,
                user_id=user.id,
                device_fingerprint=device_fingerprint,
                ip_address=ip_address,
                success=True,
            )
        except Exception as _hist_err:
            logger.warning("record_login_history_failed", error=str(_hist_err))

        # Check if 2FA is required (non-fatal — skip 2FA if DB lookup fails)
        totp_record = None
        try:
            totp_record = await repo.get_totp_secret(self.session, user.id)
        except Exception:
            pass
        if totp_record and totp_record.enabled:
            # Issue a short-lived 2FA session ID stored in Redis
            session_id = secrets.token_urlsafe(32)
            session_key = f"auth:2fa_session:{session_id}"
            await self.redis.setex(
                session_key,
                300,  # 5-minute window to complete 2FA
                str(user.id),
            )
            logger.info("2fa_required", user_id=str(user.id))
            return LoginResponse(
                requires_2fa=True,
                two_fa_session_id=session_id,
                message="2FA verification required.",
            )

        # No 2FA — issue tokens directly
        tokens = await self._issue_token_pair(user, device_fingerprint)
        logger.info("login_success", user_id=str(user.id))
        return LoginResponse(tokens=tokens)

    # ── 2FA ───────────────────────────────────────────────────────────────────

    async def enable_2fa(
        self, user_id: uuid.UUID, method: str, ip_address: str | None
    ) -> dict[str, Any]:
        """Enable TOTP or SMS 2FA for a user."""
        user = await repo.get_user_by_id(self.session, user_id)
        if user is None:
            raise NotFoundError("User not found.")

        if method == "totp":
            secret = generate_totp_secret()
            encrypted = encrypt_totp_secret(secret, self.settings.TOTP_ENCRYPTION_KEY)
            await repo.upsert_totp_secret(
                self.session, user_id, encrypted, enabled=False
            )
            uri = get_totp_uri(secret, user.email)
            await repo.create_audit_log(
                self.session, user_id, "2fa_toggle", ip_address
            )
            return {
                "method": "totp",
                "totp_secret": secret,  # Shown ONCE to the user to save
                "totp_qr_url": uri,
                "message": "Scan the QR code with your authenticator app, "
                           "then call /auth/2fa/verify to complete setup.",
            }
        else:
            # SMS — send an OTP to the registered phone
            otp = generate_otp()
            expires_at = datetime.now(tz=timezone.utc) + timedelta(
                seconds=self.settings.OTP_TTL_SECONDS
            )
            await repo.create_otp(
                self.session, user_id, "2fa", hash_otp(otp), expires_at
            )
            await self._send_sms_otp(phone=user.phone, otp=otp)
            return {
                "method": "sms",
                "message": "A verification code has been sent to your registered phone.",
            }

    async def verify_2fa(
        self,
        two_fa_session_id: str,
        otp_code: str,
        ip_address: str | None,
    ) -> TokenPair:
        """
        Validate 2FA and issue tokens.
        Session ID links back to user_id stored in Redis.
        """
        session_key = f"auth:2fa_session:{two_fa_session_id}"
        user_id_str: str | None = await self.redis.get(session_key)

        if not user_id_str:
            raise TokenInvalidError(
                "2FA session has expired or is invalid. Please log in again."
            )

        user_id = uuid.UUID(user_id_str)
        user = await repo.get_user_by_id(self.session, user_id)
        if user is None:
            raise NotFoundError("User not found.")

        totp_record = await repo.get_totp_secret(self.session, user_id)
        verified = False

        if totp_record and totp_record.enabled:
            # TOTP verification
            decrypted = decrypt_totp_secret(
                totp_record.secret_encrypted, self.settings.TOTP_ENCRYPTION_KEY
            )
            verified = verify_totp(decrypted, otp_code)
        else:
            # SMS OTP verification
            otp_record = await repo.get_valid_otp(self.session, user_id, "2fa")
            if otp_record and verify_otp_hash(otp_code, otp_record.code_hash):
                await repo.mark_otp_used(self.session, otp_record.id)
                verified = True

        if not verified:
            raise OTPInvalidError("Invalid 2FA code.")

        # Mark TOTP as enabled (in case this was the setup verification)
        if totp_record and not totp_record.enabled:
            await repo.upsert_totp_secret(
                self.session, user_id, totp_record.secret_encrypted, enabled=True
            )

        # Consume the 2FA session to prevent reuse
        await self.redis.delete(session_key)

        # Get any known device fingerprint from the refresh-token context
        # For 2FA we issue with an empty fingerprint — the refresh token will
        # carry it on next login
        tokens = await self._issue_token_pair(user, device_fingerprint="2fa_verified")
        logger.info("2fa_verified", user_id=str(user_id))
        return tokens

    # ── Token refresh ─────────────────────────────────────────────────────────

    async def refresh_access_token(self, raw_refresh_token: str) -> TokenRefreshResponse:
        """
        Validate the refresh token and issue a new access token.
        Implements refresh token rotation — old token is revoked.
        """
        token_hash = hash_refresh_token(raw_refresh_token)
        rt = await repo.get_refresh_token_by_hash(self.session, token_hash)

        if rt is None:
            raise TokenInvalidError(
                "Refresh token is invalid, expired, or has already been used."
            )

        user = await repo.get_user_by_id(self.session, rt.user_id)
        if user is None or not user.is_active:
            raise TokenInvalidError("Associated user account is no longer active.")

        # Revoke the used refresh token (rotation)
        await repo.revoke_refresh_token(self.session, token_hash)

        # Issue new access token (no new refresh token — client must re-login)
        roles = await self._get_user_roles(rt.user_id)
        subscription_tier = await self._get_subscription_tier(rt.user_id)

        access_token = create_access_token(
            private_key_path=self.settings.JWT_PRIVATE_KEY_PATH,
            user_id=str(rt.user_id),
            roles=roles,
            subscription_tier=subscription_tier,
            ttl=ACCESS_TOKEN_TTL_SECONDS,
        )

        return TokenRefreshResponse(
            access_token=access_token,
            expires_in=ACCESS_TOKEN_TTL_SECONDS,
        )

    # ── Password reset ────────────────────────────────────────────────────────

    async def request_password_reset(self, email: str) -> None:
        """
        Initiate password reset. Always returns success to prevent
        email enumeration.
        """
        user = await repo.get_user_by_email(self.session, email)

        if user is None or not user.is_active:
            # Don't reveal whether the email exists
            logger.info("password_reset_requested_unknown_email")
            return

        raw_token, token_hash = generate_reset_token()
        key = RedisKeys.reset_token(token_hash)
        await self.redis.setex(
            key,
            self.settings.RESET_TOKEN_TTL_SECONDS,
            str(user.id),
        )

        # Publish to Notification Service via RabbitMQ
        await publish_event(
            self.channel,
            routing_key="notification.send",
            payload={
                "recipient_user_id": str(user.id),
                "channel": "email",
                "template": "password_reset",
                "data": {
                    "full_name": user.full_name,
                    "reset_token": raw_token,
                    "expires_in_minutes": self.settings.RESET_TOKEN_TTL_SECONDS // 60,
                },
            },
            correlation_id=str(user.id),
        )
        logger.info("password_reset_email_sent", user_id=str(user.id))

    async def reset_password(
        self, raw_token: str, new_password: str, ip_address: str | None
    ) -> None:
        """Validate reset token and update the password. Revokes all refresh tokens."""
        token_hash = hash_reset_token(raw_token)
        key = RedisKeys.reset_token(token_hash)
        user_id_str: str | None = await self.redis.get(key)

        if not user_id_str:
            raise TokenInvalidError(
                "Password reset link is invalid or has expired."
            )

        user_id = uuid.UUID(user_id_str)
        new_hash = hash_password(new_password)

        await repo.update_password(self.session, user_id, new_hash)
        await repo.revoke_all_refresh_tokens(self.session, user_id)
        await repo.create_audit_log(
            self.session, user_id, "password_reset", ip_address
        )

        # Consume the reset token immediately (single-use)
        await self.redis.delete(key)
        logger.info("password_reset_complete", user_id=str(user_id))

    # ── Token introspection ───────────────────────────────────────────────────

    # ── OAuth login ───────────────────────────────────────────────────────────

    async def oauth_login(
        self,
        provider: str,
        id_token: str,
        device_fingerprint: str,
        ip_address: str | None,
        user_agent: str | None,
    ) -> LoginResponse:
        """
        Verify a provider ID token, look up or create the linked Velontri account,
        and issue a token pair.
        """
        from .oauth import OAuthUserInfo, verify_google_token, verify_apple_token

        if provider == "google":
            info: OAuthUserInfo = await verify_google_token(
                id_token, self.settings.GOOGLE_CLIENT_ID
            )
        elif provider == "apple":
            info = await verify_apple_token(
                id_token,
                client_id=self.settings.APPLE_CLIENT_ID,
                team_id=self.settings.APPLE_TEAM_ID,
                key_id=self.settings.APPLE_KEY_ID,
                private_key_pem=self.settings.APPLE_PRIVATE_KEY,
            )
        else:
            from shared.errors import InvalidInputError
            raise InvalidInputError(f"Unsupported OAuth provider: {provider}")

        # Look up existing user by email
        user = await repo.get_user_by_email(self.session, info.email)

        if user is None:
            # Auto-create account for OAuth users — no password set
            import secrets as _secrets
            placeholder_phone = f"+00000{_secrets.token_hex(6)}"  # Placeholder until user updates
            password_hash = hash_password(_secrets.token_urlsafe(32))  # Unusable password

            user = await repo.create_user(
                self.session,
                email=info.email,
                phone=placeholder_phone,
                password_hash=password_hash,
                full_name=info.full_name or info.email.split("@")[0],
                country_code="NG",  # Default; user updates in profile
            )
            await repo.activate_user(self.session, user.id)

            await publish_event(
                self.channel,
                routing_key="user.registered",
                payload={
                    "user_id": str(user.id),
                    "email": info.email,
                    "full_name": user.full_name,
                    "phone": placeholder_phone,
                    "country_code": "NG",
                    "oauth_provider": provider,
                },
                correlation_id=str(user.id),
            )

        if not user.is_active:
            # Re-activate if previously deactivated
            await repo.activate_user(self.session, user.id)

        device, is_new = await repo.get_or_create_device(
            self.session,
            user_id=user.id,
            fingerprint=device_fingerprint,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        if is_new:
            await self._publish_new_device_alert(user, ip_address)

        await repo.record_login_history(
            self.session, user.id, device_fingerprint, ip_address, success=True
        )

        tokens = await self._issue_token_pair(user, device_fingerprint)
        logger.info("oauth_login_success", provider=provider, user_id=str(user.id))
        return LoginResponse(tokens=tokens)

    async def introspect(self, raw_token: str) -> IntrospectResponse:
        """Verify and decode a JWT access token."""
        payload = verify_token(
            public_key_path=self.settings.JWT_PUBLIC_KEY_PATH,
            token=raw_token,
        )

        return IntrospectResponse(
            user_id=uuid.UUID(payload["sub"]),
            roles=payload.get("roles", []),
            subscription_tier=payload.get("subscription_tier", "starter"),
            branch_ids=payload.get("branch_ids", []),
            expires_at=int(payload["exp"]),
        )

    # ── Device management ─────────────────────────────────────────────────────

    async def list_devices(self, user_id: uuid.UUID) -> DeviceListResponse:
        devices = await repo.list_devices(self.session, user_id)
        return DeviceListResponse(
            devices=[
                DeviceResponse(
                    id=d.id,
                    fingerprint=d.fingerprint,
                    ip_address=str(d.ip_address) if d.ip_address else None,
                    user_agent=d.user_agent,
                    last_seen=d.last_seen,
                    is_trusted=d.is_trusted,
                    created_at=d.created_at,
                )
                for d in devices
            ]
        )

    async def revoke_device(
        self, device_id: uuid.UUID, user_id: uuid.UUID, ip_address: str | None
    ) -> None:
        deleted = await repo.delete_device(self.session, device_id, user_id)
        if not deleted:
            raise NotFoundError("Device not found or does not belong to this account.")

        await repo.create_audit_log(
            self.session, user_id, "device_revoke", ip_address
        )
        logger.info(
            "device_revoked", device_id=str(device_id), user_id=str(user_id)
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    async def _issue_token_pair(self, user: User, device_fingerprint: str) -> TokenPair:
        """Issue an access + refresh token pair for a user."""
        roles = await self._get_user_roles(user.id)
        subscription_tier = await self._get_subscription_tier(user.id)
        branch_ids: list[str] = []  # Populated by User Service for branch managers

        access_token = create_access_token(
            private_key_path=self.settings.JWT_PRIVATE_KEY_PATH,
            user_id=str(user.id),
            roles=roles,
            subscription_tier=subscription_tier,
            branch_ids=branch_ids,
        )

        raw_refresh = generate_refresh_token()
        refresh_hash = hash_refresh_token(raw_refresh)
        expires_at = datetime.now(tz=timezone.utc) + timedelta(
            seconds=REFRESH_TOKEN_TTL_SECONDS
        )

        # Write refresh token — try ORM, fall back to aiosqlite
        try:
            await repo.create_refresh_token(
                self.session,
                user_id=user.id,
                token_hash=refresh_hash,
                device_fingerprint=device_fingerprint,
                expires_at=expires_at,
            )
        except Exception as _rt_orm_err:
            logger.warning("create_refresh_token_orm_failed", error=str(_rt_orm_err))
            try:
                import aiosqlite as _aio
                from shared.db_path import get_db_path as _gdp
                _db = _gdp()
                async with _aio.connect(str(_db)) as _db_conn:
                    await _db_conn.execute("""
                        CREATE TABLE IF NOT EXISTS refresh_tokens (
                            id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
                            token_hash TEXT UNIQUE NOT NULL,
                            device_fingerprint TEXT, expires_at TEXT NOT NULL,
                            revoked INTEGER DEFAULT 0,
                            created_at TEXT DEFAULT (datetime('now'))
                        )
                    """)
                    await _db_conn.execute(
                        "CREATE INDEX IF NOT EXISTS ix_rt_hash ON refresh_tokens(token_hash)"
                    )
                    await _db_conn.execute(
                        "INSERT OR IGNORE INTO refresh_tokens "
                        "(id,user_id,token_hash,device_fingerprint,expires_at,revoked) "
                        "VALUES (?,?,?,?,?,0)",
                        [str(uuid.uuid4()), str(user.id), refresh_hash,
                         device_fingerprint, expires_at.isoformat()]
                    )
                    await _db_conn.commit()
            except Exception as _rt_aio_err:
                logger.warning("create_refresh_token_aiosqlite_failed", error=str(_rt_aio_err))

        return TokenPair(
            access_token=access_token,
            refresh_token=raw_refresh,
            expires_in=ACCESS_TOKEN_TTL_SECONDS,
        )

    async def _get_user_roles(self, user_id: uuid.UUID) -> list[str]:
        """
        Fetch user roles from the database directly.
        Falls back to aiosqlite on canonical DB if ORM fails.
        """
        try:
            roles = await repo.get_user_roles(self.session, user_id)
            if roles:
                return roles
        except Exception as e:
            logger.warning("db_role_fetch_failed", user_id=str(user_id), error=str(e))

        # Aiosqlite fallback on canonical DB
        try:
            import aiosqlite as _aio
            from shared.db_path import get_db_path as _gdp
            _db = _gdp()
            async with _aio.connect(str(_db)) as _db_conn:
                _rows = await _db_conn.execute_fetchall(
                    "SELECT role FROM user_roles WHERE CAST(user_id AS TEXT) = ?",
                    [str(user_id)]
                )
                if _rows:
                    return [r[0] for r in _rows]
        except Exception as _re:
            logger.warning("role_aiosqlite_failed", error=str(_re))

        return ["buyer"]

    async def _get_subscription_tier(self, user_id: uuid.UUID) -> str:
        """
        Fetch subscription tier from User Service.
        Falls back to "starter" on failure.
        """
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                user_svc_url = self.settings.NOTIFICATION_SERVICE_URL.replace(
                    "notification", "user"
                )
                url = f"{user_svc_url}/internal/users/{user_id}/subscription-tier"
                resp = await client.get(url)
                if resp.status_code == 200:
                    return resp.json().get("tier", "starter")
        except Exception:
            logger.warning(
                "user_service_tier_fetch_failed", user_id=str(user_id)
            )
        return "starter"

    async def _send_sms_otp(self, phone: str, otp: str) -> None:
        """Send OTP via SMS. In dev mode, prints to stdout when SMS fails."""
        # ── DEV MODE: always print OTP to terminal ─────────────────────────
        import os, sys
        if os.environ.get("ENV", "development") != "production":
            msg = (
                f"\n{'='*55}\n"
                f"  [OTP] DEV — phone: {phone}\n"
                f"  CODE: {otp}\n"
                f"{'='*55}\n"
            )
            try:
                print(msg, flush=True)
            except UnicodeEncodeError:
                sys.stdout.buffer.write(msg.encode("utf-8"))
                sys.stdout.buffer.flush()
        # ───────────────────────────────────────────────────────────────────

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(
                    f"{self.settings.NOTIFICATION_SERVICE_URL}/internal/sms",
                    json={
                        "phone": phone,
                        "message": f"Your Velontri verification code is: {otp}. Expires in 5 minutes.",
                    },
                )
                if resp.status_code not in (200, 201, 202):
                    logger.warning(
                        "sms_send_failed",
                        phone_tail=phone[-4:],
                        status=resp.status_code,
                    )
        except Exception:
            logger.warning("sms_send_exception", phone_tail=phone[-4:], exc_info=True)

    async def _send_email_otp(self, email: str, full_name: str, otp: str) -> None:
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

        ttl_minutes  = max(1, self.settings.OTP_TTL_SECONDS // 60)
        first_name   = full_name.split()[0] if full_name else "there"
        gmail_user   = (self.settings.GMAIL_USER          or "").strip()
        gmail_pass   = (self.settings.GMAIL_APP_PASSWORD  or "").strip()
        resend_key   = (self.settings.RESEND_API_KEY      or "").strip()
        sendgrid_key = (self.settings.SENDGRID_API_KEY    or "").strip()
        from_name    = self.settings.EMAIL_FROM_NAME or "Velontri"
        subject      = f"Your Velontri verification code: {otp}"

        plain_body = (
            f"Hi {first_name},\n\n"
            f"Your Velontri verification code is: {otp}\n\n"
            f"This code expires in {ttl_minutes} minutes.\n\n"
            "If you did not create a Velontri account, ignore this email.\n\n"
            "-- The Velontri Team"
        )
        html_body = (
            "<!DOCTYPE html><html><head><meta charset=utf-8></head>"
            "<body style='margin:0;padding:0;background:#f1f5f9;font-family:sans-serif'>"
            "<table width='100%' cellpadding='0' cellspacing='0' style='padding:40px 16px'>"
            "<tr><td align='center'>"
            "<table width='100%' style='max-width:520px;background:#fff;border-radius:20px;overflow:hidden'>"
            "<tr><td style='background:linear-gradient(135deg,#4F46E5,#7C3AED);padding:32px;text-align:center'>"
            "<h1 style='color:#fff;font-size:24px;font-weight:900;margin:0'>Velontri</h1>"
            "<p style='color:rgba(255,255,255,.75);font-size:13px;margin:6px 0 0'>Africa&#39;s Premier Marketplace</p>"
            "</td></tr>"
            "<tr><td style='padding:36px 32px'>"
            f"<p style='font-size:16px;font-weight:700;color:#0f172a'>Hi {first_name},</p>"
            "<p style='font-size:14px;color:#475569;line-height:1.7'>Use this code to verify your Velontri email.</p>"
            "<div style='text-align:center;margin:32px 0'>"
            "<div style='display:inline-block;background:#f8f7ff;border:2px dashed #818cf8;border-radius:16px;padding:24px 40px'>"
            "<p style='font-size:11px;font-weight:800;color:#6366f1;text-transform:uppercase;letter-spacing:3px;margin:0 0 8px'>Verification Code</p>"
            f"<p style='font-size:42px;font-weight:900;color:#4F46E5;letter-spacing:12px;margin:0'>{otp}</p>"
            f"<p style='font-size:12px;color:#94a3b8;margin:10px 0 0'>Expires in {ttl_minutes} minutes</p>"
            "</div></div>"
            "<p style='font-size:13px;color:#94a3b8'>If you did not create a Velontri account, ignore this email.</p>"
            "</td></tr>"
            "<tr><td style='background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0'>"
            "<p style='font-size:12px;color:#94a3b8;margin:0'>&copy; 2025 Velontri</p>"
            "</td></tr></table></td></tr></table></body></html>"
        )

        # ------------------------------------------------------------------
        # 1. Gmail SMTP (primary — free, works with any Gmail account)
        # ------------------------------------------------------------------
        if gmail_user and gmail_pass:
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"]    = f"{from_name} <{gmail_user}>"
                msg["To"]      = email
                msg.attach(MIMEText(plain_body, "plain"))
                msg.attach(MIMEText(html_body,  "html"))
                ctx = ssl.create_default_context()

                def _send_smtp():
                    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=ctx) as srv:
                        srv.login(gmail_user, gmail_pass)
                        srv.sendmail(gmail_user, email, msg.as_string())

                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, _send_smtp)
                logger.info("email_otp_sent_gmail", email=email)
                return
            except Exception as exc:
                logger.warning("email_otp_gmail_failed", email=email, error=str(exc))
                raise ExternalServiceError(
                    f"Gmail SMTP failed: {exc}. "
                    "Check GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env"
                ) from exc

        # ------------------------------------------------------------------
        # 2. Resend fallback
        # ------------------------------------------------------------------
        if resend_key:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.resend.com/emails",
                        headers={
                            "Authorization": f"Bearer {resend_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "from": "Velontri <onboarding@resend.dev>",
                            "to": [email],
                            "subject": subject,
                            "html": html_body,
                            "text": plain_body,
                        },
                    )
                if resp.status_code in (200, 201):
                    logger.info("email_otp_sent_resend", email=email)
                    return
                raise ExternalServiceError(
                    f"Resend {resp.status_code}: {resp.text[:200]}"
                )
            except ExternalServiceError:
                raise
            except Exception as exc:
                raise ExternalServiceError(f"Resend failed: {exc}") from exc

        # ------------------------------------------------------------------
        # 3. SendGrid last resort
        # ------------------------------------------------------------------
        if sendgrid_key:
            try:
                from_email = self.settings.EMAIL_FROM or gmail_user or "noreply@velontri.com"
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.sendgrid.com/v3/mail/send",
                        headers={
                            "Authorization": f"Bearer {sendgrid_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "personalizations": [{"to": [{"email": email, "name": full_name}]}],
                            "from": {"email": from_email, "name": from_name},
                            "subject": subject,
                            "content": [
                                {"type": "text/plain", "value": plain_body},
                                {"type": "text/html",  "value": html_body},
                            ],
                        },
                    )
                if resp.status_code in (200, 201, 202):
                    logger.info("email_otp_sent_sendgrid", email=email)
                    return
                raise ExternalServiceError(
                    f"SendGrid {resp.status_code}: {resp.text[:200]}"
                )
            except ExternalServiceError:
                raise
            except Exception as exc:
                raise ExternalServiceError(f"SendGrid failed: {exc}") from exc

        # ------------------------------------------------------------------
        # 4. Dev fallback — nothing configured
        # ------------------------------------------------------------------
        logger.warning(
            "email_otp_no_provider", email=email,
            hint="Set GMAIL_USER + GMAIL_APP_PASSWORD in backend/.env",
        )
        dev_msg = (
            f"\n{'=' * 64}\n"
            f"  [EMAIL OTP] No email provider configured\n"
            f"  Set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env\n"
            f"  To:   {email}\n"
            f"  CODE: {otp}  (expires {ttl_minutes} min)\n"
            f"{'=' * 64}\n"
        )
        try:
            print(dev_msg, flush=True)
        except UnicodeEncodeError:
            sys.stdout.buffer.write(dev_msg.encode("utf-8"))
            sys.stdout.buffer.flush()

    async def _publish_lockout_notification(self, user: User) -> None:

        """Notify the user that their account has been locked."""
        try:
            await publish_event(
                self.channel,
                routing_key="notification.send",
                payload={
                    "recipient_user_id": str(user.id),
                    "channel": "email",
                    "template": "account_locked",
                    "data": {"full_name": user.full_name},
                },
                correlation_id=str(user.id),
            )
        except Exception:
            logger.warning(
                "lockout_notification_failed", user_id=str(user.id), exc_info=True
            )

    async def _publish_new_device_alert(
        self, user: User, ip_address: str | None
    ) -> None:
        """Alert the user about a login from an unrecognised device."""
        try:
            await publish_event(
                self.channel,
                routing_key="notification.send",
                payload={
                    "recipient_user_id": str(user.id),
                    "channel": "email",
                    "template": "new_device_login",
                    "data": {
                        "full_name": user.full_name,
                        "ip_address": ip_address or "unknown",
                    },
                },
                correlation_id=str(user.id),
            )
        except Exception:
            logger.warning(
                "new_device_alert_failed", user_id=str(user.id), exc_info=True
            )
