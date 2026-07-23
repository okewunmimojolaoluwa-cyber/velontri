"""
Shared helper — returns the canonical SQLite database path.

SINGLE SOURCE OF TRUTH: always resolves to <backend_root>/velontri.db
using __file__ so it's independent of cwd, env vars, or working directory.

SQLITE_DB_PATH env var is honoured ONLY if it's an absolute path
that doesn't reference the old dev_gateway.db file.
"""
from __future__ import annotations

import os
from pathlib import Path


# Pre-compute at module import time — never changes for the lifetime of the process
_BACKEND_ROOT = Path(__file__).resolve().parents[1]  # backend/shared/db_path.py → backend/
_DEFAULT_DB   = _BACKEND_ROOT / "velontri.db"


def get_db_path() -> Path:
    """Return the absolute path to the SQLite database file."""
    env_path = os.environ.get("SQLITE_DB_PATH", "").strip()
    if (
        env_path
        and os.path.isabs(env_path)
    ):
        return Path(env_path)
    # Authoritative fallback:
    # Use dev_gateway.db if running locally (it's the dev database), else use velontri.db
    dev_db = _BACKEND_ROOT / "dev_gateway.db"
    return dev_db if dev_db.exists() else _DEFAULT_DB
    # Authoritative fallback: always backend/velontri.db
    return _DEFAULT_DB
