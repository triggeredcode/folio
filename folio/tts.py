"""Text-to-Speech — macOS say or Piper backends."""

from __future__ import annotations

import asyncio
import hashlib
import logging
from pathlib import Path

from .config import TTS_BACKEND, MEDIA_DIR

logger = logging.getLogger(__name__)


async def synthesize(text: str, voice: str = "samantha") -> Path:
    """Generate speech audio from text. Returns path to WAV file.

    Uses macOS `say` by default, falls back to Piper if configured.
    """
    text_hash = hashlib.md5(text.encode()).hexdigest()[:12]
    out_path = MEDIA_DIR / f"tts_{text_hash}.wav"

    if out_path.exists():
        return out_path

    if TTS_BACKEND == "say":
        await _macos_say(text, voice, out_path)
    else:
        await _piper(text, voice, out_path)

    return out_path


async def _macos_say(text: str, voice: str, out_path: Path) -> None:
    """Use macOS say command for TTS."""
    voice_map = {
        "samantha": "Samantha",
        "karen": "Karen",
        "daniel": "Daniel",
    }
    voice_name = voice_map.get(voice.lower(), "Samantha")

    proc = await asyncio.create_subprocess_exec(
        "say", "-v", voice_name,
        "-o", str(out_path),
        "--data-format=LEF32@22050",
        text[:5000],  # say has practical limits
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        logger.error(f"macOS say failed: {stderr.decode()}")
        raise RuntimeError(f"TTS failed: {stderr.decode()}")


async def _piper(text: str, voice: str, out_path: Path) -> None:
    """Use Piper TTS for cross-platform/non-English."""
    model_map = {
        "piper_en": "en_US-lessac-medium",
        "piper_hi_IN": "hi_IN-medium",
    }
    model = model_map.get(voice, "en_US-lessac-medium")

    proc = await asyncio.create_subprocess_exec(
        "piper",
        "--model", model,
        "--output_file", str(out_path),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate(input=text.encode())
    if proc.returncode != 0:
        logger.error(f"Piper TTS failed: {stderr.decode()}")
        raise RuntimeError(f"Piper TTS failed: {stderr.decode()}")
