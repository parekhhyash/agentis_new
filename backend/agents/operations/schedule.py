"""When a scheduled task runs: a small schedule format, checked by code, the
next run time in the user's own time zone, and a plain description of it.

The model writes schedules as JSON; nothing here trusts it. Times are local
wall-clock times in `timezone`, so "every Monday at 9" stays at 9 across
daylight-saving changes.
"""

import re
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from typing import Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel

DAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
DAY_NAMES = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
WEEKDAYS = list(DAYS[:5])
KINDS = ("once", "daily", "weekly", "monthly")
LAST_DAY = -1
DEFAULT_TIME = "09:00"


class ScheduleError(ValueError):
    pass


class Schedule(BaseModel):
    kind: Literal["once", "daily", "weekly", "monthly"]
    time: str = DEFAULT_TIME
    # weekly: which days, in week order
    days: list[str] = []
    # monthly: 1-31 (shorter months use their last day) or -1 for the last day
    day_of_month: int | None = None
    # once: YYYY-MM-DD
    date: str | None = None
    timezone: str = "UTC"


def valid_time_zone(name: str | None, fallback: str = "UTC") -> str:
    try:
        return str(ZoneInfo(name)) if name else fallback
    except (ZoneInfoNotFoundError, ValueError):
        return fallback


def _clock(value: Any) -> str:
    text = str(value or DEFAULT_TIME).strip().lower().replace(".", ":")
    match = re.fullmatch(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)?", text)
    if not match:
        raise ScheduleError(f'time "{value}" must be HH:MM in 24-hour time, like "09:00" or "18:30"')
    hour, minute, half = int(match.group(1)), int(match.group(2) or 0), match.group(3)
    if half:
        if not 1 <= hour <= 12:
            raise ScheduleError(f'time "{value}" is not a valid time')
        hour = hour % 12 + (12 if half == "pm" else 0)
    if hour > 23 or minute > 59:
        raise ScheduleError(f'time "{value}" is not a valid time')
    return f"{hour:02d}:{minute:02d}"


def _days(value: Any) -> list[str]:
    items = value if isinstance(value, list) else [value] if value else []
    days: set[str] = set()
    for item in items:
        word = str(item).strip().lower()
        if word in ("weekday", "weekdays"):
            days.update(WEEKDAYS)
        elif word in ("weekend", "weekends"):
            days.update(("sat", "sun"))
        elif word[:3] in DAYS:
            days.add(word[:3])
        else:
            raise ScheduleError(f'"{item}" is not a day; use mon, tue, wed, thu, fri, sat or sun')
    if not days:
        raise ScheduleError('a weekly schedule needs "days", like ["mon"]')
    return [d for d in DAYS if d in days]


def parse(raw: Any, default_time_zone: str) -> Schedule:
    """A checked Schedule from the model's JSON, or ScheduleError saying what's wrong."""
    if not isinstance(raw, dict):
        raise ScheduleError("schedule must be an object")
    kind = str(raw.get("kind") or "").strip().lower()
    if kind not in KINDS:
        raise ScheduleError(f'schedule kind "{kind}" must be once, daily, weekly or monthly (nothing runs more often than daily)')
    tz_name = raw.get("timezone") or default_time_zone
    tz = valid_time_zone(str(tz_name), "")
    if not tz:
        raise ScheduleError(f'"{tz_name}" is not a time zone; use an IANA name like "Asia/Kolkata"')
    schedule = Schedule(kind=kind, time=_clock(raw.get("time")), timezone=tz)  # type: ignore[arg-type]
    if kind == "weekly":
        schedule.days = _days(raw.get("days"))
        if len(schedule.days) == 7:
            schedule.kind, schedule.days = "daily", []
    elif kind == "monthly":
        value = raw.get("day_of_month")
        if str(value).strip().lower() == "last":
            value = LAST_DAY
        try:
            day = int(value)
        except (TypeError, ValueError):
            raise ScheduleError('a monthly schedule needs "day_of_month": 1-31, or -1 for the last day') from None
        if day != LAST_DAY and not 1 <= day <= 31:
            raise ScheduleError(f"day_of_month {day} must be 1-31, or -1 for the last day")
        schedule.day_of_month = day
    elif kind == "once":
        try:
            schedule.date = date.fromisoformat(str(raw.get("date") or "")).isoformat()
        except ValueError:
            raise ScheduleError('a one-time schedule needs "date" as YYYY-MM-DD') from None
    return schedule


def _at(day: date, clock: str, tz: ZoneInfo) -> datetime:
    hour, minute = (int(p) for p in clock.split(":"))
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz).astimezone(timezone.utc)


def _runs_on(schedule: Schedule, day: date) -> bool:
    if schedule.kind == "daily":
        return True
    if schedule.kind == "weekly":
        return DAYS[day.weekday()] in schedule.days
    if schedule.kind == "monthly":
        last = monthrange(day.year, day.month)[1]
        wanted = last if schedule.day_of_month == LAST_DAY else min(schedule.day_of_month or 1, last)
        return day.day == wanted
    return False


def next_run(schedule: Schedule, after: datetime) -> datetime | None:
    """The first run strictly after `after` (UTC), or None if there are no more."""
    tz = ZoneInfo(schedule.timezone)
    if schedule.kind == "once":
        at = _at(date.fromisoformat(schedule.date or ""), schedule.time, tz)
        return at if at > after else None
    start = after.astimezone(tz).date()
    for offset in range(0, 370):
        day = start + timedelta(days=offset)
        if _runs_on(schedule, day):
            at = _at(day, schedule.time, tz)
            if at > after:
                return at
    return None


def upcoming(schedule: Schedule, after: datetime, count: int = 3) -> list[datetime]:
    runs: list[datetime] = []
    while len(runs) < count:
        at = next_run(schedule, runs[-1] if runs else after)
        if at is None:
            break
        runs.append(at)
    return runs


def clock_text(clock: str) -> str:
    hour, minute = (int(p) for p in clock.split(":"))
    return f"{hour % 12 or 12}:{minute:02d} {'AM' if hour < 12 else 'PM'}"


def _ordinal(n: int) -> str:
    suffix = "th" if 10 <= n % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _join(words: list[str]) -> str:
    return words[0] if len(words) == 1 else ", ".join(words[:-1]) + " and " + words[-1]


def describe(schedule: Schedule) -> str:
    at = clock_text(schedule.time)
    if schedule.kind == "daily":
        return f"Every day at {at}"
    if schedule.kind == "weekly":
        if schedule.days == WEEKDAYS:
            return f"Every weekday at {at}"
        if schedule.days == ["sat", "sun"]:
            return f"Every Saturday and Sunday at {at}"
        return f"Every {_join([DAY_NAMES[DAYS.index(d)] for d in schedule.days])} at {at}"
    if schedule.kind == "monthly":
        day = schedule.day_of_month or 1
        if day == LAST_DAY:
            return f"On the last day of every month at {at}"
        shorter = " (or the last day, in shorter months)" if day > 28 else ""
        return f"On the {_ordinal(day)} of every month{shorter} at {at}"
    when = date.fromisoformat(schedule.date or "")
    return f"Once, on {DAY_NAMES[when.weekday()]} {when.day} {when.strftime('%B %Y')} at {at}"


def local_text(moment: datetime, time_zone: str) -> str:
    """A run time as the user reads it: "Mon 13 Oct, 9:00 AM"."""
    local = moment.astimezone(ZoneInfo(valid_time_zone(time_zone)))
    return f"{local.strftime('%a')} {local.day} {local.strftime('%b')}, {clock_text(local.strftime('%H:%M'))}"
