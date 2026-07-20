"""
Pytest configuration for Auth Service tests.

Provides:
- Async test support via pytest-asyncio
- In-memory SQLite engine for repository tests (fast, no external deps)
- Mock Redis and RabbitMQ for service tests
"""
from __future__ import annotations

import sys
from pathlib import Path

# Add workspace root to sys.path so `import shared` works without pip install
_WORKSPACE_ROOT = Path(__file__).resolve().parents[2]
if str(_WORKSPACE_ROOT) not in sys.path:
    sys.path.insert(0, str(_WORKSPACE_ROOT))

import pytest
import pytest_asyncio

# Configure pytest-asyncio to use asyncio mode for all tests
pytest_plugins = ["pytest_asyncio"]


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
