"""Grounded Q&A — answer questions using only captured pages."""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

import httpx

from .config import OLLAMA_URL, TEXT_MODEL, CACHE_DIR, DEMO_MODE
from .retrieve import retrieve_pages
from .schemas import Page, AskResponse

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent / "prompts" / "grounded_answer.en.txt"
SYSTEM_PROMPT = PROMPT_PATH.read_text()

REFUSAL_SENTENCE = "This isn't covered in the captured pages."


def _cache_key(session_id: str, question: str) -> Path:
    slug = re.sub(r"[^a-z0-9]", "_", question.lower())[:60]
    return CACHE_DIR / f"ask_{session_id}_{slug}.json"


async def ask_grounded(
    question: str,
    pages: list[Page],
    session_id: str = "default",
) -> AskResponse:
    """Answer a question grounded only in the provided pages.

    Returns AskResponse with answer, citations, and not_in_book flag.
    """
    cache_path = _cache_key(session_id, question)

    if DEMO_MODE and cache_path.exists():
        logger.info(f"Demo mode: loading cached answer for '{question[:40]}...'")
        data = json.loads(cache_path.read_text())
        return AskResponse(**data)

    relevant_pages = retrieve_pages(question, pages)
    pages_used = [p.page_number for p in relevant_pages]

    context = _build_context(relevant_pages)
    prompt = f"=== Pages ===\n{context}\n\n=== Question ===\n{question}"

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    answer_text = await _call_ollama(messages)

    not_in_book = REFUSAL_SENTENCE.lower() in answer_text.lower()
    citations = _extract_citations(answer_text)

    response = AskResponse(
        answer=answer_text,
        citations=citations,
        not_in_book=not_in_book,
        pages_used=pages_used,
    )

    cache_path.write_text(response.model_dump_json(indent=2))

    return response


def _build_context(pages: list[Page]) -> str:
    """Build the pages context block for the prompt."""
    parts = []
    for page in pages:
        section = f"[Page {page.page_number}]\n{page.text}"
        if page.diagrams:
            diagrams_text = "\n".join(
                f"  Figure: {d.label} — {d.description}" for d in page.diagrams
            )
            section += f"\n\nDiagrams:\n{diagrams_text}"
        parts.append(section)
    return "\n\n".join(parts)


def _extract_citations(text: str) -> list[dict]:
    """Extract [page N] citations from answer text."""
    matches = re.findall(r"\[page\s+(\d+)\]", text, re.IGNORECASE)
    seen = set()
    citations = []
    for m in matches:
        page_num = int(m)
        if page_num not in seen:
            seen.add(page_num)
            citations.append({"page": page_num})
    return citations


async def _call_ollama(messages: list[dict]) -> str:
    """Send a text completion request to Ollama."""
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": TEXT_MODEL,
                "messages": messages,
                "stream": False,
                "options": {"temperature": 0, "seed": 42},
            },
        )
        resp.raise_for_status()
        return resp.json()["message"]["content"]
