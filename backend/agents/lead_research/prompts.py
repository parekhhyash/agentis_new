from typing import Any

from agents.lead_research.schemas import ICP

_SELLER_FIELDS = (
    ("company_name", "Name"),
    ("company_website", "Website"),
    ("industry", "Industry"),
    ("target_audience_location", "Their customers are in"),
    ("company_description", "What they do"),
)


def seller_block(company_context: dict[str, Any], max_description_chars: int | None = None) -> str:
    lines = []
    for field, label in _SELLER_FIELDS:
        value = str(company_context.get(field) or "").strip()
        if not value:
            continue
        if field == "company_description" and max_description_chars:
            value = value[:max_description_chars]
        lines.append(f"{label}: {value}")
    return "\n".join(lines) if lines else "(no seller profile on file)"


def icp_criteria_block(icp: ICP) -> str:
    rows = [
        ("Must have", "; ".join(icp.must_have)),
        ("Exclude", "; ".join(icp.exclusions)),
        ("Industry", ", ".join(icp.industries)),
        ("Geography", ", ".join(icp.geographies)),
        ("Size", icp.company_size or ""),
        ("Useful signals", "; ".join(icp.signals)),
    ]
    return "\n".join(f"{label}: {value}" for label, value in rows if value)


ICP_SYSTEM = (
    "You plan B2B lead research for a sales team. Given the SELLER (the company looking for "
    "clients) and their lead REQUEST, define the ideal customer profile and a few high-value "
    "company-discovery queries. Respond with a single JSON object only."
)


def icp_user(request: str, company_context: dict[str, Any], min_queries: int, max_queries: int, max_leads: int) -> str:
    return f"""SELLER:
{seller_block(company_context)}

REQUEST:
{request}

Return JSON with exactly these keys:
{{
  "num_leads": integer (leads requested; 10 if not stated; max {max_leads}),
  "summary": "one sentence describing the target customer",
  "industries": ["..."],
  "geographies": ["..."],
  "company_size": "e.g. 50-500 employees" or null,
  "must_have": ["hard criteria stated in the request"],
  "nice_to_have": ["..."],
  "exclusions": ["company types to exclude, including the seller itself and direct competitors"],
  "use_case": "one sentence: why these companies would buy the seller's product",
  "signals": ["observable signals of a better fit, e.g. hiring support agents; [] if none matter"],
  "target_roles": ["decision-maker job titles to contact, most relevant first, max 6"],
  "discovery_queries": [{{"query": "...", "angle": "company|growth|problem"}}],
  "fallback_queries": ["2-3 broader queries, used only if discovery finds too few companies"]
}}

Rules:
- {min_queries}-{max_queries} discovery_queries. Each runs against a semantic company search engine, so write it as a natural description of the companies to find (e.g. "Indian consumer fintech app with a large customer base"), not a keyword list.
- Cover different angles (company type; growth signals such as funding, hiring, expansion; problem/use-case signals), but only angles relevant to the request. No near-duplicates.
- Include the industry and geography in queries when known.
- If the request states no geography, use the seller's customer location when it is set; otherwise leave geographies empty.
- If the request names job titles, list them first in target_roles; otherwise derive roles from what the seller sells."""


FILTER_SYSTEM = (
    "You screen candidate companies for B2B lead research using only the short info given. "
    "Be decisive and brief. Respond with a single JSON object only."
)


def filter_user(icp: ICP, seller_name: str, seller_domain: str, candidate_lines: list[str]) -> str:
    seller = f"{seller_name} ({seller_domain})" if seller_domain else seller_name
    candidates = "\n".join(candidate_lines)
    return f"""TARGET CUSTOMER: {icp.summary}
{icp_criteria_block(icp)}
SELLER (never a lead): {seller}

CANDIDATES (id | name | website | info):
{candidates}

For every candidate return {{"id": int, "relevant": bool, "confidence": 0.0-1.0, "reason": "max 20 words"}}.
relevant=false if it clearly fails a must-have, matches an exclusion, is the seller or a direct competitor selling the same product, or is not an operating company (directory, news site, list article, marketplace listing). If info is thin but plausible, relevant=true with lower confidence.
Output: {{"decisions": [...]}} with exactly one entry per candidate id."""


RESEARCH_SYSTEM = """You qualify one company as a potential customer for the SELLER, using ONLY the numbered sources provided.
- Every claim must cite a source label like "S2" that directly supports it. Never use outside knowledge.
- status "verified" = the source states it directly; "likely" = a reasonable reading of the source. Anything weaker: omit it.
- Never guess employee counts, revenue, funding, customers, technologies, locations or people. Unknown means null or omitted.
- If sources conflict, say so in the claim instead of picking one value.
- Be concise. Respond with a single JSON object only."""

_RESEARCH_FORMAT = """Return JSON:
{
  "industry": "short label" or null,
  "location": {"value": "HQ city/country", "source": "S#"} or null,
  "employee_count": {"value": "e.g. ~150", "source": "S#", "status": "verified|likely"} or null,
  "evidence": [{"claim": "max 25 words", "source": "S#", "status": "verified|likely"}],
  "signals": [{"signal": "max 12 words", "source": "S#"}],
  "qualification": {"icp_match": bool, "industry_match": bool|null, "geography_match": bool|null, "size_match": "verified|likely|unknown|mismatch", "use_case_match": bool|null, "growth_signal": bool|null},
  "fit": "strong|possible|poor",
  "why_relevant": "max 40 words, specific to this company and the seller's product",
  "need_more": []
}
- evidence: max 6 items, only facts that bear on fit. signals: max 4, only ones relevant to why the seller's product helps.
- fit: strong = meets every must-have with evidence; possible = plausible but some must-haves unverified; poor = fails a must-have, matches an exclusion, or is not a real prospect.
- need_more: subset of ["about","product","careers","team","contact","news"], only if that information could change fit or is required to check a must-have. [] if the sources suffice or fit is clearly poor."""


def research_header(icp: ICP, company_context: dict[str, Any], company_name: str, website: str) -> str:
    seller = seller_block(company_context, max_description_chars=300)
    return f"""SELLER:
{seller}
WHY CUSTOMERS BUY: {icp.use_case}
TARGET CUSTOMER: {icp.summary}
{icp_criteria_block(icp)}

COMPANY: {company_name} ({website})"""


def research_user(header: str, sources_block: str) -> str:
    return f"""{header}

SOURCES:
{sources_block}

{_RESEARCH_FORMAT}"""


def research_update_user(header: str, previous_json: str, last_label: int, sources_block: str) -> str:
    return f"""{header}

YOUR PREVIOUS ASSESSMENT (labels S1-S{last_label} remain valid):
{previous_json}

NEW SOURCES:
{sources_block}

Return the complete updated assessment in the same format, keeping still-valid earlier evidence with its original labels. need_more must be [].
{_RESEARCH_FORMAT}"""


SITE_PEOPLE_SYSTEM = (
    "You list the people named on a company's own web pages. Copy each name and job title exactly "
    "as written on the page; never guess, complete or translate them. Respond with a single JSON object only."
)


def site_people_user(company_name: str, page_blocks: list[str]) -> str:
    pages = "\n\n".join(page_blocks)
    return f"""COMPANY: {company_name}

PAGES:
{pages}

List people the pages name as working at {company_name} (founders, executives, team leads), with the job title the page gives them there.
Skip customers, investors, testimonials, advisors and anyone without a stated title.
Output: {{"people": [{{"name": "...", "title": "...", "source": "P1"}}]}} - [] if none. Max 10."""
