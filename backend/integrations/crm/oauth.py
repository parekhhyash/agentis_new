"""OAuth 2.0 authorization code flow with PKCE for CRM MCP servers. The
PKCE verifier travels encrypted in `state` (see integrations/oauth_common.py)."""

import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx
from cryptography.fernet import Fernet

from integrations import oauth_common
from integrations.crm.providers import NAMES, CrmError, OAuthProvider


@dataclass
class TokenGrant:
    access_token: str
    refresh_token: str | None
    expires_in: int
    raw: dict[str, Any]


def fernet(secret_key: str) -> Fernet:
    try:
        return Fernet(secret_key.encode())
    except (ValueError, TypeError) as exc:
        raise CrmError("INTEGRATIONS_ENCRYPTION_KEY is not a valid Fernet key", 503) from exc


pkce_pair = oauth_common.pkce_pair


def make_state(secret_key: str, user_id: str, provider: str, verifier: str) -> str:
    return oauth_common.seal_state(fernet(secret_key), user_id, provider, verifier)


def read_state(secret_key: str, state: str) -> dict[str, str]:
    try:
        return oauth_common.open_state(fernet(secret_key), state)
    except oauth_common.StateError as exc:
        raise CrmError(str(exc), 400) from None


def authorize_url(provider: OAuthProvider, redirect_uri: str, state: str, challenge: str) -> str:
    params = {
        "response_type": "code",
        "client_id": provider.client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    }
    if provider.scope:
        params["scope"] = provider.scope
    if provider.id == "salesforce":
        params["prompt"] = "login consent"
    return f"{provider.authorize_url}?{urlencode(params)}"


async def _token_request(provider: OAuthProvider, form: dict[str, str], client: httpx.AsyncClient) -> TokenGrant:
    form = {**form, "client_id": provider.client_id}
    if provider.client_secret:
        form["client_secret"] = provider.client_secret
    response = await client.post(provider.token_url, data=form, headers={"Accept": "application/json"})
    try:
        data = response.json()
    except ValueError:
        data = {}
    if response.status_code >= 400 or not data.get("access_token"):
        error = data.get("error_description") or data.get("error") or f"HTTP {response.status_code}"
        status = 401 if data.get("error") in ("invalid_grant", "invalid_token") else 502
        raise CrmError(f"{NAMES[provider.id]} sign-in failed: {error}", status)
    return TokenGrant(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        expires_in=int(data.get("expires_in") or 1800),
        raw=data,
    )


async def exchange_code(provider: OAuthProvider, code: str, verifier: str, redirect_uri: str, client: httpx.AsyncClient) -> TokenGrant:
    return await _token_request(
        provider,
        {"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri, "code_verifier": verifier},
        client,
    )


async def refresh(provider: OAuthProvider, refresh_token: str, client: httpx.AsyncClient) -> TokenGrant:
    return await _token_request(provider, {"grant_type": "refresh_token", "refresh_token": refresh_token}, client)


def account_label(provider: str, grant: TokenGrant) -> str:
    """Something recognisable for "Connected as ..." from the token response."""
    raw = grant.raw
    if provider == "salesforce" and raw.get("instance_url"):
        return str(raw["instance_url"]).removeprefix("https://")
    for key in ("hub_domain", "user", "email", "hub_id", "portal_id"):
        if raw.get(key):
            return f"Account {raw[key]}" if key in ("hub_id", "portal_id") else str(raw[key])
    return f"{NAMES[provider]} account"


def expires_at(grant: TokenGrant) -> float:
    return time.time() + max(60, grant.expires_in)
