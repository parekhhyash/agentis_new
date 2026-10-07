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

    def __init__(
        self,
        fast: ModelSpec,
        strong: ModelSpec,
        timeout_seconds: float = 60.0,
        num_retries: int = 2,
        reasoning_allowance: int = 4096,
    ):
        self._specs = {"fast": fast, "strong": strong}
        self._timeout = timeout_seconds
        self._num_retries = num_retries
        self._reasoning_allowance = reasoning_allowance

    async def complete_json(self, *, system: str, user: str, tier: Tier, max_tokens: int) -> LLMResult:
        """`max_tokens` is the size of the JSON answer. Reasoning models spend
        hidden tokens from the same limit first, so the request limit adds an
        allowance for that, and a reply cut off by the limit is retried once
        with double the room."""
        spec = self._specs[tier]
        limit = max_tokens + self._reasoning_allowance
        tokens = 0
        for attempt in range(2):
            content, finish_reason, used = await self._call(spec, system, user, limit)
            tokens += used
            try:
                return LLMResult(data=parse_json_object(content), tokens=tokens)
            except LLMOutputError:
                logger.warning(
                    "Unusable %s reply from %s (finish_reason=%s, max_tokens=%d, %d chars): %r",
                    tier, spec.model, finish_reason, limit, len(content), content[:300],
                )
                if attempt == 0 and (finish_reason == "length" or not content.strip()):
                    limit *= 2
                    continue
                raise
        raise AssertionError("unreachable")

    async def _call(self, spec: ModelSpec, system: str, user: str, limit: int) -> tuple[str, str | None, int]:
        import litellm

        try:
            response = await litellm.acompletion(
                model=spec.model,
                api_key=spec.api_key,
                messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=limit,
                timeout=self._timeout,
                num_retries=self._num_retries,
                **spec.extra,
            )
        except litellm.AuthenticationError as exc:
            raise ResearchConfigError(f"LLM provider rejected the API key for {spec.model}") from exc
        except litellm.NotFoundError:
            # OpenRouter answers 404 when no endpoint matches the preferred
            # provider/quantization (providers change what they serve). Drop
            # the preference for the rest of this client's life and retry on
            # normal routing rather than failing every call.
            body = spec.extra.get("extra_body") or {}
            if "provider" not in body:
                raise
            logger.warning("No OpenRouter route for %s with the preferred provider; using default routing", spec.model)
            spec.extra = {**spec.extra, "extra_body": {k: v for k, v in body.items() if k != "provider"}}
            return await self._call(spec, system, user, limit)

        choice = response.choices[0]
        usage = getattr(response, "usage", None)
        tokens = int(getattr(usage, "total_tokens", 0) or 0)
        # OpenRouter reports which upstream provider served the call.
        served_by = getattr(response, "provider", None) or (getattr(response, "_hidden_params", None) or {}).get("custom_llm_provider")
        logger.info("LLM call %s served by %s (%d tokens)", spec.model, served_by or "unknown", tokens)
        return choice.message.content or "", getattr(choice, "finish_reason", None), tokens


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

    effort = settings.llm_reasoning_effort

    def spec(model: str | None) -> ModelSpec:
        chosen = model or default_model
        extra: dict[str, Any] = {}
        if provider == "groq":
            extra["reasoning_format"] = "hidden"
        if provider in ("groq", "gemini") and effort:
            # drop_params: models litellm doesn't know support reasoning get the
            # call without it instead of an UnsupportedParamsError.
            groq_effort = "low" if effort == "none" else effort  # gpt-oss has no "off"
            extra.update(reasoning_effort=groq_effort if provider == "groq" else effort, drop_params=True)
        if provider == "openrouter":
            body: dict[str, Any] = {}
            if effort:
                # OpenRouter's unified reasoning control; providers/models
                # without reasoning ignore it. Models with on/off thinking
                # (DeepSeek) ignore effort levels, so "none" must disable it.
                body["reasoning"] = {"enabled": False} if effort == "none" else {"effort": effort}
            if chosen == settings.openrouter_model and settings.openrouter_provider_order:
                # Prefer the cheapest fp8 endpoint for the default model, falling
                # back to other fp8 endpoints rather than failing: a hard pin
                # broke every call when its provider stopped serving the model.
                # If no fp8 route exists at all, _call retries on default
                # routing. Overrides use normal routing since the provider may
                # not serve them.
                body["provider"] = {
                    "order": [p.strip() for p in settings.openrouter_provider_order.split(",") if p.strip()],
                    "quantizations": ["fp8"],
                    "allow_fallbacks": True,
                }
            if body:
                extra["extra_body"] = body
        return ModelSpec(model=chosen, api_key=api_key, extra=extra)

    return LiteLLMClient(
        fast=spec(settings.llm_fast_model),
        strong=spec(settings.llm_strong_model),
        timeout_seconds=settings.llm_timeout_seconds,
        reasoning_allowance=settings.llm_reasoning_token_allowance,
    )
