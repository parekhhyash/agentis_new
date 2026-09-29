import asyncio

import httpx

from agents.lead_research.budget import ResearchBudget
from agents.lead_research.cache import TTLCache
from agents.lead_research.scraper import ContentFetcher, WebScraper
from agents.lead_research.search_provider import PageContent
from agents.lead_research.state import ResearchState

HOMEPAGE = """<html><head><title>Alpha Fintech</title><script>var tracking = 1;</script></head>
<body>
<nav><a href="/about">About us</a><a href="/careers">Careers</a><a href="/contact">Contact</a>
<a href="https://twitter.com/alpha">Twitter</a><a href="/logo.png">logo</a></nav>
<div class="cookie-banner">We use cookies</div>
<main><h1>Lending for India</h1>
<p>Alpha Fintech provides instant personal loans to over two million customers across India.
Our support team handles thousands of customer queries every day in six languages.</p>
<p>Email hello@alpha.com or write to our agency at ops@designagency.io.</p>
<a href="mailto:support@alpha.com">Support</a>
</main>
<footer>Copyright Alpha</footer>
</body></html>"""


def _scraper(routes: dict[str, httpx.Response], **kwargs) -> tuple[WebScraper, list[str]]:
    hits: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        hits.append(url)
        response = routes.get(url)
        if callable(response):
            return response()
        return response or httpx.Response(404)

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler), follow_redirects=True)
    return WebScraper(client=client, per_domain_interval_seconds=0, cache=TTLCache(), **kwargs), hits


def _html(body: str) -> httpx.Response:
    return httpx.Response(200, text=body, headers={"content-type": "text/html; charset=utf-8"})


def test_extracts_clean_text_links_and_own_domain_emails():
    scraper, _ = _scraper({"https://alpha.com/": _html(HOMEPAGE)})
    page = asyncio.run(scraper.scrape("https://alpha.com/"))

    assert page is not None
    assert page.title == "Alpha Fintech"
    assert "two million customers" in page.text
    assert "var tracking" not in page.text and "We use cookies" not in page.text
    assert page.emails == ["hello@alpha.com", "support@alpha.com"]  # agency address excluded
    link_urls = [url for url, _ in page.links]
    assert "https://alpha.com/careers" in link_urls
    assert not any("twitter.com" in u or u.endswith(".png") for u in link_urls)
    assert page.contact_page == "https://alpha.com/contact"


def test_respects_robots_disallow():
    robots = httpx.Response(200, text="User-agent: *\nDisallow: /private")
    scraper, hits = _scraper(
        {"https://beta.com/robots.txt": robots, "https://beta.com/private/page": _html(HOMEPAGE)}
    )
    assert asyncio.run(scraper.scrape("https://beta.com/private/page")) is None
    assert "https://beta.com/private/page" not in hits


def test_non_html_and_4xx_are_skipped_without_retry():
    scraper, hits = _scraper(
        {
            "https://gamma.com/file": httpx.Response(200, content=b"%PDF", headers={"content-type": "application/pdf"}),
            "https://gamma.com/missing": httpx.Response(404),
        }
    )
    assert asyncio.run(scraper.scrape("https://gamma.com/file")) is None
    assert asyncio.run(scraper.scrape("https://gamma.com/missing")) is None
    assert hits.count("https://gamma.com/missing") == 1


def test_transient_error_is_retried_once():
    attempts = iter([httpx.Response(503), _html(HOMEPAGE)])
    scraper, hits = _scraper({"https://delta.com/": lambda: next(attempts)})
    assert asyncio.run(scraper.scrape("https://delta.com/")) is not None
    assert hits.count("https://delta.com/") == 2


def test_response_size_is_capped():
    huge = "<html><body><p>" + "word " * 200_000 + "</p></body></html>"
    scraper, _ = _scraper({"https://epsilon.com/": _html(huge)}, max_bytes=50_000, max_chars=1000)
    page = asyncio.run(scraper.scrape("https://epsilon.com/"))
    assert page is not None and len(page.text) <= 1000


class _BlockedScraper:
    async def scrape(self, url):
        return None


class _FallbackSearch:
    def __init__(self):
        self.calls = 0

    async def get_contents(self, urls, *, max_characters):
        self.calls += 1
        return [PageContent(url=urls[0], title="Zeta", text="Zeta sells  loans.")]


def test_fetcher_falls_back_to_search_contents_and_caches_per_run():
    search = _FallbackSearch()
    fetcher = ContentFetcher(_BlockedScraper(), search, max_chars=500)  # type: ignore[arg-type]
    state = ResearchState(objective="x", company_context={}, budget=ResearchBudget())

    first = asyncio.run(fetcher.fetch("https://zeta.com/", state))
    second = asyncio.run(fetcher.fetch("https://www.zeta.com", state))

    assert first is not None and first.via == "exa" and first.text == "Zeta sells loans."
    assert second is first
    assert search.calls == 1 and state.usage.scrapes == 1
