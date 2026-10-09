"""General agent: answers with company + conversation context, or routes the
message to a specialist agent with a standalone task."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from agents.general import prompts
from agents.lead_research.llm import LLMClient

Route = Literal["none", "lead_research", "sales_outreach", "data_reporting"]
ROUTES = ("lead_research", "sales_outreach", "data_reporting")


class GeneralResult(BaseModel):
    kind: Literal["general"] = "general"
    reply: str
    route: Route = "none"
    # Instruction for the routed agent (empty when answering directly).
    task: str = ""
    llm_tokens: int = 0


def _company_text(company: dict[str, Any]) -> str:
    lines = [f"{k.replace('_', ' ')}: {v}" for k, v in company.items() if v]
    return "\n".join(lines) or "(not provided)"


class GeneralAgent:
    def __init__(self, llm: LLMClient):
        self._llm = llm

    async def run(
        self,
        *,
        message: str,
        history: str,
        company: dict[str, Any],
        user_name: str,
        today: datetime,
        attachments: str = "",
    ) -> GeneralResult:
        out = await self._llm.complete_json(
            system=prompts.SYSTEM,
            user=prompts.USER.format(
                today=today.strftime("%A %d %B %Y"),
                user_name=user_name or "the user",
                company=_company_text(company),
                history=history,
                attachments=attachments or "(none)",
                message=message,
            ),
            tier="strong",
            max_tokens=3000,
        )
        data = out.data
        route = data.get("route") if data.get("route") in ROUTES else "none"
        reply = str(data.get("reply") or "").strip()
        task = str(data.get("task") or "").strip()
        if route != "none" and not task:
            task = message
        if not reply:
            reply = "I'll hand this to the right agent." if route != "none" else "Sorry, I couldn't come up with an answer. Try rephrasing?"
        return GeneralResult(reply=reply, route=route, task=task if route != "none" else "", llm_tokens=out.tokens)
