"""Narration assembly — converts a Page into a spoken-form string for TTS.

The narration is designed for accessibility: a partially-sighted student
should be able to understand the page fully from the narration alone.
"""

from __future__ import annotations

from .schemas import Page


def build_narration(page: Page, pedagogical: bool = True) -> str:
    """Build a narration string from a Page for TTS.

    Order: page announcement → headings → main text → diagram descriptions.
    When pedagogical=True, adds teaching framing around diagrams.
    """
    parts: list[str] = []

    parts.append(f"Page {page.page_number}.")

    if page.headings:
        main_heading = page.headings[0].text
        parts.append(f"This page is about: {main_heading}.")
        if len(page.headings) > 1:
            sub = ", ".join(h.text for h in page.headings[1:])
            parts.append(f"It covers: {sub}.")

    if page.text:
        clean_text = page.text.strip()
        if len(clean_text) > 2000:
            clean_text = clean_text[:2000] + "..."
        parts.append(clean_text)

    for i, diagram in enumerate(page.diagrams):
        if pedagogical:
            parts.append(
                f"Now let me describe a figure on this page. "
                f"It's labelled: {diagram.label}."
            )
            parts.append(diagram.description)
            if diagram.labels:
                label_list = ", ".join(diagram.labels[:8])
                parts.append(f"The key parts to remember are: {label_list}.")
        else:
            parts.append(f"There is a figure on this page: {diagram.label}.")
            parts.append(diagram.description)

    return "\n\n".join(parts)


def build_summary(page: Page) -> str:
    """Build a short summary for the page strip tooltip."""
    parts = []
    if page.headings:
        parts.append(page.headings[0].text)
    if page.text:
        first_sentence = page.text.split(".")[0] + "."
        if len(first_sentence) < 100:
            parts.append(first_sentence)
    if page.diagrams:
        parts.append(f"{len(page.diagrams)} diagram(s)")
    return " · ".join(parts) if parts else f"Page {page.page_number}"
