import logging

from fastapi import APIRouter, HTTPException

from agents.lead_research import LeadResearchResult
from api.models import CancelRequest, LeadGenerationRequest
from services.agent_runner import run_sales_agent
from services.cancellation import request_cancellation
from services.exceptions import (
    AgentCancelledError,
    AgentConfigurationError,
    AgentOutputError,
    AgentTimeoutError,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sales-agent", tags=["sales-agent"])


@router.post("/generate-leads", response_model=LeadResearchResult)
async def generate_leads(request: LeadGenerationRequest) -> LeadResearchResult:
    try:
        return await run_sales_agent(
            request.query,
            request_id=request.request_id,
            company_context=request.company_context,
        )
    except AgentTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except AgentCancelledError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except AgentConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except AgentOutputError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - never leak internals/stack traces to the client
        logger.exception("Unexpected error running lead research for query=%r", request.query)
        raise HTTPException(status_code=500, detail="Internal error running the lead research agent") from exc


@router.post("/cancel", status_code=202)
async def cancel_leads(request: CancelRequest) -> dict[str, bool]:
    """Best-effort: flags the run so it stops at its next checkpoint (before
    the next search, scrape or LLM call) rather than running to completion
    and burning tokens regardless of what the caller does."""
    request_cancellation(request.request_id)
    return {"cancelled": True}
