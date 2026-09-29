import pytest

from agents.lead_research import scraper, tracking


@pytest.fixture(autouse=True)
def _clear_shared_caches():
    tracking._search_cache.clear()
    scraper._page_cache.clear()
    scraper._robots_cache.clear()
    yield
