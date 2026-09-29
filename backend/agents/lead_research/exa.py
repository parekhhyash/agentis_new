import asyncio
import logging
from typing import Any

import httpx

from agents.lead_research.errors import ResearchConfigError
from agents.lead_research.search_provider import (
    PageContent,
    SearchCategory,
    SearchHit,
    SearchProviderError,
    SearchResponse,
)

logger = logging.getLogger(__name__)

EXA_BASE_URL = "https://api.exa.ai"

# Per Exa's API spec, these categories 400 on date/text filters and excludeDomains.
_RESTRICTED_CATEGORIES = {"company", "people"}


class ExaSearchProvider:
    def __init__(
        self,
        api_key: str,
        *,
        client: httpx.AsyncClient | None = None,
        base_url: str = EXA_BASE_URL,
        timeout_seconds: float = 30.0,
        max_retries: int = 2,
    ):
        if not api_key:
            raise ResearchConfigError("EXA_API_KEY is not configured")
        self._client = client or httpx.AsyncClient(timeout=timeout_seconds)
        self._owns_client = client is None
        self._base_url = base_url.rstrip("/")
        self._headers = {"x-api-key": api_key, "Content-Type": "application/json"}
        self._max_retries = max_retries
        self._timeout = timeout_seconds

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def search(
        self,
        query: str,
        *,
        category: SearchCategory | None = None,
        num_results: int = 10,
        highlight_chars: int = 300,
        highlight_query: str | None = None,
        start_published_date: str | None = None,
        include_domains: list[str] | None = None,
    ) -> SearchResponse:
        highlights: dict[str, Any] = {"maxCharacters": highlight_chars}
        if highlight_query:
            highlights["query"] = highlight_query
        body: dict[str, Any] = {
            "query": query,
            "type": "auto",
            "numResults": max(1, min(num_results, 100)),
            "contents": {"highlights": highlights},
        }
        if category:
            body["category"] = category
        if include_domains:
            body["includeDomains"] = include_domains
        if start_published_date and category not in _RESTRICTED_CATEGORIES:
            body["startPublishedDate"] = start_published_date

        data = await self._post("/search", body)
        hits = [hit for raw in data.get("results") or [] if (hit := _to_hit(raw))]
        return SearchResponse(hits=hits, cost_usd=_cost(data))

    async def get_contents(self, urls: list[str], *, max_characters: int) -> list[PageContent]:
        if not urls:
            return []
        data = await self._post("/contents", {"urls": urls, "text": {"maxCharacters": max_characters}})
        pages = []
        for raw in data.get("results") or []:
            text = (raw.get("text") or "").strip()
            if raw.get("url") and text:
                pages.append(PageContent(url=raw["url"], title=raw.get("title"), text=text))
        return pages

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base_url}{path}"
        last_error: Exception | None = None
        for attempt in range(self._max_retries + 1):
            try:
                response = await asyncio.wait_for(
                    self._client.post(url, headers=self._headers, json=body), timeout=self._timeout
                )
            except (httpx.TransportError, asyncio.TimeoutError) as exc:
                last_error = exc
            else:
                if response.status_code in (401, 403):
                    raise ResearchConfigError("Exa rejected the API key (check EXA_API_KEY)")
                if response.status_code == 402:
                    raise ResearchConfigError("Exa account has no remaining credits")
                if response.status_code == 429 or response.status_code >= 500:
                    last_error = SearchProviderError(f"Exa {path} returned HTTP {response.status_code}")
                elif response.status_code >= 400:
                    raise SearchProviderError(f"Exa {path} returned HTTP {response.status_code}: {response.text[:300]}")
                else:
                    return response.json()
            if attempt < self._max_retries:
                await asyncio.sleep(1.0 * (2**attempt))
        raise SearchProviderError(f"Exa {path} failed after retries: {last_error}")


def _cost(data: dict[str, Any]) -> float:
    cost = data.get("costDollars") or {}
    try:
        return float(cost.get("total") or 0.0)
    except (TypeError, ValueError):
        return 0.0


def _to_hit(raw: dict[str, Any]) -> SearchHit | None:
    url = raw.get("url")
    if not url:
        return None
    highlights = [h.strip() for h in raw.get("highlights") or [] if isinstance(h, str) and h.strip()]
    snippet = " … ".join(highlights) or (raw.get("summary") or "").strip() or (raw.get("text") or "")[:400].strip()

    entity_type = entity_id = None
    entity: dict[str, Any] = {}
    entities = raw.get("entities") or []
    if entities and isinstance(entities[0], dict):
        entity_type = entities[0].get("type")
        entity_id = entities[0].get("id")
        entity = entities[0].get("properties") or {}

    return SearchHit(
        url=url,
        title=raw.get("title"),
        snippet=snippet,
        published_date=raw.get("publishedDate"),
        entity_type=entity_type,
        entity_id=entity_id,
        entity=entity,
    )
