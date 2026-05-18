# Folio

**Reads any book aloud, teaches what it sees.**

Folio is an AI-powered textbook companion that turns any physical book into an interactive learning experience. Point your camera at a page — Folio reads it aloud, describes diagrams for visually impaired users, and answers questions grounded *only* in what's on your actual book.

Built with [Gemma 4 E4B](https://ai.google.dev/gemma) running locally via [Ollama](https://ollama.com). No cloud. No data leaves your device.

## Two Modes

| Mode | For | UX |
|------|-----|-----|
| **Reader** | Partially-sighted students | Voice-first: capture a page → hear it narrated with diagram descriptions |
| **Tutor** | Exam prep students | Chat-first: capture your chapter → ask questions with cited answers |

## Quick Start

### Prerequisites

- macOS with [Ollama](https://ollama.com) installed
- Python 3.11+
- Node.js 18+ with pnpm

### Setup

```bash
# 1. Clone and enter
git clone https://github.com/triggeredcode/folio.git
cd folio

# 2. Pull the model (~9 GB)
ollama pull gemma4:e4b

# 3. Start Ollama (in a separate terminal)
ollama serve

# 4. Install Python backend
pip install -e ".[dev]"

# 5. Start the backend (port 8001)
uvicorn folio.api:app --host 0.0.0.0 --port 8001
```

In another terminal:
```bash
# 6. Install and start the frontend (port 8000)
cd web && pnpm install
NEXT_PUBLIC_API_URL=http://localhost:8001 pnpm dev --port 8000
```

Open http://localhost:8000 in your browser. Scan the QR code from your phone (same Wi-Fi) to use your phone camera.

### Demo Mode (no Ollama needed)

To try the app with pre-cached responses (no model download required):

```bash
FOLIO_DEMO_MODE=1 make backend
# Then start frontend normally
```

### Docker

```bash
# Requires Ollama running on the host
docker compose up
```

## Architecture

```
User (phone/laptop browser)
  │
  ├── Camera capture / PDF upload
  │
Next.js UI (:8000) ──── FastAPI (:8001) ──── Ollama (:11434)
                              │                   gemma4:e4b
                              ├── Vision: page extraction + structured output
                              ├── RAG: BM25 retrieval + grounded Q&A
                              ├── Context Bank (in-memory sessions)
                              └── TTS (macOS say / Piper)
```

### Cross-Device Flow

1. Start Folio on your laptop
2. Scan the QR code on the homepage with your phone
3. Phone joins the same session — snap pages with your phone camera
4. Pages appear on both devices in real-time
5. Chat on either device, answers are grounded in your captured pages

## Testing

```bash
# Unit tests (no Ollama needed)
pytest tests/test_retrieve.py tests/test_narrate.py tests/test_api.py -v

# Integration tests (requires Ollama + gemma4:e4b)
pytest tests/ -v -m integration

# Headless replay (uses cached responses, no Ollama)
FOLIO_DEMO_MODE=1 pytest tests/test_headless.py -v
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FOLIO_VISION_MODEL` | `gemma4:e4b` | Ollama model for vision |
| `FOLIO_TEXT_MODEL` | `gemma4:e4b` | Ollama model for Q&A |
| `FOLIO_TTS` | `say` | TTS backend: `say` or `piper` |
| `FOLIO_OLLAMA_URL` | `http://localhost:11434` | Ollama API URL |
| `FOLIO_DEMO_MODE` | `0` | Use cached responses (no Ollama) |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/session` | Create a session |
| GET | `/api/session/:id` | Get session state |
| GET | `/api/session/:id/pages` | List all pages in session |
| GET | `/api/session/:id/page/:n/image` | Serve raw page image |
| POST | `/api/session/:id/topics` | Extract topics + starter questions |
| GET | `/api/sessions/active` | List active sessions |
| POST | `/api/page` | Ingest a page image (SSE) |
| POST | `/api/pdf` | Ingest a PDF (SSE) |
| POST | `/api/ask` | Ask a grounded question (SSE) |
| POST | `/api/tts` | Generate speech audio |
| GET | `/api/network-info` | Get LAN IP for cross-device |

## Hackathon

Built for the [Kaggle Gemma 4 Hackathon](https://www.kaggle.com/competitions/gemma-4-hackathon) — Education Impact Track.

## License

Apache 2.0
