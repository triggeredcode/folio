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

# 5. Start the backend
make backend
```

In another terminal:
```bash
# 6. Install and start the frontend
cd web && pnpm install && pnpm dev
```

Open http://localhost:3000 in your browser.

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
Next.js UI (:3000) ──── FastAPI (:8000) ──── Ollama (:11434)
                              │                   gemma4:e4b
                              ├── Context Bank (in-memory)
                              └── TTS (macOS say / Piper)
```

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
| POST | `/api/page` | Ingest a page image (SSE) |
| POST | `/api/pdf` | Ingest a PDF (SSE) |
| POST | `/api/ask` | Ask a grounded question (SSE) |
| POST | `/api/tts` | Generate speech audio |

## Hackathon

Built for the [Kaggle Gemma 4 Hackathon](https://www.kaggle.com/competitions/gemma-4-hackathon) — Education Impact Track.

## License

Apache 2.0
