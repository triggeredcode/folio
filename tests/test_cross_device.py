"""Integration tests for cross-device page upload, relay, and session management."""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client():
    from folio.api import app, SESSIONS
    SESSIONS.clear()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    SESSIONS.clear()


@pytest.fixture
def test_image() -> bytes:
    """Minimal JPEG for testing."""
    from PIL import Image
    import io
    img = Image.new("RGB", (100, 100), "white")
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestActiveSessions:
    @pytest.mark.asyncio
    async def test_no_sessions(self, client):
        r = await client.get("/api/sessions/active")
        assert r.status_code == 200
        assert r.json()["sessions"] == []

    @pytest.mark.asyncio
    async def test_lists_sessions(self, client):
        await client.post("/api/session", json={"mode": "tutor"})
        await client.post("/api/session", json={"mode": "reader"})
        r = await client.get("/api/sessions/active")
        sessions = r.json()["sessions"]
        assert len(sessions) == 2
        assert sessions[0]["mode"] in ("tutor", "reader")

    @pytest.mark.asyncio
    async def test_most_recent_first(self, client):
        import asyncio
        await client.post("/api/session", json={"mode": "tutor"})
        await asyncio.sleep(0.01)
        r2 = await client.post("/api/session", json={"mode": "reader"})
        sid2 = r2.json()["session_id"]
        r = await client.get("/api/sessions/active")
        sessions = r.json()["sessions"]
        assert sessions[0]["session_id"] == sid2


class TestCrossDeviceRelay:
    """Simulate: PC creates session -> phone uploads page -> PC fetches pages."""

    @pytest.mark.asyncio
    async def test_upload_and_fetch_pages(self, client, test_image):
        r = await client.post("/api/session", json={"mode": "tutor"})
        sid = r.json()["session_id"]

        r_upload = await client.post(
            "/api/page",
            data={"session_id": sid, "page_number": "1"},
            files={"image": ("page.jpg", test_image, "image/jpeg")},
        )
        assert r_upload.status_code == 200

        r_pages = await client.get(f"/api/session/{sid}/pages")
        assert r_pages.status_code == 200
        data = r_pages.json()
        assert data["page_count"] >= 1
        assert any(p["page_number"] == 1 for p in data["pages"])

    @pytest.mark.asyncio
    async def test_multiple_uploads_unique_page_ids(self, client, test_image):
        """Upload 3 pages — all must have unique page_ids."""
        r = await client.post("/api/session", json={"mode": "tutor"})
        sid = r.json()["session_id"]

        for i in range(1, 4):
            await client.post(
                "/api/page",
                data={"session_id": sid, "page_number": str(i)},
                files={"image": ("page.jpg", test_image, "image/jpeg")},
            )

        r_pages = await client.get(f"/api/session/{sid}/pages")
        pages = r_pages.json()["pages"]
        assert len(pages) == 3

        page_ids = [p["page_id"] for p in pages]
        assert len(set(page_ids)) == 3, f"Duplicate page_ids found: {page_ids}"

    @pytest.mark.asyncio
    async def test_auto_page_number(self, client, test_image):
        """Backend auto-assigns page_number when -1 is sent."""
        r = await client.post("/api/session", json={"mode": "tutor"})
        sid = r.json()["session_id"]

        await client.post(
            "/api/page",
            data={"session_id": sid, "page_number": "-1"},
            files={"image": ("page.jpg", test_image, "image/jpeg")},
        )
        await client.post(
            "/api/page",
            data={"session_id": sid, "page_number": "-1"},
            files={"image": ("page.jpg", test_image, "image/jpeg")},
        )

        r_pages = await client.get(f"/api/session/{sid}/pages")
        pages = r_pages.json()["pages"]
        assert len(pages) == 2
        page_nums = sorted([p["page_number"] for p in pages])
        assert page_nums == [1, 2]

    @pytest.mark.asyncio
    async def test_page_image_served(self, client, test_image):
        """Uploaded page image can be retrieved via GET."""
        r = await client.post("/api/session", json={"mode": "tutor"})
        sid = r.json()["session_id"]

        await client.post(
            "/api/page",
            data={"session_id": sid, "page_number": "1"},
            files={"image": ("page.jpg", test_image, "image/jpeg")},
        )

        r_img = await client.get(f"/api/session/{sid}/page/1/image")
        assert r_img.status_code == 200
        assert r_img.headers["content-type"] in ("image/jpeg", "image/png")
        assert len(r_img.content) > 0


class TestTopicsEndpoint:
    @pytest.mark.asyncio
    async def test_topics_with_pages(self, client, test_image):
        r = await client.post("/api/session", json={"mode": "tutor"})
        sid = r.json()["session_id"]

        await client.post(
            "/api/page",
            data={"session_id": sid, "page_number": "1"},
            files={"image": ("page.jpg", test_image, "image/jpeg")},
        )

        r_topics = await client.post(
            f"/api/session/{sid}/topics",
            json={"selected_pages": [1]},
        )
        assert r_topics.status_code == 200
        data = r_topics.json()
        assert "topics" in data
        assert "questions" in data
        assert data["page_count"] == 1

    @pytest.mark.asyncio
    async def test_topics_all_pages(self, client, test_image):
        r = await client.post("/api/session", json={"mode": "tutor"})
        sid = r.json()["session_id"]

        for i in range(1, 3):
            await client.post(
                "/api/page",
                data={"session_id": sid, "page_number": str(i)},
                files={"image": ("page.jpg", test_image, "image/jpeg")},
            )

        r_topics = await client.post(f"/api/session/{sid}/topics", json={})
        assert r_topics.status_code == 200
        assert r_topics.json()["page_count"] == 2


class TestAskWithSelectedPages:
    @pytest.mark.asyncio
    async def test_ask_all_pages(self, client, test_image):
        r = await client.post("/api/session", json={"mode": "tutor"})
        sid = r.json()["session_id"]

        await client.post(
            "/api/page",
            data={"session_id": sid, "page_number": "1"},
            files={"image": ("page.jpg", test_image, "image/jpeg")},
        )

        r_ask = await client.post(
            "/api/ask",
            json={"session_id": sid, "question": "What is on this page?"},
        )
        assert r_ask.status_code == 200

    @pytest.mark.asyncio
    async def test_ask_selected_pages(self, client, test_image):
        r = await client.post("/api/session", json={"mode": "tutor"})
        sid = r.json()["session_id"]

        for i in range(1, 3):
            await client.post(
                "/api/page",
                data={"session_id": sid, "page_number": str(i)},
                files={"image": ("page.jpg", test_image, "image/jpeg")},
            )

        r_ask = await client.post(
            "/api/ask",
            json={"session_id": sid, "question": "What is on this page?", "selected_pages": [1]},
        )
        assert r_ask.status_code == 200

    @pytest.mark.asyncio
    async def test_ask_invalid_selected_pages(self, client, test_image):
        r = await client.post("/api/session", json={"mode": "tutor"})
        sid = r.json()["session_id"]

        await client.post(
            "/api/page",
            data={"session_id": sid, "page_number": "1"},
            files={"image": ("page.jpg", test_image, "image/jpeg")},
        )

        r_ask = await client.post(
            "/api/ask",
            json={"session_id": sid, "question": "test", "selected_pages": [99]},
        )
        assert r_ask.status_code == 400
