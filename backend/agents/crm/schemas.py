"""What a CRM run produces: the lookups it made (read tools, run right away)
and the changes it proposes (write tools, run only when the user approves)."""

from typing import Any, Literal

from pydantic import BaseModel, Field

CrmActionStatus = Literal["draft", "done", "discarded", "failed"]


class CrmCall(BaseModel):
    provider: str
    tool: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    ok: bool = True
    # First few hundred characters of the result, for "what it looked at".
    preview: str = ""


class CrmAction(BaseModel):
    id: str
    provider: str
    tool: str
    arguments: dict[str, Any] = Field(default_factory=dict)
    # Plain-words description shown on the approval card.
    summary: str
    status: CrmActionStatus = "draft"
    result: str | None = None
    error: str | None = None
    done_at: str | None = None
    # Zoho asks the user to authorise a service on first use.
    sign_in_url: str | None = None


class SignIn(BaseModel):
    provider: str
    url: str


class CrmResult(BaseModel):
    providers: list[str] = Field(default_factory=list)
    calls: list[CrmCall] = Field(default_factory=list)
    actions: list[CrmAction] = Field(default_factory=list)
    sign_in: list[SignIn] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
