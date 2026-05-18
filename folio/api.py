"""FastAPI service — all endpoints for Folio."""

from __future__ import annotations

import io
import logging
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sse_starlette.sse import EventSourceResponse

from .config import OLLAMA_URL, VISION_MODEL, PORT, MEDIA_DIR
from .schemas import (
    Session, SessionCreateRequest, AskRequest, AskResponse, TTSRequest, Page,
)
from .vision import extract_page
from .narrate import build_narration
from .ask import ask_grounded
from .tts import synthesize

logger = logging.getLogger(__name__)

# In-memory session store
SESSIONS: dict[str, Session] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Warm up Ollama on startup."""
    logger.info(f"Warming up Ollama ({VISION_MODEL})...")
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": VISION_MODEL,
                    "messages": [{"role": "user", "content": "hello"}],
                    "stream": False,
                },
            )
        logger.info("Ollama warm-up complete.")
    except Exception as e:
        logger.warning(f"Ollama warm-up failed (non-fatal): {e}")
    yield


app = FastAPI(title="Folio API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "sessions": len(SESSIONS)}


@app.get("/api/network-info")
async def network_info():
    """Return the machine's LAN IP for QR code generation."""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"
    return {"ip": ip, "port": PORT}


@app.post("/api/session")
async def create_session(req: SessionCreateRequest):
    session = Session(mode=req.mode, lang=req.lang)
    SESSIONS[session.session_id] = session
    return {"session_id": session.session_id, "mode": session.mode, "lang": session.lang}


@app.get("/api/session/{session_id}")
async def get_session(session_id: str):
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return {
        "session_id": session.session_id,
        "mode": session.mode,
        "lang": session.lang,
        "pages": len(session.pages),
        "page_numbers": [p.page_number for p in session.pages],
    }


@app.get("/api/session/{session_id}/pages")
async def get_session_pages(session_id: str):
    """Return all pages in a session (for cross-device sync)."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    pages_out = []
    for p in session.pages:
        page_data = p.model_dump(exclude={"raw_image_path"})
        if p.raw_image_path:
            page_data["image_url"] = f"/api/session/{session_id}/page/{p.page_number}/image"
        pages_out.append(page_data)
    return {"session_id": session_id, "page_count": len(pages_out), "pages": pages_out}


@app.get("/api/session/{session_id}/page/{page_number}/image")
async def get_page_image(session_id: str, page_number: int):
    """Serve the raw image for a page."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    for p in session.pages:
        if p.page_number == page_number and p.raw_image_path:
            from pathlib import Path
            img_path = Path(p.raw_image_path)
            if img_path.exists():
                suffix = img_path.suffix.lower()
                media_type = "image/png" if suffix == ".png" else "image/jpeg"
                return FileResponse(img_path, media_type=media_type)
    raise HTTPException(404, "Page image not found")


