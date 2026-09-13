"""The Sales / Lead Research agent.

Built as a two-stage pipeline rather than one agent, because ADK disables
tool use on any agent that has `output_schema` set (a schema-constrained
final response and function calling are mutually exclusive in the same
turn). So:

1. `researcher_agent` - has the search/fetch tools, does the actual open-
   ended research and qualification, and writes its findings as a plain-
   text dossier (see prompts.RESEARCHER_INSTRUCTION for the exact format).
2. `structuring_agent` - has no tools, only `output_schema`, and its sole
   job is converting that dossier into schema-valid JSON.

They're chained with `SequentialAgent`, which passes the same session
state through both steps; `output_key="research_dossier"` on step 1 is
what `{research_dossier}` in step 2's instruction reads back out.
"""

from google.adk.agents import LlmAgent, SequentialAgent
from google.adk.models.lite_llm import LiteLlm

from agents.sales_agent.prompts import RESEARCHER_INSTRUCTION, STRUCTURER_INSTRUCTION
from agents.sales_agent.schemas import LeadGenerationResult
from agents.sales_agent.tools.search import search_web
from agents.sales_agent.tools.web_reader import fetch_webpage
from config.settings import get_settings


def get_model():
    """Return the model handle for the configured provider.

    Gemini is passed to ADK as a plain model-name string (ADK talks to it
    natively). Any other provider goes through LiteLLM's universal
    interface instead - swapping providers is just changing
    LLM_PROVIDER/the matching API key in .env, no agent code changes.
    """
    settings = get_settings()

    if settings.llm_provider == "groq":
        # Groq's reasoning models (gpt-oss-*) emit a `reasoning_content`
        # field on assistant turns. ADK replays prior turns verbatim as
        # message history on the next call (needed for its multi-turn tool
        # loop), and Groq's own endpoint rejects that field on an incoming
        # message - "property 'reasoning_content' is unsupported". Groq
        # docs confirm `reasoning_format` must be "parsed" or "hidden"
        # anyway whenever tool calls or JSON mode are in play (both stages
        # here use one or the other); "hidden" drops the field from the
        # response entirely so it never gets echoed back.
        # num_retries: gets merged straight into litellm's completion call
        # (same mechanism as reasoning_format above), so a transient 429
        # from Groq's free-tier TPM limit gets retried instead of failing
        # the whole run outright. Set high (8) because litellm's built-in
        # backoff is exponential but caps at 8s/step - confirmed via Render
        # logs that 3 retries exhausted in ~2s total, nowhere near the
        # 20-30s Groq's error message says the TPM window needs to clear.
        # Worst case ~40s of cumulative backoff, well inside the 280s run
        # timeout below.
        return LiteLlm(model=settings.groq_model, reasoning_format="hidden", num_retries=8)

    if settings.llm_provider == "openrouter":
        return LiteLlm(model=settings.openrouter_model, num_retries=3)

    return settings.gemini_model


def build_sales_agent_pipeline() -> SequentialAgent:
    model = get_model()

    researcher_agent = LlmAgent(
        name="lead_researcher",
        model=model,
        description="Searches the web and qualifies companies as sales leads.",
        instruction=RESEARCHER_INSTRUCTION,
        tools=[search_web, fetch_webpage],
        output_key="research_dossier",
    )

    structuring_agent = LlmAgent(
        name="lead_structurer",
        model=model,
        description="Converts the research dossier into schema-valid JSON.",
        instruction=STRUCTURER_INSTRUCTION,
        output_schema=LeadGenerationResult,
        output_key="structured_result",
    )

    return SequentialAgent(
        name="sales_lead_pipeline",
        sub_agents=[researcher_agent, structuring_agent],
    )


root_agent = build_sales_agent_pipeline()
