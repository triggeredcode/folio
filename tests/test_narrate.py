"""Tests for narration assembly (pure logic, no external deps)."""

from folio.narrate import build_narration
from folio.schemas import Page, Heading, Diagram


def test_narration_includes_page_number():
    page = Page(page_number=5, text="Some content here.")
    result = build_narration(page)
    assert "Page 5" in result


def test_narration_includes_heading():
    page = Page(
        page_number=1,
        text="Body text.",
        headings=[Heading(level=1, text="The Plant Cell")],
    )
    result = build_narration(page)
    assert "The Plant Cell" in result


def test_narration_includes_diagram_description():
    page = Page(
        page_number=2,
        text="Some text.",
        diagrams=[
            Diagram(
                id="fig1",
                label="Fig 2.1: Cell structure",
                description="A detailed diagram showing the cell wall and membrane.",
                labels=["cell wall", "membrane"],
            )
        ],
    )
    result = build_narration(page)
    assert "Fig 2.1: Cell structure" in result
    assert "detailed diagram" in result


def test_narration_truncates_long_text():
    page = Page(page_number=1, text="x" * 5000)
    result = build_narration(page)
    assert "..." in result
    assert len(result) < 5100


def test_narration_empty_page():
    page = Page(page_number=1)
    result = build_narration(page)
    assert "Page 1" in result
