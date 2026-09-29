from agents.lead_research.contacts import contact_from_hit, role_score
from agents.lead_research.search_provider import SearchHit

ROLES = ["Head of Customer Support", "VP Customer Experience", "COO", "Founder"]


def test_role_score_ranks_exact_then_seniority_matches():
    assert role_score("Head of Customer Support", ROLES) == 100
    assert role_score("Vice President, Customer Experience", ROLES) == 65
    assert role_score("COO & Co-Founder", ROLES) == 90
    assert role_score("Co-Founder", ROLES) > 0
    assert role_score("Customer Support Associate", ROLES) == 0
    assert role_score("Cooperative Relations Lead", ["COO"]) == 0


def _person(url, title=None, entity=None):
    return SearchHit(url=url, title=title, snippet="", entity_type="person" if entity else None, entity=entity or {})


def test_current_role_from_work_history_is_accepted():
    entity = {
        "name": "Bob Rao",
        "workHistory": [
            {"title": "COO", "company": {"name": "Alpha Fintech Pvt Ltd"}, "dates": {"from": "2021-01-01", "to": None}},
        ],
    }
    contact, score = contact_from_hit(_person("https://www.linkedin.com/in/bob", entity=entity), "Alpha Fintech", ROLES)
    assert (contact.name, contact.title, contact.company) == ("Bob Rao", "COO", "Alpha Fintech")
    assert contact.linkedin_url == "https://www.linkedin.com/in/bob"
    assert contact.email is None and contact.email_verified is False
    assert score > 0


def test_past_role_is_rejected():
    entity = {
        "name": "Old Exec",
        "workHistory": [
            {"title": "COO", "company": {"name": "Alpha Fintech"}, "dates": {"from": "2018-01-01", "to": "2022-01-01"}},
            {"title": "COO", "company": {"name": "Other Co"}, "dates": {"from": "2022-02-01", "to": None}},
        ],
    }
    assert contact_from_hit(_person("https://linkedin.com/in/old", entity=entity), "Alpha Fintech", ROLES) is None


def test_headline_fallback_requires_matching_company():
    good = _person("https://linkedin.com/in/jane", "Jane Doe - Head of Customer Support - Alpha Fintech | LinkedIn")
    wrong_company = _person("https://linkedin.com/in/joe", "Joe - Head of Customer Support - Beta Pay | LinkedIn")
    no_company = _person("https://linkedin.com/in/ann", "Ann Lee | LinkedIn")

    contact, _ = contact_from_hit(good, "Alpha Fintech", ROLES)
    assert contact.name == "Jane Doe" and contact.title == "Head of Customer Support"
    assert contact_from_hit(wrong_company, "Alpha Fintech", ROLES) is None
    assert contact_from_hit(no_company, "Alpha Fintech", ROLES) is None


def test_non_linkedin_source_keeps_source_but_no_linkedin_url():
    hit = _person("https://alpha.com/team", "Priya Nair - Head of Customer Support at Alpha Fintech")
    contact, _ = contact_from_hit(hit, "Alpha Fintech", ROLES)
    assert contact.linkedin_url is None and contact.source_url == "https://alpha.com/team"
