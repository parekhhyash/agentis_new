import asyncio
import json

import httpx
import pytest

from agents.lead_research import exa as exa_module
from agents.lead_research.errors import ResearchConfigError
from agents.lead_research.exa import ExaSearchProvider
from agents.lead_research.search_provider import SearchProviderError


def _provider(handler) -> tuple[ExaSearchProvider, list[httpx.Request]]:
    seen: list[httpx.Request] = []

    def record(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return handler(request)

    client = httpx.AsyncClient(transport=httpx.MockTransport(record))
    return ExaSearchProvider("test-key", client=client), seen


SEARCH_RESPONSE = {
    "results": [
        {
            "url": "https://alpha.com/",
            "title": "Alpha Fintech",
            "highlights": ["Alpha builds lending apps.", "Serving 2M users in India."],
            "entities": [
                {
                    "id": "https://exa.ai/library/company/alpha",
                    "type": "company",
                    "version": 1,
                    "properties": {"name": "Alpha Fintech", "workforce": {"total": 210}},
                }
            ],
        },
        {"title": "no url result"},
    ],
    "costDollars": {"total": 0.012},
}


def test_company_search_request_matches_exa_spec_and_parses_entities():
    provider, seen = _provider(lambda r: httpx.Response(200, json=SEARCH_RESPONSE))
    response = asyncio.run(
        provider.search(
            "Indian fintech",
            category="company",
            num_results=500,
            highlight_chars=300,
            highlight_query="what they do",
            start_published_date="2025-01-01",
        )
    )

    request = seen[0]
    body = json.loads(request.content)
    assert request.url == "https://api.exa.ai/search"
    assert request.headers["x-api-key"] == "test-key"
    assert body["category"] == "company"
    assert body["numResults"] == 100
    assert body["contents"] == {"highlights": {"maxCharacters": 300, "query": "what they do"}}
    # company/people categories 400 on date filters and excludeDomains per Exa's spec
    assert "startPublishedDate" not in body and "excludeDomains" not in body

    assert len(response.hits) == 1
    hit = response.hits[0]
    assert hit.snippet == "Alpha builds lending apps. … Serving 2M users in India."
    assert hit.entity_type == "company" and hit.entity["workforce"]["total"] == 210
    assert response.cost_usd == pytest.approx(0.012)


def test_news_search_keeps_date_filter():
    provider, seen = _provider(lambda r: httpx.Response(200, json={"results": []}))
    asyncio.run(provider.search("Alpha funding", category="news", start_published_date="2025-01-01"))
    assert json.loads(seen[0].content)["startPublishedDate"] == "2025-01-01"


def test_bad_key_is_a_config_error_not_a_silent_empty_result():
    provider, _ = _provider(lambda r: httpx.Response(401, json={"error": "invalid key"}))
    with pytest.raises(ResearchConfigError):
        asyncio.run(provider.search("anything"))


def test_rate_limit_is_retried(monkeypatch):
    async def no_sleep(_):
        return None

    monkeypatch.setattr(exa_module.asyncio, "sleep", no_sleep)
    responses = iter([httpx.Response(429), httpx.Response(200, json={"results": []})])
    provider, seen = _provider(lambda r: next(responses))
    asyncio.run(provider.search("anything"))
    assert len(seen) == 2


def test_client_error_raises_search_error():
    provider, _ = _provider(lambda r: httpx.Response(400, json={"error": "bad param"}))
    with pytest.raises(SearchProviderError):
        asyncio.run(provider.search("anything"))


def test_missing_key_rejected_up_front():
    with pytest.raises(ResearchConfigError):
        ExaSearchProvider("")


def test_get_contents_returns_clean_text():
    payload = {"results": [{"url": "https://alpha.com/", "title": "Alpha", "text": "Alpha lends."}, {"url": "https://x.com", "text": ""}]}
    provider, seen = _provider(lambda r: httpx.Response(200, json=payload))
    pages = asyncio.run(provider.get_contents(["https://alpha.com/"], max_characters=2000))
    assert json.loads(seen[0].content) == {"urls": ["https://alpha.com/"], "text": {"maxCharacters": 2000}}
    assert [(p.url, p.text) for p in pages] == [("https://alpha.com/", "Alpha lends.")]
