"""Rate-limit bookkeeping for report emails (Supabase REST)."""

import json
from datetime import datetime, timezone

import httpx

from medlens import config
from medlens.store import Store

URL = "https://proj.supabase.co"
KEY = "eyJhbGciOi.payload.signature"
SINCE = datetime(2026, 11, 14, 10, 0, 0, tzinfo=timezone.utc)


def store_with(handler):
    return Store(URL, KEY, http=httpx.Client(transport=httpx.MockTransport(handler)))


def test_log_email_posts_hashes_not_addresses():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"], seen["body"] = str(request.url), json.loads(request.content)
        return httpx.Response(201)

    assert store_with(handler).log_email("iphash", "tohash", "P004", "sent") is True
    assert seen["url"] == f"{URL}/rest/v1/email_log"
    assert seen["body"] == {"ip_hash": "iphash", "to_hash": "tohash", "report_id": "P004", "status": "sent"}


def test_count_emails_reads_the_total_from_content_range():
    seen = {}

    def handler(request: httpx.Request):
        seen["params"], seen["headers"] = dict(request.url.params), dict(request.headers)
        return httpx.Response(206, json=[{"id": "x"}], headers={"content-range": "0-0/7"})

    n = store_with(handler).count_emails(SINCE, ip_hash="ip1")
    assert n == 7
    assert seen["params"] == {"select": "id", "created_at": "gte.2026-11-14T10:00:00+00:00", "ip_hash": "eq.ip1"}
    assert seen["headers"]["prefer"] == "count=exact" and seen["headers"]["range"] == "0-0"


def test_count_emails_with_no_rows_is_zero():
    assert store_with(lambda r: httpx.Response(200, json=[], headers={"content-range": "*/0"})).count_emails(SINCE) == 0


def test_count_emails_filters_by_recipient_and_by_both():
    seen = []
    store_with(lambda r: (seen.append(dict(r.url.params)), httpx.Response(200, json=[], headers={"content-range": "*/0"}))[1]).count_emails(SINCE, to_hash="t1")
    assert seen[0]["to_hash"] == "eq.t1" and "ip_hash" not in seen[0]


def test_count_emails_failure_is_none_so_callers_can_fail_closed():
    assert store_with(lambda r: httpx.Response(500)).count_emails(SINCE) is None
    assert store_with(lambda r: httpx.Response(200, json=[], headers={})).count_emails(SINCE) is None

    def boom(request):
        raise RuntimeError("down")

    assert store_with(boom).count_emails(SINCE) is None


def test_log_email_failure_is_false():
    assert store_with(lambda r: httpx.Response(500)).log_email("a", "b", "P001", "failed") is False


# ---------------------------------------------------------------- SMTP settings

def test_smtp_settings_are_cleaned(monkeypatch):
    monkeypatch.setenv("SMTP_HOST", " smtp.gmail.com ")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_EMAIL", "﻿me@gmail.com\n")
    monkeypatch.setenv("SMTP_APP_PASSWORD", '"abcd efgh ijkl mnop"')  # Gmail shows app passwords in groups, quotes from a .env paste
    s = config.smtp_settings()
    assert (s.host, s.port, s.email, s.password, s.enabled) == ("smtp.gmail.com", 587, "me@gmail.com", "abcdefghijklmnop", True)


def test_smtp_defaults_and_missing_values(monkeypatch):
    for name in ("SMTP_HOST", "SMTP_PORT", "SMTP_EMAIL", "SMTP_APP_PASSWORD"):
        monkeypatch.delenv(name, raising=False)
    s = config.smtp_settings()
    assert (s.host, s.port, s.enabled) == ("smtp.gmail.com", 587, False)
    monkeypatch.setenv("SMTP_PORT", "not-a-number")
    assert config.smtp_settings().port == 587
    monkeypatch.setenv("SMTP_EMAIL", "me@gmail.com")
    assert config.smtp_settings().enabled is False  # a password is needed too
