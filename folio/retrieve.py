"""Page retrieval — select relevant pages for a question."""

from __future__ import annotations

import re
from collections import Counter

from .schemas import Page


def retrieve_pages(question: str, pages: list[Page], top_k: int = 5) -> list[Page]:
    """Retrieve relevant pages for a question.

    Strategy:
    - If len(pages) <= 8: return ALL pages (fits in 128K context easily).
    - Else: BM25-style keyword overlap, take top-k, always include most recent page.
    """
    if not pages:
        return []

    if len(pages) <= 8:
        return pages

    question_terms = _tokenize(question)
    scored: list[tuple[float, Page]] = []

    for page in pages:
        page_text = page.text + " " + " ".join(d.description for d in page.diagrams)
        page_terms = _tokenize(page_text)
        score = _bm25_score(question_terms, page_terms)
        scored.append((score, page))

    scored.sort(key=lambda x: x[0], reverse=True)
    result = [p for _, p in scored[:top_k]]

    most_recent = max(pages, key=lambda p: p.ingested_at_ms)
    if most_recent not in result:
        result.append(most_recent)

    return sorted(result, key=lambda p: p.page_number)


def _tokenize(text: str) -> list[str]:
    """Simple word tokenization — lowercase, alphanumeric, with naive stemming."""
    words = re.findall(r"[a-z0-9]+", text.lower())
    return [w.rstrip("s") for w in words]


def _bm25_score(query_terms: list[str], doc_terms: list[str]) -> float:
    """Simplified BM25-ish scoring (term frequency overlap)."""
    if not doc_terms:
        return 0.0
    doc_freq = Counter(doc_terms)
    doc_len = len(doc_terms)
    score = 0.0
    for term in set(query_terms):
        tf = doc_freq.get(term, 0)
        if tf > 0:
            score += (tf * 2.0) / (tf + 1.0 + 0.75 * (doc_len / 200.0))
    return score
