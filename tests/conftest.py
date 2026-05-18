"""Shared test fixtures for Folio tests."""

from __future__ import annotations

import os
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("FOLIO_DEMO_MODE", "0")
os.environ.setdefault("FOLIO_TTS", "say")

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_page_image() -> bytes:
    """Load a real test fixture image (or generate a placeholder)."""
    img_path = FIXTURES_DIR / "page1.jpg"
    if img_path.exists():
        return img_path.read_bytes()
    # Generate a simple test image with text
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (800, 1000), "white")
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
        small_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
    except (OSError, IOError):
        font = ImageFont.load_default()
        small_font = font

    draw.text((50, 30), "Chapter 3: The Plant Cell", fill="black", font=font)
    draw.text((50, 80), "3.1 Cell Wall", fill="black", font=font)
    body = (
        "The plant cell wall is composed of cellulose microfibrils.\n"
        "It provides structural support and protection.\n\n"
        "The cell membrane lies just inside the cell wall.\n"
        "It is selectively permeable, controlling what enters and exits.\n\n"
        "The cytoplasm contains various organelles including:\n"
        "- Chloroplasts (photosynthesis)\n"
        "- Mitochondria (cellular respiration)\n"
        "- Ribosomes (protein synthesis)\n"
        "- Endoplasmic reticulum (transport)"
    )
    y = 130
    for line in body.split("\n"):
        draw.text((50, y), line, fill="black", font=small_font)
        y += 25

    # Draw a simple diagram
    draw.rectangle([50, y + 20, 400, y + 300], outline="black", width=2)
    draw.text((150, y + 5), "Fig. 3.1: Plant Cell", fill="black", font=small_font)
    draw.ellipse([150, y + 80, 300, y + 200], outline="green", width=2)
    draw.text((180, y + 130), "Nucleus", fill="black", font=small_font)
    draw.text((70, y + 310), "Fig. 3.1: A typical plant cell showing major organelles.", fill="black", font=small_font)

    import io
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    # Save for reuse
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)
    img_path.write_bytes(buf.getvalue())
    return buf.getvalue()


@pytest.fixture
def plant_cell_pages() -> list:
    """Pre-built Page objects for testing grounded Q&A."""
    from folio.schemas import Page, Heading, Diagram

    return [
        Page(
            page_number=1,
            text=(
                "The plant cell wall is composed of cellulose microfibrils. "
                "It provides structural support and protection. "
                "The cell membrane lies just inside the cell wall. "
                "It is selectively permeable, controlling what enters and exits the cell."
            ),
            headings=[
                Heading(level=1, text="Chapter 3: The Plant Cell"),
                Heading(level=2, text="3.1 Cell Wall"),
            ],
            diagrams=[
                Diagram(
                    id="fig_3_1",
                    label="Fig. 3.1: Plant cell cross-section",
                    description=(
                        "A labelled diagram of a plant cell. The cell wall is the outermost layer. "
                        "Inside: cell membrane, cytoplasm, large central vacuole. "
                        "The nucleus is on the upper-right with nucleolus inside. "
                        "Several green chloroplasts scattered through cytoplasm."
                    ),
                    labels=["cell wall", "cell membrane", "cytoplasm", "vacuole", "nucleus"],
                )
            ],
            captions=["Fig. 3.1: A typical plant cell."],
        ),
        Page(
            page_number=2,
            text=(
                "Ribosomes are the sites of protein synthesis. They can be found free in the "
                "cytoplasm or attached to the endoplasmic reticulum. Ribosomes translate mRNA "
                "into polypeptide chains. The rough endoplasmic reticulum has ribosomes on its "
                "surface and is involved in protein processing and transport."
            ),
            headings=[Heading(level=2, text="3.2 Ribosomes and ER")],
            diagrams=[],
            captions=[],
        ),
        Page(
            page_number=3,
            text=(
                "Mitochondria are the powerhouse of the cell. They perform cellular respiration, "
                "converting glucose and oxygen into ATP (adenosine triphosphate). Each mitochondrion "
                "has a double membrane — the inner membrane is folded into cristae to increase "
                "surface area for ATP production."
            ),
            headings=[Heading(level=2, text="3.3 Mitochondria")],
            diagrams=[
                Diagram(
                    id="fig_3_2",
                    label="Fig. 3.2: Mitochondrion structure",
                    description=(
                        "A cross-section of a mitochondrion showing the outer membrane (smooth), "
                        "inner membrane (folded into cristae), matrix (interior), and intermembrane space."
                    ),
                    labels=["outer membrane", "inner membrane", "cristae", "matrix"],
                )
            ],
            captions=["Fig. 3.2: Structure of a mitochondrion."],
        ),
    ]


@pytest.fixture
async def api_client():
    """AsyncClient wired to the Folio FastAPI app."""
    from folio.api import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
