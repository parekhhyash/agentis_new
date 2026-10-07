class GoogleIntegrationError(Exception):
    """Base for Google connection/API failures the user should see."""


class GoogleConfigError(GoogleIntegrationError):
    """The backend isn't configured for Google OAuth (client id/secret, encryption key)."""


class GoogleNotConnectedError(GoogleIntegrationError):
    """The user hasn't connected a Google account."""


class GoogleAuthExpiredError(GoogleIntegrationError):
    """The stored grant was revoked or expired; the user has to reconnect."""


class GoogleAPIError(GoogleIntegrationError):
    """Gmail/Calendar returned an error for a request."""

    def __init__(self, status: int, message: str):
        super().__init__(f"Google API error ({status}): {message}")
        self.status = status
