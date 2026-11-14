"""HTTP API contract. The frontend is built against these shapes, so they must stay stable."""

import pytest
from fastapi.testclient import TestClient

from medlens.api import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def _no_llm_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)


# ---------- health and reference data ----------

def test_health_reports_that_chat_is_off_without_a_key():
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["llm_enabled"] is False
    assert body["kb"] == {"ranges": 13, "danger_limits": 4, "aliases": 9, "safety_rules": 4}


def test_health_reports_chat_on_when_a_key_exists(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "x")
    body = client.get("/api/health").json()
    assert body["llm_enabled"] is True and body["llm_provider"] == "gemini"


def test_reports_lists_the_fourteen_corpus_reports():
    r = client.get("/api/reports")
    assert r.status_code == 200
    items = r.json()
    assert [i["report_id"] for i in items] == [f"P{n:03d}" for n in range(1, 15)]
    assert items[3] == {"report_id": "P004", "patient_name": "Diana Prince", "result_count": 2}


def test_kb_endpoint_exposes_ranges_with_sources():
    body = client.get("/api/kb").json()
    assert len(body["ranges"]) == 13
    assert body["ranges"][0]["source"]["file"] == "4_ranges_hematology.md"
    assert body["urgent_phrase"] == "see a doctor today"


# ---------- analyze a corpus report ----------

def test_analyze_urgent_report():
    r = client.post("/api/analyze", json={"report_id": "P004"})
    assert r.status_code == 200
    body = r.json()
    assert body["overall"] == "URGENT"
    assert body["patient"]["name"] == "Diana Prince"
    assert [x["status"] for x in body["results"]] == ["URGENT_LOW", "LOW"]
    assert "see a doctor today" in body["urgent_banner"]["title"].lower()
    assert 3 <= len(body["doctor_questions"]) <= 5
    assert "licensed medical doctor" in body["disclaimer"]
    assert body["results"][0]["explanation"]["label"].startswith("General information")


def test_analyze_shows_unit_conversion_working():
    body = client.post("/api/analyze", json={"report_id": "P005"}).json()
    conv = body["results"][0]["conversion"]
    assert conv["working"] == "6.0 mmol/L × 18 = 108 mg/dL"
    assert conv["origin"] == "team"


def test_analyze_needs_info_report_asks_for_demographics():
    body = client.post("/api/analyze", json={"report_id": "P003"}).json()
    assert body["results"][0]["status"] == "NEEDS_INFO"
    assert body["missing_demographics"] == ["age", "sex"]
    assert "age" in body["demographics_prompt"]


def test_unknown_report_id_is_404():
    r = client.post("/api/analyze", json={"report_id": "P999"})
    assert r.status_code == 404


@pytest.mark.parametrize("payload", [{}, {"report_id": "P001", "text": "ALT: 40 U/L"}, {"report_id": ""}, {"text": ""}])
def test_analyze_needs_exactly_one_of_report_id_or_text(payload):
    assert client.post("/api/analyze", json=payload).status_code == 422


# ---------- analyze pasted text ----------

def test_analyze_pasted_text():
    text = "Recorded Age: 30\nBiological Sex: Male\nALT: 85 U/L\nSerum Ferritin: 25 ng/mL\n"
    r = client.post("/api/analyze", json={"text": text})
    assert r.status_code == 200
    body = r.json()
    assert body["report_id"] is None
    assert [x["status"] for x in body["results"]] == ["HIGH", "UNCLASSIFIED"]
    assert body["overall"] == "NOT_NORMAL"


def test_text_with_no_readable_results_is_422_with_a_clear_message():
    r = client.post("/api/analyze", json={"text": "Hello, this is not a lab report at all."})
    assert r.status_code == 422
    assert "No test results" in r.json()["detail"]


def test_very_long_text_is_rejected():
    r = client.post("/api/analyze", json={"text": "ALT: 40 U/L\n" * 5000})
    assert r.status_code == 422


# ---------- user supplies missing demographics ----------

def test_demographics_endpoint_resolves_a_needs_info_report():
    r = client.post("/api/analyze/demographics", json={"report_id": "P003", "age": 40, "sex": "Male"})
    assert r.status_code == 200
    body = r.json()
    assert body["results"][0]["status"] == "HIGH"
    assert body["demographics_source"] == {"age": "user_supplied", "sex": "user_supplied"}
    assert body["demographics_prompt"] is None


def test_demographics_endpoint_accepts_lowercase_and_short_sex():
    body = client.post("/api/analyze/demographics", json={"report_id": "P012", "sex": "f"}).json()
    assert body["results"][0]["status"] == "HIGH"  # AST 44 > 43 for female


@pytest.mark.parametrize(
    "payload",
    [
        {"report_id": "P003"},  # nothing supplied
        {"report_id": "P003", "age": -1},
        {"report_id": "P003", "age": 200},
        {"report_id": "P003", "sex": "Robot"},
        {"report_id": "P003", "age": "forty"},
    ],
)
def test_demographics_endpoint_rejects_bad_input(payload):
    assert client.post("/api/analyze/demographics", json=payload).status_code == 422


def test_demographics_for_unknown_report_is_404():
    assert client.post("/api/analyze/demographics", json={"report_id": "P999", "age": 30}).status_code == 404


# ---------- plumbing ----------

def test_cors_header_is_present_for_a_browser_origin():
    r = client.get("/api/reports", headers={"Origin": "https://example.vercel.app"})
    assert r.headers["access-control-allow-origin"] in ("*", "https://example.vercel.app")


def test_unknown_route_is_404():
    assert client.get("/api/nope").status_code == 404


def test_responses_never_leak_other_patients():
    body = client.post("/api/analyze", json={"report_id": "P001"}).json()
    dumped = str(body)
    for other in ("Bob Jones", "Diana Prince", "CLD-P002"):
        assert other not in dumped
