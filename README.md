# Agentis

**AI-powered sales automation platform** — autonomous agents that research leads, draft emails, schedule meetings, and manage outreach, all from a single conversational dashboard.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [AI Agent Architecture](#ai-agent-architecture)
- [Core Workflow](#core-workflow)
- [Installation & Setup](#installation--setup)
- [Environment Variables](#environment-variables)
- [Running the Project](#running-the-project)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Deployment](#deployment)
- [Testing](#testing)
- [Future Enhancements](#future-enhancements)
- [Contributors](#contributors)

---

## Project Overview

Agentis is a full-stack AI sales automation platform that combines autonomous AI agents with a chat-style dashboard interface. Users describe what they need in natural language — *"find 10 SaaS startups in India that need customer support automation"* — and the platform's agents handle the rest: discovering companies, qualifying them against the user's Ideal Customer Profile (ICP), finding decision-maker contacts, drafting personalized outreach emails, scheduling meetings via Google Calendar, and threading replies through Gmail.

The system is built as a **React + TypeScript** frontend (Vite) paired with a **Python FastAPI** backend. Supabase provides authentication, database storage, and Row Level Security. LLM processing is provider-agnostic through [litellm](https://github.com/BerriAI/litellm), supporting **Google Gemini**, **Groq**, and **OpenRouter** out of the box.

---

## Key Features

- **Lead Research Agent** — Discovers, filters, deeply researches, and qualifies companies as potential sales leads using Exa search and LLM analysis
- **Sales & Outreach Agent** — Drafts personalized emails, thread-aware replies, and calendar invitations using the user's connected Gmail and Google Calendar
- **General Agent** — The default chat agent: answers questions with company and conversation context, or hands the task to the right specialist
- **Data & Reporting Agent** — Answers questions about numbers with headline figures, charts and tables, from the user's Agentis activity (leads, emails, replies, meetings) and CSV/Excel files they upload. The model plans queries; the backend runs every calculation, and the written summary may only quote numbers that the queries produced
- **Conversational Dashboard** — Chat-style UI where each agent request appears as a conversation with real-time progress updates
- **Google Integration** — Secure OAuth 2.0 flow to connect Gmail (send, read, reply) and Google Calendar (create events with Meet links)
- **Human-in-the-Loop** — All outreach drafts require explicit user approval before sending; users can edit, approve, discard, or save each action
- **ICP-Driven Qualification** — The Lead Research agent builds an Ideal Customer Profile from the user's request and company context, then qualifies every lead against it
- **Evidence-Based Results** — Every lead includes verified evidence with source URLs; claims citing unfetched sources are automatically dropped
- **Contact Discovery** — Finds decision-maker contacts via Exa people search with LinkedIn profiles and verified email addresses (never guessed)
- **CSV Export** — Download qualified leads with full contact details as a CSV file
- **Multi-Provider LLM** — Swap between Gemini, Groq, and OpenRouter with a single environment variable; supports per-stage model overrides (fast screening vs. strong analysis)
- **Real-Time Progress** — Live step-by-step agent progress pushed to Supabase and polled by the frontend
- **Run Cancellation** — Stop a running agent at its next checkpoint to save LLM tokens
- **Dark Mode** — System-aware or manual toggle, applied before first paint to prevent flash
- **Responsive Design** — Mobile-friendly sidebar with touch-accessible navigation
- **Supabase Auth** — Email/password authentication with protected routes and session management

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Vite + React)                  │
│  Landing Page ─── Auth (Login/Signup) ─── Company Setup         │
│                          │                                      │
│                    Dashboard Page                               │
│        ┌─────────────────┼─────────────────┐                    │
│   Request Sidebar   Chat Conversation   Task Composer           │
│                     Agent Progress      Outreach Setup          │
│                     Lead Results        Outreach Results        │
│                     Connections Panel                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP + Supabase Auth Token
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Backend (FastAPI + Python)                    │
│                                                                 │
│  /sales-agent/*          /sales-outreach/*    /integrations/*   │
│       │                        │                    │           │
│  Lead Research Agent    Sales Outreach Agent   Google OAuth     │
│  (Exa + LLM Pipeline)  (Gmail + Calendar)     (Connection Mgr)  │
│       │                        │                    │           │
│       ▼                        ▼                    ▼           │
│  ┌─────────┐  ┌──────────────────┐  ┌────────────────────┐      │
│  │ litellm │  │ Google APIs      │  │ Supabase (svc key) │      │
│  │ (LLM)   │  │ (Gmail/Calendar) │  │ (progress, state)  │      │
│  └─────────┘  └──────────────────┘  └────────────────────┘      │
│       │                                                         │
│  ┌─────────┐                                                    │
│  │  Exa    │                                                    │
│  │ (Search)│                                                    │
│  └─────────┘                                                    │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Supabase                                   │
│  Auth ── profiles ── agent_requests ── google_connections       │
│  (RLS policies enforce per-user data isolation)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| **React 19** | UI framework |
| **TypeScript 6** | Type-safe development |
| **Vite 8** | Build tool and dev server |
| **Tailwind CSS 4** | Utility-first styling |
| **React Router 7** | Client-side routing (HashRouter) |
| **Supabase JS** | Auth, database queries, real-time subscriptions |
| **Instrument Sans** | Custom Google Font |

### Backend

| Technology | Purpose |
|---|---|
| **Python 3.11+** | Runtime |
| **FastAPI** | API framework with async support |
| **litellm** | Multi-provider LLM abstraction (Gemini, Groq, OpenRouter) |
| **Pydantic v2** | Request/response validation and settings management |
| **httpx** | Async HTTP client for external APIs |
| **trafilatura** | Web page content extraction |
| **BeautifulSoup4** | HTML parsing for contact extraction |
| **cryptography** | Fernet encryption for stored OAuth refresh tokens |
| **Uvicorn** | ASGI server |

### Infrastructure

| Technology | Purpose |
|---|---|
| **Supabase** | PostgreSQL database, authentication, Row Level Security |
| **Exa** | AI-native search API for company and people discovery |
| **Google APIs** | Gmail (send/read) and Calendar (events + Meet) |
| **Vercel** | Frontend deployment (SPA rewrites) |
| **Render** | Backend deployment (Python web service) |

---

## Project Structure

```
agentis_new/
├── index.html                    # App entry point (dark mode script, fonts)
├── package.json                  # Frontend dependencies and scripts
├── vite.config.ts                # Vite configuration
├── vercel.json                   # Vercel SPA rewrite rules
├── render.yaml                   # Render Blueprint (backend deployment)
├── .env.example                  # Frontend environment template
│
├── src/                          # Frontend source (React + TypeScript)
│   ├── App.tsx                   # Root component with routing
│   ├── main.tsx                  # React DOM entry
│   ├── index.css                 # Global styles (Tailwind + custom)
│   ├── pages/
│   │   ├── LandingPage.tsx       # Public landing with Hero prompt
│   │   ├── LoginPage.tsx         # Email/password sign in
│   │   ├── SignupPage.tsx        # Registration with email confirmation
│   │   ├── CompanySetupPage.tsx  # Onboarding: company profile form
│   │   ├── CompanySettingsPage.tsx# Edit company profile
│   │   └── DashboardPage.tsx     # Main app: sidebar + chat + composer
│   ├── components/
│   │   ├── Hero.tsx              # Landing hero with prompt box
│   │   ├── Features.tsx          # Feature showcase
│   │   ├── HowItWorks.tsx        # Workflow explanation
│   │   ├── ProtectedRoute.tsx    # Auth guard wrapper
│   │   ├── ThemeToggle.tsx       # Dark/light mode switch
│   │   ├── icons.tsx             # SVG icon components
│   │   └── dashboard/
│   │       ├── TaskComposer.tsx          # Agent selector + prompt input
│   │       ├── ChatConversation.tsx      # Request display as conversation
│   │       ├── RequestSidebar.tsx        # History sidebar
│   │       ├── LeadResultsPanel.tsx      # Lead research results table
│   │       ├── OutreachResultsPanel.tsx  # Email/meeting draft cards
│   │       ├── OutreachSetupBar.tsx      # Google connection + lead picker
│   │       ├── AgentProgressView.tsx     # Live progress steps
│   │       ├── ConnectionsPanel.tsx      # Google account management
│   │       └── ProfileMenu.tsx           # User profile dropdown
│   └── lib/
│       ├── supabase.ts           # Supabase client initialization
│       ├── AuthContext.tsx        # Auth provider (session, signIn/Up/Out)
│       ├── agentRuns.ts          # Agent run orchestration (create, start, stop)
│       ├── agentTypes.ts         # Agent type definitions and metadata
│       ├── salesAgentApi.ts      # Lead research API client
│       ├── salesAgentTypes.ts    # Lead research result types
│       ├── outreachApi.ts        # Sales outreach API client
│       ├── outreachTypes.ts      # Outreach action types (email, reply, meeting)
│       ├── backendApi.ts         # Authenticated fetch wrapper
│       ├── googleConnection.ts   # Google connection hook
│       ├── leadExport.ts         # CSV export utility
│       ├── database.types.ts     # Auto-generated Supabase types
│       ├── useProfile.ts         # Profile data hook
│       └── theme.ts              # Theme persistence utilities
│
├── backend/                      # Backend (Python + FastAPI)
│   ├── main.py                   # FastAPI app, CORS, router mounts
│   ├── requirements.txt          # Python dependencies
│   ├── .env.example              # Backend environment template
│   ├── config/
│   │   └── settings.py           # Pydantic Settings (env-driven config)
│   ├── api/
│   │   ├── routes.py             # /sales-agent/* endpoints
│   │   ├── outreach.py           # /sales-outreach/* endpoints
│   │   ├── integrations.py       # /integrations/google/* endpoints
│   │   └── models.py             # Pydantic request/response models
│   ├── agents/
│   │   ├── lead_research/
│   │   │   ├── agent.py          # LeadResearchAgent orchestrator
│   │   │   ├── icp.py            # ICP analysis and query generation
│   │   │   ├── discovery.py      # Company discovery via Exa search
│   │   │   ├── candidate_filter.py # Batch LLM screening
│   │   │   ├── researcher.py     # Deep company research + qualification
│   │   │   ├── contacts.py       # Contact discovery (Exa people search)
│   │   │   ├── site_contacts.py  # On-site email extraction
│   │   │   ├── scraper.py        # Web page fetching (robots.txt aware)
│   │   │   ├── llm.py            # LLM client abstraction (litellm)
│   │   │   ├── exa.py            # Exa search provider implementation
│   │   │   ├── prompts.py        # All LLM prompts
│   │   │   ├── schemas.py        # Output schemas (ICP, leads, evidence)
│   │   │   ├── budget.py         # Research budget limits (scalable)
│   │   │   ├── state.py          # Research state management
│   │   │   └── ...               # Domains, cache, formatter, tracking
│   │   └── sales_outreach/
│   │       ├── agent.py          # SalesOutreachAgent (planner + drafts)
│   │       ├── executor.py       # Execute approved actions (send/schedule)
│   │       ├── prompts.py        # Planner and reply prompts
│   │       └── schemas.py        # Action models (email, reply, meeting)
│   ├── integrations/google/
│   │   ├── oauth.py              # OAuth 2.0 flow + token management
│   │   ├── connections.py        # Encrypted connection storage
│   │   ├── gmail.py              # Gmail API client (search, read, send)
│   │   ├── calendar.py           # Calendar API client (events, conflicts)
│   │   └── errors.py             # Integration error hierarchy
│   ├── services/
│   │   ├── agent_runner.py       # Lead research run lifecycle
│   │   ├── outreach_runner.py    # Outreach run lifecycle + action decisions
│   │   ├── auth.py               # Supabase session verification
│   │   ├── progress_reporter.py  # Live progress to Supabase
│   │   ├── request_store.py      # Final status persistence
│   │   ├── cancellation.py       # Run cancellation registry
│   │   ├── supabase_rest.py      # Supabase PostgREST client (service key)
│   │   └── exceptions.py         # Service-layer error types
│   └── tests/                    # Offline test suite (no API keys needed)
│       ├── test_pipeline.py      # Full pipeline tests
│       ├── test_outreach.py      # Outreach agent tests
│       ├── test_llm.py           # LLM client tests
│       ├── test_exa.py           # Exa search tests
│       ├── test_contacts.py      # Contact research tests
│       └── ...
│
└── supabase/
    └── migrations/
        └── 20261007000000_google_connections.sql  # Google connections table
```

---

## AI Agent Architecture

### Lead Research Agent

The Lead Research Agent follows a structured pipeline where the **application drives every step** — the LLM only decides *what* is needed (queries, fit, missing info) and never makes network calls itself.

```
Natural-language request + Company context
  │
  ▼
┌──────────────────────────────────────────────────────────────────┐
│ 1. ICP Analysis        1 strong-model call                       │
│    → ICP summary, 4-10 discovery queries, target roles,          │
│      fallback queries, requested lead count                      │
├──────────────────────────────────────────────────────────────────┤
│ 2. Company Discovery   Exa company search per query              │
│    → Highlights only (no scraping), deduplication by domain      │
│      and normalized name; seller's own company excluded          │
├──────────────────────────────────────────────────────────────────┤
│ 3. Candidate Filter    Cheap/fast model, batches of 20           │
│    → Snippet-level screening against ICP criteria                │
├──────────────────────────────────────────────────────────────────┤
│ 4. Deep Research       Homepage first; extra pages only if       │
│    → needed. Evidence validation, ICP qualification,             │
│      concurrent research with wave-based processing              │
├──────────────────────────────────────────────────────────────────┤
│ 5. Contact Research    Exa people search + on-site extraction    │
│    → LinkedIn profiles, verified emails (never guessed),         │
│      filtered to relevant current roles at the company           │
├──────────────────────────────────────────────────────────────────┤
│ 6. Result Formatting   Structured output with evidence + usage   │
│    → Final qualified leads ranked by fit and confidence           │
└──────────────────────────────────────────────────────────────────┘
```

**Stop conditions** — The pipeline stops when:
- Enough qualified leads are found
- The time budget runs out (default 12 minutes, scalable)
- The qualification rate falls below 15% after 8+ researched companies
- The entire shortlist has been exhausted

**Budget system** — Research budgets scale with the number of requested leads, controlling: discovery queries, unique candidates, deep research concurrency, pages per company, contacts per company, and total runtime.

### Sales & Outreach Agent

```
Instruction + Company context + Optional leads from Lead Research
  │
  ▼
┌──────────────────────────────────────────────────────────────────┐
│ 1. Planner             1 strong-model call                       │
│    → New emails (fully written), reply intents (Gmail search     │
│      query + instructions), meeting intents (with times)         │
├──────────────────────────────────────────────────────────────────┤
│ 2. Recipient Guard     Every recipient must appear in the        │
│    → instruction text or the leads list; the model cannot        │
│      invent or "complete" an email address                       │
├──────────────────────────────────────────────────────────────────┤
│ 3. Reply Drafting      Gmail search → read thread → extract      │
│    → recipient from actual headers → 1 model call per thread     │
│      for the reply body (thread text treated as untrusted)       │
├──────────────────────────────────────────────────────────────────┤
│ 4. Meeting Resolution  Resolve times in user's timezone,         │
│    → check Calendar for conflicts, validate future dates         │
├──────────────────────────────────────────────────────────────────┤
│ 5. Draft Storage       All actions stored as drafts on the       │
│    → agent_requests row — nothing is sent automatically          │
└──────────────────────────────────────────────────────────────────┘
```

**Human-in-the-loop** — The user reviews every draft in the dashboard:
- **Approve** → Sends the email via Gmail or creates the Calendar event (with optional Google Meet link)
- **Discard** → Drops the draft
- **Save** → Keeps edits without sending

### Data & Reporting Agent

```
Question + attached files + company context + earlier turns of the chat
  │
  ▼
┌──────────────────────────────────────────────────────────────────┐
│ 1. Catalogue           Built-in tables from agent_requests       │
│    (leads, emails, meetings, agent_runs) + the user's uploads    │
│    with column names, types and sample values                    │
├──────────────────────────────────────────────────────────────────┤
│ 2. Planner             1 strong-model call: up to 6 blocks       │
│    (kpi, line, bar, pie, table), each a query in a small JSON    │
│    language (filters, group_by + time bucket, metrics, sort)     │
├──────────────────────────────────────────────────────────────────┤
│ 3. Check + repair      Every dataset, column, operator and value │
│    is checked against the real schema; failing blocks go back to │
│    the model once with the reasons, the rest are left out        │
├──────────────────────────────────────────────────────────────────┤
│ 4. Load + run          Upload rows load only if used; reply      │
│    status is checked live in Gmail when a query needs it;        │
│    queries run in plain Python (no eval, no SQL)                 │
├──────────────────────────────────────────────────────────────────┤
│ 5. Summary + verify    The model writes the summary from the     │
│    results; any number not in the results triggers one rewrite,  │
│    then a plain summary read straight off the results            │
└──────────────────────────────────────────────────────────────────┘
```

**Uploads** — CSV or Excel (`.xlsx`) up to 5 MB / 20,000 rows. The backend skips title rows, drops empty columns, and types each column as number (₹/$, lakh commas and `(1,000)` negatives understood), date (day-first when ambiguous), yes/no or text, so queries never parse raw strings.

---

## Core Workflow

1. **Sign Up / Sign In** — Create an account with email + password (Supabase Auth)
2. **Company Setup** — Enter company name, website, industry, description, and target audience location during onboarding
3. **Pick an Agent** — Ask General (the default), or pick Lead Research, Sales & Outreach or Data & Reporting in the task composer; attach a CSV or Excel file with the paperclip to ask about your own numbers
4. **Describe the Task** — Enter a natural-language request (e.g., *"Find 10 fintech startups in Southeast Asia"*)
5. **Watch Progress** — The agent runs and pushes live step-by-step progress visible in the chat view
6. **Review Results** — Lead Research shows a table of qualified companies with contacts and evidence; Sales & Outreach shows editable email/meeting draft cards; Data & Reporting shows a summary with number tiles, charts and tables (each with its calculation, a table view and CSV download)
7. **Take Action** — Export leads as CSV, or approve/edit/discard outreach drafts
8. **Iterate** — Start new chats, link lead research results to outreach runs, review history in the sidebar

---

## Installation & Setup

### Prerequisites

- **Node.js** 18+ and **npm**
- **Python** 3.11+
- A **Supabase** project ([supabase.com](https://supabase.com))
- An **Exa** API key ([dashboard.exa.ai](https://dashboard.exa.ai/api-keys))
- At least one LLM API key: **Google AI** ([aistudio.google.com](https://aistudio.google.com/apikey)), **Groq** ([console.groq.com](https://console.groq.com/keys)), or **OpenRouter** ([openrouter.ai](https://openrouter.ai/keys))

### 1. Clone the Repository

```bash
git clone https://github.com/parekhhyash/agentis_new.git
cd agentis_new
```

### 2. Frontend Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your Supabase project details:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SALES_AGENT_API_URL=http://localhost:8000
```

### 3. Backend Setup

```bash
cd backend
python -m venv .venv

# macOS/Linux:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
```

Edit `backend/.env` with your keys (see [Environment Variables](#environment-variables) below).

### 4. Supabase Setup

Your Supabase project needs the following tables (set up via the Supabase dashboard or migrations):

- **`profiles`** — User profiles with company info (created by Auth trigger)
- **`agent_requests`** — Agent run history (prompt, status, result, progress)
- **`google_connections`** — Encrypted Google OAuth tokens

Run the Google connections migration:

```sql
-- In the Supabase SQL Editor or via `supabase db push`
-- File: supabase/migrations/20261007000000_google_connections.sql
```

### 5. Google OAuth Setup (Optional — required for Sales & Outreach)

1. In [Google Cloud Console](https://console.cloud.google.com):
   - Enable **Gmail API** and **Google Calendar API**
   - Configure **OAuth consent screen** (External type)
   - Add scopes: `gmail.send`, `gmail.readonly`, `calendar.events`
   - Add yourself as a **test user**
2. Create an **OAuth client ID** (Web application) with redirect URI:
   - Local: `http://localhost:8000/integrations/google/callback`
   - Production: `https://<your-backend>/integrations/google/callback`
3. Generate an encryption key:
   ```bash
   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
4. Set the relevant environment variables in `backend/.env`

---

## Environment Variables

### Frontend (`.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase anon/public key |
| `VITE_SALES_AGENT_API_URL` | ❌ | Backend API URL (default: `http://localhost:8000`) |

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `LLM_PROVIDER` | ✅ | `gemini`, `groq`, or `openrouter` |
| `GOOGLE_API_KEY` | If gemini | Google AI API key |
| `GROQ_API_KEY` | If groq | Groq API key |
| `OPENROUTER_API_KEY` | If openrouter | OpenRouter API key |
| `EXA_API_KEY` | ✅ | Exa search API key |
| `SUPABASE_URL` | ❌ | Enables live progress reporting |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Service role key (never exposed to browser) |
| `CORS_ORIGINS` | ❌ | Allowed frontend origins (default: `http://localhost:5173`) |
| `GEMINI_MODEL` | ❌ | Gemini model name (default: `gemini-flash-latest`) |
| `LLM_FAST_MODEL` | ❌ | Cheaper model for batch screening |
| `LLM_STRONG_MODEL` | ❌ | Stronger model for ICP analysis |
| `LLM_REASONING_EFFORT` | ❌ | `none`/`low`/`medium`/`high` (default: `none`) |
| `SCRAPER_RESPECT_ROBOTS` | ❌ | Respect robots.txt (default: `true`) |
| `GOOGLE_OAUTH_CLIENT_ID` | For outreach | OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | For outreach | OAuth client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | For outreach | OAuth callback URL |
| `INTEGRATIONS_ENCRYPTION_KEY` | For outreach | Fernet key for token encryption |
| `FRONTEND_URL` | For outreach | Where OAuth callback redirects (default: `http://localhost:5173`) |

---

## Running the Project

### Development

Start the backend and frontend in separate terminals:

```bash
# Terminal 1 — Backend
cd backend
source .venv/bin/activate         # Windows: .venv\Scripts\activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
npm run dev
```

The frontend runs at `http://localhost:5173` and the backend at `http://localhost:8000`.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run OxLint on frontend code |

---

## API Reference

### Lead Research

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/sales-agent/generate-leads` | ❌ | Run lead research with a natural-language query |
| `POST` | `/sales-agent/cancel` | ❌ | Cancel a running lead research request |
| `GET` | `/health` | ❌ | Health check |

**Request body** (`generate-leads`):
```json
{
  "query": "Find 10 startups in India that need sales automation",
  "request_id": "optional-uuid",
  "company_context": {
    "company_name": "Acme Corp",
    "company_website": "https://acme.com",
    "industry": "SaaS",
    "target_audience_location": "India",
    "company_description": "AI-powered sales tools"
  }
}
```

### Sales & Outreach

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/sales-outreach/run` | ✅ Bearer | Draft outreach actions from an instruction |
| `POST` | `/sales-outreach/requests/{id}/actions/{action_id}` | ✅ Bearer | Approve, discard, or save a drafted action |
| `POST` | `/sales-outreach/cancel` | ✅ Bearer | Cancel a running outreach request |

### General and Data & Reporting

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/general/run` | ✅ Bearer | Answer a message or route it to a specialist agent |
| `POST` | `/data/run` | ✅ Bearer | Build a report (numbers, charts, tables) for a question |
| `POST` | `/data/datasets` | ✅ Bearer | Upload a CSV/Excel file (base64) to be parsed and stored |

### Google Integration

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/integrations/google/status` | ✅ Bearer | Check Google connection status |
| `GET` | `/integrations/google/auth-url` | ✅ Bearer | Get Google OAuth consent URL |
| `GET` | `/integrations/google/callback` | ❌ | OAuth callback (internal) |
| `DELETE` | `/integrations/google` | ✅ Bearer | Disconnect Google account |

---

## Database Schema

### `profiles`

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | References `auth.users` |
| `full_name` | `text` | User's display name |
| `company_name` | `text` | Company name |
| `company_website` | `text` | Company URL |
| `industry` | `text` | Industry sector |
| `company_description` | `text` | Business description |
| `target_audience_location` | `text` | Target market geography |
| `onboarding_completed` | `boolean` | Whether setup is done |

### `agent_requests`

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Request identifier |
| `user_id` | `uuid` (FK) | Owning user |
| `agent_type` | `enum` | `general`, `lead_research`, `sales_outreach`, `data_reporting`, etc. |
| `conversation_id` | `uuid` (FK) | The chat this turn belongs to |
| `attachments` | `jsonb` | Files attached to the message: `[{type: "dataset", id, name}]` |
| `prompt` | `text` | User's natural-language request |
| `status` | `enum` | `queued` → `in_progress` → `completed` / `failed` |
| `result` | `jsonb` | Agent output (leads or outreach drafts) |
| `progress` | `jsonb` | Live progress steps from the backend |
| `error` | `text` | Error message if failed |
| `started_at` | `timestamptz` | When execution began |
| `created_at` | `timestamptz` | When the request was created |

### `google_connections`

| Column | Type | Description |
|---|---|---|
| `user_id` | `uuid` (PK) | References `auth.users` |
| `google_email` | `text` | Connected Google email |
| `scopes` | `text[]` | Granted OAuth scopes |
| `refresh_token_encrypted` | `text` | Fernet-encrypted refresh token |
| `connected_at` | `timestamptz` | Initial connection time |
| `updated_at` | `timestamptz` | Last token update |

> RLS is enabled on `google_connections` with **no policies** — only the backend (service role key) can access it. The encrypted refresh token never reaches the browser.

### `datasets`

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK) | Dataset identifier |
| `user_id` | `uuid` (FK) | Owning user |
| `name` / `filename` | `text` | Display name and original file name |
| `columns` | `jsonb` | `[{name, type, samples, min, max, unit}]` |
| `rows` | `jsonb` | Typed rows (numbers, ISO dates, booleans, null for blanks) |
| `row_count` / `size_bytes` | `integer` | Size of the upload |
| `created_at` | `timestamptz` | Upload time |

> Users can read and delete their own datasets (RLS); uploads are parsed and inserted by the backend.

---

## Deployment

### Frontend — Vercel

The `vercel.json` at the project root configures SPA routing:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Set the `VITE_*` environment variables in the Vercel dashboard.

### Backend — Render

The `render.yaml` Blueprint defines a Python web service:

- **Root directory**: `backend/`
- **Build**: `pip install -r requirements.txt`
- **Start**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Health check**: `/health`

Secrets (`EXA_API_KEY`, LLM key, `SUPABASE_SERVICE_ROLE_KEY`, Google OAuth credentials) are set in the Render dashboard. Non-secret environment variables like `CORS_ORIGINS` should be edited in `render.yaml` since blueprint syncs overwrite dashboard edits.

---

## Testing

The backend includes an offline test suite that runs without API keys or network access:

```bash
cd backend
source .venv/bin/activate
python -m pytest tests
```

Test coverage includes:
- Full lead research pipeline (`test_pipeline.py`)
- Sales outreach agent and executor (`test_outreach.py`)
- Reply checking (`test_replies.py`)
- General agent and conversation context (`test_general.py`)
- Data & Reporting: file parsing, query checks and execution, summary number checks, live reply status (`test_data_reporting.py`)
- LLM client behavior (`test_llm.py`)
- Exa search provider (`test_exa.py`)
- Contact research (`test_contacts.py`)
- Web scraper (`test_scraper.py`)
- Domain extraction and budget scaling (`test_domains_and_budget.py`)
- API routes (`test_api.py`)

---

## Future Enhancements

The codebase defines several agent types that are registered in the UI but do not yet have backend implementations:

| Agent | Status | Description |
|---|---|---|
| **Lead Research** | ✅ Implemented | Find and qualify companies as leads |
| **Sales & Outreach** | ✅ Implemented | Draft and send emails, schedule meetings |
| **General** | ✅ Implemented | Answers questions and routes tasks to specialist agents |
| **Data & Reporting** | ✅ Implemented | Reports with charts from Agentis activity and uploaded files |
| **Content & Copy** | 🔜 Planned | Blog posts, ad copy, social captions |
| **Customer Support** | 🔜 Planned | Ticket resolution and routing |
| **Operations** | 🔜 Planned | Back-office automation |

---

## Contributors

| Name | GitHub | Role |
|---|---|---|
| Hyash Parekh | [@parekhhyash](https://github.com/parekhhyash) | Author / Maintainer |
| Darsh Sharma | [@darshsharma11](https://github.com/darshsharma11) | Contributor |
| Meet Shah | [@ItsMeet18](https://github.com/ItsMeet18) | Contributor |

---

## License

This project is currently not licensed. Please contact the repository owner for usage terms.
