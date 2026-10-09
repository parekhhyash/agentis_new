"""Output of the Content & Copy agent: for each requested piece, a few
scored variants (best first is marked as recommended), with the problems
the code checks found and where each one was posted."""

from typing import Literal

from pydantic import BaseModel, Field


class Issue(BaseModel):
    # "error" breaks a hard rule (too long, empty); "warning" is worth a look.
    level: Literal["error", "warning"]
    message: str


class Publication(BaseModel):
    provider: Literal["linkedin", "x"]
    url: str
    posted_at: str
    # How many posts went out (a thread can stop part way).
    posts: int = 1


class Variant(BaseModel):
    id: str
    # Short name for the approach ("Story", "Data-led", "Question hook").
    angle: str = ""
    # Post / caption / article body / email body / ad primary text.
    text: str = ""
    # Thread posts, in order.
    parts: list[str] = Field(default_factory=list)
    # Blog title or email subject.
    title: str | None = None
    # Meta description or email preview line.
    subtitle: str | None = None
    headlines: list[str] = Field(default_factory=list)
    descriptions: list[str] = Field(default_factory=list)
    score: float | None = None
    scores: dict[str, float] = Field(default_factory=dict)
    reason: str = ""
    issues: list[Issue] = Field(default_factory=list)
    published: list[Publication] = Field(default_factory=list)


class Piece(BaseModel):
    id: str
    format: str
    label: str
    platform: str | None = None
    limit: int | None = None
    x_count: bool = False
    topic: str = ""
    variants: list[Variant] = Field(default_factory=list)
    recommended_id: str | None = None


class ContentUsage(BaseModel):
    llm_calls: int = 0
    llm_tokens: int = 0


class ContentResult(BaseModel):
    kind: Literal["content_copy"] = "content_copy"
    request: str
    summary: str = ""
    pieces: list[Piece] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    usage: ContentUsage = Field(default_factory=ContentUsage)
