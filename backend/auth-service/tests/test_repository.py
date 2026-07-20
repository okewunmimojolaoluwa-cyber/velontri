"""
Repository layer tests for the Auth Service.

Uses pytest-asyncio with an in-memory SQLite database for speed.
Tests that every repository function behaves correctly at the data layer —
including constraint enforcement, duplicate detection, and query correctness.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import Base
from app.repository import (
    activate_user,
    clear_lockout,
    create_otp,
    create_refresh_token,
    create_user,
    delete_device,
    get_or_create_device,
    get_refresh_token_by_hash,
    get_user_by_email,
    get_user_by_id,
    get_user_by_identifier,
    get_user_by_phone,
    get_valid_otp,
    list_devices,
    lock_user,
    mark_otp_used,
    revoke_all_refresh_tokens,
    revoke_refresh_token,
    update_password,
)
from app.security import hash_password, hash_otp
from shared.errors import AlreadyExistsError


# ── Test database setup ───────────────────────────────────────────────────────

@pytest_asyncio.fixture(scope="function")
async def async_session():
    """Create a fresh in-memory SQLite database for each test function.
    
    INET type is PostgreSQL-specific — override with String for SQLite tests.
    """
    from sqlalchemy.dialects.postgresql import INET
    from sqlalchemy import String
    from sqlalchemy import event

    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    # SQLite doesn't support INET — render as VARCHAR for tests
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_conn, _):
        pass  # no-op; INET override handled via column type patching

    # Patch INET columns in models to use String for SQLite
    from app.models import Device, LoginHistory, AuditLog
    for table in [Device.__table__, LoginHistory.__table__, AuditLog.__table__]:
        for col in table.columns:
            if hasattr(col.type, '__class__') and col.type.__class__.__name__ == 'INET':
                col.type = String(45)  # IPv6 max length

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(bind=engine, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()

    await engine.dispose()


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _create_test_user(session: AsyncSession, suffix: str = "") -> uuid.UUID:
    """Create a basic user and return their ID."""
    user = await create_user(
        session,
        email=f"test{suffix}@example.com",
        phone=f"+2348012{suffix.zfill(6)}",
        password_hash=hash_password("StrongPass1!"),
        full_name=f"Test User {suffix}",
        country_code="NG",
    )
    await session.commit()
    return user.id


# ── User repository tests ─────────────────────────────────────────────────────

class TestUserRepository:

    @pytest.mark.asyncio
    async def test_create_user_success(self, async_session) -> None:
        user = await create_user(
            async_session,
            email="create@example.com",
            phone="+2348011111111",
            password_hash=hash_password("StrongPass1!"),
            full_name="Create Test",
            country_code="NG",
        )
        await async_session.commit()
        assert user.id is not None
        assert user.is_active is False
        assert user.phone_verified is False
        assert user.failed_attempts == 0

    @pytest.mark.asyncio
    async def test_create_duplicate_email_raises(self, async_session) -> None:
        await create_user(
            async_session,
            email="dup@example.com",
            phone="+2348011111112",
            password_hash=hash_password("StrongPass1!"),
            full_name="Dup Test",
            country_code="NG",
        )
        await async_session.commit()

        with pytest.raises(AlreadyExistsError) as exc_info:
            await create_user(
                async_session,
                email="dup@example.com",  # same email
                phone="+2348011111113",
                password_hash=hash_password("StrongPass1!"),
                full_name="Dup Test 2",
                country_code="NG",
            )
        assert "email" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_create_duplicate_phone_raises(self, async_session) -> None:
        await create_user(
            async_session,
            email="first@example.com",
            phone="+2348099999999",
            password_hash=hash_password("StrongPass1!"),
            full_name="First",
            country_code="NG",
        )
        await async_session.commit()

        with pytest.raises(AlreadyExistsError) as exc_info:
            await create_user(
                async_session,
                email="second@example.com",
                phone="+2348099999999",  # same phone
                password_hash=hash_password("StrongPass1!"),
                full_name="Second",
                country_code="NG",
            )
        assert "phone" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_get_user_by_email(self, async_session) -> None:
        await _create_test_user(async_session, "001")
        user = await get_user_by_email(async_session, "test001@example.com")
        assert user is not None
        assert user.email == "test001@example.com"

    @pytest.mark.asyncio
    async def test_get_user_by_email_not_found(self, async_session) -> None:
        user = await get_user_by_email(async_session, "nonexistent@example.com")
        assert user is None

    @pytest.mark.asyncio
    async def test_get_user_by_phone(self, async_session) -> None:
        suffix = "002"
        user_id = await _create_test_user(async_session, suffix)
        phone = f"+2348012{suffix.zfill(6)}"  # matches _create_test_user format
        user = await get_user_by_phone(async_session, phone)
        assert user is not None
        assert user.id == user_id

    @pytest.mark.asyncio
    async def test_get_user_by_identifier_email(self, async_session) -> None:
        await _create_test_user(async_session, "003")
        user = await get_user_by_identifier(async_session, "test003@example.com")
        assert user is not None

    @pytest.mark.asyncio
    async def test_get_user_by_identifier_phone(self, async_session) -> None:
        suffix = "004"
        await _create_test_user(async_session, suffix)
        phone = f"+2348012{suffix.zfill(6)}"
        user = await get_user_by_identifier(async_session, phone)
        assert user is not None

    @pytest.mark.asyncio
    async def test_activate_user(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "005")
        await activate_user(async_session, user_id)
        await async_session.commit()
        user = await get_user_by_id(async_session, user_id)
        assert user.is_active is True
        assert user.phone_verified is True

    @pytest.mark.asyncio
    async def test_update_password(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "006")
        new_hash = hash_password("NewStrongPass1!")
        await update_password(async_session, user_id, new_hash)
        await async_session.commit()
        user = await get_user_by_id(async_session, user_id)
        assert user.password_hash == new_hash

    @pytest.mark.asyncio
    async def test_lock_and_clear_lockout(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "007")
        until = datetime.now(tz=timezone.utc) + timedelta(minutes=15)
        await lock_user(async_session, user_id, until)
        await async_session.commit()

        user = await get_user_by_id(async_session, user_id)
        assert user.is_locked is True

        await clear_lockout(async_session, user_id)
        await async_session.commit()
        user = await get_user_by_id(async_session, user_id)
        assert user.is_locked is False
        assert user.failed_attempts == 0


# ── OTP repository tests ──────────────────────────────────────────────────────

class TestOTPRepository:

    @pytest.mark.asyncio
    async def test_create_and_retrieve_valid_otp(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "otp001")
        otp_code = "123456"
        code_hash = hash_otp(otp_code)
        expires = datetime.now(tz=timezone.utc) + timedelta(minutes=5)

        await create_otp(async_session, user_id, "phone_verify", code_hash, expires)
        await async_session.commit()

        otp = await get_valid_otp(async_session, user_id, "phone_verify")
        assert otp is not None
        assert otp.code_hash == code_hash

    @pytest.mark.asyncio
    async def test_expired_otp_not_returned(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "otp002")
        expires = datetime.now(tz=timezone.utc) - timedelta(seconds=1)  # already expired

        await create_otp(async_session, user_id, "phone_verify", hash_otp("999999"), expires)
        await async_session.commit()

        otp = await get_valid_otp(async_session, user_id, "phone_verify")
        assert otp is None

    @pytest.mark.asyncio
    async def test_used_otp_not_returned(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "otp003")
        expires = datetime.now(tz=timezone.utc) + timedelta(minutes=5)

        otp = await create_otp(async_session, user_id, "phone_verify", hash_otp("111111"), expires)
        await async_session.commit()
        await mark_otp_used(async_session, otp.id)
        await async_session.commit()

        result = await get_valid_otp(async_session, user_id, "phone_verify")
        assert result is None

    @pytest.mark.asyncio
    async def test_new_otp_invalidates_previous(self, async_session) -> None:
        """Creating a new OTP for same user+purpose marks the old one as used."""
        user_id = await _create_test_user(async_session, "otp004")
        expires = datetime.now(tz=timezone.utc) + timedelta(minutes=5)

        old_otp = await create_otp(
            async_session, user_id, "phone_verify", hash_otp("111111"), expires
        )
        await async_session.commit()

        # Create a new OTP — should invalidate the old one
        new_otp = await create_otp(
            async_session, user_id, "phone_verify", hash_otp("222222"), expires
        )
        await async_session.commit()

        # Only the new OTP should be valid
        valid = await get_valid_otp(async_session, user_id, "phone_verify")
        assert valid.id == new_otp.id


# ── Refresh token repository tests ───────────────────────────────────────────

class TestRefreshTokenRepository:

    @pytest.mark.asyncio
    async def test_create_and_retrieve_refresh_token(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "rt001")
        token_hash = "a" * 64
        expires = datetime.now(tz=timezone.utc) + timedelta(days=7)

        await create_refresh_token(async_session, user_id, token_hash, "fp1", expires)
        await async_session.commit()

        rt = await get_refresh_token_by_hash(async_session, token_hash)
        assert rt is not None
        assert rt.user_id == user_id

    @pytest.mark.asyncio
    async def test_revoked_token_not_returned(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "rt002")
        token_hash = "b" * 64
        expires = datetime.now(tz=timezone.utc) + timedelta(days=7)

        await create_refresh_token(async_session, user_id, token_hash, "fp2", expires)
        await async_session.commit()
        await revoke_refresh_token(async_session, token_hash)
        await async_session.commit()

        rt = await get_refresh_token_by_hash(async_session, token_hash)
        assert rt is None

    @pytest.mark.asyncio
    async def test_revoke_all_tokens(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "rt003")
        expires = datetime.now(tz=timezone.utc) + timedelta(days=7)

        for i in range(3):
            await create_refresh_token(
                async_session, user_id, f"{'c' * 63}{i}", f"fp{i}", expires
            )
        await async_session.commit()

        await revoke_all_refresh_tokens(async_session, user_id)
        await async_session.commit()

        for i in range(3):
            rt = await get_refresh_token_by_hash(async_session, f"{'c' * 63}{i}")
            assert rt is None


# ── Device repository tests ───────────────────────────────────────────────────

class TestDeviceRepository:

    @pytest.mark.asyncio
    async def test_first_device_is_new(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "dev001")
        device, is_new = await get_or_create_device(
            async_session, user_id, "fp_abc123", "192.168.1.1", "TestAgent"
        )
        await async_session.commit()
        assert is_new is True
        assert device.fingerprint == "fp_abc123"

    @pytest.mark.asyncio
    async def test_same_device_not_new(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "dev002")
        await get_or_create_device(
            async_session, user_id, "fp_same", "10.0.0.1", "Agent"
        )
        await async_session.commit()

        _, is_new = await get_or_create_device(
            async_session, user_id, "fp_same", "10.0.0.2", "Agent"
        )
        await async_session.commit()
        assert is_new is False

    @pytest.mark.asyncio
    async def test_list_devices(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "dev003")
        for i in range(3):
            await get_or_create_device(
                async_session, user_id, f"fp_{i}", "10.0.0.1", "Agent"
            )
        await async_session.commit()

        devices = await list_devices(async_session, user_id)
        assert len(devices) == 3

    @pytest.mark.asyncio
    async def test_delete_device(self, async_session) -> None:
        user_id = await _create_test_user(async_session, "dev004")
        device, _ = await get_or_create_device(
            async_session, user_id, "fp_del", "10.0.0.1", "Agent"
        )
        await async_session.commit()

        deleted = await delete_device(async_session, device.id, user_id)
        await async_session.commit()
        assert deleted is True

        devices = await list_devices(async_session, user_id)
        assert len(devices) == 0

    @pytest.mark.asyncio
    async def test_delete_other_users_device_returns_false(
        self, async_session
    ) -> None:
        user1 = await _create_test_user(async_session, "dev005")
        user2 = await _create_test_user(async_session, "dev006")
        device, _ = await get_or_create_device(
            async_session, user1, "fp_user1", "10.0.0.1", "Agent"
        )
        await async_session.commit()

        # user2 tries to delete user1's device
        deleted = await delete_device(async_session, device.id, user2)
        assert deleted is False
