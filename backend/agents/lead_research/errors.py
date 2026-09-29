class LeadResearchError(Exception):
    """Base for failures the caller should surface to the user."""


class ResearchConfigError(LeadResearchError):
    """A required provider (search, LLM) isn't configured or rejected our credentials."""


class ResearchCancelledError(LeadResearchError):
    """The caller asked the run to stop."""


class ResearchFailedError(LeadResearchError):
    """A stage the pipeline can't proceed without failed (e.g. ICP analysis)."""


class LLMOutputError(LeadResearchError):
    """The model returned something that isn't parseable JSON."""
