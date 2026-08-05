#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Velontri Backend — Render startup script
# ──────────────────────────────────────────────────────────────────────────────
set -eo pipefail

# ── Resolve backend directory (where this script lives) ──────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Stable JWT keys ───────────────────────────────────────────────────────────
# These keys are baked in so tokens survive every Render redeploy.
# Env vars JWT_PRIVATE_KEY / JWT_PUBLIC_KEY still override if set in dashboard.
mkdir -p secrets

if [ -n "${JWT_PRIVATE_KEY:-}" ]; then
    printf '%s' "${JWT_PRIVATE_KEY}" > secrets/jwt_private_key.pem
    echo "[startup] Restored JWT_PRIVATE_KEY from environment variable"
else
    cat > secrets/jwt_private_key.pem << 'ENDOFKEY'
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAtJFxJGJcBWeZ7DduECVK9kuA1BOnYcez3lPt68o+ANFU+I1S
/a2dHGncRUVzlr15V+IKrsMr4YuotUeOi5zaJD4Zz4IIS8Fly6g/0jbUJd5pD+Bs
5b+6qJMicOJspSnSRi5lft19ModJHmEvCFCzwEBkuwRZ6HbPoY/Faid+LuCPTqna
zVtnc8K4DJc3F3qZev5sXX6BySfgTtoELWaZdEiSrRaIYWb4woGdFhifWGk2F+D6
Ssm8bS8TSIomtWaQ1JzT02YyMO2mDLqV8QHdCnOHMi0ctAwQOOUCQvlYnv/Y6kBF
vSylCksJjTujp8XaQqmQriQvt2AKicWboESLYwIDAQABAoIBADxAlfTyn0ssZVfF
rUPU9d0Wl6/suPsvRK1I60i1TRg/wa9IlStR/e2Hw3kX8jiYFAAHzNHBDYju7cZD
0OR0W/QhBsLP3I3OxHV/OICgTA0w2HT0SdImNpZetmzdmSxJtsE1ZSe+p7KvIu5w
tl17dGeP9SzUiF3CG4mJLHI+KGRieUxOaHysUoHXTxOccSsbexj24ezvr8CQcy4+
caAzO4Ddu6osOVIS00Dh7A6yNqeIfbBeRgrWlatJ7LSSZ2De//DRAgfGtyDRTTxu
nX00d58LC35v+s0O7aW8d/JghF7D1SMjbqazK5imFwGQdDIP7k6r3PoHG/MTvoZe
+zeXn1UCgYEA62ATud0s9czA2Symov4ortkxwt3sKDbBtVr87VwNAExhQh6p+Re4
b83qVMWcVEEmQutk4jggwLFalPQDZJVty/+v8K3gQ/HWrJPc9sBjFKGTSDZ7XsAL
7ExvxBcRPH+ehm4Wj/LSPnsvHle4qZByfutfYhszs9BX/7U5+4Rw8u0CgYEAxGPv
JuPSXxuNSEYQzAN95RP4ud2r941B9QxqjM3i9sCyn8SzqIFxdY48C0O0c0sbcDv0
gaapbBe0xPXcoXYDxmiMdsiW7Gt8obZ9VpDgSCYqW8Bv6JxOQpkjA/ItZBKANeSD
LCJUDWTb1KSs6uzk/zF/7gnJdhCOr/hd4cNIHY8CgYEAweLtvOANZhiZDwxx47fb
CVTOYcfu/Z1Fab+es2NtLj68qvuZZh/9BNQpYFU7lkfoXZ2MB7DWggRWKnbqyJMy
06U2Z9rC7xUqkhRnIzeNJnSGXyjJ7V3jNG4ubufVgfFaQ0AyA7exKljMkoEOE1dy
iUwX0Te5GjjYFEJTlfUeGW0CgYEAmB48IOh4i7ign6m92vidbHIix30fdblRrIi4
g2X6dlzePwiyjEPvaToJ4kPII0G6+B1Ij6BTPOnD2IgEJIBv/h//JQbMeEXtnKjo
vsOrJdeCGd2eERP5Pna1e5n7dLcr3hKpU+cnKdTEvhnr4nAqFEz4JZ4pES1UCJOd
zIBhfJsCgYBlnKQzai3tDLG/1kUk74Dd2kJdFGREFfHnKb8nCSto5unFWYBB4DtO
Y9orhuDKuWiD51ZKMUkwV5FPoBi1dDAmFEO8Pkjjf+CgjApVl4LAKPcyYXajYl6s
iQfHaRUE9VDNqSju0dHawMvz8Eg4dJg5m44GGOxryBDqvEuKZk1XkQ==
-----END RSA PRIVATE KEY-----
ENDOFKEY
    echo "[startup] Using baked-in JWT private key (stable across deploys)"
fi

if [ -n "${JWT_PUBLIC_KEY:-}" ]; then
    printf '%s' "${JWT_PUBLIC_KEY}" > secrets/jwt_public_key.pem
    echo "[startup] Restored JWT_PUBLIC_KEY from environment variable"
else
    cat > secrets/jwt_public_key.pem << 'ENDOFKEY'
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtJFxJGJcBWeZ7DduECVK
9kuA1BOnYcez3lPt68o+ANFU+I1S/a2dHGncRUVzlr15V+IKrsMr4YuotUeOi5za
JD4Zz4IIS8Fly6g/0jbUJd5pD+Bs5b+6qJMicOJspSnSRi5lft19ModJHmEvCFCz
wEBkuwRZ6HbPoY/Faid+LuCPTqnazVtnc8K4DJc3F3qZev5sXX6BySfgTtoELWaZ
dEiSrRaIYWb4woGdFhifWGk2F+D6Ssm8bS8TSIomtWaQ1JzT02YyMO2mDLqV8QHd
CnOHMi0ctAwQOOUCQvlYnv/Y6kBFvSylCksJjTujp8XaQqmQriQvt2AKicWboESL
YwIDAQAB
-----END PUBLIC KEY-----
ENDOFKEY
    echo "[startup] Using baked-in JWT public key (stable across deploys)"
fi

export JWT_PRIVATE_KEY_PATH="${SCRIPT_DIR}/secrets/jwt_private_key.pem"
export JWT_PUBLIC_KEY_PATH="${SCRIPT_DIR}/secrets/jwt_public_key.pem"

# ── Port ──────────────────────────────────────────────────────────────────────
PORT="${PORT:-8000}"

# ── SQLite DB path — always next to this script (backend/velontri.db) ─────────
export SQLITE_DB_PATH="${SCRIPT_DIR}/velontri.db"
echo "[startup] SQLite DB path: $SQLITE_DB_PATH"

# ── Python path ───────────────────────────────────────────────────────────────
export PYTHONPATH="${SCRIPT_DIR}:${SCRIPT_DIR}/scripts${PYTHONPATH:+:$PYTHONPATH}"
echo "[startup] PYTHONPATH: $PYTHONPATH"

# ── Wipe all Python bytecode caches — forces Render to run fresh .py files ───
find "${SCRIPT_DIR}" -type d -name __pycache__ | xargs rm -rf 2>/dev/null || true
find "${SCRIPT_DIR}" -name "*.pyc" -delete 2>/dev/null || true
echo "[startup] Cleared Python bytecode cache"

echo "[startup] Starting Velontri API Gateway on port $PORT..."

# -B = never write .pyc files; gateway.app is the clean entry point
exec python -B -m uvicorn gateway.app:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --workers 1 \
    --log-level info \
    --no-access-log
