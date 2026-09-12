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
from config.settings import get_settings
from services.exceptions import AgentOutputError, AgentTimeoutError

logger = logging.getLogger(__name__)

_APP_NAME = "agentis-sales-agent"


async def run_sales_agent(query: str) -> LeadGenerationResult:
    settings = get_settings()

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

    content = types.Content(role="user", parts=[types.Part(text=query)])

    async def _drive_to_completion() -> None:
        async for _event in runner.run_async(
            user_id=user_id, session_id=session_id, new_message=content
        ):
            pass  # we read the final state after the run, not the event stream

    try:
        await asyncio.wait_for(
            _drive_to_completion(), timeout=settings.agent_run_timeout_seconds
        )
    except asyncio.TimeoutError as exc:
        logger.warning("Sales agent run timed out for query=%r", query)
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
