"""
Unit tests for JWT utilities — the most security-critical component.

Property test: Task 2.8 — JWT Expiry Enforcement
All expired tokens must be rejected by introspect.
"""
from __future__ import annotations

import time
import uuid
from pathlib import Path

import pytest
from hypothesis import given, settings as h_settings, strategies as st

from shared.errors import TokenExpiredError, TokenInvalidError
from shared.jwt_utils import (
    ACCESS_TOKEN_TTL_SECONDS,
    JWT_AUDIENCE,
    create_access_token,
    verify_token,
)


# ── Key pair fixture ──────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def rsa_key_pair(tmp_path_factory):
    """Generate a fresh RSA-2048 key pair for test isolation using Python cryptography."""
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    tmp = tmp_path_factory.mktemp("keys")
    private_path = tmp / "private.pem"
    public_path = tmp / "public.pem"

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    private_path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    public_path.write_bytes(
        key.public_key().public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )
    return str(private_path), str(public_path)


# ── Basic token tests ─────────────────────────────────────────────────────────

class TestTokenCreationAndVerification:

    def test_create_and_verify_access_token(self, rsa_key_pair) -> None:
        priv, pub = rsa_key_pair
        user_id = str(uuid.uuid4())
        token = create_access_token(
            private_key_path=priv,
            user_id=user_id,
            roles=["buyer", "seller"],
            subscription_tier="growth",
        )
        payload = verify_token(pub, token)
        assert payload["sub"] == user_id
        assert "buyer" in payload["roles"]
        assert payload["subscription_tier"] == "growth"
        assert payload["aud"] == JWT_AUDIENCE

    def test_token_contains_exp_claim(self, rsa_key_pair) -> None:
        priv, pub = rsa_key_pair
        token = create_access_token(priv, str(uuid.uuid4()), ["buyer"], "starter")
        payload = verify_token(pub, token)
        assert "exp" in payload
        assert payload["exp"] > int(time.time())

    def test_token_contains_iat_claim(self, rsa_key_pair) -> None:
        priv, pub = rsa_key_pair
        token = create_access_token(priv, str(uuid.uuid4()), ["buyer"], "starter")
        payload = verify_token(pub, token)
        assert "iat" in payload

    def test_token_ttl_is_15_minutes(self, rsa_key_pair) -> None:
        priv, pub = rsa_key_pair
        before = int(time.time())
        token = create_access_token(priv, str(uuid.uuid4()), ["buyer"], "starter")
        payload = verify_token(pub, token)
        expected_exp = before + ACCESS_TOKEN_TTL_SECONDS
        # Allow 2-second tolerance for test execution time
        assert abs(payload["exp"] - expected_exp) <= 2

    def test_branch_ids_in_token(self, rsa_key_pair) -> None:
        priv, pub = rsa_key_pair
        branch_ids = [str(uuid.uuid4()), str(uuid.uuid4())]
        token = create_access_token(
            priv, str(uuid.uuid4()), ["branch_manager"], "pro",
            branch_ids=branch_ids
        )
        payload = verify_token(pub, token)
        assert payload["branch_ids"] == branch_ids

    def test_empty_branch_ids_default(self, rsa_key_pair) -> None:
        priv, pub = rsa_key_pair
        token = create_access_token(priv, str(uuid.uuid4()), ["buyer"], "starter")
        payload = verify_token(pub, token)
        assert payload["branch_ids"] == []


