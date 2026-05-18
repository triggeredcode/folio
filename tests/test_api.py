"""Tests for the FastAPI endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client():
    from folio.api import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestHealthAndSession:
    @pytest.mark.asyncio
    async def test_health(self, client):
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    @pytest.mark.asyncio
    async def test_create_session(self, client):
        resp = await client.post("/api/session", json={"mode": "reader", "lang": "en"})
        assert resp.status_code == 200
        data = resp.json()
        assert "session_id" in data
        assert data["mode"] == "reader"

    @pytest.mark.asyncio
    async def test_get_session(self, client):
        resp = await client.post("/api/session", json={"mode": "tutor"})
        sid = resp.json()["session_id"]
        resp2 = await client.get(f"/api/session/{sid}")
        assert resp2.status_code == 200
        assert resp2.json()["pages"] == 0

    @pytest.mark.asyncio
    async def test_get_session_not_found(self, client):
        resp = await client.get("/api/session/nonexistent")
        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_ask_no_pages(self, client):
        resp = await client.post("/api/session", json={"mode": "tutor"})
        sid = resp.json()["session_id"]
        resp2 = await client.post(
            "/api/ask", json={"session_id": sid, "question": "hello"}
        )
        assert resp2.status_code == 400
