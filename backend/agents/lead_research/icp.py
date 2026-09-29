import logging
import re
from typing import Any

from pydantic import ValidationError

from agents.lead_research import prompts
from agents.lead_research.budget import ResearchBudget
from agents.lead_research.errors import LLMOutputError, ResearchFailedError
from agents.lead_research.llm import LLMClient
from agents.lead_research.schemas import ICP
from agents.lead_research.state import ResearchState
from agents.lead_research.tracking import call_llm

logger = logging.getLogger(__name__)

MIN_DISCOVERY_QUERIES = 4


class ICPAnalyzer:
    """One strong-model call that turns request + seller context into the ICP,
    discovery queries and target contact roles - everything later stages need,
    so the seller context is never sent in full again."""

    def __init__(self, llm: LLMClient):
        self._llm = llm

    async def analyze(self, state: ResearchState, request: str, company_context: dict[str, Any], budget: ResearchBudget) -> ICP:
        user = prompts.icp_user(
            request,
            company_context,
            min_queries=MIN_DISCOVERY_QUERIES,
            max_queries=budget.max_discovery_queries,
            max_leads=budget.max_leads,
        )
        for attempt in range(2):
            try:
                data = await call_llm(self._llm, state, system=prompts.ICP_SYSTEM, user=user, tier="strong", max_tokens=1400)
                icp = ICP.model_validate(data)
            except (LLMOutputError, ValidationError) as exc:
                logger.warning("ICP analysis attempt %d unusable: %s", attempt + 1, exc)
                user += "\n\nYour previous reply was not valid. Reply with the JSON object only."
                continue
            if icp.discovery_queries:
                icp.num_leads = min(icp.num_leads, budget.max_leads)
                return icp
            user += "\n\nYou returned no discovery_queries. Include them."
        raise ResearchFailedError("Could not understand the lead request well enough to start searching")


def _query_key(query: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", query.lower()))


class QueryGenerator:
    """Guards against the LLM wasting the search budget: trims empties,
    drops near-duplicates, and caps the count."""

    @staticmethod
    def select(queries: list[str], limit: int, already_used: list[str] | None = None) -> list[str]:
        chosen: list[str] = []
        keys: list[set[str]] = [_query_key(q) for q in already_used or []]
        for raw in queries:
            query = " ".join(raw.split())
            if len(query) < 4:
                continue
            key = _query_key(query)
            if any(len(key & other) / max(1, len(key | other)) >= 0.8 for other in keys):
                continue
            chosen.append(query)
            keys.append(key)
            if len(chosen) >= limit:
                break
        return chosen
