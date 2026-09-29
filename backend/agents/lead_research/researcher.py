import asyncio
import json
import logging
import re
from datetime import date, timedelta
from typing import Any, Literal

from agents.lead_research import prompts
from agents.lead_research.budget import ResearchBudget
from agents.lead_research.domains import normalize_company_name, normalize_url, root_domain
from agents.lead_research.errors import ResearchCancelledError, ResearchConfigError
from agents.lead_research.llm import LLMClient
from agents.lead_research.schemas import ICP, Evidence, Lead, Qualification
from agents.lead_research.scraper import ContentFetcher
from agents.lead_research.search_provider import SearchHit, SearchProvider
from agents.lead_research.state import Candidate, FilterDecision, ResearchedCompany, ResearchState, ScrapedPage
from agents.lead_research.tracking import call_llm, tracked_search
from agents.lead_research.url_selector import PAGE_CATEGORIES, URLSelector

logger = logging.getLogger(__name__)

Fit = Literal["strong", "possible", "poor"]

FIT_LABELS: dict[str, str] = {"strong": "Strong potential fit", "possible": "Possible fit", "poor": "Not a fit"}
_SIZE_VALUES = {"verified", "likely", "unknown", "mismatch"}
_EVIDENCE_STATUSES = {"verified", "likely"}
_MAX_EVIDENCE = 6
_MAX_SIGNALS = 4
_SIGNAL_LOOKBACK_DAYS = 540


class _Sources:
    """Maps the S1..Sn labels shown to the model back to real URLs. A citation
    to a label we never issued resolves to nothing, so the claim is dropped."""

    def __init__(self) -> None:
        self._urls: list[str] = []

    def add(self, url: str) -> str:
        self._urls.append(url)
        return f"S{len(self._urls)}"

    def url(self, label: Any) -> str | None:
        match = re.fullmatch(r"\[?\s*[sS]?(\d+)\s*\]?", str(label or "").strip())
        if not match:
            return None
        index = int(match.group(1)) - 1
        return self._urls[index] if 0 <= index < len(self._urls) else None

    def __len__(self) -> int:
        return len(self._urls)


def _facts_text(facts: dict[str, Any]) -> str:
    return "\n".join(f"{key.replace('_', ' ').capitalize()}: {value}" for key, value in facts.items())


def _page_block(label: str, kind: str, page: ScrapedPage) -> str:
    title = f" - {page.title}" if page.title else ""
    return f"[{label}] {kind} {page.final_url}{title}\n{page.text}"


def _opt_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str) and value.strip().lower() in ("true", "false"):
        return value.strip().lower() == "true"
    return None


def _opt_str(value: Any, limit: int) -> str | None:
    text = " ".join(str(value or "").split())
    return text[:limit] if text and text.lower() not in ("null", "none", "unknown", "n/a") else None


def _mentions(hit: SearchHit, company_name: str) -> bool:
    name = normalize_company_name(company_name)
    haystack = normalize_company_name(f"{hit.title or ''} {hit.snippet}")
    return bool(name) and re.search(rf"\b{re.escape(name)}\b", haystack) is not None


def _compact(data: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in data.items() if k != "need_more"}


