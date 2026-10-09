"""A small, safe query language for reports.

The planner (an LLM) writes each chart or number as JSON:

    {"dataset": "emails",
     "filters": [{"column": "status", "op": "eq", "value": "sent"}],
     "group_by": {"column": "sent_on", "bucket": "week"},
     "metrics": [{"fn": "count", "label": "Emails sent"},
                 {"fn": "rate", "where": [{"column": "replied", "op": "eq", "value": true}], "label": "Reply rate"}],
     "sort": {"by": "Emails sent", "dir": "desc"}, "limit": 10}

compile_query() checks it against the real tables (every dataset, column,
operator and value must exist and fit the column's type) and run_query()
evaluates it in plain Python. Nothing the model writes is ever executed as
code or SQL, and every number in a report comes from run_query.
"""

import statistics
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from agents.data_reporting.tables import Column, Table, parse_bool, parse_date, parse_number

FILTER_OPS = {
    "eq", "ne", "gt", "gte", "lt", "lte", "contains", "not_contains", "in", "not_in",
    "is_empty", "not_empty", "last_days", "this_month", "last_month", "this_year", "between",
}
_COMPARE = {"gt", "gte", "lt", "lte"}
_DATE_ONLY = {"last_days", "this_month", "last_month", "this_year", "between"}
_NO_VALUE = {"is_empty", "not_empty", "this_month", "last_month", "this_year"}
METRIC_FNS = {"count", "count_distinct", "sum", "avg", "median", "min", "max", "rate"}
_NUMERIC_FNS = {"sum", "avg", "median"}
_ADDITIVE = {"count", "sum"}
BUCKETS = {"day", "week", "month", "year"}
BLANK = "(blank)"
OTHER = "Other"

MAX_GROUP_LIMIT = 50
DEFAULT_GROUP_LIMIT = 12
MAX_LIST_ROWS = 50
DEFAULT_LIST_ROWS = 20
MAX_TIME_POINTS = 400
_CURRENCY_UNITS = {"₹", "$", "€", "£", "¥"}


class QueryError(ValueError):
    """The planned query doesn't fit the data; the message says why."""


@dataclass
class Filter:
    column: Column
    op: str
    value: Any = None


@dataclass
class Metric:
    fn: str
    label: str
    column: Column | None = None
    where: list[Filter] = field(default_factory=list)
    unit: str | None = None


@dataclass
class Group:
    column: Column
    bucket: str | None = None


@dataclass
class Query:
    table: Table
    filters: list[Filter] = field(default_factory=list)
    group: Group | None = None
    metrics: list[Metric] = field(default_factory=list)
    select: list[Column] = field(default_factory=list)
    sort_by: str | None = None
    sort_desc: bool = True
    limit: int | None = None
    other: bool = False


@dataclass
class ResultColumn:
    name: str
    type: str  # "text" | "number" | "date" | "boolean"
    role: str  # "dimension" | "metric" | "field"
    unit: str | None = None

    def dump(self) -> dict[str, Any]:
        out = {"name": self.name, "type": self.type, "role": self.role}
        if self.unit:
            out["unit"] = self.unit
        return out


@dataclass
class QueryResult:
    columns: list[ResultColumn]
    rows: list[list[Any]]
    # Groups or rows before the limit, for "showing 10 of 34".
    total: int
    matched_rows: int


# --- compiling ----------------------------------------------------------------

def _column(table: Table, name: Any, role: str) -> Column:
    column = table.column(str(name or ""))
    if column is None:
        visible = ", ".join(c.name for c in table.columns if not c.hidden)
        raise QueryError(f'{table.name} has no column "{name}" (its columns are: {visible})')
    return column


def _coerce(column: Column, value: Any) -> Any:
    if column.type == "number":
        number = parse_number(value)
        if number is None:
            raise QueryError(f'"{value}" isn\'t a number, but {column.name} holds numbers')
        return number
    if column.type == "date":
        parsed = parse_date(value)
        if parsed is None:
            raise QueryError(f'"{value}" isn\'t a date (use YYYY-MM-DD) for {column.name}')
        return parsed
    if column.type == "boolean":
        parsed = parse_bool(value)
        if parsed is None:
            raise QueryError(f"{column.name} is yes/no, so filter it with true or false")
        return parsed
    return str(value).strip().lower()


