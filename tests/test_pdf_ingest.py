"""Tests for PDF ingest endpoint."""

import pytest
from pathlib import Path
from httpx import ASGITransport, AsyncClient

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
async def client():
    from folio.api import app, SESSIONS
    SESSIONS.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestPdfIngest:
    @pytest.mark.asyncio
    async def test_pdf_ingest_returns_events(self, client):
        """PDF upload returns proper SSE events."""
        # Create session first
        resp = await client.post("/api/session", json={"mode": "tutor"})
        session_id = resp.json()["session_id"]

        pdf_path = FIXTURES_DIR / "test_chapter.pdf"
        if not pdf_path.exists():
            pytest.skip("test_chapter.pdf fixture not available")

        with open(pdf_path, "rb") as f:
            resp = await client.post(
                "/api/pdf",
                files={"pdf": ("test.pdf", f, "application/pdf")},
                data={"session_id": session_id, "start_page": "1", "end_page": "2"},
            )

        assert resp.status_code == 200
        body = resp.text
        assert "pdf_meta" in body
        assert "page_complete" in body
        assert "pdf_done" in body

    @pytest.mark.asyncio
    async def test_pdf_session_not_found(self, client):
        """PDF upload to nonexistent session returns 404."""
        pdf_path = FIXTURES_DIR / "test_chapter.pdf"
        if not pdf_path.exists():
            pytest.skip("test_chapter.pdf fixture not available")

        with open(pdf_path, "rb") as f:
            resp = await client.post(
                "/api/pdf",
                files={"pdf": ("test.pdf", f, "application/pdf")},
                data={"session_id": "nonexistent", "start_page": "1", "end_page": "1"},
            )
        assert resp.status_code == 404
