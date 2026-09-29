from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

SearchCategory = Literal["company", "people", "news"]


class SearchProviderError(Exception):
    """A single search/contents call failed in a way the pipeline can skip past."""


@dataclass
class SearchHit:
    url: str
    title: str | None
    snippet: str
    published_date: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    entity: dict[str, Any] = field(default_factory=dict)


@dataclass
class SearchResponse:
    hits: list[SearchHit]
    cost_usd: float = 0.0


@dataclass
class PageContent:
    url: str
    title: str | None
    text: str


class SearchProvider(Protocol):
    """Anything that can discover URLs for a natural-language query. Exa is the
    default; swapping providers means implementing these two methods."""

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
    ) -> SearchResponse: ...

    async def get_contents(self, urls: list[str], *, max_characters: int) -> list[PageContent]: ...
