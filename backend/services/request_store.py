"""Persists the final outcome of a sales agent run directly to Supabase from
the backend itself.

Until now, `agent_requests.status`/`result`/`error` were only ever written
by the requesting browser tab, after its own fetch() to /generate-leads
resolved. That means a deploy restart, a dropped connection, or the user
just closing the tab mid-run leaves the row stuck at 'in_progress' forever
- there's nothing else that would ever flip it to 'completed' or 'failed',
so the UI shows "Working on it..." indefinitely with no way to recover.

Calling this from the backend (which keeps running the request regardless
of what happens to the HTTP response) means the row gets a real terminal
status as long as the process itself is still alive to finish - the
frontend's own write becomes a redundant fast-path rather than the only
path. Uses the service role key since this runs with no user session to
bypass RLS with; best-effort only, a failed write here must never mask
the actual run outcome from the HTTP caller.
"""

import logging
from typing import Any

import httpx

from config.settings import get_settings
from services.uuid_utils import is_valid_request_id

logger = logging.getLogger(__name__)


async def finalize_request(
    request_id: str | None,
    *,
    status: str,
    result: dict[str, Any] | None = None,
    error: str | None = None,
) -> None:
    if not is_valid_request_id(request_id):
        return

    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return

    body: dict[str, Any] = {"status": status}
    if result is not None:
        body["result"] = result
    if error is not None:
        body["error"] = error

    url = f"{settings.supabase_url}/rest/v1/agent_requests"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.patch(
                url, headers=headers, params={"id": f"eq.{request_id}"}, json=body
            )
            response.raise_for_status()
    except Exception:  # noqa: BLE001 - must never break the caller's own error handling
        logger.warning(
            "Failed to persist final status=%r for request_id=%s", status, request_id,
            exc_info=True,
        )
