"""Rule checks on every variant, in code: platform limits, hashtag counts,
placeholders, stock AI phrases, and figures that didn't come from the user
(a number the model made up is the costliest mistake in marketing copy)."""

import re

from agents.content_copy import formats
from agents.content_copy.formats import Format
from agents.content_copy.schemas import Issue, Variant

CLICHES = (
    "delve", "game-changer", "game changer", "unlock the power", "unleash", "elevate your", "in today's fast-paced",
    "in today's digital", "revolutionize", "revolutionise", "seamless", "cutting-edge", "look no further",
    "dive into", "deep dive", "supercharge", "next level", "take it to the next level", "harness the power",
    "synergy", "leverage", "embark on", "navigate the", "ever-evolving", "it's not just", "a testament to",
)
_HASHTAG = re.compile(r"(?<![\w#&])#(\w+)")
_PLACEHOLDER = re.compile(r"\[[A-Z][^\]]{1,40}\](?!\()|\{[a-z_ ]{2,30}\}|<insert[^>]*>|\bXX+\b|lorem ipsum", re.I)
# 37%, 3x, $5M, ₹2.5 lakh, 10,000, 4.8
_FIGURE = re.compile(r"(?<![\w#])(?:[$₹€£]\s?)?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|x|k|m|bn|cr|lakh|crore|million|billion)\b|%)?", re.I)


def _numbers(text: str) -> set[str]:
    return {re.sub(r"[\s,$₹€£]", "", m.group(0)).lower() for m in _FIGURE.finditer(text)}


def allowed_figures(*sources: str) -> set[str]:
    """Figures the user (or their profile, or the chat) gave us."""
    found: set[str] = set()
    for source in sources:
        for figure in _numbers(source or ""):
            found.add(figure)
            found.add(re.sub(r"[^\d.]", "", figure))
    return found


def _unsupported(text: str, allowed: set[str]) -> list[str]:
    out = []
    for match in _FIGURE.finditer(text):
        raw = match.group(0).strip()
        key = re.sub(r"[\s,$₹€£]", "", raw).lower()
        digits = re.sub(r"[^\d.]", "", key)
        if not digits or digits in allowed or key in allowed:
            continue
        value = float(digits) if digits.replace(".", "", 1).isdigit() else None
        plain_small = value is not None and value <= 10 and key == digits
        year = value is not None and key == digits and 1990 <= value <= 2100 and "." not in digits
        if plain_small or year:
            continue  # "3 ways", "in 2026"
        if raw not in out:
            out.append(raw)
    return out


def all_text(variant: Variant) -> str:
    return "\n".join([variant.title or "", variant.subtitle or "", variant.text, *variant.parts, *variant.headlines, *variant.descriptions])


def check(variant: Variant, fmt: Format, allowed: set[str]) -> list[Issue]:
    issues: list[Issue] = []

    def error(message: str) -> None:
        issues.append(Issue(level="error", message=message))

    def warn(message: str) -> None:
        issues.append(Issue(level="warning", message=message))

    if fmt.shape == "thread":
        if len(variant.parts) < 2:
            error("A thread needs at least 2 posts")
        for i, part in enumerate(variant.parts, 1):
            size = formats.length(part, fmt)
            if not part.strip():
                error(f"Post {i} is empty")
            elif fmt.limit and size > fmt.limit:
                error(f"Post {i} is {size} characters; X allows {fmt.limit}")
    elif fmt.shape == "ad":
        if len(variant.headlines) < 1:
            error("No headlines")
        for h in variant.headlines:
            if len(h) > formats.AD_HEADLINE_LIMIT:
                error(f"Headline \"{h[:40]}\" is {len(h)} characters; keep it to {formats.AD_HEADLINE_LIMIT}")
        for d in variant.descriptions:
            if len(d) > formats.AD_DESCRIPTION_LIMIT:
                error(f"A description is {len(d)} characters; keep it to {formats.AD_DESCRIPTION_LIMIT}")
        if len(variant.text) > formats.AD_PRIMARY_LIMIT:
            warn(f"Primary text is {len(variant.text)} characters; {formats.AD_PRIMARY_LIMIT} or fewer shows without truncation")
    else:
        size = formats.length(variant.text, fmt)
        if not variant.text.strip():
            error("The text is empty")
        elif fmt.limit and size > fmt.limit:
            error(f"{size} characters; {fmt.label} allows {fmt.limit}")
        if fmt.shape == "article":
            if not variant.title:
                error("No title")
            elif len(variant.title) > formats.BLOG_TITLE_LIMIT:
                warn(f"Title is {len(variant.title)} characters; search results show about {formats.BLOG_TITLE_LIMIT}")
            if variant.subtitle and len(variant.subtitle) > formats.META_DESCRIPTION_LIMIT:
                warn(f"Meta description is {len(variant.subtitle)} characters; keep it to {formats.META_DESCRIPTION_LIMIT}")
        if fmt.shape == "email":
            if not variant.title:
                error("No subject line")
            elif len(variant.title) > formats.EMAIL_SUBJECT_LIMIT:
                warn(f"Subject is {len(variant.title)} characters; inboxes cut it after about {formats.EMAIL_SUBJECT_LIMIT}")

    text = all_text(variant)
    lowered = text.lower()
    hashtags = _HASHTAG.findall(text)
    if fmt.max_hashtags is not None and len(hashtags) > fmt.max_hashtags:
        warn(f"{len(hashtags)} hashtags; {fmt.max_hashtags} or fewer reads better on {fmt.label.split()[0]}")
    if _PLACEHOLDER.search(text):
        error("Has a placeholder to fill in: " + _PLACEHOLDER.search(text).group(0))
    found = [c for c in CLICHES if c in lowered]
    if found:
        warn("Stock phrases: " + ", ".join(f"\"{c}\"" for c in found[:4]))
    if "—" in text:
        warn("Uses em dashes")
    figures = _unsupported(text, allowed)
    if figures:
        warn("Check these figures, they weren't in your brief: " + ", ".join(figures[:5]))
    if fmt.platform == "x" and re.search(r"https?://", text):
        warn("Posts with links cost more through the X API ($0.20 instead of $0.015)")
    return issues


def penalty(issues: list[Issue]) -> float:
    errors = sum(1 for i in issues if i.level == "error")
    warnings = sum(1 for i in issues if i.level == "warning")
    return 3.0 * errors + min(2.0, 0.5 * warnings)
