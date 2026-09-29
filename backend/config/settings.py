from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from agents.lead_research.budget import ResearchBudget


class Settings(BaseSettings):
    """Central config. All values are read from the environment (or a local
    .env file) so nothing about which LLM/provider is used is hardcoded in
    the agent code itself.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", env_nested_delimiter="__")

    # --- LLM provider -------------------------------------------------
    # Which provider the agents use. Swapping this (plus the matching API
    # key) is the only thing needed to move between providers - no agent
    # code changes required.
    llm_provider: Literal["gemini", "groq", "openrouter"] = "gemini"

    google_api_key: str | None = None
    gemini_model: str = "gemini-flash-latest"

    groq_api_key: str | None = None
    groq_model: str = "groq/openai/gpt-oss-120b"

    openrouter_api_key: str | None = None
    openrouter_model: str = "openrouter/deepseek/deepseek-v4-flash-0731"
    # Pins OPENROUTER_MODEL to these providers (comma-separated); empty = normal routing.
    openrouter_provider_order: str = "open-inference"

    # Optional per-tier overrides (litellm model strings for the same provider).
    # "fast" screens candidates in bulk; "strong" does ICP analysis and
    # per-company qualification. Both default to the provider's model above.
    llm_fast_model: str | None = None
    llm_strong_model: str | None = None
    llm_timeout_seconds: float = 60.0

    # --- Lead research ------------------------------------------------
    exa_api_key: str | None = None
    scraper_respect_robots: bool = True
    # Every field is overridable, e.g. LEAD_RESEARCH_BUDGET__MAX_TOTAL_RUNTIME_MINUTES=4
    lead_research_budget: ResearchBudget = Field(default_factory=ResearchBudget)

    # Hard kill switch around a whole run. The pipeline stops itself at
    # lead_research_budget.max_total_runtime_minutes (5 min default); this
    # only fires if something hangs past that. Keep src/lib/salesAgentApi.ts's
    # client-side timeout above this value.
    agent_run_timeout_seconds: float = 900.0

    # --- Live progress reporting -----------------------------------------
    # Optional: lets the agent push step-by-step progress (current tool
    # call, stage transitions) back to the same Supabase row the frontend
    # already polls, so a long run isn't a silent black box. Uses the
    # service role key (bypasses RLS) since this runs with no user session -
    # never expose this key to the frontend. If unset, progress reporting is
    # just skipped; the run itself is unaffected.
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    # --- API --------------------------------------------------------
    # Plain comma-separated string, not list[str]: pydantic-settings always
    # tries json.loads() on the raw env value for any list-typed field
    # before any validator gets a chance to run, and a bare CSV string
    # isn't valid JSON - confirmed this raises SettingsError outright
    # (fails closed, not a silent fallback). Keeping this a str field and
    # parsing it ourselves below sidesteps that entirely.
    cors_origins_raw: str = Field(
        default="http://localhost:5173", validation_alias="CORS_ORIGINS"
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
