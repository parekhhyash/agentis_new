"""In-memory tables the Data & Reporting agent reports on, and parsing of
spreadsheets the user uploads (CSV or Excel) into typed columns.

Values are normalised once, at upload: numbers become floats/ints, dates
become ISO "YYYY-MM-DD" strings, yes/no columns become booleans and blanks
become None, so queries never have to guess at "₹1,20,000" or "05/03/2026".
"""

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Literal

ColumnType = Literal["number", "date", "text", "boolean"]

MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_ROWS = 20_000
MAX_COLUMNS = 60
MAX_TEXT = 500
_SAMPLES = 4


class DatasetError(ValueError):
    """A file that can't be turned into a table, with a message for the user."""


@dataclass
class Column:
    name: str
    type: ColumnType
    # A few distinct example values (or min/max for numbers and dates), so
    # the planner knows what's in the column without seeing every row.
    samples: list[Any] = field(default_factory=list)
    min: Any = None
    max: Any = None
    # Internal columns (ids) the planner never sees or uses.
    hidden: bool = False
    # Currency symbol when the values were written as money ("₹1,20,000").
    unit: str | None = None

    def describe(self) -> dict[str, Any]:
        out: dict[str, Any] = {"name": self.name, "type": self.type}
        if self.unit:
            out["unit"] = self.unit
        if self.samples:
            out["samples"] = self.samples
        if self.min is not None:
            out["min"], out["max"] = self.min, self.max
        return out


@dataclass
class Table:
    id: str
    name: str
    columns: list[Column]
    rows: list[list[Any]]
    description: str = ""
    kind: Literal["activity", "upload"] = "upload"
    # Known size when the rows haven't been loaded yet (uploads load lazily).
    row_count: int | None = None

    @property
    def size(self) -> int:
        return len(self.rows) if self.rows or self.row_count is None else self.row_count

    def index(self, column: str) -> int:
        return next(i for i, c in enumerate(self.columns) if c.name == column)

    def column(self, name: str) -> Column | None:
        """Exact name, else a case/punctuation-insensitive match."""
        visible = [c for c in self.columns if not c.hidden]
        for c in visible:
            if c.name == name:
                return c
        key = _key(name)
        return next((c for c in visible if _key(c.name) == key), None)


