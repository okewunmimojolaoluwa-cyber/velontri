#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Velontri Backend — Render startup script
# Runs the unified FastAPI gateway on port $PORT (Render sets this automatically)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Render sets $PORT — default to 8000 for local testing
PORT="${PORT:-8000}"

# Database path — use Render persistent disk if available, else current dir
DB_DIR="${DB_PATH:-/data}"
if [ ! -d "$DB_DIR" ]; then
    DB_DIR="$(pwd)"
fi
export SQLITE_DB_PATH="$DB_DIR/velontri.db"
echo "[startup] SQLite DB path: $SQLITE_DB_PATH"

# Set Python path so all service modules can be found
export PYTHONPATH="$(pwd):$(pwd)/scripts:$PYTHONPATH"

# Apply native stubs (SQLite + Redis in-memory + RabbitMQ no-op)
# These are already applied inside gateway/main.py via native_stubs.py

echo "[startup] Starting Velontri API Gateway on port $PORT..."
exec python -m uvicorn gateway.main:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --workers 1 \
    --log-level info \
    --no-access-log
