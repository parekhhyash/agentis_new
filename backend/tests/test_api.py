from fastapi.testclient import TestClient

import main
from config.settings import Settings
from services import agent_runner


def test_missing_exa_key_is_reported_as_503(monkeypatch):
    settings = Settings(_env_file=None, llm_provider="openrouter", openrouter_api_key="x", exa_api_key=None)
    monkeypatch.setattr(agent_runner, "get_settings", lambda: settings)

    response = TestClient(main.app).post(
        "/sales-agent/generate-leads", json={"query": "Find 5 fintech companies in India to sell to"}
    )

    assert response.status_code == 503
    assert "EXA_API_KEY" in response.json()["detail"]


def test_cancel_endpoint_accepts_request():
    response = TestClient(main.app).post("/sales-agent/cancel", json={"request_id": "abc"})
    assert response.status_code == 202 and response.json() == {"cancelled": True}
