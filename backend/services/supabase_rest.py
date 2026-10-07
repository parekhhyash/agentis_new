"""Minimal Supabase PostgREST + Auth access with the service role key.

The service role key bypasses RLS, so every caller is responsible for
scoping queries to the authenticated user (filters are always passed via
`params`, never concatenated into the URL).
"""

import logging
from typing import Any

import httpx

from config.settings import get_settings

logger = logging.getLogger(__name__)


class SupabaseNotConfiguredError(Exception):
    pass


def _base() -> tuple[str, dict[str, str]]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise SupabaseNotConfiguredError("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured on the backend")
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    return settings.supabase_url.rstrip("/"), headers


async def select(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    url, headers = _base()
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{url}/rest/v1/{table}", headers=headers, params=params)
        response.raise_for_status()
        return response.json()


async def select_one(table: str, params: dict[str, str]) -> dict[str, Any] | None:
    rows = await select(table, {**params, "limit": "1"})
    return rows[0] if rows else None


async def upsert(table: str, row: dict[str, Any], on_conflict: str) -> None:
    url, headers = _base()
    headers = {**headers, "Prefer": "resolution=merge-duplicates,return=minimal"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            f"{url}/rest/v1/{table}", headers=headers, params={"on_conflict": on_conflict}, json=row
        )
        response.raise_for_status()


async def update(table: str, params: dict[str, str], patch: dict[str, Any]) -> None:
    url, headers = _base()
    headers = {**headers, "Prefer": "return=minimal"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.patch(f"{url}/rest/v1/{table}", headers=headers, params=params, json=patch)
        response.raise_for_status()


async def delete(table: str, params: dict[str, str]) -> None:
    url, headers = _base()
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.delete(f"{url}/rest/v1/{table}", headers=headers, params=params)
        response.raise_for_status()


async def get_auth_user(access_token: str) -> dict[str, Any] | None:
    """Resolves a user's Supabase access token to their auth user, or None if
    the token is invalid or expired. Asking Supabase (rather than verifying
    the JWT locally) works with any signing-key setup the project uses."""
    url, headers = _base()
    headers = {**headers, "Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(f"{url}/auth/v1/user", headers=headers)
    if response.status_code in (401, 403):
        return None
    response.raise_for_status()
    return response.json()
