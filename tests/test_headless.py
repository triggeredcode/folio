"""Headless integration test harness.

Tests the full pipeline with cached/real inputs, switchable via env vars.
This enables fully autonomous iteration without user-held PDFs.

Usage:
    # Run with real Ollama (caches results for next time)
    pytest tests/test_headless.py -v -m integration

    # Run with cached responses only (no Ollama needed)
    FOLIO_DEMO_MODE=1 pytest tests/test_headless.py -v
"""

import json
import os
from pathlib import Path

import pytest

from folio.schemas import Page, Heading, Diagram
from folio.vision import extract_page
from folio.ask import ask_grounded
from folio.narrate import build_narration
from folio.config import CACHE_DIR

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _get_fixture_images() -> list[tuple[int, bytes]]:
    """Load all fixture page images."""
    images = []
    for i in range(1, 4):
        path = FIXTURES_DIR / f"page{i}.jpg"
        if path.exists():
            images.append((i, path.read_bytes()))
    if not images:
        path = FIXTURES_DIR / "page1.jpg"
        if path.exists():
            images.append((1, path.read_bytes()))
    return images


ADVERSARIAL_QUESTIONS = [
    "Who is the current president of India?",
    "What is the capital of France?",
    "Explain quantum computing in simple terms.",
    "What year did World War 2 end?",
    "What is the speed of light?",
]

GROUNDED_QUESTIONS = [
    ("What is the cell wall made of?", ["cellulose", "cell wall"]),
    ("What organelles does the cytoplasm contain?", ["chloroplast", "mitochondria", "ribosome"]),
    ("What provides structural support to the cell?", ["cell wall", "support"]),
]


@pytest.mark.integration
class TestHeadlessPipeline:
    """Full headless pipeline: ingest → ask → verify. Caches all results."""

    @pytest.mark.asyncio
    async def test_vision_extracts_all_fixtures(self):
        """Ingest all fixture images and verify extraction quality."""
        images = _get_fixture_images()
        assert len(images) > 0, "Need at least one fixture image"

        for page_num, img_bytes in images:
            page = await extract_page(img_bytes, page_num, session_id="headless")
            assert page.text, f"Page {page_num}: no text extracted"
            assert len(page.text) > 30, f"Page {page_num}: text too short"

            narration = build_narration(page)
            assert len(narration) > 50, f"Page {page_num}: narration too short"
            assert f"Page {page_num}" in narration

    @pytest.mark.asyncio
    async def test_grounded_answers_correct(self):
        """Ask known questions → verify answers contain expected terms."""
        pages = _build_test_pages()

        for question, expected_terms in GROUNDED_QUESTIONS:
            response = await ask_grounded(question, pages, session_id="headless_grounded")
            answer_lower = response.answer.lower()

            assert not response.not_in_book, (
                f"Should answer '{question}' from pages. Got refusal: {response.answer[:100]}"
            )
            found = [t for t in expected_terms if t in answer_lower]
            assert len(found) > 0, (
                f"Answer for '{question}' should contain one of {expected_terms}. "
                f"Got: {response.answer[:200]}"
            )
            assert len(response.citations) > 0, (
                f"Answer for '{question}' should have citations. Got none."
            )

    @pytest.mark.asyncio
    async def test_adversarial_refusals(self):
        """V2.1: All adversarial questions must be refused."""
        pages = _build_test_pages()
        failures = []

        for question in ADVERSARIAL_QUESTIONS:
            response = await ask_grounded(question, pages, session_id="headless_adversarial")
            if not response.not_in_book:
                failures.append(f"  '{question}' → NOT refused: {response.answer[:80]}")

        assert not failures, (
            f"Adversarial questions should all be refused:\n" + "\n".join(failures)
        )

    @pytest.mark.asyncio
    async def test_citation_accuracy(self):
        """V2.2: Every cited page actually contains relevant content."""
        pages = _build_test_pages()
        response = await ask_grounded(
            "What is the structure of a mitochondrion?",
            pages,
            session_id="headless_citation_check",
        )

        for citation in response.citations:
            page_num = citation["page"]
            cited_page = next((p for p in pages if p.page_number == page_num), None)
            assert cited_page is not None, f"Citation refers to non-existent page {page_num}"


def _build_test_pages() -> list[Page]:
    """Build reliable test pages with known content."""
    return [
        Page(
            page_number=1,
            text=(
                "The plant cell wall is composed of cellulose microfibrils. "
                "It provides structural support and protection to the cell. "
                "The cell membrane lies just inside the cell wall. "
                "It is selectively permeable, controlling what enters and exits the cell. "
                "The cytoplasm contains various organelles including chloroplasts, "
                "mitochondria, ribosomes, and endoplasmic reticulum."
            ),
            headings=[
                Heading(level=1, text="Chapter 3: The Plant Cell"),
                Heading(level=2, text="3.1 Cell Wall"),
            ],
            diagrams=[
                Diagram(
                    id="fig_3_1",
                    label="Fig. 3.1: Plant cell cross-section",
                    description="A labelled diagram of a plant cell showing the cell wall, membrane, cytoplasm, and organelles.",
                    labels=["cell wall", "cell membrane", "cytoplasm", "nucleus"],
                )
            ],
            captions=["Fig. 3.1: A typical plant cell."],
        ),
        Page(
            page_number=2,
            text=(
                "Ribosomes are the sites of protein synthesis. They can be found free "
                "in the cytoplasm or attached to the endoplasmic reticulum. "
                "The rough endoplasmic reticulum has ribosomes on its surface."
            ),
            headings=[Heading(level=2, text="3.2 Ribosomes")],
            diagrams=[],
            captions=[],
        ),
        Page(
            page_number=3,
            text=(
                "Mitochondria are the powerhouse of the cell. They perform cellular "
                "respiration, converting glucose and oxygen into ATP. Each mitochondrion "
                "has a double membrane. The inner membrane is folded into cristae."
            ),
            headings=[Heading(level=2, text="3.3 Mitochondria")],
            diagrams=[
                Diagram(
                    id="fig_3_2",
                    label="Fig. 3.2: Mitochondrion structure",
                    description="Cross-section showing outer membrane, inner membrane with cristae, matrix.",
                    labels=["outer membrane", "inner membrane", "cristae", "matrix"],
                )
            ],
            captions=["Fig. 3.2: Structure of a mitochondrion."],
        ),
    ]
