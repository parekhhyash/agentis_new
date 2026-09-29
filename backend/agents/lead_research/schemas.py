from typing import Literal

from pydantic import BaseModel, Field, field_validator


class DiscoveryQuery(BaseModel):
    query: str
    angle: str = "company"


class ICP(BaseModel):
    """What the ICPAnalyzer extracts from the request + seller context. Lenient
    on input since it comes straight from an LLM."""

    num_leads: int = 10
    summary: str = ""
    industries: list[str] = Field(default_factory=list)
    geographies: list[str] = Field(default_factory=list)
    company_size: str | None = None
    must_have: list[str] = Field(default_factory=list)
    nice_to_have: list[str] = Field(default_factory=list)
    exclusions: list[str] = Field(default_factory=list)
    use_case: str = ""
    signals: list[str] = Field(default_factory=list)
    target_roles: list[str] = Field(default_factory=list)
    discovery_queries: list[DiscoveryQuery] = Field(default_factory=list)
    fallback_queries: list[str] = Field(default_factory=list)

    @field_validator("num_leads", mode="before")
    @classmethod
    def _coerce_num_leads(cls, value: object) -> int:
        try:
            return max(1, int(value))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return 10

    @field_validator("discovery_queries", mode="before")
    @classmethod
    def _coerce_queries(cls, value: object) -> list:
        if not isinstance(value, list):
            return []
        return [{"query": item} if isinstance(item, str) else item for item in value]

    @field_validator(
        "industries", "geographies", "must_have", "nice_to_have", "exclusions",
        "signals", "target_roles", "fallback_queries", mode="before",
    )
    @classmethod
    def _coerce_str_list(cls, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            return [value] if value.strip() else []
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v).strip()]
        return []


class Evidence(BaseModel):
    claim: str
    source_url: str
    status: Literal["verified", "likely"]


class Contact(BaseModel):
    name: str
    title: str
    company: str
    linkedin_url: str | None = None
    email: str | None = None
    email_verified: bool = False
    source_url: str


class Qualification(BaseModel):
    icp_match: bool
    industry_match: bool | None = None
    geography_match: bool | None = None
    size_match: Literal["verified", "likely", "unknown", "mismatch"] = "unknown"
    use_case_match: bool | None = None
    growth_signal: bool | None = None
    contact_found: bool = False


class Lead(BaseModel):
    company_name: str
    website: str
    industry: str | None = None
    location: str | None = None
    employee_count: str | None = None
    qualification: str
    why_relevant: str
    relevant_signals: list[str] = Field(default_factory=list)
    qualification_detail: Qualification
    evidence: list[Evidence] = Field(default_factory=list)
    contacts: list[Contact] = Field(default_factory=list)
    company_emails: list[str] = Field(default_factory=list)
    contact_page: str | None = None
    sources: list[str] = Field(default_factory=list)


class ICPSummary(BaseModel):
    summary: str
    industries: list[str] = Field(default_factory=list)
    geographies: list[str] = Field(default_factory=list)
    company_size: str | None = None
    target_roles: list[str] = Field(default_factory=list)
    signals: list[str] = Field(default_factory=list)


class ResearchUsage(BaseModel):
    searches: int = 0
    scrapes: int = 0
    llm_calls: int = 0
    tokens: int = 0
    runtime_seconds: float = 0.0
    search_cost_usd: float = 0.0


class LeadResearchResult(BaseModel):
    query: str
    icp: ICPSummary
    requested_leads: int
    leads_found: int
    leads: list[Lead]
    notes: str | None = None
    usage: ResearchUsage
