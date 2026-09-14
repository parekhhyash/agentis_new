"""Web search tool for the sales agent.

Wraps `ddgs` (a metasearch aggregator; despite the name it can query several
backends, not just DuckDuckGo) so the agent can look up real companies
instead of guessing from training data. No API key required, which keeps
this a zero-friction default - swap in Tavily/Serper/Google CSE here later
without touching the agent itself if a paid, higher-quality search API is
preferred.
"""

import asyncio
import logging

from ddgs import DDGS
from ddgs.exceptions import DDGSException

from config.settings import get_settings

logger = logging.getLogger(__name__)

# ddgs's default backend="auto" fans out across every registered engine
# (wikipedia, grokipedia, duckduckgo, google, yahoo, startpage, brave,
# mojeek) a few at a time. Confirmed via Render logs across multiple runs:
# mojeek times out on essentially every single call from Render's network,
# and brave gets rate-limited (429) almost as often - both just add dead
# wall-clock time to every search without ever contributing results.
# Restricting to the engines that were actually returning 200s cuts that
# waste out.
_SEARCH_BACKENDS = "duckduckgo,google,yahoo,startpage,wikipedia,grokipedia"


async def search_web(query: str, max_results: int = 8) -> dict:
    """Search the web and return a list of results (title, url, snippet).

    Use this to find candidate companies, e.g. "AI startups customer support
    India 2026" or "site:linkedin.com fintech startup Bangalore". Call this
    multiple times with different phrasings if the first search doesn't
    surface enough good candidates.

    Args:
        query: The search query.
        max_results: Maximum number of results to return (capped for cost/latency).

    Returns:
        A dict with:
        - status: "success" or "error"
        - results: list of {"title", "url", "snippet"} (on success)
        - error_message: reason for failure (on error)
    """
    settings = get_settings()
    capped_max_results = max(1, min(max_results, settings.max_search_results_per_query))

    def _run_search() -> list[dict]:
        with DDGS(timeout=int(settings.http_timeout_seconds)) as ddgs:
            return ddgs.text(query, max_results=capped_max_results, backend=_SEARCH_BACKENDS)

    try:
        # ddgs's own timeout, like httpx's, only bounds a single socket
        # read - not the whole call - so a backend that stalls mid-response
        # could otherwise hang this past its configured timeout (same class
        # of bug fixed in fetch_webpage's fetch, after that one hung for 7+
        # minutes on a single slow site). This wait_for is a second,
        # wall-clock-total backstop: the awaiting task moves on even if the
        # orphaned background thread itself takes longer to unwind.
        raw_results = await asyncio.wait_for(
            asyncio.to_thread(_run_search), timeout=settings.http_timeout_seconds * 2
        )
    except asyncio.TimeoutError:
        logger.warning("search_web timed out for query=%r", query)
        return {"status": "error", "error_message": "Search took too long"}
    except DDGSException as exc:
        logger.warning("search_web failed for query=%r: %s", query, exc)
        return {"status": "error", "error_message": f"Search failed: {exc}"}
    except Exception as exc:  # noqa: BLE001 - surface any unexpected failure to the agent, don't crash the run
        logger.exception("search_web unexpected error for query=%r", query)
        return {"status": "error", "error_message": f"Unexpected search error: {exc}"}

    results = [
        {
            "title": item.get("title", ""),
            "url": item.get("href", ""),
            "snippet": item.get("body", ""),
        }
        for item in raw_results
        if item.get("href")
    ]

    return {"status": "success", "results": results, "count": len(results)}
