"""Supabase storage (REST, no SDK). It must never break an API request and never leak the key."""

import json
import logging

import httpx
import pytest

from medlens import config
from medlens.store import Store, demographics_key, get_store

URL = "https://proj.supabase.co"
LEGACY_KEY = "eyJhbGciOi.payload.signature"
SECRET_KEY = "sb_secret_abc123"


def store_with(handler, key=SECRET_KEY):
    return Store(URL, key, http=httpx.Client(transport=httpx.MockTransport(handler)))


CHAT = dict(
    report_id="P004", question="Is my hemoglobin ok?", answer="It is urgently low.", answer_type="answered",
    llm_used=True, reading_grade=5.2, sources=[{"id": "RES1"}], model="gemini-2.5-flash", age=42, sex="Female",
)


# ---------- settings ----------

def test_supabase_settings_prefer_the_service_role_key(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://p.supabase.co/")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "﻿role-key\n")
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "secret-key")
    s = config.supabase_settings()
    assert (s.url, s.key, s.enabled) == ("https://p.supabase.co", "role-key", True)


def test_supabase_settings_fall_back_to_the_secret_key_and_can_be_missing(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://p.supabase.co")
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_SECRET_KEY", "secret-key")
    assert config.supabase_settings().key == "secret-key"
    monkeypatch.delenv("SUPABASE_SECRET_KEY")
    assert config.supabase_settings().enabled is False


def test_get_store_is_none_when_not_configured(monkeypatch):
    for name in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"):
        monkeypatch.delenv(name, raising=False)
    assert get_store() is None


# ---------- chat log ----------

def test_log_chat_posts_a_row_and_returns_its_id():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"] = str(request.url)
        seen["method"] = request.method
        seen["headers"] = dict(request.headers)
        seen["body"] = json.loads(request.content)
        return httpx.Response(201, json=[{"id": "11111111-1111-1111-1111-111111111111"}])

    new_id = store_with(handler).log_chat(**CHAT)
    assert new_id == "11111111-1111-1111-1111-111111111111"
    assert seen["url"] == f"{URL}/rest/v1/chat_messages"
    assert seen["method"] == "POST"
    assert seen["headers"]["prefer"] == "return=representation"
    assert seen["body"] == CHAT


def test_new_style_secret_key_goes_in_apikey_only():
    seen = {}

    def handler(request):
        seen["headers"] = dict(request.headers)
        return httpx.Response(201, json=[{"id": "x"}])

    store_with(handler, SECRET_KEY).log_chat(**CHAT)
    assert seen["headers"]["apikey"] == SECRET_KEY
    assert "authorization" not in seen["headers"]  # sb_secret_ keys are not JWTs


def test_legacy_jwt_key_is_also_sent_as_a_bearer_token():
    seen = {}

    def handler(request):
        seen["headers"] = dict(request.headers)
        return httpx.Response(201, json=[{"id": "x"}])

    store_with(handler, LEGACY_KEY).log_chat(**CHAT)
    assert seen["headers"]["apikey"] == LEGACY_KEY
    assert seen["headers"]["authorization"] == f"Bearer {LEGACY_KEY}"


# ---------- failures never propagate and never leak ----------

@pytest.mark.parametrize("status", [400, 401, 404, 409, 500, 503])
def test_http_errors_return_none_and_do_not_raise(status, caplog):
    caplog.set_level(logging.WARNING)
    s = store_with(lambda r: httpx.Response(status, json={"message": f"bad {SECRET_KEY}"}))
    assert s.log_chat(**CHAT) is None
    assert SECRET_KEY not in caplog.text
    assert str(status) in caplog.text


def test_timeouts_and_odd_exceptions_return_none(caplog):
    caplog.set_level(logging.WARNING)

    def slow(request):
        raise httpx.ReadTimeout("slow")

    def odd(request):
        raise RuntimeError(f"boom {SECRET_KEY}")

    assert store_with(slow).log_chat(**CHAT) is None
    assert store_with(odd).log_chat(**CHAT) is None
    assert SECRET_KEY not in caplog.text


def test_a_non_ascii_key_cannot_crash_a_request():
    s = Store(URL, "café", http=httpx.Client(transport=httpx.MockTransport(lambda r: httpx.Response(201, json=[{"id": "x"}]))))
    assert s.log_chat(**CHAT) is None


def test_empty_response_body_returns_none():
    assert store_with(lambda r: httpx.Response(201, json=[])).log_chat(**CHAT) is None


# ---------- analyses ----------

def test_save_analysis_upserts_on_report_and_demographics():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"] = str(request.url)
        seen["headers"] = dict(request.headers)
        seen["body"] = json.loads(request.content)
        return httpx.Response(201)

    ok = store_with(handler).save_analysis(
        report_id="P003", age=40, sex="Male", overall="NOT_NORMAL", result={"overall": "NOT_NORMAL"}
    )
    assert ok is True
    assert seen["url"] == f"{URL}/rest/v1/analyses?on_conflict=report_id%2Cdemographics_key"
    assert "resolution=merge-duplicates" in seen["headers"]["prefer"]
    row = seen["body"]
    assert row["demographics_key"] == "age=40|sex=Male"
    assert (row["report_id"], row["age"], row["sex"], row["overall"]) == ("P003", 40, "Male", "NOT_NORMAL")
    assert row["result"] == {"overall": "NOT_NORMAL"}
    assert "updated_at" in row


def test_save_analysis_failure_returns_false():
    assert store_with(lambda r: httpx.Response(500)).save_analysis("P001", None, None, "ALL_NORMAL", {}) is False


@pytest.mark.parametrize("age, sex, key", [(None, None, "age=|sex="), (40, None, "age=40|sex="), (None, "Female", "age=|sex=Female"), (7, "Male", "age=7|sex=Male")])
def test_demographics_key(age, sex, key):
    assert demographics_key(age, sex) == key
