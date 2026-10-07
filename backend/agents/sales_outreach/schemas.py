"""Output of the Sales & Outreach agent: a set of drafted Gmail/Calendar
actions the user reviews. Nothing is sent or scheduled until the user
approves an action (see executor.py)."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field

ActionStatus = Literal["draft", "sent", "scheduled", "discarded", "failed"]


class _Action(BaseModel):
    id: str
    status: ActionStatus = "draft"
    error: str | None = None
    # Why the agent drafted this (shown to the user while reviewing).
    rationale: str | None = None


class EmailAction(_Action):
    type: Literal["email"] = "email"
    to: list[str]
    cc: list[str] = Field(default_factory=list)
    subject: str
    body: str
    gmail_thread_id: str | None = None
    gmail_link: str | None = None


class ReplyAction(_Action):
    type: Literal["reply"] = "reply"
    thread_id: str
    to: list[str]
    subject: str
    body: str
    # The message being replied to, for context in the review UI.
    original_from: str
    original_date: str
    original_snippet: str
    in_reply_to: str | None = None
    references: str | None = None
    gmail_link: str | None = None


class MeetingAction(_Action):
    type: Literal["meeting"] = "meeting"
    title: str
    attendees: list[str]
    # Local wall-clock times in `time_zone`, "YYYY-MM-DDTHH:MM:SS".
    start: str
    end: str
    time_zone: str
    description: str = ""
    add_meet: bool = True
    conflicts: list[str] = Field(default_factory=list)
    event_link: str | None = None
    meet_link: str | None = None


OutreachAction = Annotated[EmailAction | ReplyAction | MeetingAction, Field(discriminator="type")]


class ReplyCheck(BaseModel):
    """Whether someone answered an email sent through Agentis."""

    thread_id: str
    to: list[str] = Field(default_factory=list)
    subject: str = ""
    replied: bool = False
    # Their message is the latest in the thread, so it still needs an answer.
    awaiting_you: bool = False
    reply_from: str | None = None
    reply_at: str | None = None
    reply_snippet: str | None = None
    gmail_link: str | None = None


class OutreachUsage(BaseModel):
    llm_calls: int = 0
    llm_tokens: int = 0
    threads_read: int = 0


class OutreachResult(BaseModel):
    kind: Literal["sales_outreach"] = "sales_outreach"
    query: str = ""
    summary: str
    sender_email: str
    sender_name: str = ""
    time_zone: str
    actions: list[OutreachAction] = Field(default_factory=list)
    # Things the agent couldn't do or needs from the user (missing address,
    # no matching thread, ...).
    notes: list[str] = Field(default_factory=list)
    # Filled by "check for replies": one entry per sent email that was checked.
    reply_checks: list[ReplyCheck] = Field(default_factory=list)
    replies_checked_at: str | None = None
    usage: OutreachUsage = Field(default_factory=OutreachUsage)
