#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Velontri Backend — Render startup script
# ──────────────────────────────────────────────────────────────────────────────
set -eo pipefail   # removed -u so unset vars don't crash

# Render sets $PORT — default to 8000 for local testing
PORT="${PORT:-8000}"

# Database path — use Render persistent disk if available, else backend root
DB_DIR="${DB_PATH:-}"
if [ -z "$DB_DIR" ] || [ ! -d "$DB_DIR" ]; then
    DB_DIR="$(cd "$(dirname "$0")" && pwd)"
fi
export SQLITE_DB_PATH="$DB_DIR/velontri.db"
echo "[startup] SQLite DB path: $SQLITE_DB_PATH"

# Clear Python bytecode cache to prevent stale .pyc files
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find . -name "*.pyc" -delete 2>/dev/null || true
echo "[startup] Cleared Python bytecode cache"

# Set Python path — use existing value if set, otherwise build it
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
export PYTHONPATH="${PYTHONPATH:-}:${SRC_DIR}:${SRC_DIR}/scripts"

echo "[startup] PYTHONPATH: $PYTHONPATH"
echo "[startup] Starting Velontri API Gateway on port $PORT..."

exec python -B -m uvicorn gateway.app:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --workers 1 \
    --log-level info \
    --no-access-log
