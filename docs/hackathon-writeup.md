# Folio: Your Textbook, Understood

**Track: Future of Education | Ollama Special Technology Prize**

## The Problem

In a rural classroom in Maharashtra, India, Aanya — a 12-year-old with low vision — presses her face inches from a biology textbook. She can make out the words, slowly, but the diagram of a plant cell? It's a blur of lines she'll never decipher. Her teacher has 60 students and no time to describe every figure individually.

Meanwhile, thousands of kilometers away, Rohan is cramming for his 10th-grade board exams at midnight. He's read the same chapter three times but has nobody to quiz him, nobody to tell him if he actually understands mitochondria or is just memorizing sentences.

Both students are failed by the same gap: **printed textbooks are static, and AI tutors hallucinate.** OCR apps give raw text but can't describe a diagram. ChatGPT fabricates answers beyond the textbook. Cloud-based tutors need internet that rural schools don't have. Nothing runs locally, privately, on hardware a student already owns.

## Folio: Two Modes, Two Students, One Model

**Folio** turns any physical textbook into an interactive study companion powered by Gemma 4 E4B running locally via Ollama. No cloud, no API keys, no data leaving the room.

**Reader mode** is built for Aanya. She points her phone at a page. Folio reads it aloud and — critically — *describes the diagrams*: "A circular cell diagram shows the nucleus in the center, surrounded by cytoplasm. The cell membrane forms the outer boundary. Mitochondria appear as small oval structures scattered through the cytoplasm." She hears what sighted students see.

**Tutor mode** is built for Rohan. He snaps photos of his chapter from his phone, selects pages to study, and asks questions. Folio answers *only from the book*: "Mitochondria are called the powerhouses of the cell because they produce ATP through cellular respiration [page 3]." If he asks about something not on those pages, Folio refuses: *"This isn't covered in the captured pages."*

## Architecture

```
Phone (camera) ──Wi-Fi──▶ Next.js (:8000) ──▶ FastAPI (:8001) ──▶ Ollama (gemma4:e4b)
```

The phone is a wireless camera. The laptop is the brain. Both share a session in real-time — pages captured on the phone appear on the laptop instantly. One big QR code on the homepage connects them.

## Three Uses of Gemma 4

**1. Multimodal Vision Extraction.** Each page image goes to `gemma4:e4b` with a structured prompt that outputs JSON: `{text, headings[], diagrams[], captions[]}`. Diagram descriptions are deliberately detailed — spatial relationships, colors, labels, relative positions — because a blind student needs to *hear* the picture.

**2. Grounded Q&A with Anti-Hallucination.** When Rohan asks a question, Folio retrieves relevant pages via BM25, builds a context window, and prompts Gemma 4 with strict grounding rules: cite every claim as `[page N]`, refuse if the answer isn't in the book. This is enforced through prompt engineering and verified by 48 automated tests — including adversarial questions designed to trick the model into using training knowledge.

**3. Topic Extraction + Starter Questions.** Before chatting, Folio identifies key topics from selected pages and suggests questions: "What is the cell theory?" "What are the functions of mitochondria?" Students get a structured entry point, not a blank chat box.

## Cross-Device Camera Flow

Laptop webcams face the wrong way for scanning books. Folio's answer:

1. Open Folio on your laptop → click Tutor
2. Scan the QR code with your phone (same Wi-Fi)
3. Phone opens a minimal black screen — one camera button, nothing else
4. Snap pages as fast as you want — they queue and upload in parallel
5. Pages appear on the laptop in real-time via polling

The phone auto-discovers the laptop's active session and re-checks every 5 seconds. Create a new session on the laptop and the phone auto-switches. Zero configuration.

## Technical Decisions

**Why Gemma 4 E4B?** 8B total / 4.5B active parameters — fits in laptop memory. Multimodal (vision + text) in a single model. 128K context window holds 8+ textbook pages. Apache 2.0 — free forever.

**Why Ollama?** Local inference is non-negotiable. Rural Indian schools have intermittent internet. Student data should never leave the device. `ollama pull gemma4:e4b` is the entire setup.

**Why BM25 over vector embeddings?** With ≤30 pages per session, BM25's zero-dependency simplicity wins. No embedding model download, no vector store. When pages < 8, we skip retrieval entirely — Gemma 4's 128K context handles it all.

**Why SSE?** Server-Sent Events work through proxies, are simpler than WebSockets, and perfectly fit our use case: streaming ingestion progress and Q&A results.

## Anti-Hallucination: Tested, Not Promised

We don't just *prompt* Gemma 4 to stay grounded — we *verify* it. Our test suite includes:

- **Grounded questions**: Must answer correctly with citations
- **Out-of-scope questions**: Must refuse ("This isn't covered in the captured pages")
- **Adversarial questions**: Training-data questions designed to trigger hallucination
- **Citation accuracy**: Page references must match actual source pages

All 48 tests pass. The model stays inside the book.

## Image Optimization

Phone cameras produce 4000×3000 images. Before sending to Gemma 4, Folio resizes to max 1024px and compresses to JPEG quality 85. This cuts vision call latency by 3-5x without losing text legibility.

## Impact

Folio sits at the intersection of **Future of Education** and **Digital Equity**:

- **Accessibility**: Reader mode makes visual content audible — diagrams described, not just text read
- **Anti-hallucination**: Students get answers from *their* book, with citations, or a refusal
- **Privacy**: Nothing leaves the device. No accounts, no cloud, no tracking
- **Minimal hardware**: A laptop with Ollama + a phone with a browser + Wi-Fi

A teacher sets this up in 10 minutes. A student uses it alone at midnight. The technology is deliberately minimal because the students who need it most have the least.

## Challenges Overcome

1. **Vision prompt engineering** — structured JSON extraction across diverse layouts (biology diagrams, math equations, dense text)
2. **Cross-device camera without HTTPS** — HTML5 `capture="environment"` enables direct camera access over HTTP on mobile
3. **Session synchronization** — automatic discovery and re-pairing across devices
4. **Latency** — image compression + non-blocking TTS + parallel processing reduced per-page time from ~8s to ~2s

## Repository

48 automated tests. Demo mode with cached responses. Docker support. 11 documented API endpoints. Built to be verified, not just demonstrated.
