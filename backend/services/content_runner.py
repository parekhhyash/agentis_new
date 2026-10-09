"""Runs the Content & Copy agent, and posts a chosen variant to LinkedIn or X
when the user asks."""

import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

import httpx

from agents.content_copy import ContentAgent, ContentResult
from agents.content_copy import checks, formats
from agents.content_copy.schemas import Publication
from agents.lead_research.llm import build_llm_client
from config.settings import get_settings
from integrations.social import connections as social
from integrations.social.providers import NAMES, SocialError
from integrations.social.publish import PartialThreadError, post_linkedin, post_x
from services import supabase_rest
from services.auth import AuthUser
from services.conversation_context import load_context
from services.outreach_runner import OutreachError, _owned_request, _to_outreach_error
from services.progress_reporter import ProgressTracker
from services.request_store import finalize_request

RUN_TIMEOUT_SECONDS = 180.0
PLATFORM_OF = {"linkedin_post": "linkedin", "x_post": "x", "x_thread": "x"}


async def run_content(
    user: AuthUser, *, prompt: str, request_id: str | None, company_context: dict[str, Any]
) -> ContentResult:
    owned_id = None
    if request_id:
        await _owned_request(user.id, request_id, "content_copy")
        owned_id = request_id
    try:
        progress = ProgressTracker(owned_id)
        await progress.add_step("Reading the conversation")
        context = await load_context(user.id, owned_id)
        agent = ContentAgent(build_llm_client(get_settings()), on_step=progress.add_step)
        result = await asyncio.wait_for(
            agent.run(
                prompt,
                company={k: v for k, v in company_context.items() if v},
                history=context.render(),
                today=datetime.now(timezone.utc),
            ),
            timeout=RUN_TIMEOUT_SECONDS,
        )
    except Exception as exc:  # noqa: BLE001 - mapped to a user-facing message
        error = _to_outreach_error(exc, "Content & Copy", RUN_TIMEOUT_SECONDS)
        await finalize_request(owned_id, status="failed", error=str(error))
        raise error from exc
    await finalize_request(owned_id, status="completed", result=result.model_dump(mode="json"))
    return result


# One publish at a time per request, so a double click can't post twice.
_locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


async def publish_variant(
    user: AuthUser,
    request_id: str,
    *,
    piece_id: str,
    variant_id: str,
    provider: str,
    text: str | None = None,
    parts: list[str] | None = None,
) -> dict[str, Any]:
    async with _locks[request_id]:
        try:
            row = await _owned_request(user.id, request_id, "content_copy")
        except OutreachError as exc:
            raise SocialError(str(exc), exc.status) from exc
        result = ContentResult.model_validate(row.get("result") or {"request": ""})
        piece = next((p for p in result.pieces if p.id == piece_id), None)
        variant = next((v for v in piece.variants if v.id == variant_id), None) if piece else None
        if not piece or not variant:
            raise SocialError("That draft wasn't found", 404)
        if PLATFORM_OF.get(piece.format) != provider:
            raise SocialError(f"A {piece.label} can't be posted to {NAMES.get(provider, provider)}", 400)
        if any(p.provider == provider for p in variant.published):
            raise SocialError(f"This option is already posted on {NAMES[provider]}", 409)

        fmt = formats.get(piece.format)
        edited = variant.model_copy(deep=True)
        if text is not None:
            edited.text = text.strip()
        if parts is not None:
            edited.parts = [p.strip() for p in parts if p.strip()]
        errors = [i.message for i in checks.check(edited, fmt, set()) if i.level == "error"]
        if errors:
            raise SocialError(errors[0], 422)

        token, connection = await social.credentials(user.id, provider)
        settings = get_settings()
        error: SocialError | None = None
        async with httpx.AsyncClient(timeout=20.0) as client:
            try:
                if provider == "linkedin":
                    posted = await post_linkedin(client, token, connection["account_id"], edited.text, settings.linkedin_api_version)
                else:
                    handle = (connection.get("account_label") or "").removeprefix("@") or None
                    posted = await post_x(client, token, handle, edited.parts if fmt.shape == "thread" else [edited.text])
            except PartialThreadError as exc:  # some of the thread went out: record it
                posted, error = exc.posted, exc

        edited.published.append(
            Publication(provider=provider, url=posted.url, posted_at=datetime.now(timezone.utc).isoformat(), posts=posted.posts)  # type: ignore[arg-type]
        )
        edited.issues = checks.check(edited, fmt, checks.allowed_figures(result.request)) if (text or parts) else variant.issues
        piece.variants[piece.variants.index(variant)] = edited
        await supabase_rest.update(
            "agent_requests",
            {"id": f"eq.{request_id}", "user_id": f"eq.{user.id}"},
            {"result": result.model_dump(mode="json")},
        )
        if error:
            raise error
        return edited.model_dump(mode="json")