def _filter(table: Table, raw: Any) -> Filter:
    if not isinstance(raw, dict):
        raise QueryError("a filter must be an object with column, op and value")
    column = _column(table, raw.get("column"), "filter")
    op = str(raw.get("op") or "eq").lower()
    if op not in FILTER_OPS:
        raise QueryError(f'"{op}" isn\'t a supported filter')
    value = raw.get("value")
    if op in _DATE_ONLY and column.type != "date":
        raise QueryError(f'"{op}" only works on date columns, and {column.name} isn\'t one')
    if op in _COMPARE and column.type not in ("number", "date"):
        raise QueryError(f'"{op}" needs a number or date column, and {column.name} is {column.type}')
    if op in ("contains", "not_contains") and column.type != "text":
        raise QueryError(f'"{op}" only works on text columns')
    if op in _NO_VALUE:
        return Filter(column, op)
    if op == "last_days":
        try:
            days = int(value)
        except (TypeError, ValueError):
            raise QueryError("last_days needs a number of days") from None
        return Filter(column, op, max(1, min(days, 3650)))
    if op == "between":
        if not isinstance(value, list) or len(value) != 2:
            raise QueryError("between needs [start, end] dates")
        start, end = sorted(_coerce(column, v) for v in value)
        return Filter(column, op, (start, end))
    if op in ("in", "not_in"):
        values = value if isinstance(value, list) else [value]
        if not values:
            raise QueryError(f"{op} needs a list of values")
        return Filter(column, op, {_coerce(column, v) for v in values[:100]})
    if value is None or (isinstance(value, str) and not value.strip()):
        raise QueryError(f"the {column.name} filter has no value")
    return Filter(column, op, _coerce(column, value))


def _metric(table: Table, raw: Any, used: set[str]) -> Metric:
    if not isinstance(raw, dict):
        raise QueryError("a metric must be an object with fn (and column)")
    fn = str(raw.get("fn") or "count").lower()
    if fn not in METRIC_FNS:
        raise QueryError(f'"{fn}" isn\'t a supported calculation')
    column = None
    if fn in ("count_distinct", "min", "max") or fn in _NUMERIC_FNS:
        column = _column(table, raw.get("column"), "metric")
        if fn in _NUMERIC_FNS and column.type != "number":
            raise QueryError(f"{fn} needs a number column, and {column.name} is {column.type}")
        if fn in ("min", "max") and column.type not in ("number", "date"):
            raise QueryError(f"{fn} needs a number or date column")
    where = [_filter(table, f) for f in (raw.get("where") or [])] if fn == "rate" else []
    if fn == "rate" and not where:
        raise QueryError('a rate needs "where" filters saying which rows count')

    defaults = {
        "count": "Count", "count_distinct": f"Unique {column.name if column else ''}",
        "sum": f"Total {column.name if column else ''}", "avg": f"Average {column.name if column else ''}",
        "median": f"Median {column.name if column else ''}", "min": f"Lowest {column.name if column else ''}",
        "max": f"Highest {column.name if column else ''}", "rate": "Rate",
    }
    label = " ".join(str(raw.get("label") or "").split())[:60] or defaults[fn].strip()
    base, n = label, 2
    while label.lower() in used:
        label, n = f"{base} ({n})", n + 1
    used.add(label.lower())

    unit = " ".join(str(raw.get("unit") or "").split())[:5] or (column.unit if column else None)
    if fn == "rate":
        unit = "%"
    elif fn in ("count", "count_distinct"):
        unit = None
    return Metric(fn=fn, label=label, column=column, where=where, unit=unit)


