#!/usr/bin/env python3
"""Process a PDF through Folio pipeline — CLI tool for testing.

Usage:
    python scripts/process_pdf.py /path/to/textbook.pdf --pages 1-5
    python scripts/process_pdf.py /path/to/textbook.pdf --pages 3 --ask "What is a cell?"
"""

import asyncio
import json
import sys
import io
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from folio.vision import extract_page
from folio.narrate import build_narration
from folio.ask import ask_grounded
from folio.schemas import Page


async def main():
    import argparse

    parser = argparse.ArgumentParser(description="Process a PDF through Folio")
    parser.add_argument("pdf_path", help="Path to PDF file")
    parser.add_argument("--pages", default="1-3", help="Page range (e.g., '1-5' or '3')")
    parser.add_argument("--ask", nargs="*", help="Questions to ask after processing")
    parser.add_argument("--session", default="cli_test", help="Session ID for caching")
    args = parser.parse_args()

    pdf_path = Path(args.pdf_path)
    if not pdf_path.exists():
        print(f"Error: {pdf_path} not found")
        sys.exit(1)

    # Parse page range
    if "," in args.pages:
        page_range = [int(p.strip()) for p in args.pages.split(",")]
    elif "-" in args.pages:
        start, end = args.pages.split("-")
        page_range = list(range(int(start), int(end) + 1))
    else:
        page_range = [int(args.pages)]

    print(f"📖 Processing {pdf_path.name}, pages {list(page_range)}")
    print(f"   Session: {args.session}")
    print()

    # Rasterize and process
    import pypdfium2 as pdfium

    doc = pdfium.PdfDocument(pdf_path)
    total_pages = len(doc)
    print(f"   PDF has {total_pages} total pages")

    pages: list[Page] = []
    for page_num in page_range:
        if page_num > total_pages:
            print(f"   ⚠️  Page {page_num} exceeds PDF length, skipping")
            break

        idx = page_num - 1
        print(f"   📄 Page {page_num}...", end=" ", flush=True)

        pdf_page = doc[idx]
        bitmap = pdf_page.render(scale=200 / 72)
        pil_image = bitmap.to_pil()
        buf = io.BytesIO()
        pil_image.save(buf, format="PNG")
        image_bytes = buf.getvalue()

        page = await extract_page(image_bytes, page_num, session_id=args.session)
        narration = build_narration(page)
        page.narration_text = narration
        pages.append(page)

        print(f"✅ ({len(page.text)} chars, {len(page.diagrams)} diagrams)")
        if page.headings:
            print(f"       Headings: {', '.join(h.text for h in page.headings[:3])}")

    print(f"\n✅ Processed {len(pages)} pages successfully")
    print(f"   Cached at: demos/cached_responses/vision_{args.session}_p*.json")

    # Ask questions if provided
    if args.ask:
        print(f"\n💬 Asking {len(args.ask)} questions:")
        for question in args.ask:
            print(f"\n   Q: {question}")
            response = await ask_grounded(question, pages, session_id=args.session)
            if response.not_in_book:
                print(f"   A: ❌ Not in book")
            else:
                print(f"   A: {response.answer[:200]}")
                if response.citations:
                    print(f"   📎 Citations: {response.citations}")


if __name__ == "__main__":
    asyncio.run(main())