@app.post("/api/page")
async def ingest_page(
    session_id: str = Form(...),
    page_number: int = Form(...),
    image: UploadFile = File(...),
):
    """Ingest a single page image. Returns SSE stream with progress + result."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    image_bytes = await image.read()

    async def event_stream():
        yield {"event": "progress", "data": '{"stage": "vision_call_start"}'}

        page = await extract_page(
            image_bytes, page_number, session_id=session_id, lang=session.lang
        )

        yield {"event": "progress", "data": '{"stage": "extract_text"}'}

        narration = build_narration(page)
        page.narration_text = narration

        # Save raw image
        img_path = MEDIA_DIR / f"{session_id}_p{page_number}.jpg"
        img_path.write_bytes(image_bytes)
        page.raw_image_path = str(img_path)

        session.pages.append(page)

        yield {"event": "progress", "data": '{"stage": "store"}'}
        yield {"event": "page_complete", "data": page.model_dump_json()}

        # Generate TTS
        audio_path = await synthesize(narration)
        yield {
            "event": "narration",
            "data": f'{{"narration_text": "{narration[:100]}...", "audio_url": "/api/audio/{audio_path.name}"}}',
        }

    return EventSourceResponse(event_stream())


@app.post("/api/pdf")
async def ingest_pdf(
    session_id: str = Form(...),
    pdf: UploadFile = File(...),
    start_page: int = Form(1),
    end_page: int = Form(-1),
):
    """Ingest a multi-page PDF. Returns SSE stream."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    pdf_bytes = await pdf.read()

    async def event_stream():
        import pypdfium2 as pdfium

        doc = pdfium.PdfDocument(pdf_bytes)
        total_pages = len(doc)
        actual_end = end_page if end_page > 0 else total_pages
        actual_end = min(actual_end, total_pages)
        page_range = list(range(start_page - 1, actual_end))

        yield {
            "event": "pdf_meta",
            "data": f'{{"total_pages": {total_pages}, "ingesting": {[i+1 for i in page_range]}}}',
        }

        t0 = time.time()
        for idx in page_range:
            page_num = idx + 1
            yield {
                "event": "progress",
                "data": f'{{"page_number": {page_num}, "stage": "rasterize"}}',
            }

            pdf_page = doc[idx]
            bitmap = pdf_page.render(scale=200 / 72)
            pil_image = bitmap.to_pil()
            buf = io.BytesIO()
            pil_image.save(buf, format="PNG")
            image_bytes = buf.getvalue()

            yield {
                "event": "progress",
                "data": f'{{"page_number": {page_num}, "stage": "vision_call"}}',
            }

            page = await extract_page(
                image_bytes, page_num, session_id=session_id, lang=session.lang
            )
            narration = build_narration(page)
            page.narration_text = narration

            img_path = MEDIA_DIR / f"{session_id}_p{page_num}.png"
            img_path.write_bytes(image_bytes)
            page.raw_image_path = str(img_path)

            session.pages.append(page)
            yield {"event": "page_complete", "data": page.model_dump_json()}

        elapsed_ms = int((time.time() - t0) * 1000)
        yield {
            "event": "pdf_done",
            "data": f'{{"pages_ingested": {len(page_range)}, "total_latency_ms": {elapsed_ms}}}',
        }

    return EventSourceResponse(event_stream())


@app.post("/api/ask")
async def ask_question(req: AskRequest):
    """Grounded Q&A — returns SSE stream with retrieval info + answer."""
    session = SESSIONS.get(req.session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.pages:
        raise HTTPException(400, "No pages captured yet")

    selected = session.pages
    if req.selected_pages:
        selected = [p for p in session.pages if p.page_number in req.selected_pages]
        if not selected:
            raise HTTPException(400, "None of the selected pages exist in this session")

    async def event_stream():
        response = await ask_grounded(
            question=req.question,
            pages=selected,
            session_id=req.session_id,
        )
        yield {"event": "retrieve", "data": f'{{"pages_used": {response.pages_used}}}'}
        yield {"event": "done", "data": response.model_dump_json()}

    return EventSourceResponse(event_stream())


@app.post("/api/session/{session_id}/topics")
async def get_topics(session_id: str, req: dict | None = None):
    """Extract topics and starter questions from selected pages."""
    session = SESSIONS.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    if not session.pages:
        raise HTTPException(400, "No pages captured yet")

    selected_pages = (req or {}).get("selected_pages")
    pages = session.pages
    if selected_pages:
        pages = [p for p in session.pages if p.page_number in selected_pages]
        if not pages:
            pages = session.pages

    topics = []
    questions = []
    for page in pages:
        for h in page.headings:
            topic = h.text.strip()
            if topic and topic not in topics:
                topics.append(topic)
        for d in page.diagrams:
            if d.label and d.label not in topics:
                topics.append(d.label)

    if topics:
        for t in topics[:6]:
            questions.append(f"What is {t.lower()}?")
    elif pages:
        first_text = pages[0].text[:200]
        words = [w for w in first_text.split() if len(w) > 4][:3]
        for w in words:
            questions.append(f"Tell me about {w.lower()}")

    return {
        "topics": topics[:10],
        "questions": questions[:6],
        "page_count": len(pages),
    }


@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    """Generate audio for given text."""
    audio_path = await synthesize(req.text, req.voice)
    return FileResponse(audio_path, media_type="audio/wav")


@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    """Serve a generated audio file."""
    path = MEDIA_DIR / filename
    if not path.exists():
        raise HTTPException(404, "Audio file not found")
    return FileResponse(path, media_type="audio/wav")
