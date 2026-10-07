"""Runs the General agent for one chat message."""

import asyncio
from datetime import datetime, timezone
from typing import Any

from agents.general import GeneralAgent, GeneralResult
from agents.lead_research.llm import build_llm_client
from config.settings import get_settings
from services.auth import AuthUser
from services.conversation_context import load_context
from services.outreach_runner import OutreachError, _owned_request, _to_outreach_error
from services.progress_reporter import ProgressTracker
from services.request_store import finalize_request

RUN_TIMEOUT_SECONDS = 120.0


async def run_general(
    user: AuthUser,
    *,
    prompt: str,
    request_id: str | None,
    company_context: dict[str, Any],
    user_name: str | None,
) -> GeneralResult:
    owned_id = None
    if request_id:
        await _owned_request(user.id, request_id, "general")
        owned_id = request_id
    try:
        progress = ProgressTracker(owned_id)
        await progress.add_step("Reading the conversation")
        context = await load_context(user.id, owned_id)
        await progress.add_step("Thinking")
        agent = GeneralAgent(build_llm_client(get_settings()))
        result = await asyncio.wait_for(
            agent.run(
                message=prompt,
                history=context.render(),
                company={k: v for k, v in company_context.items() if v},
                user_name=(user_name or "").strip(),
                today=datetime.now(timezone.utc),
            ),
            timeout=RUN_TIMEOUT_SECONDS,
        )
    except Exception as exc:  # noqa: BLE001 - mapped to a user-facing message
        error = _to_outreach_error(exc)
        await finalize_request(owned_id, status="failed", error=str(error))
        raise error from exc
    await finalize_request(owned_id, status="completed", result=result.model_dump(mode="json"))
    return result


__all__ = ["OutreachError", "run_general"]
