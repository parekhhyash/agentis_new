"""Connecting the user's Google account (Gmail + Calendar).

Flow: the web app calls GET /integrations/google/auth-url with the user's
Supabase session, sends the browser to the returned Google consent URL,
Google redirects to /integrations/google/callback, and the callback stores
the grant and sends the browser back to the dashboard.
"""

import logging
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from config.settings import get_settings
from integrations.google import connections, oauth
from integrations.google.errors import GoogleConfigError, GoogleIntegrationError
from services.auth import AuthUser, current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations/google", tags=["integrations"])


def _config() -> oauth.OAuthConfig:
    try:
        return oauth.oauth_config(get_settings())
    except GoogleConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _back_to_app(status: str, message: str | None = None) -> RedirectResponse:
    params = {"google": status}
    if message:
        params["message"] = message
    # The app uses a HashRouter, so the route and its query live after '#'.
    url = f"{get_settings().frontend_url.rstrip('/')}/#/dashboard?{urlencode(params)}"
    return RedirectResponse(url, status_code=302)


@router.get("/status")
async def google_status(user: AuthUser = Depends(current_user)) -> dict:
    settings = get_settings()
    configured = bool(
        settings.google_oauth_client_id and settings.google_oauth_client_secret and settings.integrations_encryption_key
    )
    connection = await connections.get_connection(user.id) if configured else None
    return {
        "configured": configured,
        "connected": connection is not None,
        "email": connection.email if connection else None,
        "scopes": connection.scopes if connection else [],
    }


@router.get("/auth-url")
async def google_auth_url(user: AuthUser = Depends(current_user)) -> dict:
    config = _config()
    state = oauth.sign_state(user.id, config.secret_key)
    return {"url": oauth.build_auth_url(config, state, login_hint=user.email)}


@router.get("/callback", include_in_schema=False)
async def google_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error:
        return _back_to_app("error", "Google access was not granted" if error == "access_denied" else error)
    if not code or not state:
        return _back_to_app("error", "Missing sign-in details from Google")
    try:
        config = oauth.oauth_config(get_settings())
        user_id = oauth.verify_state(state, config.secret_key)
        async with httpx.AsyncClient(timeout=15.0) as client:
            grant = await oauth.exchange_code(config, code, client)
            missing = oauth.REQUIRED_SCOPES - set(grant.scopes)
            if missing:
                return _back_to_app(
                    "error", "Please allow Gmail and Calendar access (tick every box on Google's screen) and try again"
                )
            if not grant.refresh_token:
                return _back_to_app("error", "Google didn't return offline access, try connecting again")
            email = await oauth.fetch_email(grant.access_token, client)
        await connections.save_connection(config, user_id, email, grant.scopes, grant.refresh_token)
    except GoogleIntegrationError as exc:
        return _back_to_app("error", str(exc))
    except Exception:  # noqa: BLE001
        logger.exception("Google OAuth callback failed")
        return _back_to_app("error", "Something went wrong connecting Google")
    return _back_to_app("connected")


@router.delete("")
async def google_disconnect(user: AuthUser = Depends(current_user)) -> dict:
    try:
        config = oauth.oauth_config(get_settings())
    except GoogleConfigError:
        config = None
    await connections.delete_connection(config, user.id)
    return {"connected": False}
