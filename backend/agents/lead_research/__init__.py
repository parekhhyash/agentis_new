from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from typing import Any

from agents.lead_research.agent import LeadResearchAgent, ProgressCallback
from agents.lead_research.errors import ResearchConfigError
from agents.lead_research.exa import ExaSearchProvider
from agents.lead_research.llm import build_llm_client
from agents.lead_research.schemas import LeadResearchResult
from agents.lead_research.scraper import ContentFetcher, WebScraper

__all__ = ["LeadResearchAgent", "LeadResearchResult", "lead_research_agent"]


@asynccontextmanager
async def lead_research_agent(
    settings: Any,
    *,
    on_step: ProgressCallback | None = None,
    is_cancelled: Callable[[], bool] | None = None,
) -> AsyncIterator[LeadResearchAgent]:
    """Builds the agent with the configured providers (Exa, our scraper,
    litellm) and closes their HTTP clients afterwards."""
    if not settings.exa_api_key:
        raise ResearchConfigError("EXA_API_KEY is not configured on the backend")
    budget = settings.lead_research_budget
    llm = build_llm_client(settings)
    search = ExaSearchProvider(settings.exa_api_key)
    scraper = WebScraper(max_chars=budget.max_page_chars, respect_robots=settings.scraper_respect_robots)
    try:
        yield LeadResearchAgent(
            llm=llm,
            search=search,
            fetcher=ContentFetcher(scraper, search, budget.max_page_chars),
            budget=budget,
            on_step=on_step,
            is_cancelled=is_cancelled,
        )
    finally:
        await scraper.aclose()
        await search.aclose()
