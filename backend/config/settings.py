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
    llm_provider: Literal["gemini", "groq"] = "gemini"

    google_api_key: str | None = None
    gemini_model: str = "gemini-flash-latest"

    groq_api_key: str | None = None
    groq_model: str = "groq/openai/gpt-oss-120b"

    # --- Tool safeguards ------------------------------------------------
    max_search_results_per_query: int = 8
    max_page_text_chars: int = 6000
    http_timeout_seconds: float = 15.0

    # --- Run-level safeguards -------------------------------------------
    agent_run_timeout_seconds: float = 240.0

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
