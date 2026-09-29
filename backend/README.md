# Agentis Agent API

Backend for Agentis's AI agents, starting with the **Lead Research Agent**:
given a lead request and the requesting company's profile, it discovers,
filters, researches and returns a short list of evidence-backed potential
clients with relevant contacts. FastAPI for the HTTP layer, Exa for
discovery, litellm for the LLM provider.

## How the Lead Research Agent works

```
Request + company profile
  -> ICPAnalyzer      1 strong-model call: ICP, 4-10 discovery queries, target roles
  -> CompanyDiscovery Exa company search per query (highlights only, no scraping)
  -> Deduplicator     by root domain / normalized name; drops directories & the seller
  -> CandidateFilter  cheap model, batches of 20, snippet-level screening
  -> DeepResearcher   homepage first; extra pages/news only if the model can't decide
  -> ContactResearch  Exa people search; kept only if the source ties the person to
                      the company in a relevant current role; emails never guessed
  -> ResultFormatter  structured leads + evidence + usage
```

The application does all network I/O (Exa, scraping, retries, timeouts,
robots.txt, rate limits, caching, budgets). The LLM only decides *what* is
needed and qualifies from numbered sources; any claim citing a source the
pipeline didn't actually fetch is dropped in code.

Runs stop when the requested number of qualified leads is reached, the time
budget runs out, the hit rate shows the remaining candidates won't qualify,
or the shortlist is exhausted. Budgets scale down with the number of leads
requested.

## Structure

```
backend/
├── agents/lead_research/
│   ├── agent.py            # orchestrator: stages, stop conditions, progress
│   ├── budget.py           # ResearchBudget (hard limits, scaled per request)
│   ├── state.py            # ResearchState (research memory + usage)
│   ├── icp.py              # ICPAnalyzer + QueryGenerator
│   ├── discovery.py        # CompanyDiscovery + CandidateDeduplicator
│   ├── candidate_filter.py # batched cheap-model screening
│   ├── url_selector.py     # picks on-site pages to fetch
│   ├── researcher.py       # DeepResearcher + evidence validation/qualification
│   ├── contacts.py         # ContactResearcher
│   ├── formatter.py        # ResultFormatter
│   ├── prompts.py          # every LLM prompt
│   ├── schemas.py          # ICP + final output models
│   ├── search_provider.py  # SearchProvider interface
│   ├── exa.py              # Exa implementation
│   ├── scraper.py          # WebScraper + ContentFetcher (Exa contents fallback)
│   ├── llm.py              # LLMClient interface + litellm implementation
│   ├── tracking.py         # usage accounting + search cache
│   └── cache.py / domains.py / errors.py
├── api/            # request models + routes
├── config/         # env-driven settings
├── services/       # agent runner, progress reporting, cancellation, persistence
└── tests/          # offline test suite (no network, no API keys)
```

Swapping providers: implement `SearchProvider` (search + get_contents) or
`LLMClient` (complete_json) and pass it to `LeadResearchAgent`.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
```

Set in `.env`:

- `EXA_API_KEY` (required) from https://dashboard.exa.ai/api-keys
- an LLM key matching `LLM_PROVIDER`: `GOOGLE_API_KEY` (gemini), `GROQ_API_KEY`
  (groq) or `OPENROUTER_API_KEY` (openrouter). Optionally `LLM_FAST_MODEL` /
  `LLM_STRONG_MODEL` to use a cheaper model for screening.
- budgets via `LEAD_RESEARCH_BUDGET__<FIELD>` (see `.env.example`).

## Run & test

```bash
uvicorn main:app --reload --port 8000
python -m pytest tests
```

`POST /sales-agent/generate-leads` with `{"query": "...", "company_context": {...}}`.
The pipeline stops itself after 5 minutes by default; `AGENT_RUN_TIMEOUT_SECONDS`
(900s) is only a hard kill switch. A missing/invalid `EXA_API_KEY` returns 503.

## Deploying (Render)

A `render.yaml` Blueprint at the repo root points Render at `backend/`.
Secrets (`EXA_API_KEY`, the LLM key, `SUPABASE_SERVICE_ROLE_KEY`) are set in
the Render dashboard, never in git. `CORS_ORIGINS` must list the deployed
frontend origin; edit it in `render.yaml` rather than the dashboard, since
blueprint syncs overwrite dashboard edits of non-secret vars.
