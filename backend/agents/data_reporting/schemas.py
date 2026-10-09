"""Output of the Data & Reporting agent: a short written summary plus blocks
(headline numbers, charts and tables), every value computed by query.py."""

from typing import Any, Literal

from pydantic import BaseModel, Field

Visual = Literal["kpi", "bar", "line", "pie", "table"]


class ReportColumn(BaseModel):
    name: str
    type: str
    role: Literal["dimension", "metric", "field"]
    unit: str | None = None


class ReportBlock(BaseModel):
    id: str
    title: str
    visual: Visual
    dataset: str
    columns: list[ReportColumn]
    rows: list[list[Any]]
    # Groups/rows before the limit, and rows that matched the filters.
    total: int = 0
    matched_rows: int = 0
    # The query in plain words ("how this was calculated").
    explanation: str = ""


class DatasetRef(BaseModel):
    id: str
    name: str
    kind: Literal["activity", "upload"]
    rows: int


class DataReportUsage(BaseModel):
    llm_calls: int = 0
    llm_tokens: int = 0
    threads_checked: int = 0


class DataReportResult(BaseModel):
    kind: Literal["data_report"] = "data_report"
    question: str
    title: str
    summary: str
    blocks: list[ReportBlock] = Field(default_factory=list)
    # What couldn't be answered or calculated, and caveats about the data.
    notes: list[str] = Field(default_factory=list)
    datasets: list[DatasetRef] = Field(default_factory=list)
    # Set when this report checked Gmail for replies itself.
    replies_checked_at: str | None = None
    generated_at: str
    usage: DataReportUsage = Field(default_factory=DataReportUsage)
