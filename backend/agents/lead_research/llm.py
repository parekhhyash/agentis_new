import json
import logging
import re
from dataclasses import dataclass
from typing import Any, Literal, Protocol

from agents.lead_research.errors import LLMOutputError, ResearchConfigError

logger = logging.getLogger(__name__)

Tier = Literal["fast", "strong"]


@dataclass
class LLMResult:
    data: dict[str, Any]
    tokens: int


class LLMClient(Protocol):
    """Provider-agnostic JSON completion. `fast` is for cheap bulk screening,
    `strong` for ICP analysis and per-company qualification."""

    async def complete_json(self, *, system: str, user: str, tier: Tier, max_tokens: int) -> LLMResult: ...


def parse_json_object(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.IGNORECASE)
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            raise LLMOutputError(f"No JSON object in model output: {text[:200]!r}") from None
        try:
            value = json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as exc:
            raise LLMOutputError(f"Invalid JSON in model output: {exc}") from exc
    if not isinstance(value, dict):
        raise LLMOutputError("Model output JSON is not an object")
    return value


@dataclass
class ModelSpec:
    model: str
    api_key: str | None
    extra: dict[str, Any]


class LiteLLMClient:
    """LLMClient backed by litellm, so switching Gemini/Groq/OpenRouter (or any
    other litellm-supported provider) is configuration only."""

    def __init__(self, fast: ModelSpec, strong: ModelSpec, timeout_seconds: float = 60.0, num_retries: int = 2):
        self._specs = {"fast": fast, "strong": strong}
        self._timeout = timeout_seconds
        self._num_retries = num_retries

    async def complete_json(self, *, system: str, user: str, tier: Tier, max_tokens: int) -> LLMResult:
        import litellm

        spec = self._specs[tier]
        try:
            response = await litellm.acompletion(
                model=spec.model,
                api_key=spec.api_key,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=max_tokens,
                timeout=self._timeout,
                num_retries=self._num_retries,
                **spec.extra,
            )
        except litellm.AuthenticationError as exc:
            raise ResearchConfigError(f"LLM provider rejected the API key for {spec.model}") from exc

        content = response.choices[0].message.content or ""
        usage = getattr(response, "usage", None)
        tokens = int(getattr(usage, "total_tokens", 0) or 0)
        return LLMResult(data=parse_json_object(content), tokens=tokens)


def build_llm_client(settings: Any) -> LiteLLMClient:
    provider = settings.llm_provider
    if provider == "openrouter":
        default_model, api_key = settings.openrouter_model, settings.openrouter_api_key
    elif provider == "groq":
        default_model, api_key = settings.groq_model, settings.groq_api_key
    else:
        default_model = settings.gemini_model if settings.gemini_model.startswith("gemini/") else f"gemini/{settings.gemini_model}"
        api_key = settings.google_api_key

    if not api_key:
        raise ResearchConfigError(f"No API key configured for LLM provider '{provider}'")

    def spec(model: str | None) -> ModelSpec:
        chosen = model or default_model
        extra: dict[str, Any] = {}
        if provider == "groq":
            extra["reasoning_format"] = "hidden"
        if provider == "openrouter" and chosen == settings.openrouter_model and settings.openrouter_provider_order:
            # Pin the default model to the cheap route we validated; overrides
            # use OpenRouter's normal routing since the pinned provider may not
            # serve them.
            extra["extra_body"] = {
                "provider": {
                    "order": [p.strip() for p in settings.openrouter_provider_order.split(",") if p.strip()],
                    "quantizations": ["fp8"],
                    "allow_fallbacks": False,
                }
            }
        return ModelSpec(model=chosen, api_key=api_key, extra=extra)

    return LiteLLMClient(
        fast=spec(settings.llm_fast_model),
        strong=spec(settings.llm_strong_model),
        timeout_seconds=settings.llm_timeout_seconds,
    )
