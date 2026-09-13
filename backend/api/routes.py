import logging

from fastapi import APIRouter, HTTPException

from agents.sales_agent.schemas import LeadGenerationResult
from api.models import LeadGenerationRequest
from services.agent_runner import run_sales_agent
from services.exceptions import AgentOutputError, AgentTimeoutError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sales-agent", tags=["sales-agent"])


@router.post("/generate-leads", response_model=LeadGenerationResult)
async def generate_leads(request: LeadGenerationRequest) -> LeadGenerationResult:
    try:
        return await run_sales_agent(
            request.query,
            request_id=request.request_id,
            company_context=request.company_context,
        )
    except AgentTimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except AgentOutputError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 - never leak internals/stack traces to the client
        logger.exception("Unexpected error running sales agent for query=%r", request.query)
        raise HTTPException(status_code=500, detail="Internal error running the sales agent") from exc
