import asyncio
import math
from typing import Any

from agents.lead_research.budget import ResearchBudget
from agents.lead_research.domains import (
    company_name_from_title,
    homepage_url,
    is_non_company_domain,
    names_match,
    normalize_company_name,
    root_domain,
)
from agents.lead_research.search_provider import SearchHit, SearchProvider
from agents.lead_research.state import Candidate, ResearchState
from agents.lead_research.tracking import tracked_search

_HIGHLIGHT_QUERY = "what the company does, who its customers are, its size and location"


def _company_facts(entity: dict[str, Any]) -> dict[str, Any]:
    facts: dict[str, Any] = {}
    workforce = entity.get("workforce") or {}
    if workforce.get("total"):
        facts["employees"] = workforce["total"]
    hq = entity.get("headquarters") or {}
    location = ", ".join(part for part in (hq.get("city"), hq.get("country")) if part)
    if location:
        facts["headquarters"] = location
    if entity.get("foundedYear"):
        facts["founded"] = entity["foundedYear"]
    financials = entity.get("financials") or {}
    if financials.get("fundingTotal"):
        facts["total_funding_usd"] = financials["fundingTotal"]
    latest = financials.get("fundingLatestRound") or {}
    round_desc = " ".join(str(v) for v in (latest.get("name"), latest.get("date")) if v)
    if round_desc:
        facts["latest_funding_round"] = round_desc + (f" (${latest['amount']:,})" if latest.get("amount") else "")
    return facts


def hit_to_candidate(hit: SearchHit, query: str) -> Candidate | None:
    domain = root_domain(hit.url)
    if not domain or "." not in domain or is_non_company_domain(domain):
        return None
    name = (hit.entity.get("name") or "").strip() or company_name_from_title(hit.title, domain)
    description = (hit.entity.get("description") or "").strip() or hit.snippet
    source = hit.entity_id if (hit.entity_id or "").startswith("http") else hit.url
    facts = _company_facts(hit.entity) if hit.entity_type == "company" else {}
    return Candidate(
        company_name=name,
        website=homepage_url(hit.url),
        domain=domain,
        description=description[:400],
        source_url=hit.url,
        discovery_query=query,
        facts=facts,
        facts_source=source if facts else None,
    )


class CompanyDiscovery:
    """Stage 1: run the discovery queries against the search provider's
    company index and keep only lightweight candidate records."""

    def __init__(self, search: SearchProvider):
        self._search = search

    async def discover(self, state: ResearchState, queries: list[str], budget: ResearchBudget) -> list[Candidate]:
        if not queries:
            return []
        per_query = max(5, min(25, math.ceil(budget.max_discovery_results / len(queries))))
        results = await asyncio.gather(
            *(
                tracked_search(
                    self._search,
                    state,
                    query,
                    category="company",
                    num_results=per_query,
                    highlight_chars=300,
                    highlight_query=_HIGHLIGHT_QUERY,
                )
                for query in queries
            )
        )
        # Round-robin across queries so the per-run cap keeps every search angle
        # represented instead of only the first few queries' results.
        candidates: list[Candidate] = []
        for rank in range(per_query):
            for query, hits in zip(queries, results):
                if rank < len(hits) and len(candidates) < budget.max_discovery_results:
                    if (candidate := hit_to_candidate(hits[rank], query)) is not None:
                        candidates.append(candidate)
        return candidates


class CandidateDeduplicator:
    @staticmethod
    def dedupe(candidates: list[Candidate], *, seller_domain: str, seller_name: str, limit: int) -> list[Candidate]:
        by_domain: dict[str, Candidate] = {}
        seen_names: set[str] = set()
        for candidate in candidates:
            if candidate.domain == seller_domain or (seller_name and names_match(candidate.company_name, seller_name)):
                continue
            existing = by_domain.get(candidate.domain)
            if existing is not None:
                if not existing.facts and candidate.facts:
                    existing.facts, existing.facts_source = candidate.facts, candidate.facts_source
                if len(candidate.description) > len(existing.description):
                    existing.description = candidate.description
                continue
            name_key = normalize_company_name(candidate.company_name)
            if name_key and name_key in seen_names:
                continue
            if len(by_domain) >= limit:
                continue
            by_domain[candidate.domain] = candidate
            if name_key:
                seen_names.add(name_key)
        return list(by_domain.values())
