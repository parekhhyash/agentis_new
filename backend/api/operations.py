from typing import Any, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from agents.operations import OperationsResult
from api.models import CompanyContext
from services import scheduler
from services.auth import AuthUser, current_user
from services.operations_runner import (
    OutreachError,
    change_task,
    decide_proposal,
    delete_task,
    list_tasks,
    run_operations,
    run_task_now,
)
from services.scheduler import OperationsError

router = APIRouter(prefix="/operations", tags=["operations"])


class OperationsRunRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    request_id: str | None = None
    company_context: CompanyContext | None = None
    time_zone: str | None = Field(default=None, max_length=64)
    user_name: str | None = Field(default=None, max_length=120)


class ProposalDecision(BaseModel):
    decision: Literal["confirm", "discard"]
    # The "Email me the results" switch on the card, if the user changed it.
    notify_email: bool | None = None


class TaskChange(BaseModel):
    status: Literal["active", "paused"] | None = None
    notify_email: bool | None = None


def _http(exc: OperationsError | OutreachError) -> HTTPException:
    return HTTPException(status_code=exc.status, detail=str(exc))


@router.post("/run", response_model=OperationsResult)
async def run(body: OperationsRunRequest, user: AuthUser = Depends(current_user)) -> OperationsResult:
    try:
        return await run_operations(
            user,
            prompt=body.prompt,
            request_id=body.request_id,
            company_context=body.company_context.model_dump() if body.company_context else {},
            time_zone=body.time_zone,
            user_name=body.user_name,
        )
    except OutreachError as exc:
        raise _http(exc) from exc


@router.post("/requests/{request_id}/proposals/{proposal_id}")
async def decide(
    request_id: str, proposal_id: str, body: ProposalDecision, user: AuthUser = Depends(current_user)
) -> dict[str, Any]:
    try:
        return await decide_proposal(user, request_id, proposal_id, body.decision, body.notify_email)
    except OperationsError as exc:
        raise _http(exc) from exc


@router.get("/tasks")
async def tasks(user: AuthUser = Depends(current_user)) -> dict[str, Any]:
    return {"tasks": [t.model_dump(mode="json") for t in await list_tasks(user.id, with_runs=True)]}


@router.patch("/tasks/{task_id}")
async def change(task_id: str, body: TaskChange, user: AuthUser = Depends(current_user)) -> dict[str, Any]:
    try:
        task = await change_task(user, task_id, status=body.status, notify_email=body.notify_email)
    except OperationsError as exc:
        raise _http(exc) from exc
    return task.model_dump(mode="json")


@router.delete("/tasks/{task_id}")
async def delete(task_id: str, user: AuthUser = Depends(current_user)) -> dict[str, bool]:
    try:
        await delete_task(user, task_id)
    except OperationsError as exc:
        raise _http(exc) from exc
    return {"deleted": True}


@router.post("/tasks/{task_id}/run")
async def run_now(task_id: str, user: AuthUser = Depends(current_user)) -> dict[str, Any]:
    try:
        task = await run_task_now(user, task_id)
    except OperationsError as exc:
        raise _http(exc) from exc
    return task.model_dump(mode="json")


@router.post("/tick")
async def tick(x_operations_secret: str | None = Header(default=None)) -> dict[str, int]:
    """Called every minute by pg_cron while a task is due or running (see the
    operations_scheduler migration). Starts due runs and returns at once."""
    if not await scheduler.tick_secret_ok(x_operations_secret):
        raise HTTPException(status_code=401, detail="Not allowed")
    return {"started": await scheduler.process_due()}
