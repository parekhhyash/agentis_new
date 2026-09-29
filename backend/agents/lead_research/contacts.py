import re
from typing import Any

from agents.lead_research.budget import ResearchBudget
from agents.lead_research.domains import names_match
from agents.lead_research.schemas import Contact, Lead
from agents.lead_research.search_provider import SearchHit, SearchProvider
from agents.lead_research.state import ResearchState
from agents.lead_research.tracking import tracked_search

DEFAULT_ROLES = ["Founder", "Co-Founder", "CEO", "COO"]

_SENIORITY = {"head", "vp", "vice", "president", "director", "chief", "lead", "manager", "senior", "sr", "global", "gm", "general"}
_STOPWORDS = {"of", "the", "and", "for", "at", "in"}
_EXECUTIVE_ACRONYMS = {"ceo", "coo", "cto", "cfo", "cmo", "cro", "cco", "cpo", "cxo", "founder", "cofounder"}
_TITLE_SPLIT_RE = re.compile(r"\s+[-–—|]\s+")


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower().replace("co-founder", "cofounder"))


def role_score(title: str, roles: list[str]) -> int:
    """How well a job title matches the target roles (earlier roles weigh
    more). 0 = not a decision-maker we were asked to find."""
    words = [t for t in _tokens(title) if t not in _STOPWORDS]
    title_tokens = set(words)
    if "cofounder" in title_tokens:
        title_tokens.add("founder")
    normalized_title = " ".join(words)
    for index, role in enumerate(roles):
        role_tokens = [t for t in _tokens(role) if t not in _STOPWORDS]
        if not role_tokens:
            continue
        penalty = index * 5
        if re.search(rf"\b{re.escape(' '.join(role_tokens))}\b", normalized_title):
            return 100 - penalty
        core = [t for t in role_tokens if t not in _SENIORITY]
        if not core:
            continue
        if all(t in title_tokens for t in core) and (title_tokens & (_SENIORITY | _EXECUTIVE_ACRONYMS) or set(core) <= _EXECUTIVE_ACRONYMS):
            return 70 - penalty
    return 0


def _parse_headline(title: str | None) -> tuple[str | None, str | None, str | None]:
    """'Jane Doe - Head of Support - Acme | LinkedIn' -> (name, title, company)."""
    if not title:
        return None, None, None
    parts = [p.strip() for p in _TITLE_SPLIT_RE.split(title) if p.strip() and p.strip().lower() != "linkedin"]
    name = parts[0] if parts else None
    job = parts[1] if len(parts) > 1 else None
    company = parts[2] if len(parts) > 2 else None
    if job and company is None and " at " in job:
        job, company = (s.strip() for s in job.split(" at ", 1))
    return name, job, company


def _current_role(entity: dict[str, Any], company_name: str) -> str | None:
    for entry in entity.get("workHistory") or []:
        if not isinstance(entry, dict):
            continue
        company = (entry.get("company") or {}).get("name") or ""
        ended = (entry.get("dates") or {}).get("to")
        if company and not ended and names_match(company, company_name) and entry.get("title"):
            return entry["title"]
    return None


def contact_from_hit(hit: SearchHit, company_name: str, roles: list[str]) -> tuple[Contact, int] | None:
    """Only returns a contact when the source itself ties the person to this
    company in a relevant current role. Never fills in an email."""
    headline_name, headline_title, headline_company = _parse_headline(hit.title)
    name = (hit.entity.get("name") or "").strip() or headline_name
    title = _current_role(hit.entity, company_name) if hit.entity else None
    if title is None and headline_title and headline_company and names_match(headline_company, company_name):
        title = headline_title
    if not name or not title or len(name) > 60 or names_match(name, company_name):
        return None

    score = role_score(title, roles)
    if score <= 0:
        return None

    linkedin = hit.url if re.search(r"linkedin\.com/in/", hit.url) else None
    contact = Contact(name=name, title=title[:120], company=company_name, linkedin_url=linkedin, source_url=hit.url)
    return contact, score


class ContactResearcher:
    def __init__(self, search: SearchProvider):
        self._search = search

    async def find(self, state: ResearchState, lead: Lead, roles: list[str], budget: ResearchBudget) -> list[Contact]:
        roles = roles or DEFAULT_ROLES
        role_groups = [roles[i : i + 2] for i in range(0, len(roles), 2)][: budget.max_contact_searches_per_company]
        scored: dict[str, tuple[Contact, int]] = {}

        for group in role_groups:
            strong = [c for c, s in scored.values() if s >= 70]
            if len(strong) >= budget.max_contacts_per_company or state.out_of_time():
                break
            hits = await tracked_search(
                self._search,
                state,
                f"{' or '.join(group)} at {lead.company_name}",
                category="people",
                num_results=6,
                highlight_chars=200,
            )
            for hit in hits:
                found = contact_from_hit(hit, lead.company_name, roles)
                if found is None:
                    continue
                key = (found[0].linkedin_url or found[0].name).lower()
                if key not in scored or found[1] > scored[key][1]:
                    scored[key] = found

        ranked = sorted(scored.values(), key=lambda pair: pair[1], reverse=True)
        return [contact for contact, _ in ranked[: budget.max_contacts_per_company]]
