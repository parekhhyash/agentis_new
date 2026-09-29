import re
from urllib.parse import urlsplit, urlunsplit

# Second-level public suffixes common in our target markets. Not a full PSL,
# but enough that example.co.in and example.co.uk dedupe to the right root.
_MULTI_PART_SUFFIXES = {
    "co.in", "org.in", "net.in", "firm.in", "gen.in", "ind.in", "ac.in", "gov.in",
    "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "org.au", "co.nz",
    "com.sg", "com.my", "com.ph", "com.hk", "com.cn", "co.jp", "co.kr", "co.id",
    "com.br", "com.mx", "com.ar", "co.za", "com.tr", "com.vn", "com.pk", "com.bd",
    "com.ng", "com.eg", "com.sa", "co.il", "com.tw", "co.th",
}

# Directories, social networks, marketplaces and publishers - never a lead
# themselves, even when a search result points at them.
NON_COMPANY_DOMAINS = {
    "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com", "youtube.com",
    "tiktok.com", "reddit.com", "quora.com", "medium.com", "substack.com", "wikipedia.org",
    "wikimedia.org", "github.com", "crunchbase.com", "tracxn.com", "zoominfo.com",
    "pitchbook.com", "cbinsights.com", "owler.com", "dnb.com", "apollo.io", "rocketreach.co",
    "glassdoor.com", "glassdoor.co.in", "indeed.com", "naukri.com", "ambitionbox.com",
    "wellfound.com", "angel.co", "ycombinator.com", "producthunt.com", "g2.com", "capterra.com",
    "clutch.co", "goodfirms.co", "trustpilot.com", "justdial.com", "indiamart.com",
    "tradeindia.com", "amazon.com", "amazon.in", "flipkart.com", "apple.com", "google.com",
    "microsoft.com", "blogspot.com", "wordpress.com", "forbes.com", "techcrunch.com",
    "inc42.com", "yourstory.com", "indiatimes.com", "livemint.com", "moneycontrol.com",
    "business-standard.com", "thehindu.com", "bloomberg.com", "reuters.com", "cnbc.com",
    "entrackr.com", "vccircle.com", "businessinsider.com", "exa.ai",
}

_COMPANY_SUFFIXES = {
    "inc", "incorporated", "llc", "llp", "ltd", "limited", "pvt", "private", "plc", "corp",
    "corporation", "co", "company", "gmbh", "sa", "ag", "bv", "pte", "pty", "technologies",
    "technology", "tech", "solutions", "labs", "group", "holdings", "india", "the",
}


def normalize_url(url: str) -> str:
    """Lowercase host, drop www/fragment/query/trailing slash - the key used
    for page caching and dedup of individual URLs."""
    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower() or "https"
    host = (parts.hostname or "").lower().removeprefix("www.")
    path = parts.path.rstrip("/")
    return urlunsplit((scheme, host, path, "", ""))


def root_domain(url_or_host: str) -> str:
    value = url_or_host.strip().lower()
    host = urlsplit(value).hostname if "://" in value else value.split("/")[0]
    host = (host or "").removeprefix("www.").strip(".")
    labels = host.split(".")
    if len(labels) >= 3 and ".".join(labels[-2:]) in _MULTI_PART_SUFFIXES:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def homepage_url(url: str) -> str:
    parts = urlsplit(url.strip())
    scheme = parts.scheme or "https"
    return f"{scheme}://{parts.netloc}"


def is_non_company_domain(domain: str) -> bool:
    return domain in NON_COMPANY_DOMAINS


def normalize_company_name(name: str) -> str:
    tokens = re.findall(r"[a-z0-9]+", name.lower())
    kept = [t for t in tokens if t not in _COMPANY_SUFFIXES]
    return " ".join(kept or tokens)


def names_match(a: str, b: str) -> bool:
    na, nb = normalize_company_name(a), normalize_company_name(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    shorter, longer = sorted((na, nb), key=len)
    return len(shorter) >= 3 and re.search(rf"\b{re.escape(shorter)}\b", longer) is not None


def domain_label(domain: str) -> str:
    return domain.split(".")[0]


def company_name_from_title(title: str | None, domain: str) -> str:
    if title:
        head = re.split(r"\s[|\-–—:]\s", title.strip(), maxsplit=1)[0].strip()
        if 1 < len(head) <= 60:
            return head
    label = domain_label(domain)
    return label[:1].upper() + label[1:]
