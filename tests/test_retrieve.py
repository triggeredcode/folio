"""Tests for page retrieval (pure logic, no Ollama needed)."""

import pytest
from folio.retrieve import retrieve_pages
from folio.schemas import Page, Heading, Diagram


def test_retrieve_all_when_few_pages(plant_cell_pages):
    """When <= 8 pages, return all pages."""
    result = retrieve_pages("what is a ribosome?", plant_cell_pages)
    assert len(result) == 3
    assert result == plant_cell_pages


def test_retrieve_empty_pages():
    """Empty pages list returns empty."""
    result = retrieve_pages("anything", [])
    assert result == []


def test_retrieve_bm25_when_many_pages():
    """When > 8 pages, use BM25 to select relevant ones."""
    pages = [
        Page(page_number=i, text=f"Content about topic {i}" * 20)
        for i in range(1, 12)
    ]
    pages[4] = Page(page_number=5, text="The ribosome is responsible for protein synthesis. " * 10)
    pages[7] = Page(page_number=8, text="Ribosomes translate mRNA into proteins. " * 10)

    result = retrieve_pages("what is a ribosome?", pages, top_k=3)
    page_nums = [p.page_number for p in result]
    assert 5 in page_nums
    assert 8 in page_nums


def test_retrieve_includes_most_recent():
    """Most recently ingested page is always included."""
    import time
    pages = [
        Page(page_number=i, text=f"Unrelated content {i}" * 20, ingested_at_ms=1000 + i)
        for i in range(1, 12)
    ]
    pages[-1] = Page(page_number=11, text="Also unrelated", ingested_at_ms=9999)

    result = retrieve_pages("ribosome protein synthesis", pages, top_k=3)
    page_nums = [p.page_number for p in result]
    assert 11 in page_nums
