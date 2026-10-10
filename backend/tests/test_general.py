import asyncio
from datetime import datetime, timezone

from fastapi.testclient import TestClient

import main
from agents.general import GeneralAgent
from agents.lead_research.llm import LLMResult
from agents.sales_outreach import OutreachContext, SalesOutreachAgent
from services import conversation_context, supabase_rest

USER_ID = "11111111-1111-1111-1111-111111111111"
REQUEST_ID = "22222222-2222-2222-2222-222222222222"
NOW = datetime(2026, 10, 7, 9, 0, tzinfo=timezone.utc)


class FakeLLM:
    def __init__(self, data):
        self.data = data
        self.users: list[str] = []

    async def complete_json(self, *, system, user, tier, max_tokens):
        self.users.append(user)
        return LLMResult(data=self.data, tokens=42)


def _run(data, message="hi"):
    llm = FakeLLM(data)
    result = asyncio.run(
        GeneralAgent(llm).run(message=message, history="USER: earlier\nGENERAL: ok", company={"company_name": "Agentis"}, user_name="Yash", today=NOW)
    )
    return result, llm


def test_general_answers_directly_with_company_and_history_in_prompt():
    result, llm = _run({"route": "none", "reply": "**Plan:** do X", "task": "ignored"})
    assert (result.route, result.reply, result.task) == ("none", "**Plan:** do X", "")
    assert "company name: Agentis" in llm.users[0] and "USER: earlier" in llm.users[0]


def test_general_routes_with_a_standalone_task_and_rejects_unknown_agents():
    routed, _ = _run({"route": "lead_research", "reply": "Handing to Lead Research.", "task": "Find 10 D2C brands in India"})
    assert routed.route == "lead_research" and routed.task == "Find 10 D2C brands in India"

    no_task, _ = _run({"route": "sales_outreach", "reply": "On it."}, message="email ravi@beta.io")
    assert no_task.task == "email ravi@beta.io"

    unknown, _ = _run({"route": "customer_support", "reply": "Here's a plan", "task": "x"})
    assert unknown.route == "none" and unknown.task == ""


def test_summaries_cover_each_agent():
    leads = conversation_context.summarize(
        {"agent_type": "lead_research", "status": "completed", "result": {"leads": [
            {"company_name": "Mamaearth", "website": "mamaearth.in", "why_relevant": "fast-growing D2C", "contacts": [{"name": "Varun", "title": "CEO", "email": "varun@mamaearth.in"}]}
        ]}}
    )
    assert "Mamaearth" in leads and "varun@mamaearth.in" in leads

    outreach = conversation_context.summarize(
        {"agent_type": "sales_outreach", "status": "completed", "result": {"kind": "sales_outreach", "summary": "Drafted an intro.", "actions": [
            {"type": "email", "to": ["ravi@beta.io"], "subject": "Hi", "body": "Hello Ravi", "status": "sent"}
        ]}}
    )
    assert "ravi@beta.io" in outreach and "[sent]" in outreach

    failed = conversation_context.summarize({"agent_type": "general", "status": "failed", "error": "boom"})
    assert failed == "(failed: boom)"


def test_load_context_is_scoped_to_the_user_and_finds_latest_leads(monkeypatch):
    seen = {}

    async def select_one(table, params):
        seen["one"] = params
        return {"conversation_id": "c1", "created_at": "2026-10-07T10:00:00Z"}

    async def select(table, params):
        seen["many"] = params
        return [  # newest first, as requested
            {"id": "r2", "agent_type": "general", "prompt": "now email them", "status": "completed", "result": {"kind": "general", "reply": "ok"}},
            {"id": "r1", "agent_type": "lead_research", "prompt": "find leads", "status": "completed", "result": {"leads": [{"company_name": "A"}]}},
        ]

    monkeypatch.setattr(supabase_rest, "select_one", select_one)
    monkeypatch.setattr(supabase_rest, "select", select)
    ctx = asyncio.run(conversation_context.load_context(USER_ID, REQUEST_ID))

    assert seen["one"]["user_id"] == f"eq.{USER_ID}" and seen["many"]["user_id"] == f"eq.{USER_ID}"
    assert seen["many"]["conversation_id"] == "eq.c1"
    assert [t.prompt for t in ctx.turns] == ["find leads", "now email them"]
    assert ctx.latest_lead_request_id == "r1"
    assert ctx.render().startswith("USER: find leads")


def test_outreach_accepts_addresses_from_earlier_in_the_chat():
    class Plan:
        async def complete_json(self, *, system, user, tier, max_tokens):
            return LLMResult(data={"summary": "Follow-up.", "actions": [{"type": "email", "to": ["ravi@beta.io"], "subject": "Following up", "body": "Hi Ravi"}]}, tokens=1)

    class NoGmail:
        async def search_thread_ids(self, query, max_results):
            return []

    class NoCalendar:
        async def events_between(self, a, b):
            return []

    ctx = OutreachContext(
        instruction="send him a follow-up", sender_name="Yash", sender_email="yash@agentis.ai", time_zone="Asia/Kolkata",
        now=NOW, history="USER: email ravi@beta.io an intro\nSALES & OUTREACH: - email to ravi@beta.io [sent]",
    )
    result = asyncio.run(SalesOutreachAgent(llm=Plan(), gmail=NoGmail(), calendar=NoCalendar()).run(ctx))
    assert [a.to for a in result.actions] == [["ravi@beta.io"]]


def test_general_endpoint_requires_sign_in():
    assert TestClient(main.app).post("/general/run", json={"prompt": "hello"}).status_code == 401
