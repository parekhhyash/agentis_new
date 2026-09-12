from functools import lru_cache
from typing import Literal

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
    groq_model: str = "groq/llama-3.3-70b-versatile"

    # --- Tool safeguards ------------------------------------------------
    max_search_results_per_query: int = 8
    max_page_text_chars: int = 6000
    http_timeout_seconds: float = 15.0

    # --- Run-level safeguards -------------------------------------------
    agent_run_timeout_seconds: float = 240.0

    # --- API --------------------------------------------------------
    cors_origins: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
