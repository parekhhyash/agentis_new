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
from services.exceptions import AgentOutputError, AgentTimeoutError
from services.progress_reporter import ProgressTracker

logger = logging.getLogger(__name__)

_APP_NAME = "agentis-sales-agent"

_STAGE_LABELS = {
    "lead_researcher": "Researching the web for candidate companies...",
    "lead_structurer": "Structuring the qualified leads into the final report...",
}

_CONTEXT_FIELD_LABELS = {
    "company_name": "Name",
    "company_website": "Website",
    "industry": "Industry",
    "company_size": "Size",
    "company_description": "What they do",
}


def _format_company_context(company_context: CompanyContext | None) -> str | None:
    """Renders the user's own company profile as a text block to prepend to
    the query, or None if there's nothing worth including (a brand new
    profile with every field blank, or no profile supplied at all)."""
    if company_context is None:
        return None

    lines = [
        f"{label}: {value}"
        for field, label in _CONTEXT_FIELD_LABELS.items()
        if (value := getattr(company_context, field, None))
    ]
    if not lines:
        return None

    return (
        "COMPANY CONTEXT (the user's own company - not a lead, use this to "
        "judge fit and personalize why_good_fit):\n" + "\n".join(lines)
    )


async def run_sales_agent(
    query: str,
    request_id: str | None = None,
    company_context: CompanyContext | None = None,
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
    # concurrent requests.
    agent = build_sales_agent_pipeline()
    runner = Runner(agent=agent, app_name=_APP_NAME, session_service=session_service)

    context_block = _format_company_context(company_context)
    message_text = f"{context_block}\n\nREQUEST:\n{query}" if context_block else query
    content = types.Content(role="user", parts=[types.Part(text=message_text)])

    await progress.add_step("Starting up the research agent...")

    async def _drive_to_completion() -> None:
        seen_stage: str | None = None

        async for event in runner.run_async(
            user_id=user_id, session_id=session_id, new_message=content
        ):
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
        await asyncio.wait_for(
            _drive_to_completion(), timeout=settings.agent_run_timeout_seconds
        )
    except asyncio.TimeoutError as exc:
        logger.warning("Sales agent run timed out for query=%r", query)
        await progress.add_step("Timed out.")
        raise AgentTimeoutError(
            f"Agent did not finish within {settings.agent_run_timeout_seconds}s"
        ) from exc

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
