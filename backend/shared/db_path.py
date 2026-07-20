"""
Shared helper — returns the canonical SQLite database path.

Priority:
  1. SQLITE_DB_PATH env var (set by Render, or by native_stubs.py at startup)
  2. dev_gateway.db at the backend root (local dev fallback)
"""
from __future__ import annotations

import os
from pathlib import Path


def get_db_path() -> Path:
    """Return the absolute path to the SQLite database file."""
    env_path = os.environ.get("SQLITE_DB_PATH", "").strip()
    if env_path:
        return Path(env_path)
    # Fallback: walk up from this file to find the backend root
    here = Path(__file__).resolve()
    # shared/ is 2 levels deep: backend/shared/db_path.py → backend/
    backend_root = here.parents[1]
    return backend_root / "dev_gateway.db"
