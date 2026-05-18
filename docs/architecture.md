# Folio Architecture

## System Overview

Folio runs as three cooperating processes on a single machine:

```
┌─────────────────────────────────────────────────────────────┐
│                     User's Device                           │
│  (phone browser / laptop browser via local WiFi or ngrok)  │
└──────────────────────┬──────────────────────────────────────┘
                       │
           getUserMedia (camera) / PDF upload
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              Next.js Frontend (:3000)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Mode     │  │ Camera   │  │ Page     │  │ Chat      │ │
│  │ Switcher │  │ Capture  │  │ Strip    │  │ Panel     │ │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘ │
│                                                             │
│  API proxy: /api/* → localhost:8000                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST + SSE
┌──────────────────────▼──────────────────────────────────────┐
│              FastAPI Backend (:8000)                         │
│                                                             │
│  Endpoints:                                                 │
│  POST /api/session     → create session                     │
│  POST /api/page        → ingest single image (SSE stream)   │
│  POST /api/pdf         → ingest PDF pages (SSE stream)      │
│  POST /api/ask         → grounded Q&A (SSE stream)          │
│  POST /api/tts         → text-to-speech                     │
│                                                             │
│  Internal modules:                                          │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐         │
│  │ vision  │ │ retrieve │ │   ask    │ │  tts  │         │
│  └────┬────┘ └──────────┘ └──────────┘ └───┬───┘         │
│       │                                      │             │
│  Context Bank (in-memory: session_id → pages[])            │
└───────┼──────────────────────────────────────┼─────────────┘
        │                                      │
┌───────▼───────┐                    ┌─────────▼─────────┐
│ Ollama :11434 │                    │ macOS say / Piper │
│ gemma4:e4b    │                    │ (subprocess)      │
│ vision+text   │                    │                   │
└───────────────┘                    └───────────────────┘
```

## Data Flow: Page Ingest

1. User captures image (camera frame or PDF page rasterized at 200 DPI)
2. Image bytes sent to `/api/page` as multipart form data
3. Backend calls Ollama vision endpoint with structured extraction prompt
4. Gemma 4 E4B returns JSON: `{text, headings[], diagrams[], captions[]}`
5. Backend parses response into Pydantic `Page` model
6. Page stored in in-memory context bank (dict keyed by session_id)
7. Narration string assembled from Page fields
8. TTS generates audio WAV from narration
9. SSE events stream back: progress → page_complete → narration

## Data Flow: Grounded Q&A

1. User types question in chat panel
2. Frontend sends to `/api/ask` with session_id
3. Backend retrieves relevant pages (all if ≤8, BM25 if >8)
4. Builds prompt: system instruction (strict grounding) + page content + question
5. Ollama generates answer with `temperature=0, seed=42`
6. Backend extracts `[page N]` citations via regex
7. Detects refusal via literal string match
8. SSE events stream back: retrieve → done (with full answer + citations)

## Anti-Hallucination Design

Two enforcement layers:

1. **Prompt constraint**: System prompt explicitly instructs model to answer ONLY from
   provided pages and use a specific refusal sentence if content is absent.
2. **Post-hoc detection**: Backend checks for the canonical refusal sentence and flags
   `not_in_book=true`. UI renders a special banner explaining the limitation.

Verified against 5 adversarial questions (completely off-topic content that
the model knows from training but isn't in the captured pages). All 5 refuse.

## Determinism

All Ollama calls use `temperature=0, seed=42`. Combined with response caching,
this enables:
- Reproducible demo video recording
- `?demo=1` replay mode (cached SSE traces, no backend needed)
- Consistent test assertions

## Configuration

Single-model architecture by default (`gemma4:e4b` for both vision and text).
Configurable via `FOLIO_VISION_MODEL` and `FOLIO_TEXT_MODEL` env vars for
upgrade path to `gemma4:26b` (better quality) or `gemma4:31b` (dense).
