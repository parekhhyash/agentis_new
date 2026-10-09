"""Data & Reporting agent: question -> planned queries -> checked against the
data -> run in code -> written summary whose numbers are verified.

The model only chooses *what* to calculate (as queries in query.py's JSON
language) and words the summary; the application runs every calculation.
"""

import json
import logging
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from agents.data_reporting import prompts
from agents.data_reporting.query import Query, QueryError, compile_query, describe_query, run_query
from agents.data_reporting.schemas import DataReportResult, DatasetRef, ReportBlock, ReportColumn
from agents.data_reporting.tables import Table
from agents.data_reporting.verify import allowed_numbers, fallback_summary, unverified_numbers
from agents.lead_research.llm import LLMClient

logger = logging.getLogger(__name__)

MAX_BLOCKS = 6
_VISUALS = {"kpi", "bar", "line", "pie", "table"}

StepCallback = Callable[[str], Awaitable[None]]
# Called with the compiled queries before they run, so the caller can load
# rows for the tables they use (uploads, live reply status). Returns notes
# about the data to show with the report.
PrepareHook = Callable[[list[Query]], Awaitable[list[str]]]


async def _no_step(_: str) -> None:
    return None


class DataReportCancelledError(Exception):
    pass


@dataclass
class PlannedBlock:
    title: str
    visual: str
    query: Query


def _company_text(company: dict[str, Any]) -> str:
    lines = [f"{k.replace('_', ' ')}: {v}" for k, v in company.items() if v]
    return "\n".join(lines) or "(not provided)"


def render_catalogue(tables: list[Table], attached: set[str]) -> str:
    blocks = []
    for table in tables:
        origin = "Agentis activity" if table.kind == "activity" else "uploaded file"
        flag = ", ATTACHED to this message" if table.id in attached else ""
        lines = [f'DATASET "{table.id}": {table.name} ({origin}{flag}, {table.size:,} rows)']
        if table.description:
            lines.append(f"  {table.description}")
        for column in table.columns:
            if column.hidden:
                continue
            if column.min is not None:
                detail = f"{column.min} to {column.max}"
            elif column.samples:
                detail = "e.g. " + ", ".join(json.dumps(s, ensure_ascii=False) for s in column.samples)
            else:
                detail = "no values yet"
            money = f", money in {column.unit}" if column.unit else ""
            lines.append(f"  - {column.name} ({column.type}{money}; {detail})")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _fit_visual(visual: str, query: Query) -> str:
    """Keeps the chart type consistent with what the query returns."""
    if query.select:
        return "table"
    if not query.group:
        return "kpi"
    if visual == "kpi":
        return "bar" if len(query.metrics) == 1 else "table"
    if visual == "line" and not query.group.bucket:
        return "bar"
    if visual == "pie" and len(query.metrics) != 1:
        return "bar"
    return visual if visual in _VISUALS else "bar"


def _results_for_prompt(blocks: list[ReportBlock]) -> str:
    out = []
    for block in blocks:
        out.append({
            "title": block.title,
            "columns": [f"{c.name}{f' ({c.unit})' if c.unit else ''}" for c in block.columns],
            "rows": block.rows[:25],
            "rows_total": block.total,
            "matching_rows": block.matched_rows,
        })
    return json.dumps(out, ensure_ascii=False, default=str)