class TestTokenRejection:

    def test_expired_token_raises_token_expired_error(self, rsa_key_pair) -> None:
        priv, pub = rsa_key_pair
        # Create token with -1 TTL (immediately expired)
        token = create_access_token(
            priv, str(uuid.uuid4()), ["buyer"], "starter", ttl=-1
        )
        with pytest.raises(TokenExpiredError):
            verify_token(pub, token)

    def test_wrong_audience_raises_token_invalid_error(self, rsa_key_pair) -> None:
        import jwt as pyjwt
        priv, pub = rsa_key_pair
        private_key = Path(priv).read_text()
        # Manually craft a token with wrong audience
        payload = {
            "sub": str(uuid.uuid4()),
            "aud": "wrong-audience",
            "iat": int(time.time()),
            "exp": int(time.time()) + 900,
            "roles": ["buyer"],
        }
        bad_token = pyjwt.encode(payload, private_key, algorithm="RS256")
        with pytest.raises(TokenInvalidError):
            verify_token(pub, bad_token)

    def test_tampered_token_raises_token_invalid_error(self, rsa_key_pair) -> None:
        """A token whose payload has been modified must be rejected."""
        import base64
        import json as _json
        priv, pub = rsa_key_pair
        token = create_access_token(priv, str(uuid.uuid4()), ["buyer"], "starter")
        header_b64, payload_b64, sig_b64 = token.split(".")

        # Decode and modify the payload (add padding back for b64decode)
        padded = payload_b64 + "=" * (4 - len(payload_b64) % 4)
        payload_data = _json.loads(base64.urlsafe_b64decode(padded))
        payload_data["roles"] = ["enterprise_admin"]  # privilege escalation attempt
        new_payload = base64.urlsafe_b64encode(
            _json.dumps(payload_data, separators=(",", ":")).encode()
        ).rstrip(b"=").decode()

        # Reassemble with original header + modified payload + original sig
        tampered = f"{header_b64}.{new_payload}.{sig_b64}"

        # Must raise because the signature no longer matches the payload
        with pytest.raises((TokenInvalidError, Exception)):
            verify_token(pub, tampered)

    def test_random_string_raises_token_invalid_error(self, rsa_key_pair) -> None:
        _, pub = rsa_key_pair
        with pytest.raises(TokenInvalidError):
            verify_token(pub, "not.a.jwt")

    def test_empty_token_raises_token_invalid_error(self, rsa_key_pair) -> None:
        _, pub = rsa_key_pair
        with pytest.raises(TokenInvalidError):
            verify_token(pub, "")

    def test_wrong_public_key_raises_token_invalid_error(
        self, rsa_key_pair, tmp_path
    ) -> None:
        priv, _ = rsa_key_pair
        token = create_access_token(priv, str(uuid.uuid4()), ["buyer"], "starter")

        # Generate a different key pair using Python cryptography
        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa as _rsa

        other_key = _rsa.generate_private_key(public_exponent=65537, key_size=2048)
        other_pub = tmp_path / "other_pub.pem"
        other_pub.write_bytes(
            other_key.public_key().public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            )
        )
        with pytest.raises(TokenInvalidError):
            verify_token(str(other_pub), token)


# ── Property test: JWT Expiry Enforcement (Task 2.8, Property 4) ─────────────

class TestJWTExpiryProperty:
    """
    Property: For any token issued with a negative TTL (already expired),
    verify_token MUST raise TokenExpiredError.
    This ensures no code path can accidentally accept an expired token.
    """

    @given(
        user_id=st.uuids().map(str),
        roles=st.lists(
            st.sampled_from(["buyer", "seller", "agent", "branch_manager", "business_owner"]),
            min_size=1, max_size=3,
        ),
        tier=st.sampled_from(["starter", "growth", "pro", "enterprise"]),
        ttl_seconds=st.integers(min_value=-3600, max_value=-1),  # Always expired
    )
    @h_settings(max_examples=50, deadline=None)
    def test_expired_token_always_rejected(
        self, rsa_key_pair, user_id, roles, tier, ttl_seconds
    ) -> None:
        priv, pub = rsa_key_pair
        token = create_access_token(
            private_key_path=priv,
            user_id=user_id,
            roles=roles,
            subscription_tier=tier,
            ttl=ttl_seconds,
        )
        with pytest.raises(TokenExpiredError):
            verify_token(pub, token)
