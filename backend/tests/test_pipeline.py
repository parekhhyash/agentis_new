"""End-to-end run of LeadResearchAgent with fake LLM/search/scraper - checks
the pipeline contract (dedup, filtering, evidence validation, stop
conditions, budgets, contacts) without any network or API keys."""

import asyncio
import json
import re

import pytest

from agents.lead_research import prompts
from agents.lead_research.agent import LeadResearchAgent
from agents.lead_research.budget import ResearchBudget
from agents.lead_research.errors import ResearchCancelledError, ResearchFailedError
from agents.lead_research.llm import LLMResult
from agents.lead_research.scraper import ContentFetcher
from agents.lead_research.search_provider import SearchHit, SearchResponse
from agents.lead_research.state import ScrapedPage

SELLER = {
    "company_name": "Agentis",
    "company_website": "https://agentis.ai",
    "industry": "AI software",
    "target_audience_location": "India",
    "company_description": "AI agents that automate customer support for growing businesses.",
}

COMPANIES = {
    "alpha.com": {"name": "Alpha Fintech", "entity": {"name": "Alpha Fintech", "workforce": {"total": 210}, "headquarters": {"city": "Bengaluru", "country": "India"}}},
    "beta.co.in": {"name": "Beta Pay", "entity": None},
    "gamma.io": {"name": "Gamma Games", "entity": None},
    "delta.com": {"name": "Delta Lending", "entity": None},
    "epsilon.com": {"name": "Epsilon Credit", "entity": None},
}


def _company_hits() -> list[SearchHit]:
    hits = []
    for domain, info in COMPANIES.items():
        entity = info["entity"] or {}
        hits.append(
            SearchHit(
                url=f"https://www.{domain}/",
                title=f"{info['name']} | Home",
                snippet=f"{info['name']} is an Indian company.",
                entity_type="company" if entity else None,
                entity_id=f"https://exa.ai/library/company/{domain}" if entity else None,
                entity=entity,
            )
        )
    hits += [
        SearchHit(url="https://alpha.com/about", title="About Alpha Fintech", snippet="dup of alpha"),
        SearchHit(url="https://www.linkedin.com/company/alpha", title="Alpha | LinkedIn", snippet="directory"),
        SearchHit(url="https://agentis.ai/", title="Agentis", snippet="the seller itself"),
    ]
    return hits


PEOPLE = {
    "Alpha Fintech": [
        SearchHit(url="https://www.linkedin.com/in/jane", title="Jane Doe - Head of Customer Support - Alpha Fintech | LinkedIn", snippet=""),
        SearchHit(
            url="https://www.linkedin.com/in/bob",
            title="Bob Rao | LinkedIn",
            snippet="",
            entity_type="person",
            entity={"name": "Bob Rao", "workHistory": [{"title": "COO", "company": {"name": "Alpha Fintech Pvt Ltd"}, "dates": {"to": None}}]},
        ),
        SearchHit(url="https://www.linkedin.com/in/sam", title="Sam - Customer Support Intern - Alpha Fintech | LinkedIn", snippet=""),
    ],
}


class FakeSearch:
    def __init__(self, company_hits=None):
        self.calls: list[tuple[str, str | None]] = []
        self._company_hits = company_hits if company_hits is not None else _company_hits()

    async def search(self, query, *, category=None, num_results=10, **kwargs):
        self.calls.append((query, category))
        if category == "company":
            return SearchResponse(hits=list(self._company_hits), cost_usd=0.005)
        if category == "people":
            company = next((name for name in PEOPLE if name in query), None)
            return SearchResponse(hits=PEOPLE.get(company, []), cost_usd=0.005)
        return SearchResponse(hits=[], cost_usd=0.005)

    async def get_contents(self, urls, *, max_characters):
        return []


class FakeScraper:
    def __init__(self):
        self.urls: list[str] = []

    async def scrape(self, url):
        self.urls.append(url)
        domain = re.sub(r"^https?://(www\.)?", "", url).split("/")[0]
        if url.rstrip("/").endswith("/careers"):
            return ScrapedPage(url=url, final_url=url, title="Careers", text="We are hiring 20 customer support agents.")
        links = [(f"https://{domain}/careers", "Careers"), (f"https://{domain}/about", "About")]
        return ScrapedPage(
            url=url,
            final_url=f"https://{domain}/",
            title=domain,
            text=f"{domain} homepage text about lending products in India.",
            links=links,
            emails=[f"hello@{domain}"],
            contact_page=f"https://{domain}/contact",
        )


