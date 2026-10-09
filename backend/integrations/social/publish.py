"""Posting to LinkedIn (Posts API) and X (API v2)."""

import re
from dataclasses import dataclass

import httpx

from integrations.social.providers import SocialError

LINKEDIN_POSTS = "https://api.linkedin.com/rest/posts"
X_TWEETS = "https://api.x.com/2/tweets"

# LinkedIn's "little text" format reserves these; unescaped, a "(" can cut the
# post off at that point.
_LINKEDIN_RESERVED = re.compile(r"([\\|{}@\[\]()<>#*_~])")
_HASHTAG = re.compile(r"(?<![\w#&])#(\w+)")


@dataclass
class Posted:
    url: str
    posts: int = 1


def linkedin_commentary(text: str) -> str:
    """Escapes reserved characters and turns #tags into LinkedIn hashtags."""
    out, last = [], 0
    for match in _HASHTAG.finditer(text):
        out.append(_LINKEDIN_RESERVED.sub(r"\\\1", text[last:match.start()]))
        tag = _LINKEDIN_RESERVED.sub(r"\\\1", match.group(1))
        out.append("{hashtag|\\#|" + tag + "}")
        last = match.end()
    out.append(_LINKEDIN_RESERVED.sub(r"\\\1", text[last:]))
    return "".join(out)


def _api_error(name: str, response: httpx.Response) -> SocialError:
    try:
        data = response.json()
    except ValueError:
        data = {}
    detail = data.get("detail") or data.get("message") or data.get("title") or (data.get("errors") or [{}])[0].get("message")
    if response.status_code == 401:
        return SocialError(f"{name} rejected the connection; connect it again on the Connect page", 409)
    if response.status_code == 402 or "credit" in str(detail).lower():
        return SocialError(f"{name} says the account has no API credits left: {detail or 'payment required'}", 402)
    if response.status_code == 429:
        return SocialError(f"{name} rate limit reached; try again later", 429)
    return SocialError(f"{name} didn't publish the post: {detail or f'HTTP {response.status_code}'}", 502)


async def post_linkedin(client: httpx.AsyncClient, token: str, member_id: str, text: str, api_version: str) -> Posted:
    response = await client.post(
        LINKEDIN_POSTS,
        headers={
            "Authorization": f"Bearer {token}",
            "LinkedIn-Version": api_version,
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json",
        },
        json={
            "author": f"urn:li:person:{member_id}",
            "commentary": linkedin_commentary(text),
            "visibility": "PUBLIC",
            "distribution": {"feedDistribution": "MAIN_FEED", "targetEntities": [], "thirdPartyDistributionChannels": []},
            "lifecycleState": "PUBLISHED",
            "isReshareDisabledByAuthor": False,
        },
    )
    if response.status_code >= 400:
        raise _api_error("LinkedIn", response)
    urn = response.headers.get("x-restli-id") or response.headers.get("x-linkedin-id") or ""
    url = f"https://www.linkedin.com/feed/update/{urn}/" if urn else "https://www.linkedin.com/in/me/recent-activity/all/"
    return Posted(url=url)


class PartialThreadError(SocialError):
    def __init__(self, message: str, posted: Posted):
        super().__init__(message, 502)
        self.posted = posted


async def post_x(client: httpx.AsyncClient, token: str, username: str | None, parts: list[str]) -> Posted:
    """Posts one post, or a thread as a chain of replies. If X fails part way,
    raises PartialThreadError with what did go out."""
    first_url, previous, sent = "", None, 0
    for text in parts:
        body: dict = {"text": text}
        if previous:
            body["reply"] = {"in_reply_to_tweet_id": previous}
        response = await client.post(X_TWEETS, headers={"Authorization": f"Bearer {token}"}, json=body)
        if response.status_code >= 400:
            error = _api_error("X", response)
            if sent:
                raise PartialThreadError(f"Posted {sent} of {len(parts)}, then: {error}", Posted(first_url, sent))
            raise error
        tweet_id = str((response.json().get("data") or {}).get("id") or "")
        previous = tweet_id
        sent += 1
        if not first_url:
            first_url = f"https://x.com/{username or 'i'}/status/{tweet_id}" if username else f"https://x.com/i/web/status/{tweet_id}"
    return Posted(first_url, sent)
