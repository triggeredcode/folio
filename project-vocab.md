# Folio — Project Vocabulary & Definitions

## Product Identity

| Term | Definition |
|------|-----------|
| **Folio** | The product. A web app that reads any physical book aloud and teaches what it sees, powered by Gemma 4 multimodal AI. |
| **Tagline** | "Reads any book aloud, teaches what it sees." |
| **Hackathon** | Kaggle Gemma 4 Hackathon (deadline: May 18, 2026 11:59 PM UTC). |
| **Track** | Education Impact (primary), Digital Equity & Inclusivity (secondary), Ollama Special Prize, Safety & Trust. |

## Users

| User | Profile | Mode | Demo Moment |
|------|---------|------|-------------|
| **Aanya** | 12 y/o, partially-sighted, rural Maharashtra school. Biology textbook print too small to read. | Reader | Points phone at page → Folio reads aloud + describes diagrams. |
| **Rohan** | 15 y/o, sighted exam student. 30-page chapter to revise efficiently. | Tutor | Captures chapter once → studies inside Folio with grounded Q&A. |

## Modes

| Mode | UX | Primary Output | Target User |
|------|------|---------------|-------------|
| **Reader** | Voice-first. Huge capture button, auto-narrate on capture, audio is primary output. Large touch targets, ARIA labels. | Spoken narration + diagram descriptions | Aanya (partially-sighted) |
| **Tutor** | Chat-first. Pages on top, chat below. Ask questions, get cited answers. | Text answers with `[page N]` citations | Rohan (exam prep) |

## Core Concepts

| Term | Definition |
|------|-----------|
| **Page** | A single captured textbook page. Source: camera frame (JPEG) or rasterized PDF page (PNG). |
| **Session** | An ephemeral workspace holding N captured pages + mode + language. In-memory, no persistence across server restarts. |
| **Context Bank** | In-memory dict mapping `session_id → list[Page]`. The "database" for the demo. |
| **Page JSON** | Structured extraction output: `{text, headings[], diagrams[], captions[]}`. Produced by the vision pipeline. |
| **Ingest** | The process of capturing a page image → running vision extraction → storing Page JSON in the context bank. |
| **Grounded Q&A** | Answering questions using ONLY the captured pages. Model is prompt-constrained to refuse if the answer isn't in the book. |
| **Grounding** | The anti-hallucination mechanism. Two layers: (1) prompt constraint, (2) citation extraction. |
| **Citation** | A `[page N]` marker in the model's answer, linking a claim to its source page. |
| **Refusal** | When the model says "This isn't covered in the captured pages." — triggered when the answer isn't in the book. |
| **Narration** | A spoken-form string assembled from Page JSON (headings → text → diagram descriptions). Fed to TTS. |
| **Hero Query** | One of 6 pre-selected demo questions (3 Reader, 3 Tutor) with cached deterministic responses for video recording. |

## Technical Terms

| Term | Definition |
|------|-----------|
| **Gemma 4 E4B** | 8B total / 4.5B active params. Multimodal (vision + text + audio). Apache 2.0. Default model. |
| **Gemma 4 E2B** | Smaller Gemma 4 variant. Used for Unsloth stretch (diagram specialization). |
| **Ollama** | Local LLM runtime. Serves models via HTTP API on port 11434. |
| **Vision Call** | Sending an image (base64 JPEG) + text prompt to Gemma 4 E4B via Ollama `/api/chat`. |
| **E4B** | Shorthand for `gemma4:e4b` model tag in Ollama. |
| **Context Window** | 128K tokens for E4B. Can hold ~30K tokens of page content easily (≤8 pages). |
| **BM25** | Simple keyword-overlap retrieval. Used only when pages > 8. |
| **TTS** | Text-to-Speech. macOS `say` (English, default) or Piper (multilingual, offline). |
| **Piper** | Free offline TTS engine. Used for Hindi/Marathi/Tamil voices. |
| **SSE** | Server-Sent Events. Used for streaming responses from backend → frontend. |
| **pypdfium2** | Python library for PDF rasterization (PDF → PNG per page). |
| **FastAPI** | Python web framework for the backend API on port 8000. |
| **Next.js** | React framework for the frontend on port 3000. |
| **ngrok** | Tunnel to expose localhost to the internet for demo/judging. |

## Architecture Layers

```
┌─────────────────────────────────┐
│  User (phone browser / laptop)  │
└─────────────┬───────────────────┘
              │ getUserMedia / file upload
┌─────────────▼───────────────────┐
│  Next.js UI (:3000)             │
│  Reader mode / Tutor mode       │
└─────────────┬───────────────────┘
              │ REST + SSE
┌─────────────▼───────────────────┐
│  FastAPI Backend (:8000)        │
│  /session /page /pdf /ask /tts  │
├─────────────────────────────────┤
│  Context Bank (in-memory)       │
└─────────┬───────────┬───────────┘
          │           │
┌─────────▼───┐ ┌────▼────────────┐
│ Ollama      │ │ TTS             │
│ :11434      │ │ say / Piper     │
│ gemma4:e4b  │ │ subprocess      │
└─────────────┘ └─────────────────┘
```

## Non-Technical Definitions

| Term | Definition |
|------|-----------|
| **Offline-first** | The system works without internet. Phone connects to Mac via local Wi-Fi. Textbook data never leaves the room. |
| **Anti-hallucination** | Folio refuses to answer questions not covered by the captured pages. It won't make things up. |
| **Accessibility** | Reader mode is designed for visually impaired users: voice output, large buttons, screen-reader compatible. |
| **Privacy** | No cloud. No data upload. Everything runs locally on the user's own hardware. |
| **Deterministic replay** | `?demo=1` mode replays cached responses without hitting the AI model — ensures the video demo is reproducible. |

## File/Folder Conventions

| Path | Purpose |
|------|---------|
| `folio/folio/` | Python backend package |
| `folio/web/` | Next.js frontend |
| `folio/tests/` | Backend tests (pytest) |
| `folio/tests/fixtures/` | Test images, cached model responses |
| `folio/demos/` | Hero demo content (captured pages + cached responses) |
| `folio/scripts/` | Shell scripts for setup, run, tunnel |
| `folio/docs/` | Architecture docs, writeup, screenshots |

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `FOLIO_VISION_MODEL` | `gemma4:e4b` | Which Ollama model to use for vision calls |
| `FOLIO_TEXT_MODEL` | `gemma4:e4b` | Which model for grounded Q&A (can differ) |
| `FOLIO_TTS` | `say` | TTS backend: `say` (macOS) or `piper` |
| `FOLIO_OLLAMA_URL` | `http://localhost:11434` | Ollama API base URL |
| `FOLIO_PORT` | `8000` | FastAPI port |
| `FOLIO_DEMO_MODE` | `0` | Set to `1` to replay cached responses |
| `FOLIO_CACHE_DIR` | `./demos/cached_responses/` | Where to read/write response caches |
| `FOLIO_MEDIA_DIR` | `./media/` | Uploaded images + generated audio storage |

## Testing Vocabulary

| Term | Definition |
|------|-----------|
| **V-gate** | A verification gate. Must pass before proceeding to next phase. |
| **Fixture** | A saved test input (image file, cached JSON response) used for repeatable tests. |
| **Headless test** | A test that runs without user interaction, using cached inputs and mocked/real Ollama. |
| **Sandbox** | Isolated test environment with controlled inputs. Docker container for backend, mocked Ollama for unit tests. |
| **TDD** | Test-Driven Development. Write the test first, then implement until it passes. |
| **Adversarial test** | A question designed to trick the model into using training knowledge instead of book content. |