def compile_query(raw: Any, tables: dict[str, Table], *, visual: str | None = None) -> Query:
    if not isinstance(raw, dict):
        raise QueryError("the query must be an object")
    table = tables.get(str(raw.get("dataset") or ""))
    if table is None:
        raise QueryError(f'there is no dataset "{raw.get("dataset")}"')

    query = Query(table=table, filters=[_filter(table, f) for f in (raw.get("filters") or [])][:12])
    used: set[str] = set()
    query.metrics = [_metric(table, m, used) for m in (raw.get("metrics") or [])][:6]

    group = raw.get("group_by")
    if isinstance(group, list):
        group = group[0] if group else None
    if isinstance(group, str):
        group = {"column": group}
    if isinstance(group, dict) and group.get("column"):
        column = _column(table, group.get("column"), "group")
        bucket = str(group.get("bucket") or "").lower() or None
        if column.type == "date":
            bucket = bucket if bucket in BUCKETS else "day"
        else:
            bucket = None
        query.group = Group(column, bucket)
        if not query.metrics:
            query.metrics = [_metric(table, {"fn": "count"}, used)]

    if not query.metrics:
        select = raw.get("select") or [c.name for c in table.columns if not c.hidden][:8]
        query.select = list(dict.fromkeys(_column(table, name, "select").name for name in select[:10]))
        query.select = [table.column(name) for name in query.select]  # type: ignore[misc]

    sort = raw.get("sort") if isinstance(raw.get("sort"), dict) else {}
    if sort.get("by"):
        names = {m.label.lower(): m.label for m in query.metrics}
        names.update({c.name.lower(): c.name for c in query.select})
        if query.group:
            names[query.group.column.name.lower()] = query.group.column.name
        by = str(sort["by"]).lower()
        if by not in names:
            matched = table.column(str(sort["by"]))
            by = matched.name.lower() if matched and matched.name.lower() in names else ""
        query.sort_by = names.get(by)
    query.sort_desc = str(sort.get("dir") or "desc").lower() != "asc"

    try:
        limit = int(raw["limit"]) if raw.get("limit") is not None else None
    except (TypeError, ValueError):
        limit = None
    if query.group and query.group.bucket:
        ranked = query.sort_by and query.sort_by != query.group.column.name
        query.limit = max(1, min(limit or DEFAULT_GROUP_LIMIT, MAX_GROUP_LIMIT)) if ranked else None
    elif query.group:
        query.limit = max(1, min(limit or DEFAULT_GROUP_LIMIT, MAX_GROUP_LIMIT))
    elif query.select:
        query.limit = max(1, min(limit or DEFAULT_LIST_ROWS, MAX_LIST_ROWS))
    query.other = visual == "pie" and bool(query.group) and all(m.fn in _ADDITIVE for m in query.metrics)
    return query


# --- running ------------------------------------------------------------------

