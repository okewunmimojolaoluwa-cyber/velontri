"""
Shared helper — returns the canonical SQLite database path.

Priority:
  1. SQLITE_DB_PATH env var (if it's an absolute path that isn't the old dev fallback)
  2. Absolute path relative to the backend root (derived from __file__)

This module is intentionally simple — no imports from other shared modules.
"""
from __future__ import annotations

import os
from pathlib import Path


def get_db_path() -> Path:
    """Return the absolute path to the SQLite database file."""
    env_path = os.environ.get("SQLITE_DB_PATH", "").strip()
    if env_path and "dev_gateway" not in env_path and os.path.isabs(env_path):
        return Path(env_path)
    # Always resolve relative to the backend root (this file is backend/shared/db_path.py)
    # backend/shared/ → backend/
    backend_root = Path(__file__).resolve().parents[1]
    return backend_root / "velontri.db"
