# Folio: Your Textbook, Understood

**Track: Future of Education | Ollama Special Technology Prize**

## The Problem

700 million people worldwide are visually impaired. In India alone, 12 million school-age children study from printed textbooks they struggle to read. Meanwhile, every exam student globally shares a universal frustration: reading 30 pages of dense biology, then having no one to quiz them at midnight.

Current solutions fail both groups. OCR apps give raw text without understanding diagrams. ChatGPT hallucinates freely beyond what's on the page. Cloud-based tutors require internet that rural schools don't have. And nothing runs locally, privately, on hardware a student already owns.

## Our Solution

**Folio** turns any physical textbook into an interactive study companion using Gemma 4's multimodal intelligence — running entirely on a local machine via Ollama. No cloud. No data leaves the room.

Two modes serve two real users:

- **Reader mode** for Aanya, a 12-year-old partially-sighted student in rural Maharashtra. She points her phone at a biology page. Folio reads it aloud with rich diagram descriptions ("A circular cell diagram shows the nucleus in the center, surrounded by cytoplasm..."). She learns what sighted students take for granted — the visual content of her own textbook.

- **Tutor mode** for Rohan, a 15-year-old preparing for exams. He captures his chapter, selects pages, and asks questions. Folio answers with citations: "Mitochondria are the powerhouses of the cell [page 3]." If he asks something not in the book, Folio refuses: "This isn't covered in the captured pages." No hallucination. No guessing.

## How It Works

### Architecture

Folio is a two-tier web application:

```
Phone (camera) ──Wi-Fi──▸ Next.js UI (:8000) ──▸ FastAPI (:8001) ──▸ Ollama (gemma4:e4b)
```

The phone acts as a wireless camera. The laptop runs the brain. Both share a session in real-time.

### Gemma 4 Integration (3 distinct uses)

**1. Multimodal Vision Extraction.** Each captured page image is sent to `gemma4:e4b` with a structured extraction prompt. Gemma 4's vision capabilities parse the image into a JSON schema: `{text, headings[], diagrams[], captions[]}`. The diagram descriptions are deliberately detailed for accessibility — spatial relationships, colors, labels, and relative positions are all captured, because a blind student can't "see" the diagram.

**2. Grounded Q&A with Anti-Hallucination.** When a student asks a question, Folio retrieves relevant pages via BM25, constructs a context window, and prompts Gemma 4 with strict grounding rules: cite every claim as `[page N]`, refuse if the answer isn't in the book. This isn't a suggestion — it's enforced through prompt engineering and verified through automated adversarial testing.

**3. Topic Extraction.** Before chatting, Folio asks Gemma 4 to identify key topics and generate starter questions from the selected pages, giving students a structured entry point into study.

### Image Optimization

Phone camera images are often 4000×3000 pixels. Before sending to Gemma 4, Folio resizes images to a maximum of 1024px on the longest side and compresses to JPEG quality 85. This reduces vision call latency by 3-5x without meaningful loss of text legibility.

### Cross-Device Architecture

The phone-as-camera pattern solves a real UX problem: laptop webcams face the wrong way for scanning books. Folio's solution:

1. Start a session on the laptop (Reader or Tutor mode)
2. Scan the homepage QR code with your phone (same Wi-Fi)
3. Phone opens a minimal camera-only interface — one big button, no distractions
4. Captured pages stream to the laptop session via the FastAPI backend
5. Both devices see pages in real-time through polling

The phone scanner auto-discovers the laptop's active session, and periodically re-checks every 5 seconds. If the laptop creates a new session, the phone auto-switches. No manual re-pairing needed.

### Anti-Hallucination Verification

We built automated adversarial tests that verify grounding. The test suite includes questions whose answers are in the captured pages (must answer correctly with citations) and questions whose answers are NOT in the pages (must refuse). All 48 tests pass consistently, including:

- `test_grounded_in_book`: Verifies correct answers from captured content
- `test_not_in_book`: Verifies refusal for out-of-scope questions  
- `test_citation_accuracy`: Verifies page citations match actual source pages
- `test_adversarial_refusals`: Attempts to trick the model with training-data questions

### Demo Mode

For reproducible demonstrations, `FOLIO_DEMO_MODE=1` replays cached Ollama responses. The first real inference is cached; subsequent runs replay deterministically. This ensures the video demo is honest — same inputs, same outputs, verifiable.

## Technical Decisions

**Why Gemma 4 E4B?** The 8B-total/4.5B-active architecture delivers multimodal understanding (vision + text) within a laptop's memory budget. The 128K context window comfortably holds 8+ pages of textbook content. Apache 2.0 licensing means students can use this freely.

**Why Ollama?** Local inference is non-negotiable for this use case. Rural Indian schools have intermittent internet. Student data (captured textbook pages, study questions) should never leave the device. Ollama makes local Gemma 4 deployment a single `ollama pull` command.

**Why BM25 over embeddings?** With ≤30 pages per session, BM25's simplicity wins. No embedding model needed, no vector store, no additional download. When pages < 8, we skip retrieval entirely and pass all pages — Gemma 4's 128K context handles it.

**Why SSE over WebSockets?** Server-Sent Events are simpler, work through HTTP proxies, and handle our use case perfectly: one-directional streaming of ingestion progress and Q&A responses.

## Impact

Folio addresses two of the hackathon's core themes:

**Future of Education:** A multi-tool AI companion that adapts to the learner (voice-first for accessibility, chat-first for exam prep) and empowers educators by making any printed textbook interactive.

**Digital Equity & Inclusivity:** By running locally, Folio works without internet. By describing diagrams aloud, it makes visual content accessible to blind students. By using Gemma 4's Apache 2.0 license, it's free to deploy anywhere.

The technology is deliberately minimal — a laptop with Ollama, a phone with a browser, and a Wi-Fi connection. No GPU cluster. No API keys. No subscription. A teacher in a rural school can set this up in 10 minutes.

## Challenges Overcome

1. **Vision prompt engineering** for structured JSON extraction that reliably produces valid output across diverse textbook layouts (biology diagrams, math equations, dense text)
2. **Cross-device camera relay** without HTTPS certificates — solved using HTML5 `capture="environment"` attribute for direct camera access over HTTP
3. **Session synchronization** across devices with automatic session discovery and re-pairing
4. **Latency optimization** — image compression, non-blocking TTS, and parallel processing reduced per-page ingestion from ~8s to ~2s

## Repository

- **48 automated tests** covering vision, Q&A, retrieval, API, cross-device sync, and adversarial grounding
- **Demo mode** with cached responses for reproducible demonstrations
- **Docker support** for containerized deployment
- **Full API documentation** with 11 REST/SSE endpoints

Built in a weekend. Runs on a MacBook. Changes how students learn from books.
