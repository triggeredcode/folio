"""Pydantic models for Folio's data contracts."""

from __future__ import annotations

import time
import uuid
from typing import Literal, Optional

from pydantic import BaseModel, Field


class Heading(BaseModel):
    level: int
    text: str


class Diagram(BaseModel):
    id: str = ""
    label: str = ""
    description: str = ""
    labels: list[str] = Field(default_factory=list)


class Page(BaseModel):
    page_id: str = Field(default_factory=lambda: f"p{uuid.uuid4().hex[:8]}")
    page_number: int
    text: str = ""
    headings: list[Heading] = Field(default_factory=list)
    diagrams: list[Diagram] = Field(default_factory=list)
    captions: list[str] = Field(default_factory=list)
    raw_image_path: Optional[str] = None
    narration_text: str = ""
    ingested_at_ms: int = Field(default_factory=lambda: int(time.time() * 1000))


class Session(BaseModel):
    session_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    mode: Literal["reader", "tutor"]
    lang: str = "en"
    pages: list[Page] = Field(default_factory=list)
    created_at_ms: int = Field(default_factory=lambda: int(time.time() * 1000))


class SessionCreateRequest(BaseModel):
    mode: Literal["reader", "tutor"]
    lang: str = "en"


class AskRequest(BaseModel):
    session_id: str
    question: str
    lang: str = "en"
    selected_pages: Optional[list[int]] = None


class AskResponse(BaseModel):
    answer: str
    citations: list[dict] = Field(default_factory=list)
    not_in_book: bool = False
    pages_used: list[int] = Field(default_factory=list)


class TTSRequest(BaseModel):
    text: str
    voice: str = "samantha"
