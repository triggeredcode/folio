# Folio: Your Textbook, Understood

**Track: Future of Education | Ollama Special Technology Prize**

## The Problem

A 9th-grade student asks ChatGPT "What is a cell?" and gets a response about eukaryotic organelle biogenesis, citing research papers they won't understand for another eight years. They ask about photosynthesis and get a graduate-level biochemistry lecture on the Calvin cycle's carboxylation phase. The AI isn't wrong — it's just teaching from the wrong book.

**Current AI tutors have a fundamental context problem.** They pull from their entire training corpus — Wikipedia, university lectures, research papers — and deliver answers calibrated for adults, not for the student sitting in front of them. A 9th grader and a PhD candidate get the same answer to the same question. There is no awareness of *which* textbook the student is studying, *what* level they're at, or *what* specific content their teacher has assigned.

This matters because learning is sequential. A student needs to understand the cell at the level their NCERT biology book explains it — with the same terminology, the same diagrams, the same depth — not at the level of a medical school lecture. When an AI answer goes beyond the textbook, it doesn't help the student; it confuses them.

And then there's hallucination. Ask an LLM something not in the textbook and it confidently generates an answer anyway. A student can't distinguish a grounded fact from a plausible fabrication. They study the fabrication, write it in their exam, and fail.

## Folio: Teach From the Book, Not the Internet

**Folio** constrains AI to a student's actual textbook. It doesn't know anything except what's on the captured pages. It can't hallucinate beyond the book because it's never shown anything else.

The workflow is simple: snap photos of your textbook chapter with your phone, select which pages to study, and ask questions. Every answer cites the specific page it came from: "The cell membrane controls what enters and exits the cell [page 3]." If you ask about something not in those pages, Folio refuses: *"This isn't covered in the captured pages."*

This is the core insight: **the best tutor isn't the smartest one — it's the one that teaches from your book.**

### Two Modes

**Tutor mode** — the primary experience. Capture your chapter, pick pages, see topics highlighted, then ask questions. Answers are grounded in your textbook with page citations. The AI becomes your study partner, quizzing you on exactly what your teacher assigned.

**Reader mode** — capture a page, hear it narrated aloud with diagram descriptions. Useful for revision, for students with reading difficulties, or simply when you want to listen instead of read. Diagrams are described in detail: spatial relationships, labels, and structures — because a text-to-speech app that skips diagrams skips half the content.

## How It Works

### Architecture

```
Phone (camera) ──Wi-Fi──▶ Next.js (:8000) ──▶ FastAPI (:8001) ──▶ Ollama (gemma4:e4b)
```

The phone is a wireless camera. The laptop runs Gemma 4. Both share a session in real-time.

### Three Uses of Gemma 4

**1. Multimodal Vision Extraction.** Each page image goes to `gemma4:e4b` with a structured prompt that outputs JSON: `{text, headings[], diagrams[], captions[]}`. This isn't OCR — the model *understands* the page layout, identifies headings, parses diagram labels, and describes figures in detail.

**2. Grounded Q&A with Anti-Hallucination.** When a student asks a question, Folio retrieves relevant pages via BM25, builds a context window, and prompts Gemma 4 with strict grounding rules: cite every claim as `[page N]`, refuse if the answer isn't in the book. The model never sees its training data — only the student's pages.

**3. Topic Extraction.** Before chatting, Folio identifies key topics from selected pages and suggests starter questions. Students get a structured entry point: "What is the cell theory?" "What are the functions of mitochondria?" Not a blank chat box.

### Cross-Device Camera

Laptop webcams face the wrong way for scanning books. Folio's solution:

1. Open Folio on your laptop, click Tutor
2. Scan the QR code with your phone (same Wi-Fi)
3. Phone opens a minimal camera screen — one button, no distractions
4. Snap pages as fast as you want — they queue and upload in parallel
5. Pages appear on the laptop in real-time

The phone auto-discovers the laptop's session. Create a new session and the phone auto-switches. Zero configuration.

## Anti-Hallucination: Tested, Not Promised

We don't just prompt Gemma 4 to stay grounded — we verify it with 48 automated tests:

- **Grounded questions**: Must answer correctly with page citations
- **Out-of-scope questions**: Must refuse with "This isn't covered in the captured pages"
- **Adversarial questions**: Training-data questions designed to trigger hallucination
- **Citation accuracy**: Page references must match actual source content

The model stays inside the book. This is verifiable in the repository, not just claimed in a video.

## Technical Decisions

**Why Gemma 4 E4B?** 8B total / 4.5B active parameters fits in laptop RAM. Multimodal vision + text in one model. 128K context window holds 8+ textbook pages. Apache 2.0 — free for every student.

**Why Ollama?** Local inference means no internet dependency, no API keys, no data leaving the device. `ollama pull gemma4:e4b` is the entire model setup.

**Why BM25 over embeddings?** With ≤30 pages per session, BM25's zero-dependency simplicity wins. No extra model downloads. When pages < 8, we skip retrieval entirely — Gemma 4's context window handles it.

**Image Optimization.** Phone cameras produce 12MP images. Before sending to Gemma 4, Folio resizes to max 1024px and compresses to JPEG quality 85, cutting vision latency by 3-5x without losing text legibility.

## Impact

Folio solves a specific, real problem: AI tutors that teach from the wrong source at the wrong level. By grounding every answer in the student's actual textbook:

- A 9th grader gets 9th-grade answers, not PhD-level explanations
- Citations let students verify answers against their own book
- Refusals prevent studying fabricated content before exams
- Running locally means it works without internet — in any classroom, anywhere
- No accounts, no cloud, no tracking — privacy by architecture

The technology is deliberately minimal: a laptop, a phone, and Wi-Fi. A teacher sets it up in 10 minutes. A student uses it alone at midnight before an exam. The AI knows exactly as much as the textbook, and nothing more.

## Repository

48 automated tests. Demo mode with cached responses for reproducible demonstrations. Docker support. 11 documented API endpoints. Built to be verified, not just demonstrated.
