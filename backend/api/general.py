from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from agents.general import GeneralResult
from api.models import CompanyContext
from services.auth import AuthUser, current_user
from services.general_runner import OutreachError, run_general

router = APIRouter(prefix="/general", tags=["general"])


class GeneralRunRequest(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    request_id: str | None = None
    company_context: CompanyContext | None = None
    user_name: str | None = Field(default=None, max_length=120)


@router.post("/run", response_model=GeneralResult)
async def run(body: GeneralRunRequest, user: AuthUser = Depends(current_user)) -> GeneralResult:
    try:
        return await run_general(
            user,
            prompt=body.prompt,
            request_id=body.request_id,
            company_context=body.company_context.model_dump() if body.company_context else {},
            user_name=body.user_name,
        )
    except OutreachError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc
