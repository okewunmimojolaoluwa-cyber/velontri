#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Velontri Backend — Render startup script
# ──────────────────────────────────────────────────────────────────────────────
set -eo pipefail

# ── Resolve backend directory (where this script lives) ──────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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
