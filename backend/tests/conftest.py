"""Shared fixtures for the backend test suite."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.config import get_settings  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _settings() -> None:
    """Settings read backend/.env. Fail loudly if it is missing."""
    try:
        get_settings()
    except Exception as exc:  # pragma: no cover - configuration error
        pytest.exit(f"backend/.env is missing or invalid: {exc}", returncode=1)