import asyncio
import logging

from agents.lead_research import prompts
from agents.lead_research.budget import ResearchBudget
from agents.lead_research.errors import ResearchCancelledError, ResearchConfigError
from agents.lead_research.llm import LLMClient
from agents.lead_research.schemas import ICP
from agents.lead_research.state import Candidate, FilterDecision, ResearchState
from agents.lead_research.tracking import call_llm

logger = logging.getLogger(__name__)

_FILTER_CONCURRENCY = 3
# If a whole batch can't be screened, let it through at the minimum passing
# confidence - deep research still rejects poor fits, dropping them loses leads.
_UNSCREENED_CONFIDENCE = 0.5


def _candidate_line(index: int, candidate: Candidate) -> str:
    facts = "; ".join(f"{k.replace('_', ' ')}: {v}" for k, v in candidate.facts.items() if k in ("employees", "headquarters"))
    info = " ".join(candidate.description.split())[:220]
    return f"{index} | {candidate.company_name} | {candidate.domain} | {info}" + (f" | {facts}" if facts else "")


def _to_float(value: object, default: float) -> float:
    try:
        return max(0.0, min(1.0, float(value)))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


class CandidateFilter:
    """Cheap first-pass screening on name/URL/snippet only, batched so 100
    candidates cost ~5 fast-model calls instead of 100."""

    def __init__(self, llm: LLMClient):
        self._llm = llm

    async def filter(
        self,
        state: ResearchState,
        icp: ICP,
        candidates: list[Candidate],
        budget: ResearchBudget,
        *,
        seller_name: str,
        seller_domain: str,
    ) -> list[FilterDecision]:
        batches = [candidates[i : i + budget.filter_batch_size] for i in range(0, len(candidates), budget.filter_batch_size)]
        semaphore = asyncio.Semaphore(_FILTER_CONCURRENCY)

        async def screen(batch: list[Candidate]) -> list[FilterDecision]:
            async with semaphore:
                return await self._screen_batch(state, icp, batch, seller_name, seller_domain)

        decisions = [d for batch_result in await asyncio.gather(*(screen(b) for b in batches)) for d in batch_result]
        relevant = [d for d in decisions if d.relevant and d.confidence >= budget.filter_min_confidence]
        relevant.sort(key=lambda d: d.confidence, reverse=True)
        return relevant[: budget.max_filtered_candidates]

    async def _screen_batch(
        self, state: ResearchState, icp: ICP, batch: list[Candidate], seller_name: str, seller_domain: str
    ) -> list[FilterDecision]:
        user = prompts.filter_user(icp, seller_name, seller_domain, [_candidate_line(i, c) for i, c in enumerate(batch)])
        try:
            data = await call_llm(self._llm, state, system=prompts.FILTER_SYSTEM, user=user, tier="fast", max_tokens=80 + 45 * len(batch))
        except (ResearchConfigError, ResearchCancelledError):
            raise
        except Exception as exc:  # noqa: BLE001 - one bad batch must not sink the run
            logger.warning("Filter batch failed, passing %d candidates through unscreened: %s", len(batch), exc)
            return [FilterDecision(c, True, _UNSCREENED_CONFIDENCE, "not screened (filter unavailable)") for c in batch]

        by_id: dict[int, dict] = {}
        for item in data.get("decisions") or []:
            if isinstance(item, dict):
                try:
                    by_id[int(item.get("id"))] = item
                except (TypeError, ValueError):
                    continue

        decisions = []
        for index, candidate in enumerate(batch):
            item = by_id.get(index)
            if item is None:
                decisions.append(FilterDecision(candidate, False, 0.0, "not assessed"))
                continue
            decisions.append(
                FilterDecision(
                    candidate=candidate,
                    relevant=bool(item.get("relevant")),
                    confidence=_to_float(item.get("confidence"), 0.5),
                    reason=str(item.get("reason") or "")[:200],
                )
            )
        return decisions
