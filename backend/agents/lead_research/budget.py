import math

from pydantic import BaseModel, Field


class ResearchBudget(BaseModel):
    """Hard limits for one lead research run. Configured via env vars
    (LEAD_RESEARCH_BUDGET__<FIELD>) and scaled down per request so a
    5-lead ask never pays for a 30-lead search."""

    max_total_runtime_minutes: float = 12.0
    max_discovery_queries: int = 10
    max_discovery_results: int = 150
    max_unique_candidates: int = 100
    max_filtered_candidates: int = 30
    max_deep_research_companies: int = 30
    max_pages_per_company: int = 5
    max_signal_searches_per_company: int = 1
    max_contact_searches_per_company: int = 3
    max_contacts_per_company: int = 3
    max_leads: int = 25

    filter_batch_size: int = 20
    filter_min_confidence: float = 0.5
    research_concurrency: int = 6
    contact_concurrency: int = 4
    max_page_chars: int = 3500
    # Kept free for contact research when research stops; contacts also get at
    # least this long even if research ran right up to the runtime limit.
    contact_time_reserve_seconds: float = 90.0

    requested_leads: int = Field(default=10, exclude=True)

    @property
    def max_runtime_seconds(self) -> float:
        return self.max_total_runtime_minutes * 60

    def scaled(self, requested_leads: int) -> "ResearchBudget":
        n = max(1, min(requested_leads, self.max_leads))
        filtered = min(self.max_filtered_candidates, max(6, 2 * n + 2))
        unique = min(self.max_unique_candidates, max(20, 6 * n))
        return self.model_copy(
            update={
                "requested_leads": n,
                "max_discovery_queries": min(self.max_discovery_queries, max(4, math.ceil(n / 3) + 3)),
                "max_discovery_results": min(self.max_discovery_results, math.ceil(unique * 1.5)),
                "max_unique_candidates": unique,
                "max_filtered_candidates": filtered,
                "max_deep_research_companies": min(self.max_deep_research_companies, filtered),
            }
        )