def _assessment(company: str, update: bool) -> dict:
    base = {
        "industry": "Fintech",
        "qualification": {"icp_match": True, "industry_match": True, "geography_match": True, "size_match": "unknown", "use_case_match": True, "growth_signal": True},
        "why_relevant": f"{company} runs high-volume consumer support.",
        "signals": [],
        "evidence": [],
        "need_more": [],
    }
    if company == "Alpha Fintech":
        base.update(
            fit="strong",
            employee_count={"value": "210", "source": "S1", "status": "verified"},
            location={"value": "Bengaluru, India", "source": "S1"},
            evidence=[
                {"claim": "Serves consumer lending customers in India.", "source": "S3", "status": "verified"},
                {"claim": "Has 10,000 enterprise clients.", "source": "S99", "status": "verified"},
            ],
            signals=[{"signal": "Hiring support agents", "source": "S3"}, {"signal": "Fabricated signal", "source": "S42"}],
        )
    elif company == "Beta Pay" and not update:
        base.update(fit="possible", need_more=["careers"])
    elif company == "Beta Pay":
        base.update(
            fit="strong",
            evidence=[{"claim": "Hiring 20 customer support agents.", "source": "S3", "status": "verified"}],
            signals=[{"signal": "Hiring 20 support agents", "source": "S3"}],
        )
    elif company == "Delta Lending":
        base.update(fit="strong", qualification={**base["qualification"], "icp_match": False})
    elif company == "Epsilon Credit":
        base.update(fit="possible", evidence=[{"claim": "Offers credit lines.", "source": "S2", "status": "likely"}])
    return base


class FakeLLM:
    def __init__(self, num_leads=3, icp_override=None):
        self.calls: list[str] = []
        self.num_leads = num_leads
        self.icp_override = icp_override

    async def complete_json(self, *, system, user, tier, max_tokens):
        if system == prompts.ICP_SYSTEM:
            self.calls.append("icp")
            data = self.icp_override or {
                "num_leads": self.num_leads,
                "summary": "Indian consumer fintechs with large support operations",
                "industries": ["fintech"],
                "geographies": ["India"],
                "must_have": ["consumer fintech in India"],
                "use_case": "Automate their support queue.",
                "signals": ["hiring support agents"],
                "target_roles": ["Head of Customer Support", "COO"],
                "discovery_queries": [
                    {"query": "Indian consumer fintech companies"},
                    {"query": "indian consumer fintech companies"},
                    {"query": "Indian lending apps hiring support agents"},
                    {"query": "Indian fintech startups that raised funding"},
                ],
            }
            return LLMResult(data=data, tokens=500)
        if system == prompts.FILTER_SYSTEM:
            self.calls.append(f"filter:{tier}")
            decisions = []
            for line in user.split("CANDIDATES (id | name | website | info):\n", 1)[1].split("\n\n")[0].splitlines():
                idx, name = [p.strip() for p in line.split("|")[:2]]
                decisions.append({"id": int(idx), "relevant": name != "Gamma Games", "confidence": {"Alpha Fintech": 0.95, "Beta Pay": 0.9, "Delta Lending": 0.85}.get(name, 0.8), "reason": "ok"})
            return LLMResult(data={"decisions": decisions}, tokens=300)
        if system == prompts.RESEARCH_SYSTEM:
            company = re.search(r"COMPANY: (.+?) \(", user).group(1)
            update = "YOUR PREVIOUS ASSESSMENT" in user
            self.calls.append(f"research:{company}:{'update' if update else 'initial'}")
            return LLMResult(data=_assessment(company, update), tokens=800)
        raise AssertionError("unexpected prompt")


def _agent(llm=None, search=None, scraper=None, budget=None, **kwargs):
    search = search or FakeSearch()
    scraper = scraper or FakeScraper()
    agent = LeadResearchAgent(
        llm=llm or FakeLLM(),
        search=search,
        fetcher=ContentFetcher(scraper, search, max_chars=2000),
        budget=budget or ResearchBudget(),
        **kwargs,
    )
    return agent, search, scraper


