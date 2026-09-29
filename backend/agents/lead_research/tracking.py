import json
import logging
from typing import Any

from agents.lead_research.cache import TTLCache
from agents.lead_research.llm import LLMClient, Tier
from agents.lead_research.search_provider import SearchHit, SearchProvider, SearchProviderError, SearchResponse
from agents.lead_research.state import ResearchState

logger = logging.getLogger(__name__)

_search_cache: TTLCache[SearchResponse] = TTLCache(max_entries=1000, ttl_seconds=6 * 3600)


async def call_llm(llm: LLMClient, state: ResearchState, *, system: str, user: str, tier: Tier, max_tokens: int) -> dict[str, Any]:
    state.checkpoint()
    result = await llm.complete_json(system=system, user=user, tier=tier, max_tokens=max_tokens)
    state.usage.llm_calls += 1
    state.usage.tokens += result.tokens
    return result.data


async def tracked_search(search: SearchProvider, state: ResearchState, query: str, **kwargs: Any) -> list[SearchHit]:
    """Every search goes through here: shared cache, usage/cost accounting,
    and a failed call degrades to "no results" instead of killing the run."""
    state.checkpoint()
    key = json.dumps([query, sorted(kwargs.items())], default=str)
    response = _search_cache.get(key)
    if response is None:
        state.usage.searches += 1
        try:
            response = await search.search(query, **kwargs)
        except SearchProviderError as exc:
            logger.warning("Search failed for %r: %s", query, exc)
            return []
        state.usage.search_cost_usd += response.cost_usd
        _search_cache.set(key, response)
    state.search_queries.append(query)
    state.search_results.extend(response.hits)
    return response.hits