class DataReportingAgent:
    def __init__(
        self,
        llm: LLMClient,
        *,
        on_step: StepCallback | None = None,
        is_cancelled: Callable[[], bool] | None = None,
    ):
        self._llm = llm
        self._step = on_step or _no_step
        self._is_cancelled = is_cancelled or (lambda: False)

    def _checkpoint(self) -> None:
        if self._is_cancelled():
            raise DataReportCancelledError()

    async def run(
        self,
        question: str,
        tables: list[Table],
        *,
        attached: set[str] | None = None,
        history: str = "(this is the first message)",
        company: dict[str, Any] | None = None,
        today: date,
        prepare: PrepareHook | None = None,
    ) -> DataReportResult:
        attached = attached or set()
        by_id = {t.id: t for t in tables}
        result = DataReportResult(question=question, title="Report", summary="",
                                  generated_at=datetime.now(timezone.utc).isoformat())

        await self._step("Planning the report")
        system = prompts.PLANNER_SYSTEM
        user = prompts.PLANNER_USER.format(
            today=today.strftime("%A %d %B %Y"),
            company=_company_text(company or {}),
            history=history,
            catalogue=render_catalogue(tables, attached),
            question=question,
        )
        plan = await self._llm.complete_json(system=system, user=user, tier="strong", max_tokens=3000)
        result.usage.llm_calls += 1
        result.usage.llm_tokens += plan.tokens
        result.title = " ".join(str(plan.data.get("title") or "").split())[:120] or "Report"
        missing = str(plan.data.get("missing") or "").strip()
        raw_blocks = [b for b in (plan.data.get("blocks") or []) if isinstance(b, dict)][:MAX_BLOCKS]

        planned, errors = self._compile(raw_blocks, by_id)
        if errors:
            self._checkpoint()
            await self._step("Fixing parts of the plan that don't fit your data")
            repair_user = user + "\n\nYOUR PLAN:\n" + json.dumps({"blocks": raw_blocks}, ensure_ascii=False) + "\n\n" + \
                prompts.REPAIR_USER.format(errors="\n".join(f"- {e}" for e in errors))
            try:
                fixed = await self._llm.complete_json(system=system, user=repair_user, tier="strong", max_tokens=2500)
                result.usage.llm_calls += 1
                result.usage.llm_tokens += fixed.tokens
                more = [b for b in (fixed.data.get("blocks") or []) if isinstance(b, dict)]
                repaired, still = self._compile(more[: MAX_BLOCKS - len(planned)], by_id)
                planned += repaired
                result.notes += [f"Left out: {e}" for e in still]
            except Exception as exc:  # noqa: BLE001 - keep the blocks that did work
                logger.warning("Plan repair failed: %s", exc)
                result.notes += [f"Left out: {e}" for e in errors]

        if not planned:
            result.summary = missing or "I couldn't find data that answers this. Upload a CSV or Excel file with the numbers you want to look at, or ask about your leads, emails or meetings."
            return result

        self._checkpoint()
        if prepare:
            result.notes += await prepare([p.query for p in planned])
        self._checkpoint()
        await self._step(f"Calculating {len(planned)} part{'s' if len(planned) != 1 else ''} of the report")
        result.blocks = [self._execute(p, today) for p in planned]
        used = {p.query.table.id: p.query.table for p in planned}
        result.datasets = [DatasetRef(id=t.id, name=t.name, kind=t.kind, rows=t.size) for t in used.values()]
        if missing:
            result.notes.append(missing)

        self._checkpoint()
        await self._step("Writing the summary")
        result.summary = await self._summarize(question, result, today)
        return result

    def _compile(self, raw_blocks: list[dict[str, Any]], tables: dict[str, Table]) -> tuple[list[PlannedBlock], list[str]]:
        planned, errors = [], []
        for raw in raw_blocks:
            title = " ".join(str(raw.get("title") or "").split())[:100] or "Untitled"
            visual = str(raw.get("visual") or "table").lower()
            try:
                query = compile_query(raw.get("query"), tables, visual=visual)
            except QueryError as exc:
                errors.append(f'"{title}": {exc}')
                continue
            planned.append(PlannedBlock(title=title, visual=_fit_visual(visual, query), query=query))
        return planned, errors

    def _execute(self, planned: PlannedBlock, today: date) -> ReportBlock:
        output = run_query(planned.query, today)
        return ReportBlock(
            id=uuid.uuid4().hex[:10],
            title=planned.title,
            visual=planned.visual,  # type: ignore[arg-type]
            dataset=planned.query.table.name,
            columns=[ReportColumn(**c.dump()) for c in output.columns],
            rows=output.rows,
            total=output.total,
            matched_rows=output.matched_rows,
            explanation=describe_query(planned.query),
        )

    async def _summarize(self, question: str, result: DataReportResult, today: date) -> str:
        allowed = allowed_numbers(result.blocks, question, today)
        user = prompts.SUMMARY_USER.format(
            today=today.isoformat(),
            question=question,
            title=result.title,
            results=_results_for_prompt(result.blocks),
            notes="\n".join(f"- {n}" for n in result.notes) or "(none)",
        )
        for attempt in range(2):
            try:
                out = await self._llm.complete_json(system=prompts.SUMMARY_SYSTEM, user=user, tier="strong", max_tokens=900)
            except Exception as exc:  # noqa: BLE001 - the numbers still stand on their own
                logger.warning("Summary failed: %s", exc)
                break
            result.usage.llm_calls += 1
            result.usage.llm_tokens += out.tokens
            summary = str(out.data.get("summary") or "").strip()
            if not summary:
                break
            bad = unverified_numbers(summary, allowed)
            if not bad:
                return summary
            logger.info("Summary had numbers not in the results (attempt %d): %s", attempt + 1, bad)
            user += "\n\nYOUR SUMMARY:\n" + summary + "\n\n" + prompts.SUMMARY_RETRY.format(numbers=", ".join(bad))
        return fallback_summary(result.blocks)
