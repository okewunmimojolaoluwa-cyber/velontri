"""
Root conftest.py — ensures the workspace root is on sys.path so that
`import shared` works in all service test suites without needing a
pip-installed package.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Add workspace root to sys.path (parent of this file)
_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
