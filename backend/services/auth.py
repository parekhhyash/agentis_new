"""Authenticates API callers with their Supabase session.

Endpoints that act on a user's own data (their Google account, their agent
requests) take `user: AuthUser = Depends(current_user)` and must scope every
read and write to `user.id`.
"""

import logging
from dataclasses import dataclass

from fastapi import Header, HTTPException

from services import supabase_rest

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None


async def current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in to use this endpoint")
    token = authorization.split(" ", 1)[1].strip()
    try:
        user = await supabase_rest.get_auth_user(token)
    except supabase_rest.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not verify a caller's session", exc_info=True)
        raise HTTPException(status_code=503, detail="Could not verify your session, try again") from exc
    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Your session has expired, sign in again")
    return AuthUser(id=user["id"], email=user.get("email"))
