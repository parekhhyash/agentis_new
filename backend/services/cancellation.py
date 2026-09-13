"""Cooperative cancellation for in-flight sales agent runs.

The agent run lives entirely in-process for the duration of one request
(see services/agent_runner.py), so there's nothing to "kill" from outside
it - the runner itself has to notice a cancellation request and stop
early. This module is just a shared in-memory flag set by the API layer
(on POST /sales-agent/cancel) and polled by the runner between ADK events.

A plain in-memory set is fine here: one backend process, no need for this
to survive a restart, and a stale entry left behind by a run that finishes
normally is cleaned up by that same run's `finally` block.
"""

_cancelled_request_ids: set[str] = set()


def request_cancellation(request_id: str) -> None:
    _cancelled_request_ids.add(request_id)


def is_cancelled(request_id: str | None) -> bool:
    if not request_id:
        return False
    return request_id in _cancelled_request_ids


def clear_cancellation(request_id: str | None) -> None:
    if not request_id:
        return
    _cancelled_request_ids.discard(request_id)
