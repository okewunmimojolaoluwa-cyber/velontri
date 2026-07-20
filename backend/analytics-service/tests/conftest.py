"""Pytest configuration for Analytics Service tests."""
from __future__ import annotations
import sys
from pathlib import Path

_WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
if str(_WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(_WORKSPACE_ROOT))

pytest_plugins = ["pytest_asyncio"]
