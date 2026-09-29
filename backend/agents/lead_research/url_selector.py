import re
from urllib.parse import urlsplit

from agents.lead_research.domains import normalize_url
from agents.lead_research.state import ScrapedPage

PAGE_CATEGORIES: dict[str, tuple[str, ...]] = {
    "about": ("about", "company", "who-we-are", "our-story", "story", "mission"),
    "product": ("product", "solution", "platform", "feature", "service", "pricing", "shop", "collection"),
    "careers": ("career", "jobs", "join", "hiring", "work-with-us", "opening"),
    "team": ("team", "leadership", "founder", "people", "management"),
    "contact": ("contact", "reach-us", "get-in-touch", "support"),
    "news": ("press", "news", "media", "announcement"),
}


def _score(url: str, anchor: str, keywords: tuple[str, ...]) -> int:
    path = urlsplit(url).path.lower()
    segments = [s for s in re.split(r"[/_.]", path) if s]
    score = 0
    if any(k in segment for segment in segments for k in keywords):
        score += 3
    if any(k.replace("-", " ") in anchor.lower() for k in keywords):
        score += 1
    if score:
        # Prefer the section's landing page over deep links like /blog/2021/...
        score -= max(0, len(segments) - 1)
    return score


class URLSelector:
    """Picks at most one on-site page per information need, from links the
    scraper already extracted - no extra search spend to find subpages."""

    @staticmethod
    def select(page: ScrapedPage, categories: list[str], *, exclude: set[str], limit: int) -> list[tuple[str, str]]:
        picks: list[tuple[str, str]] = []
        taken = set(exclude)
        for category in categories:
            keywords = PAGE_CATEGORIES.get(category)
            if not keywords or len(picks) >= limit:
                continue
            best_url, best_score = None, 0
            for url, anchor in page.links:
                key = normalize_url(url)
                if key in taken:
                    continue
                score = _score(url, anchor, keywords)
                if score > best_score:
                    best_url, best_score = url, score
            if best_url is not None:
                picks.append((category, best_url))
                taken.add(normalize_url(best_url))
        return picks
