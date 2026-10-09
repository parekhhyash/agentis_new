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

## How the Sales & Outreach Agent works

```
Instruction (+ company profile, optional leads from a Lead Research run)
  -> Planner   1 strong-model call: new emails (written), reply intents
               (Gmail search query + instructions), meetings (local time)
  -> Guard     every recipient must appear in the instruction or the leads;
               the model can't invent or "complete" an address
  -> Replies   Gmail search -> read thread -> recipient and threading headers
               from Gmail itself -> 1 model call per thread for the body
               (thread text is treated as untrusted data)
  -> Meetings  resolve the time in the user's zone, check Calendar for overlaps
  -> Drafts    stored on the agent_requests row
```

Nothing is sent automatically. The dashboard shows each draft as an editable
card; `POST /sales-outreach/requests/{id}/actions/{action_id}` with
`approve` sends the email / creates the Calendar event (with a Google Meet
link), `discard` drops it, `save` keeps edits. Every endpoint here requires the
user's Supabase session (`Authorization: Bearer <access token>`) and only
touches that user's rows.

## How the Data & Reporting Agent works

```
Question (+ attached files, company profile, earlier turns)
  -> Catalogue  built-in tables from agent_requests (leads, emails, meetings,
                agent_runs) + the user's uploads (columns, types, samples)
  -> Planner    1 strong-model call: up to 6 blocks (kpi/line/bar/pie/table),
                each a query in query.py's JSON language
  -> Check      every dataset/column/operator/value checked against the data;
                failing blocks go back to the model once with the reasons
  -> Run        upload rows load only when used; reply status read live from
                Gmail when a query uses it; queries run in plain Python
  -> Summary    written from the results; numbers not in the results trigger
                one rewrite, then a summary read straight off the results
```

`POST /data/datasets` takes `{filename, content_base64}` (CSV or .xlsx, up to
5 MB / 20,000 rows) and stores typed rows in `datasets`
(`supabase/migrations/20261009000000_data_reporting.sql`).

### Connecting Google

`GET /integrations/google/auth-url` returns Google's consent URL; Google
redirects to `/integrations/google/callback`, which stores the refresh token
encrypted (Fernet, `INTEGRATIONS_ENCRYPTION_KEY`) in `google_connections`
(RLS on, no policies: backend only) and sends the browser back to the
dashboard. Scopes: `gmail.send`, `gmail.readonly` (find/read threads to
reply to), `calendar.events`.

One-time setup:

1. Run `supabase/migrations/20261007000000_google_connections.sql` on the
   Supabase project (SQL editor or `supabase db push`).
2. In Google Cloud Console: enable the **Gmail API** and **Google Calendar
   API**; configure the **OAuth consent screen** (External, add the three
   scopes above, add yourself and teammates as **test users**); create an
   **OAuth client ID** of type *Web application* with authorized redirect URI
   `https://<backend>/integrations/google/callback` (and
   `http://localhost:8000/integrations/google/callback` for local dev).
3. Set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
   `GOOGLE_OAUTH_REDIRECT_URI`, `INTEGRATIONS_ENCRYPTION_KEY` and
   `FRONTEND_URL` on the backend.

While the consent screen is in *Testing*, only listed test users can connect
and Google expires their grants after 7 days (the app then asks them to
reconnect). Gmail read access is a restricted scope, so opening it to all
users needs Google's app verification.

## Structure

```
backend/
├── agents/sales_outreach/  # planner + guard + reply drafting, executor, prompts
├── agents/general/         # answers or routes each chat message
├── agents/data_reporting/  # tables.py (uploads), activity.py, query.py, verify.py, agent.py
├── integrations/google/    # OAuth, encrypted connections, Gmail + Calendar clients
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
  `LLM_STRONG_MODEL` to use a cheaper model for screening, and
  `LLM_REASONING_EFFORT` (default `none`) / `LLM_REASONING_TOKEN_ALLOWANCE` for
  models that think before answering.
- budgets via `LEAD_RESEARCH_BUDGET__<FIELD>` (see `.env.example`).

## Run & test

```bash
uvicorn main:app --reload --port 8000
python -m pytest tests
```

`POST /sales-agent/generate-leads` with `{"query": "...", "company_context": {...}}`.
The pipeline stops itself after 12 minutes by default; `AGENT_RUN_TIMEOUT_SECONDS`
(1200s) is only a hard kill switch. A missing/invalid `EXA_API_KEY` returns 503.

## Deploying (Render)

A `render.yaml` Blueprint at the repo root points Render at `backend/`.
Secrets (`EXA_API_KEY`, the LLM key, `SUPABASE_SERVICE_ROLE_KEY`) are set in
the Render dashboard, never in git. `CORS_ORIGINS` must list the deployed
frontend origin; edit it in `render.yaml` rather than the dashboard, since
blueprint syncs overwrite dashboard edits of non-secret vars.
