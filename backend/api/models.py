from pydantic import BaseModel, Field


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
