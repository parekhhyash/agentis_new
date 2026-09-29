import asyncio
import logging
import math
import time
from collections.abc import Awaitable, Callable
from typing import Any

from agents.lead_research.budget import ResearchBudget
from agents.lead_research.candidate_filter import CandidateFilter
from agents.lead_research.contacts import ContactResearcher
from agents.lead_research.discovery import CandidateDeduplicator, CompanyDiscovery
from agents.lead_research.domains import root_domain
from agents.lead_research.errors import LeadResearchError
from agents.lead_research.formatter import ResultFormatter
from agents.lead_research.icp import ICPAnalyzer, QueryGenerator
from agents.lead_research.llm import LLMClient
from agents.lead_research.researcher import DeepResearcher
from agents.lead_research.schemas import LeadResearchResult
from agents.lead_research.scraper import ContentFetcher
from agents.lead_research.search_provider import SearchProvider
from agents.lead_research.site_contacts import SiteContactExtractor, attach_published_emails, merge_contacts
from agents.lead_research.state import Candidate, FilterDecision, ResearchedCompany, ResearchState

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[str], Awaitable[None]]

# Stop condition 3: after this many researched companies, a qualification rate
# below the threshold means the remaining (lower-confidence) candidates are
# very unlikely to change the outcome.
_LOW_YIELD_MIN_RESEARCHED = 8
_LOW_YIELD_RATE = 0.15


async def _noop_step(_: str) -> None:
    return None


