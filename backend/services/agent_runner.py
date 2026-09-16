"""Runs the sales agent pipeline for one request and returns validated,
schema-checked output. This is the only place that talks to ADK's Runner -
the API layer just calls `run_sales_agent(query)` and gets back either a
LeadGenerationResult or a domain exception it can turn into an HTTP error.
"""

import asyncio
import logging
import uuid

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import ValidationError

from agents.sales_agent.agent import build_sales_agent_pipeline
from agents.sales_agent.schemas import LeadGenerationResult
from api.models import CompanyContext
from config.settings import get_settings
from services.cancellation import clear_cancellation, is_cancelled
from services.exceptions import AgentCancelledError, AgentOutputError, AgentTimeoutError
from services.progress_reporter import ProgressTracker
from services.request_store import finalize_request

logger = logging.getLogger(__name__)

_APP_NAME = "agentis-sales-agent"

_STAGE_LABELS = {
    "lead_researcher": "Researching the web for candidate companies...",
    "lead_structurer": "Structuring the qualified leads into the final report...",
}


async def run_sales_agent(
    query: str,
    request_id: str | None = None,
    company_context: CompanyContext | None = None,
) -> LeadGenerationResult:
    """Thin wrapper around `_run_pipeline` that guarantees the request's
    final status/result lands in Supabase directly from the backend, not
    only via the caller's own HTTP response handling. Without this, a
    deploy restart, a dropped connection, or the user closing the tab
    mid-run leaves the row stuck at 'in_progress' forever - nothing else
    would ever flip it to a terminal state."""
    try:
        result = await _run_pipeline(query, request_id, company_context)
    except AgentTimeoutError as exc:
        await finalize_request(request_id, status="failed", error=str(exc))
        raise
    except AgentCancelledError:
        await finalize_request(request_id, status="failed", error="Stopped by you.")
        raise
    except AgentOutputError as exc:
        await finalize_request(request_id, status="failed", error=str(exc))
        raise
    except Exception:
        await finalize_request(
            request_id, status="failed", error="Internal error running the sales agent"
        )
        raise
    else:
        await finalize_request(
            request_id, status="completed", result=result.model_dump(mode="json")
        )
        return result


async def _run_pipeline(
    query: str,
    request_id: str | None,
    company_context: CompanyContext | None,
) -> LeadGenerationResult:
    settings = get_settings()
    progress = ProgressTracker(request_id)

    session_service = InMemorySessionService()
    user_id = f"api-user-{uuid.uuid4().hex[:8]}"
    session_id = uuid.uuid4().hex

    await session_service.create_session(
        app_name=_APP_NAME, user_id=user_id, session_id=session_id
    )

    # Built fresh per request: agent definitions are cheap, stateless
    # config objects, and this avoids any risk of state leaking across
    # concurrent requests. company_context (if available) is baked directly
    # into the researcher's own instruction text - see
    # prompts.build_researcher_instruction - rather than prepended to the
    # message, so the query itself stays exactly what the user typed.
    agent = build_sales_agent_pipeline(company_context=company_context)
    runner = Runner(agent=agent, app_name=_APP_NAME, session_service=session_service)

    content = types.Content(role="user", parts=[types.Part(text=query)])

    await progress.add_step("Starting up the research agent...")

    async def _drive_to_completion() -> None:
        seen_stage: str | None = None

        async for event in runner.run_async(
            user_id=user_id, session_id=session_id, new_message=content
        ):
            if is_cancelled(request_id):
                raise AgentCancelledError("Cancelled by the caller")

            author = getattr(event, "author", None)
            if author in _STAGE_LABELS and author != seen_stage:
                seen_stage = author
                await progress.add_step(_STAGE_LABELS[author])

            for call in event.get_function_calls():
                args = call.args or {}
                if call.name == "search_web":
                    await progress.add_step(f"Searching: {args.get('query', '')}")
                elif call.name == "fetch_webpage":
                    await progress.add_step(f"Reading: {args.get('url', '')}")
                else:
                    await progress.add_step(f"Calling {call.name}...")

    try:
        try:
            await asyncio.wait_for(
                _drive_to_completion(), timeout=settings.agent_run_timeout_seconds
            )
        except asyncio.TimeoutError as exc:
            logger.warning("Sales agent run timed out for query=%r", query)
            await progress.add_step("Timed out.")
            raise AgentTimeoutError(
                f"Agent did not finish within {settings.agent_run_timeout_seconds}s"
            ) from exc
        except AgentCancelledError:
            logger.info("Sales agent run cancelled for request_id=%r", request_id)
            await progress.add_step("Stopped.")
            raise
    finally:
        clear_cancellation(request_id)

    session = await session_service.get_session(
        app_name=_APP_NAME, user_id=user_id, session_id=session_id
    )
    if session is None:
        raise AgentOutputError("Session disappeared after the agent run completed")

    raw_result = session.state.get("structured_result")

    if raw_result is None:
        raise AgentOutputError("Agent finished without producing a structured result")

    try:
        if isinstance(raw_result, dict):
            result = LeadGenerationResult.model_validate(raw_result)
        elif isinstance(raw_result, str):
            result = LeadGenerationResult.model_validate_json(raw_result)
        else:
            raise AgentOutputError(
                f"Unexpected structured_result type: {type(raw_result).__name__}"
            )
    except ValidationError as exc:
        logger.error("Structured output failed schema validation: %s", exc)
        raise AgentOutputError(f"Agent output did not match schema: {exc}") from exc

    # Trust our own input over whatever the LLM echoed back.
    result.query = query
    return result
