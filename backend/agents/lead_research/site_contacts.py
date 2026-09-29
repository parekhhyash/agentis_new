import logging
import re

from agents.lead_research import prompts
from agents.lead_research.budget import ResearchBudget
from agents.lead_research.contacts import DEFAULT_ROLES, _STOPWORDS, _tokens, role_score
from agents.lead_research.domains import names_match, normalize_url
from agents.lead_research.errors import ResearchCancelledError, ResearchConfigError
from agents.lead_research.llm import LLMClient
from agents.lead_research.schemas import Contact
from agents.lead_research.scraper import ContentFetcher
from agents.lead_research.state import ResearchedCompany, ResearchState, ScrapedPage
from agents.lead_research.tracking import call_llm
from agents.lead_research.url_selector import URLSelector, page_category

logger = logging.getLogger(__name__)

_PEOPLE_PAGES = ("team", "about")
_MAX_PAGES = 3
_NAME_WINDOW = 200  # chars around a name in which its title must appear
_HONORIFICS = {"dr", "mr", "mrs", "ms", "prof"}


def _flat(text: str) -> str:
    return " ".join(text.split()).lower()


def _stated_on_page(name: str, title: str, text: str) -> bool:
    """The model only proposes people; this is the check. The name must appear
    on the cited page verbatim and every word of the title near it."""
    page, wanted = _flat(text), _flat(name)
    title_words = [t for t in _tokens(title) if t not in _STOPWORDS]
    if not wanted or not title_words:
        return False
    for match in re.finditer(re.escape(wanted), page):
        window = set(_tokens(page[max(0, match.start() - _NAME_WINDOW) : match.end() + _NAME_WINDOW]))
        if all(word in window for word in title_words):
            return True
    return False


def _plausible_name(name: str, company_name: str) -> bool:
    words = name.split()
    return 2 <= len(words) <= 5 and len(name) <= 60 and not any(c.isdigit() for c in name) and not names_match(name, company_name)


class SiteContactExtractor:
    """Finds decision-makers named on the company's own site (homepage, team
    or about page) as a second contact source next to Exa's people search."""

    def __init__(self, llm: LLMClient, fetcher: ContentFetcher):
        self._llm = llm
        self._fetcher = fetcher

    async def extract(self, state: ResearchState, company: ResearchedCompany, roles: list[str], budget: ResearchBudget) -> list[Contact]:
        await self._add_people_page(state, company, budget)
        pages = self._people_pages(company)
        if not pages:
            return []

        blocks = [f"[P{i}] {page.final_url}\n{page.text}" for i, page in enumerate(pages, 1)]
        try:
            data = await call_llm(
                self._llm, state,
                system=prompts.SITE_PEOPLE_SYSTEM,
                user=prompts.site_people_user(company.lead.company_name, blocks),
                tier="fast", max_tokens=500,
            )
        except (ResearchConfigError, ResearchCancelledError):
            raise
        except Exception as exc:  # noqa: BLE001 - site contacts are a bonus; keep the run going
            logger.warning("Site contact extraction failed for %s: %s", company.candidate.domain, exc)
            return []

        # Founders/CEOs decide at the small companies this mostly helps with,
        # so they count even when the request targeted other roles.
        scoring_roles = roles + [r for r in DEFAULT_ROLES if r not in roles]
        found: list[tuple[Contact, int]] = []
        for item in data.get("people") or []:
            if not isinstance(item, dict):
                continue
            name = " ".join(str(item.get("name") or "").split())
            title = " ".join(str(item.get("title") or "").split())
            match = re.fullmatch(r"\[?\s*[pP]?(\d+)\s*\]?", str(item.get("source") or "").strip())
            index = int(match.group(1)) - 1 if match else -1
            if not (0 <= index < len(pages)) or not _plausible_name(name, company.lead.company_name):
                continue
            page = pages[index]
            score = role_score(title, scoring_roles)
            if score <= 0 or not _stated_on_page(name, title, page.text):
                continue
            found.append((Contact(name=name, title=title[:120], company=company.lead.company_name, source_url=page.final_url), score))

        found.sort(key=lambda pair: pair[1], reverse=True)
        return [contact for contact, _ in found]

    async def _add_people_page(self, state: ResearchState, company: ResearchedCompany, budget: ResearchBudget) -> None:
        """Fetch the team/about page unless research already read one."""
        if not company.pages or len(company.pages) >= budget.max_pages_per_company:
            return
        if any(page_category(p.final_url) in _PEOPLE_PAGES for p in company.pages[1:]):
            return
        exclude = {normalize_url(p.url) for p in company.pages} | {normalize_url(p.final_url) for p in company.pages}
        picks = URLSelector.select(company.pages[0], list(_PEOPLE_PAGES), exclude=exclude, limit=1)
        if not picks:
            return
        page = await self._fetcher.fetch(picks[0][1], state)
        if page is None:
            return
        company.pages.append(page)
        lead = company.lead
        lead.company_emails = sorted(set(lead.company_emails) | set(page.emails))
        lead.contact_page = lead.contact_page or page.contact_page

    @staticmethod
    def _people_pages(company: ResearchedCompany) -> list[ScrapedPage]:
        homepage, rest = company.pages[:1], company.pages[1:]
        people = [p for p in rest if page_category(p.final_url) in _PEOPLE_PAGES]
        return (homepage + people)[:_MAX_PAGES]


def merge_contacts(primary: list[Contact], extra: list[Contact], limit: int) -> list[Contact]:
    """Exa contacts first (they carry LinkedIn), then site-named people not
    already listed."""
    merged = list(primary[:limit])
    seen = {_flat(c.name) for c in merged}
    for contact in extra:
        if len(merged) >= limit:
            break
        if _flat(contact.name) not in seen:
            merged.append(contact)
            seen.add(_flat(contact.name))
    return merged


def _email_locals(name: str) -> set[str]:
    parts = [p for p in re.findall(r"[a-z]+", name.lower()) if p not in _HONORIFICS]
    if not parts:
        return set()
    first = parts[0]
    locals_ = {first} if len(first) >= 3 else set()
    if len(parts) > 1:
        last = parts[-1]
        locals_ |= {first + last, f"{first}.{last}", f"{first}_{last}", f"{first}-{last}", first[0] + last, f"{first[0]}.{last}", f"{last}.{first}"}
    return locals_


def attach_published_emails(company: ResearchedCompany, contacts: list[Contact]) -> None:
    """Give a contact an email only when the company's own site publishes one
    whose address is plainly that person's (priya@, priya.sharma@, psharma@...).
    Nothing is constructed; an address matching two contacts is left general."""
    published: dict[str, str] = {}
    for page in company.pages:
        for email in page.emails:
            published.setdefault(email.lower(), page.final_url)

    assigned: set[str] = set()
    for email, source in published.items():
        local = email.split("@", 1)[0]
        owners = [c for c in contacts if c.email is None and local in _email_locals(c.name)]
        if len(owners) == 1:
            owners[0].email = email
            owners[0].email_source_url = source
            assigned.add(email)
    if assigned:
        company.lead.company_emails = [e for e in company.lead.company_emails if e.lower() not in assigned]