class LeadResearchAgent:
    """ICP -> discovery -> dedup -> cheap filter -> deep research -> contacts.
    The application drives every step; the LLM only decides *what* is needed
    (queries, fit, missing info) and never makes network calls itself."""

    def __init__(
        self,
        *,
        llm: LLMClient,
        search: SearchProvider,
        fetcher: ContentFetcher,
        budget: ResearchBudget | None = None,
        on_step: ProgressCallback | None = None,
        is_cancelled: Callable[[], bool] | None = None,
        clock: Callable[[], float] = time.monotonic,
    ):
        self._llm = llm
        self._search = search
        self._base_budget = budget or ResearchBudget()
        self._step = on_step or _noop_step
        self._is_cancelled = is_cancelled
        self._clock = clock

        self._icp = ICPAnalyzer(llm)
        self._discovery = CompanyDiscovery(search)
        self._filter = CandidateFilter(llm)
        self._researcher = DeepResearcher(llm, fetcher, search)
        self._contacts = ContactResearcher(search)
        self._site_contacts = SiteContactExtractor(llm, fetcher)

    async def run(self, request: str, company_context: dict[str, Any] | None = None) -> LeadResearchResult:
        context = company_context or {}
        state = ResearchState(
            objective=request,
            company_context=context,
            budget=self._base_budget,
            clock=self._clock,
            is_cancelled=self._is_cancelled,
        )
        seller_name = str(context.get("company_name") or "").strip()
        website = str(context.get("company_website") or "").strip()
        seller_domain = root_domain(website) if website else ""

        await self._step("Understanding your request...")
        icp = await self._icp.analyze(state, request, context, self._base_budget)
        state.icp = icp
        state.budget = budget = self._base_budget.scaled(icp.num_leads)

        candidates = await self._discover(state, [q.query for q in icp.discovery_queries], seller_name, seller_domain)
        if len(candidates) < max(10, 2 * budget.requested_leads) and icp.fallback_queries and not state.out_of_time():
            await self._step("Few matches so far - broadening the search...")
            more = await self._discover(state, icp.fallback_queries, seller_name, seller_domain, used=state.search_queries)
            candidates = CandidateDeduplicator.dedupe(
                candidates + more, seller_domain=seller_domain, seller_name=seller_name, limit=budget.max_unique_candidates
            )
        state.candidates = candidates
        if not candidates:
            state.stop_reason = "no matching companies were found for this request"
            return self._finish(state)

        state.checkpoint()
        await self._step(f"Found {len(candidates)} companies - screening them against your criteria...")
        state.filtered_candidates = await self._filter.filter(
            state, icp, candidates, budget, seller_name=seller_name, seller_domain=seller_domain
        )
        if not state.filtered_candidates:
            state.stop_reason = "none of the companies found matched the criteria closely enough"
            return self._finish(state)

        await self._step(f"Shortlisted {len(state.filtered_candidates)} companies for deeper research")
        await self._research(state)

        qualified = state.qualified()
        ranked = sorted(qualified, key=lambda r: (r.fit != "strong", -r.confidence))
        final = ranked[: budget.requested_leads]
        await self._find_contacts(state, final)
        state.final_leads = [r.lead for r in final]
        return self._finish(state)

    async def _discover(
        self, state: ResearchState, raw_queries: list[str], seller_name: str, seller_domain: str, used: list[str] | None = None
    ) -> list[Candidate]:
        budget = state.budget
        queries = QueryGenerator.select(raw_queries, budget.max_discovery_queries, already_used=used)
        for query in queries:
            await self._step(f"Searching: {query}")
        found = await self._discovery.discover(state, queries, budget)
        return CandidateDeduplicator.dedupe(
            found, seller_domain=seller_domain, seller_name=seller_name, limit=budget.max_unique_candidates
        )

    async def _research(self, state: ResearchState) -> None:
        budget = state.budget
        icp = state.icp
        queue: list[FilterDecision] = list(state.filtered_candidates[: budget.max_deep_research_companies])
        researched = 0

        while queue:
            state.checkpoint()
            qualified = len(state.qualified())
            if qualified >= budget.requested_leads:
                state.stop_reason = "enough qualified leads were found"
                return
            if state.out_of_time(budget.contact_time_reserve_seconds):
                state.stop_reason = "the research time budget ran out"
                return
            if researched >= _LOW_YIELD_MIN_RESEARCHED and qualified / researched < _LOW_YIELD_RATE:
                state.stop_reason = "the remaining candidates were unlikely to meet the criteria"
                return

            shortfall = budget.requested_leads - qualified
            wave_size = min(budget.research_concurrency, len(queue), max(1, math.ceil(shortfall * 1.5)))
            wave, queue = queue[:wave_size], queue[wave_size:]
            for decision in wave:
                await self._step(f"Researching: {decision.candidate.company_name}")

            # The wave may not run into the time reserved for contact research:
            # companies still in progress at the deadline are abandoned, the
            # finished ones are kept.
            tasks = {asyncio.ensure_future(self._researcher.research(state, icp, d, budget)): d for d in wave}
            deadline = max(1.0, state.time_left() - budget.contact_time_reserve_seconds)
            done, pending = await asyncio.wait(tasks, timeout=deadline)
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
                logger.info("Research deadline hit; abandoned %d compan(ies)", len(pending))
            researched += len(wave)
            for task in done:
                decision = tasks[task]
                if task.exception() is not None:
                    if isinstance(task.exception(), LeadResearchError):
                        raise task.exception()
                    logger.warning("Research crashed for %s: %r", decision.candidate.domain, task.exception())
                elif isinstance(task.result(), ResearchedCompany):
                    state.researched_companies.append(task.result())

        if len(state.qualified()) < budget.requested_leads:
            state.stop_reason = "all shortlisted companies were researched"

    async def _find_contacts(self, state: ResearchState, final: list[ResearchedCompany]) -> None:
        if not final:
            return
        budget = state.budget
        roles = state.icp.target_roles if state.icp else []
        semaphore = asyncio.Semaphore(budget.contact_concurrency)
        await self._step("Finding decision-makers at the qualified companies...")

        async def run(company: ResearchedCompany) -> None:
            async with semaphore:
                contacts = await self._contacts.find(state, company.lead, roles, budget)
                if budget.site_contact_extraction and len(contacts) < budget.max_contacts_per_company:
                    site = await self._site_contacts.extract(state, company, roles, budget)
                    contacts = merge_contacts(contacts, site, budget.max_contacts_per_company)
                attach_published_emails(company, contacts)
                state.contacts[company.candidate.domain] = contacts
                company.lead.contacts = contacts
                company.lead.qualification_detail.contact_found = bool(contacts)

        # Contacts are what make a lead actionable and cost only a few searches
        # (no LLM), so they always get their reserved window, even when research
        # ran right up to the runtime limit.
        window = max(state.time_left(), budget.contact_time_reserve_seconds)
        tasks = [asyncio.ensure_future(run(c)) for c in final]
        done, pending = await asyncio.wait(tasks, timeout=window)
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
            state.notes.append(f"Contact research ran out of time for {len(pending)} compan{'y' if len(pending) == 1 else 'ies'}.")
        for task in done:
            error = task.exception()
            if isinstance(error, LeadResearchError):
                raise error
            if error is not None:
                logger.warning("Contact research crashed: %r", error)

    def _finish(self, state: ResearchState) -> LeadResearchResult:
        result = ResultFormatter.format(state)
        logger.info(
            "Lead research done: %d/%d leads, stop=%r, usage=%s",
            result.leads_found, result.requested_leads, state.stop_reason, result.usage.model_dump(),
        )
        return result
