"""Configuration for Folio — all env vars in one place."""

from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

OLLAMA_URL = os.getenv("FOLIO_OLLAMA_URL", "http://localhost:11434")
VISION_MODEL = os.getenv("FOLIO_VISION_MODEL", "gemma4:e4b")
TEXT_MODEL = os.getenv("FOLIO_TEXT_MODEL", "gemma4:e4b")
TTS_BACKEND = os.getenv("FOLIO_TTS", "say")
PORT = int(os.getenv("FOLIO_PORT", "8000"))
DEMO_MODE = os.getenv("FOLIO_DEMO_MODE", "0") == "1"
CACHE_DIR = Path(os.getenv("FOLIO_CACHE_DIR", str(BASE_DIR / "demos" / "cached_responses")))
MEDIA_DIR = Path(os.getenv("FOLIO_MEDIA_DIR", str(BASE_DIR / "media")))

MEDIA_DIR.mkdir(parents=True, exist_ok=True)
CACHE_DIR.mkdir(parents=True, exist_ok=True)
