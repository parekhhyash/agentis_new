from agents.lead_research.budget import ResearchBudget
from agents.lead_research.domains import (
    company_name_from_title,
    names_match,
    normalize_url,
    root_domain,
)
from agents.lead_research.icp import QueryGenerator


def test_root_domain_handles_subdomains_and_multi_part_suffixes():
    assert root_domain("https://www.example.com/about") == "example.com"
    assert root_domain("https://careers.example.co.in/jobs") == "example.co.in"
    assert root_domain("shop.brand.co.uk") == "brand.co.uk"


def test_normalize_url_collapses_trivial_variants():
    assert normalize_url("https://WWW.Example.com/about/?utm=1#team") == "https://example.com/about"


def test_names_match_ignores_legal_suffixes_but_not_partial_words():
    assert names_match("Alpha Fintech", "Alpha Fintech Pvt. Ltd.")
    assert names_match("Razorpay", "Razorpay Software Private Limited")
    assert not names_match("Alpha", "Alphabet")


def test_company_name_from_title_falls_back_to_domain():
    assert company_name_from_title("Acme | Payments for India", "acme.in") == "Acme"
    assert company_name_from_title(None, "zeta.com") == "Zeta"


def test_budget_scales_down_for_small_requests():
    base = ResearchBudget()
    small = base.scaled(5)
    large = base.scaled(15)
    assert small.requested_leads == 5
    assert small.max_filtered_candidates < large.max_filtered_candidates <= base.max_filtered_candidates
    assert small.max_unique_candidates < base.max_unique_candidates
    assert small.max_discovery_queries <= base.max_discovery_queries
    assert base.scaled(500).requested_leads == base.max_leads


def test_query_generator_drops_near_duplicates_and_caps():
    queries = [
        "Indian fintech companies 50-500 employees",
        "indian fintech companies  50-500 employees",
        "Indian fintech startups hiring customer support",
        "  ",
        "Indian lending apps that raised Series B",
    ]
    chosen = QueryGenerator.select(queries, limit=2)
    assert chosen == ["Indian fintech companies 50-500 employees", "Indian fintech startups hiring customer support"]
