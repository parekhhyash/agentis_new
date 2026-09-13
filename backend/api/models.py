from pydantic import BaseModel, Field


class CompanyContext(BaseModel):
    """The requesting user's own company, from their Supabase profile - who
    they are, not a lead. Lets the researcher judge product-market fit
    against a real business instead of guessing from the query alone."""

    company_name: str | None = None
    company_website: str | None = None
    industry: str | None = None
    company_size: str | None = None
    company_description: str | None = None


class LeadGenerationRequest(BaseModel):
    query: str = Field(
        min_length=10,
        max_length=2000,
        description="Natural-language lead-generation request.",
        examples=[
            "Find 10 potential customers for my AI automation product. "
            "Focus on startups in India that are likely to need "
            "customer-support or sales automation."
        ],
    )
    request_id: str | None = Field(
        default=None,
        description=(
            "The agent_requests row's id, if the caller wants live "
            "progress reported back to Supabase as the run executes. "
            "Optional - the run works identically without it."
        ),
    )
    company_context: CompanyContext | None = Field(
        default=None,
        description="The requesting user's own company profile, if available.",
    )
