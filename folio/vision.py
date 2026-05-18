"""Vision pipeline — extract structured page data from textbook images using Gemma 4."""

from __future__ import annotations

import base64
import json
import logging
from pathlib import Path

import httpx

from .config import OLLAMA_URL, VISION_MODEL, CACHE_DIR, DEMO_MODE
from .schemas import Page, Heading, Diagram

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent / "prompts" / "extract_page.en.txt"
SYSTEM_PROMPT = PROMPT_PATH.read_text()


def _cache_key(page_number: int, session_id: str) -> Path:
    return CACHE_DIR / f"vision_{session_id}_p{page_number}.json"


async def extract_page(
    image_bytes: bytes,
    page_number: int,
    session_id: str = "default",
    lang: str = "en",
) -> Page:
    """Call Gemma 4 E4B vision to extract structured page data from an image.

    Returns a Page object with text, headings, diagrams, captions.
    On parse failure, retries once then degrades gracefully.
    """
    cache_path = _cache_key(page_number, session_id)

    if DEMO_MODE and cache_path.exists():
        logger.info(f"Demo mode: loading cached vision for page {page_number}")
        data = json.loads(cache_path.read_text())
        return Page(page_number=page_number, **data)

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": "Extract the page now. Output only the JSON.",
            "images": [image_b64],
        },
    ]

    raw_response = await _call_ollama(messages)
    page = _parse_response(raw_response, page_number)

    if page is None:
        retry_messages = messages + [
            {"role": "assistant", "content": raw_response},
            {
                "role": "user",
                "content": "Your previous JSON was malformed. Output strict JSON only, no markdown fences.",
            },
        ]
        raw_response = await _call_ollama(retry_messages)
        page = _parse_response(raw_response, page_number)

    if page is None:
        logger.warning(f"Vision parse failed twice for page {page_number}, degrading gracefully")
        page = Page(
            page_number=page_number,
            text=raw_response,
            headings=[],
            diagrams=[],
            captions=[],
        )

    # Cache the result for replay
    cache_path.write_text(json.dumps({
        "text": page.text,
        "headings": [h.model_dump() for h in page.headings],
        "diagrams": [d.model_dump() for d in page.diagrams],
        "captions": page.captions,
    }, indent=2))

    return page


async def _call_ollama(messages: list[dict]) -> str:
    """Send a chat completion request to Ollama and return raw text."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": VISION_MODEL,
                "messages": messages,
                "stream": False,
                "options": {"temperature": 0, "seed": 42},
            },
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]


def _parse_response(raw: str, page_number: int) -> Page | None:
    """Try to parse the LLM response as Page JSON. Returns None on failure."""
    text = raw.strip()
    # Remove markdown code fences
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    # Handle case where JSON is wrapped in other text
    if not text.startswith("{"):
        start = text.find("{")
        if start >= 0:
            end = text.rfind("}") + 1
            if end > start:
                text = text[start:end]

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None

    try:
        headings = [Heading(**h) for h in data.get("headings", []) if h]
        raw_diagrams = data.get("diagrams", [])
        diagrams = []
        for d in raw_diagrams:
            if not d:
                continue
            diagrams.append(Diagram(
                id=d.get("id") or "",
                label=d.get("label") or "",
                description=d.get("description") or "",
                labels=d.get("labels") or [],
            ))
        return Page(
            page_number=page_number,
            text=data.get("text", ""),
            headings=headings,
            diagrams=diagrams,
            captions=[c for c in data.get("captions", []) if c],
        )
    except (TypeError, KeyError, ValueError) as e:
        logger.warning(f"Page JSON parse error: {e}")
        return None
