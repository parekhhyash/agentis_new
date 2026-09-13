class AgentTimeoutError(Exception):
    """The agent pipeline did not finish within the configured time budget."""


class AgentOutputError(Exception):
    """The agent finished but its final output wasn't valid/parseable."""


class AgentCancelledError(Exception):
    """The caller requested cancellation before the agent run finished."""
