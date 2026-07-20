#!/usr/bin/env python3
"""Debug JWT token generation."""
import jwt
import time
from pathlib import Path

# Load private key
private_key_path = Path("/run/secrets/jwt_private_key")
if not private_key_path.exists():
    # Try fallback location
    private_key_path = Path(__file__).resolve().parents[1] / "jwt_private_key.pem"

if not private_key_path.exists():
    print("JWT private key not found")
    exit(1)

private_key = private_key_path.read_text()

# Create test token
user_id = "34b1401f-6d07-41be-bdf5-eb4fbcb77ea0"
roles = ["enterprise_admin"]
subscription_tier = "enterprise"
branch_ids = []

now = int(time.time())
payload = {
    "sub": user_id,
    "aud": "velontri-platform",
    "iat": now,
    "exp": now + 900,
    "roles": roles,
    "subscription_tier": subscription_tier,
    "branch_ids": branch_ids,
}

token = jwt.encode(payload, private_key, algorithm="RS256")
print(f"JWT Token:")
print(token)
print(f"\nPayload:")
print(payload)
