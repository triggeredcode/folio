"""Tests for grounded Q&A — unit tests + integration tests."""

import pytest
from folio.ask import ask_grounded, _extract_citations, REFUSAL_SENTENCE


class TestCitationExtraction:
    """Unit tests for citation parsing (no Ollama needed)."""

    def test_extract_single_citation(self):
        text = "The cell wall provides support [page 1]."
        citations = _extract_citations(text)
        assert citations == [{"page": 1}]

    def test_extract_multiple_citations(self):
        text = "As seen in [page 1] and [page 3], the cell has a wall."
        citations = _extract_citations(text)
        assert len(citations) == 2
        assert {"page": 1} in citations
        assert {"page": 3} in citations

    def test_no_citations(self):
        text = "The cell wall provides support."
        citations = _extract_citations(text)
        assert citations == []

    def test_case_insensitive(self):
        text = "According to [Page 2], cells divide."
        citations = _extract_citations(text)
        assert citations == [{"page": 2}]

    def test_deduplicates(self):
        text = "See [page 1] and also [page 1] again."
        citations = _extract_citations(text)
        assert len(citations) == 1


@pytest.mark.integration
class TestAskGroundedLive:
    """Integration tests that hit real Ollama. Run with: pytest -m integration"""

    @pytest.mark.asyncio
    async def test_grounded_in_book(self, plant_cell_pages):
        """V1.2: Question about content in pages → non-empty answer with citations."""
        response = await ask_grounded(
            question="What is a ribosome and what does it do?",
            pages=plant_cell_pages,
            session_id="test_grounded",
        )
        assert response.answer, "Answer should not be empty"
        assert not response.not_in_book, "Answer should be found in book"
        answer_lower = response.answer.lower()
        assert any(
            term in answer_lower for term in ["ribosome", "protein", "synthesis"]
        ), f"Answer should mention ribosomes: {response.answer[:200]}"

    @pytest.mark.asyncio
    async def test_not_in_book(self, plant_cell_pages):
        """V1.3: Off-topic question → refusal sentence."""
        response = await ask_grounded(
            question="Who won the 2024 US presidential election?",
            pages=plant_cell_pages,
            session_id="test_not_in_book",
        )
        assert response.not_in_book, (
            f"Should refuse off-topic questions. Got: {response.answer[:200]}"
        )

    @pytest.mark.asyncio
    async def test_citations_present(self, plant_cell_pages):
        """V1.4: Answer contains at least one [page N] citation."""
        response = await ask_grounded(
            question="What is the structure of a mitochondrion?",
            pages=plant_cell_pages,
            session_id="test_citations",
        )
        assert len(response.citations) > 0, (
            f"Should have citations. Answer: {response.answer[:200]}"
        )
        assert any(
            c["page"] == 3 for c in response.citations
        ), "Should cite page 3 (mitochondria content)"
