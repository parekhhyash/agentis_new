"""Carries out one drafted action after the user approves it."""

from datetime import datetime, timedelta, timezone
from typing import Any, Protocol
from zoneinfo import ZoneInfo

from agents.sales_outreach.agent import is_email, local_iso, resolve_local_time
from agents.sales_outreach.schemas import EmailAction, MeetingAction, OutreachAction, ReplyAction
from integrations.google.calendar import event_body
from integrations.google.gmail import build_raw_message, thread_link


class GmailSender(Protocol):
    async def send(self, raw: str, thread_id: str | None = None) -> dict[str, Any]: ...


class CalendarWriter(Protocol):
    async def create_event(self, body: dict[str, Any]) -> dict[str, Any]: ...


class EditError(ValueError):
    pass


def _addresses(value: Any, field: str, required: bool) -> list[str]:
    if not isinstance(value, list):
        raise EditError(f"{field} must be a list of email addresses")
    cleaned = [str(v).strip().lower() for v in value if str(v).strip()]
    bad = [v for v in cleaned if not is_email(v)]
    if bad:
        raise EditError(f"Not a valid email address: {bad[0]}")
    if required and not cleaned:
        raise EditError(f"Add at least one address to {field}")
    return list(dict.fromkeys(cleaned))


def apply_edits(action: OutreachAction, edits: dict[str, Any]) -> OutreachAction:
    """The user's changes from the review screen. Recipients the user types
    are their own choice, so they only need to be valid addresses."""
    updated = action.model_copy(deep=True)
    if isinstance(updated, EmailAction):
        if "to" in edits:
            updated.to = _addresses(edits["to"], "To", required=True)
        if "cc" in edits:
            updated.cc = _addresses(edits["cc"], "Cc", required=False)
        if "subject" in edits:
            updated.subject = str(edits["subject"]).strip() or "(no subject)"
        if "body" in edits:
            updated.body = str(edits["body"]).strip()
    elif isinstance(updated, ReplyAction):
        if "body" in edits:
            updated.body = str(edits["body"]).strip()
    elif isinstance(updated, MeetingAction):
        tz = ZoneInfo(updated.time_zone)
        if "title" in edits:
            updated.title = str(edits["title"]).strip() or updated.title
        if "attendees" in edits:
            updated.attendees = _addresses(edits["attendees"], "Attendees", required=False)
        if "description" in edits:
            updated.description = str(edits["description"]).strip()
        if "add_meet" in edits:
            updated.add_meet = bool(edits["add_meet"])
        if "start" in edits or "duration_minutes" in edits:
            old_start = resolve_local_time(updated.start, tz)
            duration = resolve_local_time(updated.end, tz) - old_start
            try:
                start = resolve_local_time(str(edits.get("start", updated.start)), tz)
            except ValueError as exc:
                raise EditError("Start time isn't a valid date and time") from exc
            if "duration_minutes" in edits:
                try:
                    duration = timedelta(minutes=max(15, min(int(edits["duration_minutes"]), 480)))
                except (TypeError, ValueError) as exc:
                    raise EditError("Duration must be a number of minutes") from exc
            updated.start, updated.end = local_iso(start), local_iso(start + duration)
    if isinstance(updated, (EmailAction, ReplyAction)) and not updated.body:
        raise EditError("The email body is empty")
    return updated


def gmail_link(account: str, thread_id: str) -> str:
    return thread_link(account, thread_id)


async def execute(
    action: OutreachAction,
    *,
    gmail: GmailSender,
    calendar: CalendarWriter,
    sender_name: str,
    sender_email: str,
) -> OutreachAction:
    done = action.model_copy(deep=True)
    sender = f"{sender_name} <{sender_email}>" if sender_name else sender_email
    if isinstance(done, EmailAction):
        raw = build_raw_message(sender=sender, to=done.to, cc=done.cc, subject=done.subject, body=done.body)
        sent = await gmail.send(raw)
        done.gmail_thread_id = sent.get("threadId")
        done.gmail_link = gmail_link(sender_email, sent["threadId"]) if sent.get("threadId") else None
        done.status = "sent"
    elif isinstance(done, ReplyAction):
        raw = build_raw_message(
            sender=sender, to=done.to, subject=done.subject, body=done.body,
            in_reply_to=done.in_reply_to, references=done.references,
        )
        sent = await gmail.send(raw, thread_id=done.thread_id)
        done.gmail_link = gmail_link(sender_email, sent.get("threadId") or done.thread_id)
        done.status = "sent"
    elif isinstance(done, MeetingAction):
        event = await calendar.create_event(
            event_body(
                title=done.title, start=done.start, end=done.end, time_zone=done.time_zone,
                attendees=done.attendees, description=done.description, add_meet=done.add_meet,
            )
        )
        done.event_link = event.get("htmlLink")
        done.meet_link = event.get("hangoutLink")
        done.status = "scheduled"
    done.error = None
    done.done_at = datetime.now(timezone.utc).isoformat()
    return done
