"""Vercel entrypoint: exposes the FastAPI `app` from backend/medlens/api.py."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "backend"))

from medlens.api import app  # noqa: E402,F401
