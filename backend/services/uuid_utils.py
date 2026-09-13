"""Shared validation for request_id, which always originates from the public
API's request body - an attacker-controlled string used with the service
role key (bypasses RLS), so anything that touches it must confirm it's
actually a UUID (matching agent_requests.id's column type) first.
"""

import uuid


def is_valid_request_id(value: str | None) -> bool:
    if not value:
        return False
    try:
        uuid.UUID(value)
    except ValueError:
        return False
    return True
