"""Tests for vision pipeline — requires Ollama running with gemma4:e4b."""

import pytest
from folio.vision import extract_page, _parse_response
from folio.schemas import Page


class TestParseResponse:
    """Unit tests for JSON parsing (no Ollama needed)."""

    def test_valid_json(self):
        raw = '''{
            "text": "The cell wall provides support.",
            "headings": [{"level": 1, "text": "Cell Wall"}],
            "diagrams": [],
            "captions": []
        }'''
        page = _parse_response(raw, page_number=1)
        assert page is not None
        assert page.text == "The cell wall provides support."
        assert len(page.headings) == 1
        assert page.headings[0].text == "Cell Wall"

    def test_json_with_markdown_fences(self):
        raw = '''```json
{
    "text": "Hello world.",
    "headings": [],
    "diagrams": [],
    "captions": []
}
```'''
        page = _parse_response(raw, page_number=1)
        assert page is not None
        assert page.text == "Hello world."

    def test_invalid_json_returns_none(self):
        raw = "This is not JSON at all."
        page = _parse_response(raw, page_number=1)
        assert page is None

    def test_json_with_diagrams(self):
        raw = '''{
            "text": "Page content.",
            "headings": [],
            "diagrams": [{
                "id": "fig1",
                "label": "Figure 1: Cell",
                "description": "A plant cell with green chloroplasts.",
                "labels": ["chloroplast", "nucleus"]
            }],
            "captions": ["Figure 1: A plant cell."]
        }'''
        page = _parse_response(raw, page_number=2)
        assert page is not None
        assert len(page.diagrams) == 1
        assert page.diagrams[0].id == "fig1"
        assert "chloroplast" in page.diagrams[0].labels


@pytest.mark.integration
class TestExtractPageLive:
    """Integration tests that hit real Ollama. Run with: pytest -m integration"""

    @pytest.mark.asyncio
    async def test_extract_clear_page(self, sample_page_image):
        """V1.1: Fixture image → Page with non-empty text + ≥1 diagram."""
        page = await extract_page(sample_page_image, page_number=1, session_id="test")
        assert page.text, "Extracted text should not be empty"
        assert len(page.text) > 50, "Should extract substantial text"
        # The fixture has a plant cell chapter — check key terms
        text_lower = page.text.lower()
        assert any(
            term in text_lower
            for term in ["cell", "plant", "cellulose", "membrane", "wall"]
        ), f"Expected biology terms in: {page.text[:200]}"
