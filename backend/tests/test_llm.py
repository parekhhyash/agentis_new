import asyncio
from types import SimpleNamespace

import pytest

from agents.lead_research.errors import LLMOutputError
from agents.lead_research.llm import LiteLLMClient, ModelSpec
from agents.lead_research.schemas import ICP


def _response(content, finish_reason="stop", tokens=10):
    message = SimpleNamespace(content=content)
    choice = SimpleNamespace(message=message, finish_reason=finish_reason)
    return SimpleNamespace(choices=[choice], usage=SimpleNamespace(total_tokens=tokens))


def _client():
    spec = ModelSpec(model="test/model", api_key="k", extra={})
    return LiteLLMClient(fast=spec, strong=spec, reasoning_allowance=1000)


@pytest.fixture
def fake_litellm(monkeypatch):
    import litellm

    calls = []
    replies = []

    async def acompletion(**kwargs):
        calls.append(kwargs)
        return replies.pop(0)

    monkeypatch.setattr(litellm, "acompletion", acompletion)
    return calls, replies


def test_adds_reasoning_allowance_to_max_tokens(fake_litellm):
    calls, replies = fake_litellm
    replies.append(_response('{"ok": true}'))

    result = asyncio.run(_client().complete_json(system="s", user="u", tier="strong", max_tokens=500))

    assert result.data == {"ok": True}
    assert calls[0]["max_tokens"] == 1500


def test_retries_with_more_room_when_reasoning_used_up_the_limit(fake_litellm):
    calls, replies = fake_litellm
    replies.extend([_response("", finish_reason="length", tokens=1500), _response('{"ok": 1}', tokens=900)])

    result = asyncio.run(_client().complete_json(system="s", user="u", tier="fast", max_tokens=500))

    assert result.data == {"ok": 1}
    assert result.tokens == 2400
    assert [c["max_tokens"] for c in calls] == [1500, 3000]


def test_does_not_retry_complete_but_invalid_reply(fake_litellm):
    calls, replies = fake_litellm
    replies.append(_response("I cannot help with that.", finish_reason="stop"))

    with pytest.raises(LLMOutputError):
        asyncio.run(_client().complete_json(system="s", user="u", tier="fast", max_tokens=500))
    assert len(calls) == 1


def test_icp_tolerates_common_shape_variations():
    icp = ICP.model_validate(
        {
            "num_leads": "5",
            "summary": None,
            "company_size": ["10-50", "50-200"],
            "use_case": ["ops automation"],
            "discovery_queries": [
                "Indian D2C skincare brand",
                {"q": "Indian D2C apparel brand selling online"},
                {"text": "fast growing D2C food brand India", "angle": None},
                {"angle": "growth"},
                42,
            ],
        }
    )

    assert icp.num_leads == 5
    assert icp.summary == ""
    assert icp.company_size == "10-50, 50-200"
    assert [q.query for q in icp.discovery_queries] == [
        "Indian D2C skincare brand",
        "Indian D2C apparel brand selling online",
        "fast growing D2C food brand India",
    ]
    assert icp.discovery_queries[2].angle == "company"


def _settings(**overrides):
    from config.settings import Settings

    return Settings(_env_file=None, **overrides)


def test_openrouter_disables_reasoning_by_default_and_keeps_provider_pin():
    from agents.lead_research.llm import build_llm_client

    client = build_llm_client(_settings(llm_provider="openrouter", openrouter_api_key="k"))
    body = client._specs["strong"].extra["extra_body"]

    assert body["reasoning"] == {"enabled": False}
    assert body["provider"]["order"] == ["streamlake/fp8"]


def test_openrouter_passes_explicit_reasoning_effort():
    from agents.lead_research.llm import build_llm_client

    client = build_llm_client(_settings(llm_provider="openrouter", openrouter_api_key="k", llm_reasoning_effort="low"))

    assert client._specs["fast"].extra["extra_body"]["reasoning"] == {"effort": "low"}


def test_reasoning_effort_can_be_disabled():
    from agents.lead_research.llm import build_llm_client

    client = build_llm_client(_settings(llm_provider="groq", groq_api_key="k", llm_reasoning_effort=""))

    assert "reasoning_effort" not in client._specs["fast"].extra


def test_openrouter_preference_allows_fallback_fp8_providers():
    from agents.lead_research.llm import build_llm_client

    client = build_llm_client(_settings(llm_provider="openrouter", openrouter_api_key="k"))
    provider = client._specs["strong"].extra["extra_body"]["provider"]
    assert provider == {"order": ["streamlake/fp8"], "quantizations": ["fp8"], "allow_fallbacks": True}


def test_missing_route_retries_without_provider_preference(monkeypatch):
    import litellm

    calls = []

    async def acompletion(**kwargs):
        calls.append(kwargs)
        if "provider" in kwargs.get("extra_body", {}):
            raise litellm.NotFoundError(message="No endpoints found", model="m", llm_provider="openrouter")
        return _response('{"ok": true}')

    monkeypatch.setattr(litellm, "acompletion", acompletion)
    spec = ModelSpec(model="openrouter/m", api_key="k", extra={"extra_body": {"provider": {"order": ["x"]}, "reasoning": {"enabled": False}}})
    client = LiteLLMClient(fast=spec, strong=spec, reasoning_allowance=0)

    result = asyncio.run(client.complete_json(system="s", user="u", tier="fast", max_tokens=10))
    assert result.data == {"ok": True}
    assert calls[-1]["extra_body"] == {"reasoning": {"enabled": False}}
    # The preference stays dropped for later calls.
    asyncio.run(client.complete_json(system="s", user="u", tier="fast", max_tokens=10))
    assert len(calls) == 3