class DeepResearcher:
    """Stages 3-4 for one shortlisted company: fetch the fewest pages needed,
    ask the strong model for an evidence-cited assessment, and only pull more
    pages/news if the model says it can't decide yet."""

    def __init__(self, llm: LLMClient, fetcher: ContentFetcher, search: SearchProvider):
        self._llm = llm
        self._fetcher = fetcher
        self._search = search

    async def research(
        self, state: ResearchState, icp: ICP, decision: FilterDecision, budget: ResearchBudget
    ) -> ResearchedCompany | None:
        candidate = decision.candidate
        sources = _Sources()
        blocks: list[str] = []
        pages: list[ScrapedPage] = []

        if candidate.facts:
            label = sources.add(candidate.facts_source or candidate.source_url)
            blocks.append(f"[{label}] Exa company database\n{_facts_text(candidate.facts)}")
        if candidate.description:
            label = sources.add(candidate.source_url)
            blocks.append(f"[{label}] Search result snippet ({candidate.source_url})\n{candidate.description}")

        homepage = await self._fetcher.fetch(candidate.website, state)
        if homepage is not None:
            pages.append(homepage)
            blocks.append(_page_block(sources.add(homepage.final_url), "Homepage", homepage))

        header = prompts.research_header(icp, state.company_context, candidate.company_name, candidate.website)
        data = await self._assess(state, prompts.research_user(header, "\n\n".join(blocks)), candidate)
        if data is None:
            return None

        need_more = [c for c in data.get("need_more") or [] if isinstance(c, str) and c in PAGE_CATEGORIES]
        if need_more and data.get("fit") != "poor" and not state.out_of_time(budget.contact_time_reserve_seconds):
            last_label = len(sources)
            new_blocks = await self._gather_more(state, icp, candidate, homepage, need_more, sources, pages, budget)
            if new_blocks:
                previous = json.dumps(_compact(data), separators=(",", ":"))
                user = prompts.research_update_user(header, previous, last_label, "\n\n".join(new_blocks))
                data = await self._assess(state, user, candidate) or data

        return self._build(candidate, decision, data, sources, pages)

    async def _assess(self, state: ResearchState, user: str, candidate: Candidate) -> dict[str, Any] | None:
        try:
            return await call_llm(self._llm, state, system=prompts.RESEARCH_SYSTEM, user=user, tier="strong", max_tokens=1100)
        except (ResearchConfigError, ResearchCancelledError):
            raise
        except Exception as exc:  # noqa: BLE001 - skip this company, keep the run going
            logger.warning("Research assessment failed for %s: %s", candidate.domain, exc)
            return None

    async def _gather_more(
        self,
        state: ResearchState,
        icp: ICP,
        candidate: Candidate,
        homepage: ScrapedPage | None,
        need_more: list[str],
        sources: _Sources,
        pages: list[ScrapedPage],
        budget: ResearchBudget,
    ) -> list[str]:
        blocks: list[str] = []
        page_needs = [c for c in need_more if c != "news"]
        found: set[str] = set()
        remaining_pages = budget.max_pages_per_company - 1

        if homepage is not None and page_needs and remaining_pages > 0:
            exclude = {normalize_url(homepage.url), normalize_url(homepage.final_url)}
            picks = URLSelector.select(homepage, page_needs, exclude=exclude, limit=remaining_pages)
            fetched = await asyncio.gather(*(self._fetcher.fetch(url, state) for _, url in picks))
            for (category, _), page in zip(picks, fetched):
                if page is None:
                    continue
                found.add(category)
                pages.append(page)
                blocks.append(_page_block(sources.add(page.final_url), f"{category.capitalize()} page", page))

        wants_external = "news" in need_more or ("careers" in page_needs and "careers" not in found)
        if wants_external and budget.max_signal_searches_per_company > 0:
            blocks.extend(await self._signal_search(state, icp, candidate, sources))
        return blocks

    async def _signal_search(self, state: ResearchState, icp: ICP, candidate: Candidate, sources: _Sources) -> list[str]:
        topic = "; ".join(icp.signals[:2]) or "funding, hiring or expansion"
        since = (date.today() - timedelta(days=_SIGNAL_LOOKBACK_DAYS)).isoformat()
        hits = await tracked_search(
            self._search,
            state,
            f"{candidate.company_name} {topic}",
            category="news",
            num_results=4,
            highlight_chars=300,
            highlight_query=topic,
            start_published_date=since,
        )
        blocks = []
        for hit in hits:
            if root_domain(hit.url) != candidate.domain and not _mentions(hit, candidate.company_name):
                continue
            label = sources.add(hit.url)
            published = f" ({hit.published_date[:10]})" if hit.published_date else ""
            blocks.append(f"[{label}] Article{published}: {hit.title or ''} ({hit.url})\n{hit.snippet}")
            if len(blocks) >= 3:
                break
        return blocks

    def _build(
        self,
        candidate: Candidate,
        decision: FilterDecision,
        data: dict[str, Any],
        sources: _Sources,
        pages: list[ScrapedPage],
    ) -> ResearchedCompany:
        evidence: list[Evidence] = []
        cited: list[str] = []

        for item in data.get("evidence") or []:
            if not isinstance(item, dict) or len(evidence) >= _MAX_EVIDENCE:
                continue
            claim = _opt_str(item.get("claim"), 240)
            status = str(item.get("status") or "").lower()
            url = sources.url(item.get("source"))
            if claim and url and status in _EVIDENCE_STATUSES:
                evidence.append(Evidence(claim=claim, source_url=url, status=status))  # type: ignore[arg-type]
                cited.append(url)

        signals: list[str] = []
        for item in data.get("signals") or []:
            if not isinstance(item, dict) or len(signals) >= _MAX_SIGNALS:
                continue
            text = _opt_str(item.get("signal"), 120)
            url = sources.url(item.get("source"))
            if text and url:
                signals.append(text)
                cited.append(url)

        employee_count = None
        employees = data.get("employee_count")
        if isinstance(employees, dict):
            value = _opt_str(employees.get("value"), 60)
            status = str(employees.get("status") or "").lower()
            url = sources.url(employees.get("source"))
            if value and url and status in _EVIDENCE_STATUSES:
                employee_count = value if status == "verified" else f"{value} (unverified)"
                evidence.insert(0, Evidence(claim=f"Employee count: {value}", source_url=url, status=status))  # type: ignore[arg-type]
                cited.append(url)

        location = None
        raw_location = data.get("location")
        if isinstance(raw_location, dict):
            value = _opt_str(raw_location.get("value"), 80)
            url = sources.url(raw_location.get("source"))
            if value and url:
                location = value
                cited.append(url)

        q = data.get("qualification") if isinstance(data.get("qualification"), dict) else {}
        size_match = str(q.get("size_match") or "unknown").lower()
        qualification = Qualification(
            icp_match=_opt_bool(q.get("icp_match")) is True,
            industry_match=_opt_bool(q.get("industry_match")),
            geography_match=_opt_bool(q.get("geography_match")),
            size_match=size_match if size_match in _SIZE_VALUES else "unknown",  # type: ignore[arg-type]
            use_case_match=_opt_bool(q.get("use_case_match")),
            # A growth signal is a criterion claim - it needs a cited signal behind it.
            growth_signal=_opt_bool(q.get("growth_signal")) if signals else None,
        )

        fit: Fit = data.get("fit") if data.get("fit") in FIT_LABELS else ("possible" if qualification.icp_match else "poor")
        if not qualification.icp_match:
            fit = "poor"
        elif fit == "strong" and not evidence:
            fit = "possible"

        lead = Lead(
            company_name=candidate.company_name,
            website=candidate.website,
            industry=_opt_str(data.get("industry"), 60),
            location=location,
            employee_count=employee_count,
            qualification=FIT_LABELS[fit],
            why_relevant=_opt_str(data.get("why_relevant"), 400) or "",
            relevant_signals=signals,
            qualification_detail=qualification,
            evidence=evidence,
            company_emails=sorted({email for page in pages for email in page.emails}),
            contact_page=next((page.contact_page for page in pages if page.contact_page), None),
            sources=list(dict.fromkeys(cited)),
        )
        return ResearchedCompany(candidate=candidate, fit=fit, lead=lead, confidence=decision.confidence, pages=pages)
