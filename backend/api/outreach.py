from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from agents.sales_outreach import OutreachResult
from api.models import CompanyContext
from services.auth import AuthUser, current_user
from services.cancellation import request_cancellation
from services.outreach_runner import OutreachError, decide_action, run_outreach

router = APIRouter(prefix="/sales-outreach", tags=["sales-outreach"])


class OutreachRunRequest(BaseModel):
    prompt: str = Field(min_length=3, max_length=4000)
    request_id: str | None = None
    company_context: CompanyContext | None = None
    time_zone: str | None = Field(default=None, max_length=64, description="IANA zone, e.g. Asia/Kolkata")
    sender_name: str | None = Field(default=None, max_length=120)
    lead_request_id: str | None = Field(
        default=None, description="A completed Lead Research request whose leads the emails may go to."
    )


class ActionDecision(BaseModel):
    decision: Literal["approve", "discard", "save"]
    edits: dict[str, Any] = Field(default_factory=dict)


@router.post("/run", response_model=OutreachResult)
async def run(body: OutreachRunRequest, user: AuthUser = Depends(current_user)) -> OutreachResult:
    try:
        return await run_outreach(
            user,
            prompt=body.prompt,
            request_id=body.request_id,
            company_context=body.company_context.model_dump() if body.company_context else {},
            time_zone=body.time_zone,
            sender_name=body.sender_name,
            lead_request_id=body.lead_request_id,
        )
    except OutreachError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc


@router.post("/requests/{request_id}/actions/{action_id}")
async def decide(
    request_id: str, action_id: str, body: ActionDecision, user: AuthUser = Depends(current_user)
) -> dict[str, Any]:
    try:
        return await decide_action(user, request_id, action_id, body.decision, body.edits)
    except OutreachError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc


@router.post("/cancel", status_code=202)
async def cancel(body: dict[str, str], user: AuthUser = Depends(current_user)) -> dict[str, bool]:
    request_id = body.get("request_id")
    if request_id:
        request_cancellation(request_id)
    return {"cancelled": True}
