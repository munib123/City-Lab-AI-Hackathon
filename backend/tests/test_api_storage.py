"""What the API stores: chat answers and analyses of CORPUS reports. Never pasted report text."""

import json

import pytest
from fastapi.testclient import TestClient

from medlens.api import app, llm_dependency, store_dependency

client = TestClient(app)


class FakeStore:
    def __init__(self, chat_id="chat-1", analysis_ok=True):
        self.chat_id, self.analysis_ok = chat_id, analysis_ok
        self.chats, self.analyses = [], []

    def log_chat(self, **row):
        self.chats.append(row)
        return self.chat_id

    def save_analysis(self, report_id, age, sex, overall, result):
        self.analyses.append(dict(report_id=report_id, age=age, sex=sex, overall=overall, result=result))
        return self.analysis_ok


class FakeLLM:
    def __init__(self, *replies):
        self.replies = list(replies)

    def generate_json(self, system, user):
        return json.dumps(self.replies.pop(0))


GOOD = {"answer": "Your ALT is 45 U/L. That is inside the range.", "answer_type": "answered", "sources": ["RES1", "R07"]}


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    yield
    app.dependency_overrides.clear()


def use(store=None, llm=None):
    app.dependency_overrides[store_dependency] = lambda: store
    if llm is not None:
        app.dependency_overrides[llm_dependency] = lambda: llm


# ---------------------------------------------------------------- chat log

def test_chat_answer_is_stored_and_its_id_returned():
    store = FakeStore("c-123")
    use(store, FakeLLM(GOOD))
    body = client.post("/api/chat", json={"report_id": "P002", "question": "Is my SGPT normal?"}).json()
    assert body["id"] == "c-123"
    assert len(store.chats) == 1
    row = store.chats[0]
    assert (row["report_id"], row["question"], row["answer_type"], row["llm_used"]) == ("P002", "Is my SGPT normal?", "answered", True)
    assert row["answer"] == body["answer"]
    assert [s["id"] for s in row["sources"]] == ["RES1", "R07"]
    assert (row["age"], row["sex"]) == (35, "Female")  # the demographics the answer was based on
    assert row["model"] == "gemini-2.5-flash" and row["reading_grade"] is not None


def test_refusals_and_unavailable_answers_are_stored_too():
    store = FakeStore()
    use(store)  # no LLM: chat is off
    client.post("/api/chat", json={"report_id": "P002", "question": "Do I have diabetes?"})
    client.post("/api/chat", json={"report_id": "P002", "question": "What is Alice's result?"})
    client.post("/api/chat", json={"report_id": "P002", "question": "What does my SGPT mean?"})
    assert [c["answer_type"] for c in store.chats] == ["refused_diagnosis", "refused_other_patient", "unavailable"]
    assert all(c["llm_used"] is False and c["model"] is None for c in store.chats)


def test_pasted_text_chat_is_never_stored():
    store = FakeStore()
    use(store, FakeLLM({"answer": "Your ALT is high.", "answer_type": "answered", "sources": ["RES1"]}))
    body = client.post("/api/chat", json={"text": "Recorded Age: 30\nBiological Sex: Male\nALT: 85 U/L", "question": "Is my ALT high?"}).json()
    assert body["answer_type"] == "answered" and body["id"] is None
    assert store.chats == []


def test_a_storage_failure_does_not_change_the_answer():
    use(FakeStore(chat_id=None), FakeLLM(GOOD))
    r = client.post("/api/chat", json={"report_id": "P002", "question": "Is my SGPT normal?"})
    assert r.status_code == 200
    assert r.json()["answer_type"] == "answered" and r.json()["id"] is None


def test_chat_works_with_no_database_configured():
    use(None, FakeLLM(GOOD))
    r = client.post("/api/chat", json={"report_id": "P002", "question": "Is my SGPT normal?"})
    assert r.status_code == 200 and r.json()["id"] is None


# ---------------------------------------------------------------- analyses

def test_analysis_of_a_corpus_report_is_stored():
    store = FakeStore()
    use(store)
    body = client.post("/api/analyze", json={"report_id": "P004"}).json()
    assert len(store.analyses) == 1
    saved = store.analyses[0]
    assert (saved["report_id"], saved["overall"], saved["age"], saved["sex"]) == ("P004", "URGENT", 42, "Female")
    assert saved["result"]["results"][0]["status"] == "URGENT_LOW"
    assert saved["result"] == json.loads(json.dumps(body))  # exactly what the API returned


def test_supplied_demographics_are_stored_with_the_analysis():
    store = FakeStore()
    use(store)
    client.post("/api/analyze/demographics", json={"report_id": "P003", "age": 40, "sex": "Male"})
    saved = store.analyses[0]
    assert (saved["report_id"], saved["age"], saved["sex"], saved["overall"]) == ("P003", 40, "Male", "NOT_NORMAL")


def test_analysis_of_pasted_text_is_never_stored():
    store = FakeStore()
    use(store)
    r = client.post("/api/analyze", json={"text": "Recorded Age: 30\nBiological Sex: Male\nALT: 85 U/L"})
    assert r.status_code == 200
    assert store.analyses == []


def test_analyze_works_when_the_store_fails_or_is_missing():
    use(FakeStore(analysis_ok=False))
    assert client.post("/api/analyze", json={"report_id": "P001"}).status_code == 200
    use(None)
    assert client.post("/api/analyze", json={"report_id": "P001"}).status_code == 200


def test_requests_that_fail_validation_store_nothing():
    store = FakeStore()
    use(store)
    client.post("/api/analyze", json={"report_id": "P999"})
    client.post("/api/analyze", json={})
    client.post("/api/chat", json={"report_id": "P002", "question": ""})
    assert store.analyses == [] and store.chats == []


def test_health_says_whether_storage_is_on(monkeypatch):
    assert client.get("/api/health").json()["storage_enabled"] is False
    monkeypatch.setenv("SUPABASE_URL", "https://p.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "k")
    assert client.get("/api/health").json()["storage_enabled"] is True
