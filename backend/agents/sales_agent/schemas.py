from pydantic import BaseModel, Field


class SearchCriteria(BaseModel):
    """The agent's own understanding of the request, echoed back in the
    response so the caller can see how it interpreted an ambiguous ask."""

    industry: str | None = Field(
        default=None, description="Target industry/vertical, if specified or inferable."
    )
    geography: str | None = Field(
        default=None, description="Target country/region/city, if specified."
    )
    company_stage: str | None = Field(
        default=None,
        description="Target company size or stage, e.g. 'early-stage startup', 'SMB', 'enterprise'.",
    )
    use_case: str | None = Field(
        default=None, description="The product/use case the leads are being sourced for."
    )
    num_leads_requested: int = Field(
        description="Number of leads the user asked for (default assumed if not stated)."
    )
    other_criteria: list[str] = Field(
        default_factory=list,
        description="Any other constraints mentioned in the request (e.g. funding stage, tech stack).",
    )


class Lead(BaseModel):
    company_name: str
    website: str | None = None
    industry: str | None = None
    description: str | None = Field(default=None, description="Short description of what the company does.")
    location: str | None = None
    company_size: str | None = Field(
        default=None, description="Estimated size/stage, only if publicly stated somewhere."
    )
    relevant_product_service: str | None = Field(
        default=None, description="The company's product/service relevant to this search."
    )
    potential_pain_point: str | None = None
    why_good_fit: str | None = Field(
        default=None, description="Why this lead is a good fit for the user's product."
    )
    business_email: str | None = Field(
        default=None,
        description="A public business contact email actually found on the company's site. Never invented.",
    )
    contact_page: str | None = Field(
        default=None, description="URL of a contact/about page actually found, if any."
    )
    qualification_score: int = Field(ge=0, le=100)
    reasoning: str = Field(description="Short explanation for the qualification score.")
    sources: list[str] = Field(
        default_factory=list, description="URLs actually visited/consulted for this lead."
    )
    inferred_fields: list[str] = Field(
        default_factory=list,
        description=(
            "Names of fields above whose value is a reasonable inference rather than something "
            "stated outright on the source pages (e.g. inferring company_size from headcount on "
            "LinkedIn wording). Fields not listed here that are non-null were read directly from a "
            "source. Fields that could not be determined at all are left null instead of guessed."
        ),
    )


class LeadGenerationResult(BaseModel):
    query: str = Field(description="The original natural-language request.")
    criteria: SearchCriteria
    leads_found: int
    leads: list[Lead]
    notes: str | None = Field(
        default=None,
        description=(
            "Any caveats, e.g. fewer leads returned than requested, or criteria that "
            "narrowed the results."
        ),
    )