def test_full_run_returns_evidence_backed_qualified_leads():
    llm = FakeLLM(num_leads=3)
    steps: list[str] = []

    async def on_step(label):
        steps.append(label)

    agent, search, scraper = _agent(llm=llm, on_step=on_step)
    result = asyncio.run(agent.run("Find 3 Indian consumer fintech clients", SELLER))

    names = [lead.company_name for lead in result.leads]
    assert names[:2] == ["Alpha Fintech", "Beta Pay"]  # strong fits first
    assert set(names) == {"Alpha Fintech", "Beta Pay", "Epsilon Credit"}
    assert "Delta Lending" not in names  # icp_match=false forces "Not a fit"
    assert "Gamma Games" not in names  # rejected by the cheap filter
    assert result.leads_found == 3 and result.requested_leads == 3

    # Only one near-duplicate query survives, and dedup/exclusions happen before screening.
    company_queries = [q for q, cat in search.calls if cat == "company"]
    assert len(company_queries) == 3
    researched = {c.split(":")[1] for c in llm.calls if c.startswith("research:")}
    assert researched == {"Alpha Fintech", "Beta Pay", "Delta Lending", "Epsilon Credit"}
    assert llm.calls.count("filter:fast") == 1  # one batch for all candidates, on the cheap tier

    alpha = result.leads[0]
    assert alpha.employee_count == "210" and alpha.location == "Bengaluru, India"
    claims = [e.claim for e in alpha.evidence]
    assert "Has 10,000 enterprise clients." not in claims  # cited a source that was never provided
    assert alpha.relevant_signals == ["Hiring support agents"]
    assert all(e.source_url.startswith("https://") for e in alpha.evidence)
    assert "https://exa.ai/library/company/alpha.com" in alpha.sources
    assert alpha.company_emails == ["hello@alpha.com"]
    assert alpha.qualification == "Strong potential fit"

    # Beta needed its careers page; homepage alone was insufficient.
    assert "https://beta.co.in/careers" in scraper.urls
    assert "research:Beta Pay:update" in llm.calls
    beta = result.leads[1]
    assert beta.evidence[0].source_url == "https://beta.co.in/careers"

    epsilon = next(lead for lead in result.leads if lead.company_name == "Epsilon Credit")
    assert epsilon.qualification == "Possible fit"
    assert epsilon.qualification_detail.growth_signal is None  # claimed growth with no cited signal

    # Contacts: only people the source ties to Alpha in a relevant current role; no emails invented.
    contacts = {c.name: c for c in alpha.contacts}
    assert set(contacts) == {"Jane Doe", "Bob Rao"}
    assert all(c.email is None and not c.email_verified for c in alpha.contacts)
    assert alpha.qualification_detail.contact_found is True
    assert beta.contacts == [] and beta.qualification_detail.contact_found is False

    assert result.usage.llm_calls == len(llm.calls)
    assert result.usage.searches == len(search.calls)
    assert result.usage.scrapes > 0 and result.usage.tokens > 0
    assert steps[0] == "Understanding your request..." and any(s.startswith("Researching:") for s in steps)


def test_stops_researching_once_enough_leads_qualify():
    llm = FakeLLM(num_leads=1)
    agent, _, _ = _agent(llm=llm, budget=ResearchBudget(research_concurrency=1))
    result = asyncio.run(agent.run("Find 1 fintech client", SELLER))

    assert [lead.company_name for lead in result.leads] == ["Alpha Fintech"]
    assert [c for c in llm.calls if c.startswith("research:")] == ["research:Alpha Fintech:initial"]


def test_time_budget_stops_research_but_still_returns_results():
    now = [0.0]

    def clock():
        return now[0]

    class SlowLLM(FakeLLM):
        async def complete_json(self, **kwargs):
            now[0] += 100  # every model call burns 100s of the 300s budget
            return await super().complete_json(**kwargs)

    llm = SlowLLM(num_leads=3)
    agent, _, _ = _agent(llm=llm, clock=clock, budget=ResearchBudget(research_concurrency=1))
    result = asyncio.run(agent.run("Find 3 fintech clients", SELLER))

    assert len([c for c in llm.calls if c.startswith("research:")]) < 4
    assert result.leads_found < 3
    assert "time budget" in (result.notes or "")


def test_no_candidates_returns_empty_result_with_reason():
    agent, _, _ = _agent(search=FakeSearch(company_hits=[]))
    result = asyncio.run(agent.run("Find 3 fintech clients", SELLER))
    assert result.leads == [] and "no matching companies" in result.notes


def test_cancellation_is_honoured():
    cancelled = [False]
    llm = FakeLLM()

    async def on_step(label):
        if label.startswith("Searching:"):
            cancelled[0] = True

    agent, _, _ = _agent(llm=llm, on_step=on_step, is_cancelled=lambda: cancelled[0])
    with pytest.raises(ResearchCancelledError):
        asyncio.run(agent.run("Find 3 fintech clients", SELLER))
    assert not any(c.startswith("research:") for c in llm.calls)


def test_unusable_icp_fails_cleanly():
    agent, _, _ = _agent(llm=FakeLLM(icp_override={"summary": "no queries"}))
    with pytest.raises(ResearchFailedError):
        asyncio.run(agent.run("???", SELLER))


def test_result_is_json_serializable():
    agent, _, _ = _agent()
    result = asyncio.run(agent.run("Find 3 fintech clients", SELLER))
    json.dumps(result.model_dump(mode="json"))
