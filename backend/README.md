# Agentis Agent API

Backend for Agentis's AI agents, starting with the **Sales / Lead Research
Agent**. Built with [Google ADK](https://google.github.io/adk-docs/) for
agent orchestration and FastAPI for the HTTP layer.

## Structure

```
backend/
├── agents/
│   └── sales_agent/
│       ├── agent.py       # the two-stage ADK pipeline (research -> structure)
│       ├── prompts.py     # system instructions for both stages
│       ├── schemas.py     # Pydantic output schema (Lead, LeadGenerationResult)
│       └── tools/
│           ├── search.py      # web search tool (ddgs, no API key needed)
│           └── web_reader.py  # webpage fetch + extraction tool
├── api/
│   ├── models.py   # request schema
│   └── routes.py   # POST /sales-agent/generate-leads
├── config/
│   └── settings.py # all env-driven config, incl. LLM provider selection
├── services/
│   ├── agent_runner.py # runs the ADK pipeline, validates final output
│   └── exceptions.py
└── main.py          # FastAPI app
```

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set an API key for whichever provider you're using:

- **Gemini** (default): `GOOGLE_API_KEY` from https://aistudio.google.com/apikey
- **Groq**: set `LLM_PROVIDER=groq` and `GROQ_API_KEY` from https://console.groq.com/keys

## Run

```bash
uvicorn main:app --reload --port 8000
```

Then either:

- Open http://localhost:8000/docs for the interactive Swagger UI, or
- `curl -X POST http://localhost:8000/sales-agent/generate-leads -H "Content-Type: application/json" -d '{"query": "Find 5 potential customers for my AI automation product. Focus on startups in India that are likely to need customer-support or sales automation."}'`

A real run takes a while (multiple search + fetch tool calls plus two LLM
turns) - the default timeout is 240s before the API returns a 504.

## Adding another agent later

Each agent lives in its own `agents/<name>_agent/` folder with the same
shape (agent.py/prompts.py/schemas.py/tools/). Add a new router in `api/`
and include it in `main.py` the same way `sales_agent_router` is included.
Nothing in `config/` or `services/agent_runner.py`'s pattern is
sales-agent-specific.