def _key(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


# --- value parsing ------------------------------------------------------------

_CURRENCY = re.compile(r"^(?:rs\.?|inr|usd|eur|gbp|aud|cad|sgd|aed)\s*|\s*(?:rs\.?|inr|usd|eur|gbp|aud|cad|sgd|aed)$", re.I)
_TRUE = {"true", "yes", "y"}
_FALSE = {"false", "no", "n"}
_DATE_FORMATS = (
    "%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%m-%d-%Y", "%d.%m.%Y",
    "%d %b %Y", "%d %B %Y", "%b %d, %Y", "%B %d, %Y", "%b %d %Y", "%d-%b-%Y", "%d-%b-%y",
    "%d/%m/%y", "%m/%d/%y", "%b %Y", "%B %Y", "%Y-%m",
)


def parse_number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text:
        return None
    negative = text.startswith("(") and text.endswith(")")
    text = text.strip("()").replace(",", "").replace(" ", "").replace(" ", "")
    text = re.sub(r"^[₹$€£¥]|[₹$€£¥]$", "", text)
    text = _CURRENCY.sub("", text).rstrip("%")
    if text.startswith("-"):
        negative, text = not negative, text[1:]
    if not re.fullmatch(r"\d+(?:\.\d+)?|\.\d+", text):
        return None
    number = float(text)
    return -number if negative else number


def _clean_number(number: float) -> int | float:
    return int(number) if number.is_integer() and abs(number) < 1e15 else round(number, 6)


def _strip_time(text: str) -> str:
    # "05/03/2026 14:30", "2026-03-05T14:30:00Z" -> the date part.
    return re.split(r"[T ](?=\d{1,2}:\d{2})", text, maxsplit=1)[0].strip()


def _date_with(text: str, fmt: str) -> date | None:
    try:
        return datetime.strptime(text, fmt).date()
    except ValueError:
        return None


def _pick_date_formats(values: list[str]) -> list[str]:
    """Formats ranked by how many sample values they read. Day-first formats
    come before month-first ones, so an ambiguous 05/03/2026 is 5 March."""
    sample = [_strip_time(v) for v in values[:300]]
    scores = []
    for fmt in _DATE_FORMATS:
        hits = sum(1 for v in sample if _date_with(v, fmt))
        if hits:
            scores.append((hits, -_DATE_FORMATS.index(fmt), fmt))
    scores.sort(reverse=True)
    return [fmt for _, _, fmt in scores]


def parse_date(value: Any, formats: tuple[str, ...] | list[str] = _DATE_FORMATS) -> str | None:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = _strip_time(str(value or "").strip())
    if not text:
        return None
    for fmt in formats:
        parsed = _date_with(text, fmt)
        if parsed:
            return parsed.isoformat()
    return None


def parse_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    text = str(value or "").strip().lower()
    return True if text in _TRUE else False if text in _FALSE else None


# --- typing a whole column ----------------------------------------------------

_CURRENCY_MARKS = (("₹", ("₹", "rs", "inr")), ("$", ("$", "usd")), ("€", ("€", "eur")), ("£", ("£", "gbp")))


def _currency(values: list[Any]) -> str | None:
    """The symbol most of a number column's written values carry, if any."""
    texts = [str(v).strip().lower() for v in values if isinstance(v, str)]
    if not texts:
        return None
    for symbol, marks in _CURRENCY_MARKS:
        if sum(1 for t in texts if t.startswith(marks) or t.endswith(marks)) >= 0.5 * len(values):
            return symbol
    return None


def _is_blank(value: Any) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def infer_column(name: str, raw: list[Any]) -> tuple[Column, list[Any]]:
    """Picks the column's type from its non-blank values and converts every
    value. A type needs at least 95% of values (90% for dates) to fit; the
    rest become None rather than turning a numeric column into text."""
    present = [v for v in raw if not _is_blank(v)]
    if not present:
        return Column(name, "text"), [None] * len(raw)

    if all(isinstance(v, bool) or str(v).strip().lower() in _TRUE | _FALSE for v in present):
        values = [None if _is_blank(v) else parse_bool(v) for v in raw]
        return _finish(Column(name, "boolean"), values)

    numbers = [parse_number(v) for v in present]
    if sum(n is not None for n in numbers) >= 0.95 * len(present):
        values = [None if _is_blank(v) else (None if (n := parse_number(v)) is None else _clean_number(n)) for v in raw]
        return _finish(Column(name, "number", unit=_currency(present)), values)

    if all(isinstance(v, (date, datetime)) for v in present):
        return _finish(Column(name, "date"), [None if _is_blank(v) else parse_date(v) for v in raw])
    text_values = [str(v).strip() for v in present if not isinstance(v, (date, datetime))]
    formats = _pick_date_formats(text_values) if text_values else []
    if formats:
        dates = [parse_date(v, formats) for v in present]
        if sum(d is not None for d in dates) >= 0.9 * len(present):
            return _finish(Column(name, "date"), [None if _is_blank(v) else parse_date(v, formats) for v in raw])

    values = [None if _is_blank(v) else str(v).strip()[:MAX_TEXT] for v in raw]
    return _finish(Column(name, "text"), values)


def _finish(column: Column, values: list[Any]) -> tuple[Column, list[Any]]:
    present = [v for v in values if v is not None]
    if column.type in ("number", "date") and present:
        column.min, column.max = min(present), max(present)
    distinct: list[Any] = []
    for v in present:
        if v not in distinct:
            distinct.append(v if not isinstance(v, str) else v[:60])
        if len(distinct) >= _SAMPLES:
            break
    column.samples = distinct
    return column, values


# --- files --------------------------------------------------------------------

def _decode(data: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("latin-1")


def _read_csv(data: bytes) -> list[list[Any]]:
    text = _decode(data)
    sample = text[:20_000]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        delimiter = dialect.delimiter
    except csv.Error:
        delimiter = "\t" if sample.count("\t") > sample.count(",") else ","
    return [row for row in csv.reader(io.StringIO(text), delimiter=delimiter)]


def _read_xlsx(data: bytes) -> list[list[Any]]:
    from openpyxl import load_workbook

    try:
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
    except Exception as exc:  # noqa: BLE001 - corrupt or password-protected files
        raise DatasetError("This Excel file couldn't be opened. Save it again as .xlsx or .csv and retry.") from exc
    try:
        for sheet in workbook.worksheets:
            rows = []
            for row in sheet.iter_rows(values_only=True):
                rows.append(list(row))
                if len(rows) > MAX_ROWS + 20:
                    break
            if any(any(not _is_blank(v) for v in row) for row in rows):
                return rows
        return []
    finally:
        workbook.close()


def _header_row(rows: list[list[Any]]) -> int:
    """The first of the opening rows that is as wide as the widest one, so a
    title line above the real header ("Sales report, Q3") is skipped."""
    head = rows[:10]
    widths = [sum(not _is_blank(v) for v in row) for row in head]
    widest = max(widths, default=0)
    return next(i for i, w in enumerate(widths) if w == widest)


def _column_names(header: list[Any], width: int) -> list[str]:
    names: list[str] = []
    for i in range(width):
        raw = header[i] if i < len(header) else None
        name = " ".join(str(raw).split())[:80] if not _is_blank(raw) else f"Column {i + 1}"
        base, n = name, 2
        while name in names:
            name, n = f"{base} ({n})", n + 1
        names.append(name)
    return names


def table_from_rows(raw_rows: list[list[Any]], *, id: str, name: str) -> Table:
    rows = [row for row in raw_rows if any(not _is_blank(v) for v in row)]
    if len(rows) < 2:
        raise DatasetError("The file needs a header row and at least one row of data.")
    start = _header_row(rows)
    header, body = rows[start], rows[start + 1 :]
    if not body:
        raise DatasetError("The file needs a header row and at least one row of data.")
    if len(body) > MAX_ROWS:
        raise DatasetError(f"The file has more than {MAX_ROWS:,} rows. Split it or filter it down and upload again.")

    width = max(len(header), max(len(r) for r in body))
    # Drop columns that are empty all the way down (common in exported sheets).
    keep = [i for i in range(width) if not _is_blank(header[i] if i < len(header) else None)
            or any(i < len(r) and not _is_blank(r[i]) for r in body)]
    if len(keep) > MAX_COLUMNS:
        raise DatasetError(f"The file has more than {MAX_COLUMNS} columns. Remove the ones you don't need and upload again.")
    names = _column_names([header[i] if i < len(header) else None for i in keep], len(keep))

    columns: list[Column] = []
    converted: list[list[Any]] = []
    for name_, i in zip(names, keep):
        column, values = infer_column(name_, [r[i] if i < len(r) else None for r in body])
        columns.append(column)
        converted.append(values)
    table_rows = [list(values) for values in zip(*converted)]
    return Table(id=id, name=name, columns=columns, rows=table_rows)


def parse_upload(filename: str, data: bytes, *, id: str = "upload") -> Table:
    if not data:
        raise DatasetError("The file is empty.")
    if len(data) > MAX_FILE_BYTES:
        raise DatasetError(f"The file is larger than {MAX_FILE_BYTES // (1024 * 1024)} MB.")
    lower = filename.lower()
    if lower.endswith((".xlsx", ".xlsm")):
        raw = _read_xlsx(data)
    elif lower.endswith((".csv", ".tsv", ".txt")):
        raw = _read_csv(data)
    elif lower.endswith(".xls"):
        raise DatasetError("Old .xls files aren't supported. Save it as .xlsx or .csv and upload again.")
    else:
        raise DatasetError("Upload a .csv or .xlsx file.")
    name = re.sub(r"\.[a-z0-9]+$", "", filename.strip(), flags=re.I) or "Uploaded data"
    return table_from_rows(raw, id=id, name=name[:120])