def _month_shift(day: date, months: int) -> date:
    index = day.year * 12 + day.month - 1 + months
    return date(index // 12, index % 12 + 1, 1)


def _matches(f: Filter, row: list[Any], index: int, today: date) -> bool:
    value = row[index]
    if f.op == "is_empty":
        return value is None or value == ""
    if f.op == "not_empty":
        return not (value is None or value == "")
    if value is None:
        return f.op in ("ne", "not_contains", "not_in")
    if f.column.type == "text":
        value = str(value).lower()
    if f.op == "eq":
        return value == f.value
    if f.op == "ne":
        return value != f.value
    if f.op == "gt":
        return value > f.value
    if f.op == "gte":
        return value >= f.value
    if f.op == "lt":
        return value < f.value
    if f.op == "lte":
        return value <= f.value
    if f.op == "contains":
        return f.value in value
    if f.op == "not_contains":
        return f.value not in value
    if f.op == "in":
        return value in f.value
    if f.op == "not_in":
        return value not in f.value
    if f.op == "between":
        return f.value[0] <= value <= f.value[1]
    if f.op == "last_days":
        return (today - timedelta(days=f.value - 1)).isoformat() <= value <= today.isoformat()
    if f.op == "this_month":
        return value[:7] == today.isoformat()[:7]
    if f.op == "last_month":
        return value[:7] == _month_shift(today, -1).isoformat()[:7]
    if f.op == "this_year":
        return value[:4] == today.isoformat()[:4]
    return False


def _bucket(value: Any, bucket: str | None) -> Any:
    if value is None:
        return None
    if bucket == "week":
        day = date.fromisoformat(value)
        return (day - timedelta(days=day.weekday())).isoformat()
    if bucket == "month":
        return value[:7]
    if bucket == "year":
        return value[:4]
    return value


def _next_bucket(key: str, bucket: str) -> str:
    if bucket == "day":
        return (date.fromisoformat(key) + timedelta(days=1)).isoformat()
    if bucket == "week":
        return (date.fromisoformat(key) + timedelta(days=7)).isoformat()
    if bucket == "month":
        return _month_shift(date.fromisoformat(f"{key}-01"), 1).isoformat()[:7]
    return str(int(key) + 1)


def _round(value: Any) -> Any:
    if isinstance(value, float):
        return int(value) if value.is_integer() else round(value, 2)
    return value


def _evaluate(metric: Metric, rows: list[list[Any]], table: Table, today: date) -> Any:
    if metric.fn == "count":
        return len(rows)
    if metric.fn == "rate":
        if not rows:
            return None
        indexes = [table.index(f.column.name) for f in metric.where]
        hits = sum(1 for r in rows if all(_matches(f, r, i, today) for f, i in zip(metric.where, indexes)))
        return _round(100.0 * hits / len(rows))
    assert metric.column is not None
    i = table.index(metric.column.name)
    values = [r[i] for r in rows if r[i] is not None and r[i] != ""]
    if metric.fn == "count_distinct":
        return len({str(v).lower() if isinstance(v, str) else v for v in values})
    if not values:
        return 0 if metric.fn == "sum" else None
    if metric.fn == "sum":
        return _round(float(sum(values)))
    if metric.fn == "avg":
        return _round(float(statistics.fmean(values)))
    if metric.fn == "median":
        return _round(float(statistics.median(values)))
    if metric.fn == "min":
        return _round(min(values))
    return _round(max(values))


def _metric_column(metric: Metric) -> ResultColumn:
    kind = "date" if metric.column and metric.column.type == "date" and metric.fn in ("min", "max") else "number"
    return ResultColumn(metric.label, kind, "metric", metric.unit)


def run_query(query: Query, today: date) -> QueryResult:
    table = query.table
    indexes = [table.index(f.column.name) for f in query.filters]
    rows = [r for r in table.rows if all(_matches(f, r, i, today) for f, i in zip(query.filters, indexes))]

    if query.select:
        columns = [ResultColumn(c.name, c.type, "field", c.unit) for c in query.select]
        picks = [table.index(c.name) for c in query.select]
        out = [[_round(r[i]) for i in picks] for r in rows]
        if query.sort_by:
            k = next(n for n, c in enumerate(query.select) if c.name == query.sort_by)
            present = [r for r in out if r[k] is not None]
            present.sort(key=lambda r: (str(r[k]).lower() if isinstance(r[k], str) else r[k]), reverse=query.sort_desc)
            out = present + [r for r in out if r[k] is None]
        return QueryResult(columns, out[: query.limit], total=len(out), matched_rows=len(rows))

    metric_columns = [_metric_column(m) for m in query.metrics]
    if not query.group:
        values = [_evaluate(m, rows, table, today) for m in query.metrics]
        return QueryResult(metric_columns, [values], total=1, matched_rows=len(rows))

    group = query.group
    gi = table.index(group.column.name)
    buckets: dict[Any, list[list[Any]]] = {}
    for r in rows:
        key = _bucket(r[gi], group.bucket)
        if group.column.type == "boolean" and key is not None:
            key = "Yes" if key else "No"
        elif isinstance(key, str) and group.column.type == "text":
            # "Mumbai" and "mumbai " are one group, shown as first written.
            match = next((k for k in buckets if isinstance(k, str) and k.lower() == key.lower()), None)
            key = match or key
        buckets.setdefault(BLANK if key is None else key, []).append(r)

    dim_type = {"day": "date", "week": "date", "month": "month", "year": "text"}.get(group.bucket or "", "text")
    if group.column.type == "number":
        dim_type = "number"
    dimension = ResultColumn(group.column.name if not group.bucket else f"{group.column.name} ({group.bucket})",
                             dim_type, "dimension")
    if group.bucket:
        keys = sorted(k for k in buckets if k != BLANK)
        if keys:
            filled, key = [], keys[0]
            while key <= keys[-1] and len(filled) < MAX_TIME_POINTS:
                filled.append(key)
                key = _next_bucket(key, group.bucket)
            keys = filled
        out = [[k] + [_evaluate(m, buckets.get(k, []), table, today) for m in query.metrics] for k in keys]
        total = len(out)
        metric_sort = next((n for n, m in enumerate(query.metrics) if m.label == query.sort_by), None)
        if metric_sort is not None:
            # "Best months": ranked by the metric instead of in time order.
            k = metric_sort + 1
            present = sorted((r for r in out if r[k] is not None), key=lambda r: r[k], reverse=query.sort_desc)
            out = (present + [r for r in out if r[k] is None])[: query.limit or DEFAULT_GROUP_LIMIT]
        elif query.sort_by == group.column.name and query.sort_desc:
            out.reverse()
        return QueryResult([dimension, *metric_columns], out, total=total, matched_rows=len(rows))

    out = [[_round(k)] + [_evaluate(m, members, table, today) for m in query.metrics] for k, members in buckets.items()]
    if query.sort_by == group.column.name:
        out.sort(key=lambda r: (r[0] == BLANK, str(r[0]).lower() if isinstance(r[0], str) else r[0]), reverse=False)
        if query.sort_desc:
            out.reverse()
    else:
        k = 1 + (next(n for n, m in enumerate(query.metrics) if m.label == query.sort_by) if query.sort_by else 0)
        present = sorted((r for r in out if r[k] is not None), key=lambda r: r[k], reverse=query.sort_desc)
        out = present + [r for r in out if r[k] is None]
    total = len(out)
    limit = query.limit or DEFAULT_GROUP_LIMIT
    if query.other and total > limit:
        kept, rest = out[: limit - 1], out[limit - 1 :]
        others = [OTHER] + [_round(sum((r[j] or 0) for r in rest)) for j in range(1, len(out[0]))]
        out = kept + [others]
    else:
        out = out[:limit]
    return QueryResult([dimension, *metric_columns], out, total=total, matched_rows=len(rows))


def describe_query(query: Query) -> str:
    """The query in plain words, for "how this was calculated"."""
    parts = []
    for m in query.metrics:
        if m.fn == "count":
            parts.append(f"{m.label}: number of rows")
        elif m.fn == "rate":
            parts.append(f"{m.label}: share of rows where " + " and ".join(_filter_words(f) for f in m.where))
        else:
            words = {"count_distinct": "number of different", "sum": "total", "avg": "average", "median": "median",
                     "min": "lowest", "max": "highest"}[m.fn]
            parts.append(f"{m.label}: {words} {m.column.name if m.column else ''}")
    if query.select:
        parts.append("Columns: " + ", ".join(c.name for c in query.select))
    text = f"From {query.table.name}. " + "; ".join(parts) + "."
    if query.filters:
        text += " Only rows where " + " and ".join(_filter_words(f) for f in query.filters) + "."
    if query.group:
        text += f" Grouped by {query.group.column.name}" + (f" per {query.group.bucket}" if query.group.bucket else "") + "."
    return text


def _filter_words(f: Filter) -> str:
    words = {
        "eq": "is", "ne": "is not", "gt": "is above", "gte": "is at least", "lt": "is below", "lte": "is at most",
        "contains": "contains", "not_contains": "doesn't contain", "in": "is one of", "not_in": "is not one of",
        "is_empty": "is blank", "not_empty": "is filled in", "this_month": "is this month",
        "last_month": "is last month", "this_year": "is this year",
    }
    if f.op == "last_days":
        return f"{f.column.name} is in the last {f.value} days"
    if f.op == "between":
        return f"{f.column.name} is between {f.value[0]} and {f.value[1]}"
    value = f.value
    if isinstance(value, set):
        value = ", ".join(sorted(str(v) for v in value))
    elif isinstance(value, bool):
        value = "yes" if value else "no"
    elif isinstance(value, float):
        value = _round(value)
    suffix = f" {value}" if f.op not in _NO_VALUE else ""
    return f"{f.column.name} {words[f.op]}{suffix}"


def uses_columns(query: Query, names: set[str]) -> bool:
    """Whether the query reads any of these columns of its table."""
    columns = [f.column for f in query.filters] + query.select
    for m in query.metrics:
        columns += ([m.column] if m.column else []) + [f.column for f in m.where]
    if query.group:
        columns.append(query.group.column)
    return any(c.name in names for c in columns)
