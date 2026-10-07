"""Runs the Sales & Outreach agent for a signed-in user, and carries out the
drafted actions they approve."""

import asyncio
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx

from agents.lead_research.errors import LLMOutputError, ResearchConfigError
from agents.lead_research.llm import build_llm_client
from agents.sales_outreach import OutreachCancelledError, OutreachContext, OutreachResult, SalesOutreachAgent, compact_leads
from agents.sales_outreach.executor import EditError, apply_edits, execute
from config.settings import get_settings
from integrations.google import connections, oauth
from integrations.google.calendar import CalendarClient
from integrations.google.errors import (
    GoogleAPIError,
    GoogleAuthExpiredError,
    GoogleConfigError,
    GoogleIntegrationError,
    GoogleNotConnectedError,
)
from integrations.google.gmail import GmailClient
from services import supabase_rest
from services.auth import AuthUser
from services.cancellation import clear_cancellation, is_cancelled
from services.progress_reporter import ProgressTracker
from services.request_store import finalize_request
from services.uuid_utils import is_valid_request_id

logger = logging.getLogger(__name__)

RUN_TIMEOUT_SECONDS = 300.0


class OutreachError(Exception):
    """A failure with a message that's safe and useful to show the user."""

    def __init__(self, message: str, status: int):
        super().__init__(message)
        self.status = status


def _to_outreach_error(exc: Exception) -> OutreachError:
    if isinstance(exc, OutreachError):
        return exc
    if isinstance(exc, (GoogleNotConnectedError, GoogleAuthExpiredError)):
        return OutreachError(str(exc), 409)
    if isinstance(exc, (GoogleConfigError, ResearchConfigError, supabase_rest.SupabaseNotConfiguredError)):
        return OutreachError(str(exc), 503)
    if isinstance(exc, GoogleAPIError):
        return OutreachError(str(exc), 502)
    if isinstance(exc, GoogleIntegrationError):
        return OutreachError(str(exc), 502)
    if isinstance(exc, LLMOutputError):
        return OutreachError("The model returned an unusable answer, try again", 502)
    if isinstance(exc, OutreachCancelledError):
        return OutreachError("Stopped by you.", 409)
    if isinstance(exc, asyncio.TimeoutError):
        return OutreachError(f"The agent didn't finish within {RUN_TIMEOUT_SECONDS:.0f}s", 504)
    logger.exception("Unexpected sales outreach failure")
    return OutreachError("Internal error running the Sales & Outreach agent", 500)


async def _owned_request(user_id: str, request_id: str, agent_type: str) -> dict[str, Any]:
    if not is_valid_request_id(request_id):
        raise OutreachError("Request not found", 404)
    row = await supabase_rest.select_one(
        "agent_requests",
        {"id": f"eq.{request_id}", "user_id": f"eq.{user_id}", "agent_type": f"eq.{agent_type}", "select": "*"},
    )
    if not row:
        raise OutreachError("Request not found", 404)
    return row


def _time_zone(name: str | None) -> str:
    try:
        return str(ZoneInfo(name or "UTC"))
    except (ZoneInfoNotFoundError, ValueError):
        return "UTC"


async def run_outreach(
    user: AuthUser,
    *,
    prompt: str,
    request_id: str | None,
    company_context: dict[str, Any],
    time_zone: str | None,
    sender_name: str | None,
    lead_request_id: str | None,
) -> OutreachResult:
    # Ownership is checked before anything is written with the service key.
    owned_id = None
    if request_id:
        await _owned_request(user.id, request_id, "sales_outreach")
        owned_id = request_id
    try:
        result = await _run(user, prompt, owned_id, company_context, time_zone, sender_name, lead_request_id)
    except Exception as exc:  # noqa: BLE001 - mapped to a user-facing message below
        error = _to_outreach_error(exc)
        await finalize_request(owned_id, status="failed", error=str(error))
        raise error from exc
    await finalize_request(owned_id, status="completed", result=result.model_dump(mode="json"))
    return result


async def _run(
    user: AuthUser,
    prompt: str,
    request_id: str | None,
    company_context: dict[str, Any],
    time_zone: str | None,
    sender_name: str | None,
    lead_request_id: str | None,
) -> OutreachResult:
    settings = get_settings()
    progress = ProgressTracker(request_id)
    config = oauth.oauth_config(settings)
    await progress.add_step("Connecting to your Google account")
    token = await connections.get_access_token(config, user.id)
    connection = await connections.get_connection(user.id)
    if not connection:
        raise GoogleNotConnectedError("Connect your Google account first so the agent can use Gmail and Calendar")

    leads: list[dict[str, Any]] = []
    if lead_request_id:
        lead_row = await _owned_request(user.id, lead_request_id, "lead_research")
        leads = compact_leads(lead_row.get("result"))
        await progress.add_step(f"Using {len(leads)} lead(s) from your research")

    tz = _time_zone(time_zone)
    ctx = OutreachContext(
        instruction=prompt,
        sender_name=(sender_name or "").strip() or connection.email.split("@")[0],
        sender_email=connection.email,
        time_zone=tz,
        now=datetime.now(timezone.utc),
        company={k: v for k, v in company_context.items() if v},
        leads=leads,
    )
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            agent = SalesOutreachAgent(
                llm=build_llm_client(settings),
                gmail=GmailClient(token, client),
                calendar=CalendarClient(token, client),
                max_actions=settings.outreach_max_actions,
                on_step=progress.add_step,
                is_cancelled=lambda: is_cancelled(request_id),
            )
            return await asyncio.wait_for(agent.run(ctx), timeout=RUN_TIMEOUT_SECONDS)
    except OutreachCancelledError:
        await progress.add_step("Stopped.")
        raise
    finally:
        clear_cancellation(request_id)


# Serialises decisions per request so two quick clicks can't both send, or
# overwrite each other's update of the shared result JSON.
_locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


async def decide_action(
    user: AuthUser, request_id: str, action_id: str, decision: str, edits: dict[str, Any]
) -> dict[str, Any]:
    async with _locks[request_id]:
        row = await _owned_request(user.id, request_id, "sales_outreach")
        if not row.get("result"):
            raise OutreachError("This request has no drafts", 409)
        result = OutreachResult.model_validate(row["result"])
        index = next((i for i, a in enumerate(result.actions) if a.id == action_id), None)
        if index is None:
            raise OutreachError("Draft not found", 404)
        action = result.actions[index]
        if action.status in ("sent", "scheduled"):
            raise OutreachError("This has already been sent", 409)

        try:
            updated = apply_edits(action, edits) if edits else action.model_copy(deep=True)
        except EditError as exc:
            raise OutreachError(str(exc), 422) from exc

        if decision == "discard":
            updated.status = "discarded"
        elif decision == "save":
            updated.status = "draft"
        else:
            try:
                config = oauth.oauth_config(get_settings())
                token = await connections.get_access_token(config, user.id)
                async with httpx.AsyncClient(timeout=20.0) as client:
                    updated = await execute(
                        updated,
                        gmail=GmailClient(token, client),
                        calendar=CalendarClient(token, client),
                        sender_name=result.sender_name,
                        sender_email=result.sender_email,
                    )
            except Exception as exc:  # noqa: BLE001 - recorded on the draft so the user sees it
                error = _to_outreach_error(exc)
                updated.status = "failed"
                updated.error = str(error)

        result.actions[index] = updated
        await supabase_rest.update(
            "agent_requests",
            {"id": f"eq.{request_id}", "user_id": f"eq.{user.id}"},
            {"result": result.model_dump(mode="json")},
        )
        return updated.model_dump(mode="json")
