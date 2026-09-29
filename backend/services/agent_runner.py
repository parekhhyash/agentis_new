"""Runs the lead research agent for one request. The API layer calls
`run_sales_agent(...)` and gets back either a LeadResearchResult or a domain
exception it can turn into an HTTP error.
"""

import asyncio
import logging

from agents.lead_research import LeadResearchResult, lead_research_agent
from agents.lead_research.errors import (
    LLMOutputError,
    ResearchCancelledError,
    ResearchConfigError,
    ResearchFailedError,
)
from api.models import CompanyContext
from config.settings import get_settings
from services.cancellation import clear_cancellation, is_cancelled
from services.exceptions import (
    AgentCancelledError,
    AgentConfigurationError,
    AgentOutputError,
    AgentTimeoutError,
)
from services.progress_reporter import ProgressTracker
from services.request_store import finalize_request

logger = logging.getLogger(__name__)


async def run_sales_agent(
    query: str,
    request_id: str | None = None,
    company_context: CompanyContext | None = None,
) -> LeadResearchResult:
    """Guarantees the request's final status/result lands in Supabase directly
    from the backend, not only via the caller's HTTP response - otherwise a
    deploy restart, dropped connection or closed tab leaves the row stuck at
    'in_progress' forever."""
    try:
        result = await _run(query, request_id, company_context)
    except AgentTimeoutError as exc:
        await finalize_request(request_id, status="failed", error=str(exc))
        raise
    except AgentCancelledError:
        await finalize_request(request_id, status="failed", error="Stopped by you.")
        raise
    except (AgentOutputError, AgentConfigurationError) as exc:
        await finalize_request(request_id, status="failed", error=str(exc))
        raise
    except Exception:
        await finalize_request(request_id, status="failed", error="Internal error running the lead research agent")
        raise
    else:
        await finalize_request(request_id, status="completed", result=result.model_dump(mode="json"))
        return result


async def _run(query: str, request_id: str | None, company_context: CompanyContext | None) -> LeadResearchResult:
    settings = get_settings()
    progress = ProgressTracker(request_id)
    context = company_context.model_dump() if company_context else {}

    try:
        async with lead_research_agent(
            settings,
            on_step=progress.add_step,
            is_cancelled=lambda: is_cancelled(request_id),
        ) as agent:
            result = await asyncio.wait_for(agent.run(query, context), timeout=settings.agent_run_timeout_seconds)
    except asyncio.TimeoutError as exc:
        logger.warning("Lead research hit the hard timeout for query=%r", query)
        await progress.add_step("Timed out.")
        raise AgentTimeoutError(f"Agent did not finish within {settings.agent_run_timeout_seconds:.0f}s") from exc
    except ResearchCancelledError as exc:
        logger.info("Lead research cancelled for request_id=%r", request_id)
        await progress.add_step("Stopped.")
        raise AgentCancelledError("Cancelled by the caller") from exc
    except ResearchConfigError as exc:
        raise AgentConfigurationError(str(exc)) from exc
    except (ResearchFailedError, LLMOutputError) as exc:
        raise AgentOutputError(str(exc)) from exc
    finally:
        clear_cancellation(request_id)

    await progress.add_step("Done.")
    result.query = query
    return result
