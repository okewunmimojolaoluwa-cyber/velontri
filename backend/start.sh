#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Velontri Backend — Render startup script
# ──────────────────────────────────────────────────────────────────────────────
set -eo pipefail   # removed -u so unset vars don't crash

# Render sets $PORT — default to 8000 for local testing
PORT="${PORT:-8000}"

# Database path — use Render persistent disk if available, else cwd
DB_DIR="${DB_PATH:-}"
if [ -z "$DB_DIR" ] || [ ! -d "$DB_DIR" ]; then
    DB_DIR="$(pwd)"
fi
export SQLITE_DB_PATH="$DB_DIR/velontri.db"
echo "[startup] SQLite DB path: $SQLITE_DB_PATH"

# Set Python path — use existing value if set, otherwise build it
SRC_DIR="$(pwd)"
export PYTHONPATH="${PYTHONPATH:-}:${SRC_DIR}:${SRC_DIR}/scripts"

echo "[startup] PYTHONPATH: $PYTHONPATH"
echo "[startup] Starting Velontri API Gateway on port $PORT..."

exec python -m uvicorn gateway.main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --workers 1 \
    --log-level info \
    --no-access-log
