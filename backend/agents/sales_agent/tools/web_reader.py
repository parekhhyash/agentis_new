"""Webpage fetching + extraction tool for the sales agent.

Fetches a real URL and returns the page's clean readable text plus any
contact email / contact-page link actually present in the HTML. This is the
tool's job; deciding what that text *means* for lead qualification is left
to the LLM, which sees the extracted text and reasons over it directly.
"""

import asyncio
import logging
import re
from urllib.parse import urljoin

import httpx
import trafilatura
from bs4 import BeautifulSoup

from config.settings import get_settings

logger = logging.getLogger(__name__)

_USER_AGENT = "AgentisSalesResearchBot/0.1 (+https://agentis.example; contact via website)"

_EMAIL_PATTERN = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")

# Generic addresses that are almost never useful as a business lead contact.
_LOW_VALUE_EMAIL_PREFIXES = ("noreply", "no-reply", "donotreply", "webmaster", "postmaster")


def _extract_emails(soup: BeautifulSoup) -> list[str]:
    found: set[str] = set()

    for link in soup.find_all("a", href=True):
        href = link["href"]
        if href.lower().startswith("mailto:"):
            address = href.split(":", 1)[1].split("?", 1)[0].strip()
            if address:
                found.add(address)

    for match in _EMAIL_PATTERN.findall(soup.get_text(" ")):
        found.add(match)

    return sorted(
        addr
        for addr in found
        if not addr.lower().startswith(_LOW_VALUE_EMAIL_PREFIXES)
    )


def _find_contact_page(soup: BeautifulSoup, base_url: str) -> str | None:
    for link in soup.find_all("a", href=True):
        href = link["href"]
        text = link.get_text(" ").strip().lower()
        if "contact" in href.lower() or "contact" in text:
            return urljoin(base_url, href)
    return None


async def fetch_webpage(url: str) -> dict:
    """Fetch a webpage and return its main readable text, title, any
    business email addresses found, and a contact-page link if present.

    Use this on a company's official site (homepage, About page, Contact
    page) after finding it via search_web. Only information that literally
    appears in the returned text/emails/contact_page should be treated as
    confirmed; do not assume a field exists just because you'd expect it to.

    Args:
        url: Full URL to fetch (must start with http:// or https://).

    Returns:
        A dict with:
        - status: "success" or "error"
        - final_url: URL after redirects (on success)
        - title: page title (on success)
        - text: extracted readable text, truncated to a safe length (on success)
        - emails_found: list of email addresses literally present on the page
        - contact_page: absolute URL of a contact page link, if any was found
        - error_message: reason for failure (on error)
    """
    settings = get_settings()

    if not url.lower().startswith(("http://", "https://")):
        return {"status": "error", "error_message": "URL must start with http:// or https://"}

    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": _USER_AGENT},
            timeout=settings.http_timeout_seconds,
            follow_redirects=True,
        ) as client:
            # httpx's own `timeout` is per read/write/connect operation, not
            # total elapsed time - a server that trickles bytes slowly keeps
            # resetting it, so a single pathological site can hang far past
            # http_timeout_seconds and eat the whole run's time budget
            # (confirmed live: one fetch stuck for 7+ minutes on one URL,
            # well past the configured 15s). Wrap the whole request in an
            # explicit wall-clock cap so that can never happen again.
            response = await asyncio.wait_for(
                client.get(url), timeout=settings.http_timeout_seconds
            )
    except asyncio.TimeoutError:
        logger.warning(
            "fetch_webpage timed out for url=%r after %.0fs total",
            url, settings.http_timeout_seconds,
        )
        return {
            "status": "error",
            "error_message": f"Page took too long to load (over {settings.http_timeout_seconds:.0f}s)",
        }
    except httpx.HTTPError as exc:
        logger.warning("fetch_webpage failed for url=%r: %s", url, exc)
        return {"status": "error", "error_message": f"Could not fetch page: {exc}"}

    if response.status_code >= 400:
        return {
            "status": "error",
            "error_message": f"Page returned HTTP {response.status_code}",
        }

    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type:
        return {
            "status": "error",
            "error_message": f"Not an HTML page (content-type: {content_type or 'unknown'})",
        }

    html = response.text
    soup = BeautifulSoup(html, "html.parser")

    text = trafilatura.extract(html, url=str(response.url), favor_precision=True) or ""
    if not text:
        # Fall back to raw tag stripping so a page trafilatura can't parse
        # (e.g. unusual markup) still yields something instead of nothing.
        text = soup.get_text(" ", strip=True)

    truncated_text = text[: settings.max_page_text_chars]
    title = soup.title.get_text(strip=True) if soup.title else None

    return {
        "status": "success",
        "final_url": str(response.url),
        "title": title,
        "text": truncated_text,
        "truncated": len(text) > settings.max_page_text_chars,
        "emails_found": _extract_emails(soup),
        "contact_page": _find_contact_page(soup, str(response.url)),
    }
