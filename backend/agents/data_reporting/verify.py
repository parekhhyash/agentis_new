"""Checks that every number in the written summary comes from the computed
report, so the model can't slip in a figure it made up or calculated."""

import re
from datetime import date
from typing import Any

from agents.data_reporting.schemas import ReportBlock

# 1,20,000 · 4.5 · 12% · -3 (but not the 3 in "Q3" or a date's parts glued to letters)
_NUMBER = re.compile(r"(?<![\w.])-?(?:\d{1,3}(?:,\d{2,3})+|\d+)(?:\.\d+)?(?![\w])")
# Numbers this small read as counts in prose ("top 3", "2 of them"): always allowed.
_SMALL = 10


def numbers_in(text: str) -> list[tuple[str, float]]:
    out = []
    for match in _NUMBER.finditer(text):
        raw = match.group(0)
        try:
            out.append((raw, float(raw.replace(",", ""))))
        except ValueError:
            continue
    return out


def _variants(value: float) -> set[float]:
    return {value, float(round(value)), round(value, 1), round(value, 2)}


def allowed_numbers(blocks: list[ReportBlock], question: str, today: date) -> set[float]:
    allowed: set[float] = {float(n) for n in range(_SMALL + 1)}
    allowed |= {float(today.year), float(today.month), float(today.day)}
    for _, value in numbers_in(question):
        allowed |= _variants(value)
    for block in blocks:
        for n in (block.total, block.matched_rows, len(block.rows)):
            allowed.add(float(n))
        for row in block.rows:
            for cell in row:
                if isinstance(cell, bool):
                    continue
                if isinstance(cell, (int, float)):
                    allowed |= _variants(float(cell))
                elif isinstance(cell, str):
                    # Dates and labels ("2026-10-05", "Plan 2") may be quoted in words.
                    for _, value in numbers_in(cell.replace("-", " ")):
                        allowed.add(value)
    return allowed


def unverified_numbers(summary: str, allowed: set[float]) -> list[str]:
    # Rounded forms of the real values ("4.3" for 4.33) are already in `allowed`.
    bad = []
    for raw, value in numbers_in(summary):
        if value in allowed or any(abs(value - a) < 1e-6 for a in allowed):
            continue
        if raw not in bad:
            bad.append(raw)
    return bad


def _format(value: Any, unit: str | None) -> str:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        text = f"{value:,}" if isinstance(value, int) or float(value).is_integer() else f"{value:,.2f}".rstrip("0").rstrip(".")
        if unit == "%":
            return f"{text}%"
        return f"{unit}{text}" if unit in {"₹", "$", "€", "£", "¥"} else (f"{text} {unit}" if unit else text)
    return "n/a" if value is None else str(value)


def fallback_summary(blocks: list[ReportBlock]) -> str:
    """Plain statements read straight off the results, used when the
    written summary can't be verified."""
    lines = []
    for block in blocks:
        if not block.rows:
            lines.append(f"- {block.title}: no matching data.")
            continue
        if block.visual == "kpi":
            for column, value in zip(block.columns, block.rows[0]):
                lines.append(f"- **{column.name}:** {_format(value, column.unit)}")
        elif block.visual in ("bar", "pie") and len(block.columns) > 1:
            top = block.rows[0]
            lines.append(f"- {block.title}: highest is **{top[0]}** with {_format(top[1], block.columns[1].unit)}.")
        elif block.visual == "line" and len(block.columns) > 1:
            last = block.rows[-1]
            lines.append(f"- {block.title}: latest period ({last[0]}) is {_format(last[1], block.columns[1].unit)}.")
        else:
            lines.append(f"- {block.title}: {block.total} row(s).")
    return "Here's what the data shows:\n" + "\n".join(lines)
