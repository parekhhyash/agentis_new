"""Pushes live step-by-step progress for one agent run back to Supabase.

The frontend already owns the `agent_requests` row's lifecycle (queued /
in_progress / completed / failed, and the final result) - this only ever
touches the `progress` column, as a side channel so a long run isn't a
silent black box while it's happening. Uses the service role key since this
runs with no user session to bypass RLS with; best-effort only, a failed
write here must never break the actual agent run.
"""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from config.settings import get_settings
from services.uuid_utils import is_valid_request_id

logger = logging.getLogger(__name__)

# Capped so the JSON payload (and the row) doesn't grow unbounded on a long,
# many-tool-call run - only the tail is useful for "what's it doing right
# now" anyway.
_MAX_STEPS = 40


class ProgressTracker:
    """Accumulates step labels for one request and reports them to Supabase."""

    def __init__(self, request_id: str | None) -> None:
        # request_id comes straight from the public API's request body - an
        # attacker-controlled string. It's used with the service role key,
        # which bypasses RLS entirely, so validating it's actually a UUID
        # (matching the agent_requests.id column type) before it goes
        # anywhere near a request URL is not optional here.
        self._request_id = request_id if is_valid_request_id(request_id) else None
        self._steps: list[dict[str, str]] = []

    async def add_step(self, label: str) -> None:
        self._steps.append(
            {"label": label, "at": datetime.now(timezone.utc).isoformat()}
        )
        del self._steps[:-_MAX_STEPS]
        await self._report()

    async def _report(self) -> None:
        if not self._request_id:
            return

        settings = get_settings()
        if not settings.supabase_url or not settings.supabase_service_role_key:
            return

        url = f"{settings.supabase_url}/rest/v1/agent_requests"
        headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        body: dict[str, Any] = {
            "progress": {
                "current_step": self._steps[-1]["label"] if self._steps else None,
                "steps": self._steps,
            }
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # params= lets httpx encode the value instead of it being
                # concatenated straight into the URL - the second guard
                # against a crafted id smuggling extra query-string content
                # into a request made with an RLS-bypassing key.
                response = await client.patch(
                    url,
                    headers=headers,
                    params={"id": f"eq.{self._request_id}"},
                    json=body,
                )
                response.raise_for_status()
        except Exception:  # noqa: BLE001 - progress reporting must never break the run
            logger.warning(
                "Failed to report progress for request_id=%s", self._request_id,
                exc_info=True,
            )
