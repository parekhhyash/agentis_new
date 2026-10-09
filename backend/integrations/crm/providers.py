"""The CRMs Agentis connects to over MCP, and how each one signs users in.

- HubSpot and Salesforce: OAuth 2.0 authorization code + PKCE with a client
  the operator registers once (HubSpot "MCP auth app", Salesforce "External
  Client App"); each user then approves access to their own account.
- Zoho CRM: each org's MCP server URL embeds its key (Zoho CRM > Setup >
  Developer Hub > MCP for AI Agents). The user pastes it; Zoho asks them to
  authorise each Zoho service the first time a tool needs it.
"""

import re
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import urlparse

ProviderId = Literal["hubspot", "salesforce", "zoho"]
PROVIDERS: tuple[ProviderId, ...] = ("hubspot", "salesforce", "zoho")
NAMES: dict[str, str] = {"hubspot": "HubSpot", "salesforce": "Salesforce", "zoho": "Zoho CRM"}

# Zoho's MCP hosts per data centre (US, India, EU, Australia, Japan, Canada, China, Saudi Arabia).
_ZOHO_HOST = re.compile(r"(^|\.)(zohomcp|mcp\.zoho)\.(com|in|eu|com\.au|jp|ca|com\.cn|sa)$", re.I)


class CrmError(Exception):
    """A CRM failure with a message that's safe to show, and an HTTP status."""

    def __init__(self, message: str, status: int = 502):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class OAuthProvider:
    id: ProviderId
    mcp_url: str
    authorize_url: str
    token_url: str
    client_id: str
    client_secret: str | None
    scope: str


def redirect_uri(settings: Any) -> str:
    if settings.crm_oauth_redirect_uri:
        return settings.crm_oauth_redirect_uri
    return settings.google_oauth_redirect_uri.replace("/integrations/google/callback", "/integrations/crm/callback")


def is_configured(provider: str, settings: Any) -> bool:
    if not settings.integrations_encryption_key:
        return False
    if provider == "hubspot":
        return bool(settings.hubspot_mcp_client_id and settings.hubspot_mcp_client_secret)
    if provider == "salesforce":
        return bool(settings.salesforce_mcp_client_id)
    return provider == "zoho"


def oauth_provider(provider: str, settings: Any) -> OAuthProvider:
    if provider not in ("hubspot", "salesforce"):
        raise CrmError(f"{NAMES.get(provider, provider)} doesn't use sign-in links", 400)
    if not is_configured(provider, settings):
        raise CrmError(f"{NAMES[provider]} isn't set up on the server yet", 503)
    if provider == "hubspot":
        return OAuthProvider(
            id="hubspot",
            mcp_url=settings.hubspot_mcp_url,
            authorize_url=settings.hubspot_mcp_authorize_url,
            token_url=settings.hubspot_mcp_token_url,
            client_id=settings.hubspot_mcp_client_id,
            client_secret=settings.hubspot_mcp_client_secret,
            scope="",
        )
    login = settings.salesforce_login_url.rstrip("/")
    return OAuthProvider(
        id="salesforce",
        mcp_url=settings.salesforce_mcp_url,
        authorize_url=f"{login}/services/oauth2/authorize",
        token_url=f"{login}/services/oauth2/token",
        client_id=settings.salesforce_mcp_client_id,
        client_secret=settings.salesforce_mcp_client_secret or None,
        scope="mcp_api refresh_token",
    )


def check_zoho_url(url: str) -> str:
    """Only Zoho's own MCP hosts over HTTPS: the backend connects to this URL,
    so anything else would let a user point it at arbitrary servers."""
    url = (url or "").strip()
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.hostname or not _ZOHO_HOST.search(parsed.hostname):
        raise CrmError(
            "Paste the MCP server URL from Zoho CRM (Setup > Developer Hub > MCP for AI Agents); "
            "it starts with https:// and ends in zohomcp.com, zohomcp.in or similar",
            422,
        )
    if parsed.port not in (None, 443) or parsed.username or parsed.password:
        raise CrmError("That doesn't look like a Zoho MCP server URL", 422)
    return url
