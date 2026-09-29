from agents.lead_research.contacts import contact_from_hit, role_score
from agents.lead_research.schemas import Contact, Lead, Qualification
from agents.lead_research.search_provider import SearchHit
from agents.lead_research.site_contacts import _stated_on_page, attach_published_emails, merge_contacts
from agents.lead_research.state import Candidate, ResearchedCompany, ScrapedPage

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


def test_site_person_must_be_stated_on_the_page_with_their_title():
    text = "Our story. Founded in 2019 by Priya Nair (Co-Founder and CEO) and friends. " + "x " * 300 + "Rahul Mehta leads design."
    assert _stated_on_page("Priya Nair", "Co-founder & CEO", text)
    assert _stated_on_page("priya  nair", "CEO", text)
    assert not _stated_on_page("Priya Nair", "COO", text)  # title not on the page
    assert not _stated_on_page("Vikram Rao", "CEO", text)  # name not on the page
    assert not _stated_on_page("Rahul Mehta", "Co-founder", text)  # "Co-founder" is far away, next to Priya


def _company(emails_by_page):
    pages = [ScrapedPage(url=u, final_url=u, title=None, text="", emails=e) for u, e in emails_by_page]
    lead = Lead(
        company_name="Acme",
        website="https://acme.in",
        qualification="Possible fit",
        why_relevant="",
        qualification_detail=Qualification(icp_match=True),
        company_emails=sorted({e for _, es in emails_by_page for e in es}),
    )
    candidate = Candidate(company_name="Acme", website="https://acme.in", domain="acme.in", description="", source_url="", discovery_query="")
    return ResearchedCompany(candidate=candidate, fit="possible", lead=lead, confidence=0.9, pages=pages)


def _contact(name):
    return Contact(name=name, title="CEO", company="Acme", source_url="https://x")


def test_published_emails_attach_only_to_their_unambiguous_owner():
    company = _company([
        ("https://acme.in/", ["hello@acme.in", "p.sharma@acme.in"]),
        ("https://acme.in/team", ["rahul@acme.in", "amit@acme.in"]),
    ])
    priya, rahul_a, rahul_b = _contact("Priya Sharma"), _contact("Rahul Jain"), _contact("Rahul Verma")

    attach_published_emails(company, [priya, rahul_a, rahul_b])

    assert (priya.email, priya.email_source_url) == ("p.sharma@acme.in", "https://acme.in/")
    assert rahul_a.email is None and rahul_b.email is None  # "rahul@" could be either Rahul
    assert company.lead.company_emails == ["amit@acme.in", "hello@acme.in", "rahul@acme.in"]


def test_merge_keeps_exa_contacts_first_and_skips_same_person():
    exa = [_contact("Jane Doe")]
    site = [_contact("jane  doe"), _contact("Priya Nair"), _contact("Bob Rao")]
    assert [c.name for c in merge_contacts(exa, site, 2)] == ["Jane Doe", "Priya Nair"]
