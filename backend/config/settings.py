from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central config. All values are read from the environment (or a local
    .env file) so nothing about which LLM/provider is used is hardcoded in
    the agent code itself.
    """

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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

    # --- Tool safeguards ------------------------------------------------
    # Kept modest because every search/fetch result gets folded into the
    # conversation history for every subsequent LLM turn - Groq's free-tier
    # TPM cap (8000 tokens/min for gpt-oss-120b) is easy to blow through on
    # a multi-lead research run otherwise.
    max_search_results_per_query: int = 5
    max_page_text_chars: int = 4000
    http_timeout_seconds: float = 15.0

    # --- Run-level safeguards -------------------------------------------
    # Raised from 280s after a real run on OpenRouter/DeepSeek V4 Flash
    # timed out mid-research (confirmed via Render logs: still doing
    # correct tool calls, just not done yet). Unlike Groq's LPU-accelerated
    # inference, a model routed through OpenRouter to a third-party
    # provider has ordinary LLM latency per call, and a multi-lead research
    # loop needs many sequential search/fetch/reason round trips - so the
    # wall-clock budget has to be generous regardless of which provider is
    # configured. Keep src/lib/salesAgentApi.ts's client-side timeout above
    # this value too.
    agent_run_timeout_seconds: float = 590.0

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
