import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal

from agents.lead_research.budget import ResearchBudget
from agents.lead_research.errors import ResearchCancelledError
from agents.lead_research.schemas import ICP, Lead, ResearchUsage


@dataclass
class Candidate:
    company_name: str
    website: str
    domain: str
    description: str
    source_url: str
    discovery_query: str
    facts: dict[str, Any] = field(default_factory=dict)
    facts_source: str | None = None


@dataclass
class FilterDecision:
    candidate: Candidate
    relevant: bool
    confidence: float
    reason: str


@dataclass
class ScrapedPage:
    url: str
    final_url: str
    title: str | None
    text: str
    links: list[tuple[str, str]] = field(default_factory=list)
    emails: list[str] = field(default_factory=list)
    contact_page: str | None = None
    via: Literal["scraper", "exa"] = "scraper"


@dataclass
class ResearchedCompany:
    candidate: Candidate
    fit: Literal["strong", "possible", "poor"]
    lead: Lead
    confidence: float


@dataclass
class ResearchState:
    """Single source of truth for one run - what the spec calls research
    memory. Every stage reads/writes here so budgets are enforceable and the
    run is observable after the fact."""

    objective: str
    company_context: dict[str, Any]
    budget: ResearchBudget
    clock: Callable[[], float] = time.monotonic
    started_at: float = 0.0

    icp: ICP | None = None
    search_queries: list[str] = field(default_factory=list)
    search_results: list[Any] = field(default_factory=list)
    candidates: list[Candidate] = field(default_factory=list)
    filtered_candidates: list[FilterDecision] = field(default_factory=list)
    researched_companies: list[ResearchedCompany] = field(default_factory=list)
    scraped_pages: dict[str, ScrapedPage] = field(default_factory=dict)
    contacts: dict[str, list[Any]] = field(default_factory=dict)
    final_leads: list[Lead] = field(default_factory=list)
    usage: ResearchUsage = field(default_factory=ResearchUsage)
    stop_reason: str | None = None
    notes: list[str] = field(default_factory=list)
    is_cancelled: Callable[[], bool] | None = None

    def __post_init__(self) -> None:
        if not self.started_at:
            self.started_at = self.clock()

    def checkpoint(self) -> None:
        if self.is_cancelled is not None and self.is_cancelled():
            raise ResearchCancelledError("Cancelled by the caller")

    def elapsed(self) -> float:
        return self.clock() - self.started_at

    def time_left(self) -> float:
        return self.budget.max_runtime_seconds - self.elapsed()

    def out_of_time(self, reserve_seconds: float = 0.0) -> bool:
        return self.time_left() <= reserve_seconds

    def qualified(self) -> list[ResearchedCompany]:
        return [r for r in self.researched_companies if r.fit != "poor" and r.lead.qualification_detail.icp_match]
