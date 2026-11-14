import json

import pytest
from fastapi.testclient import TestClient

from medlens.api import app, llm_dependency

client = TestClient(app)


class FakeLLM:
    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    def generate_json(self, system, user):
        self.calls.append((system, user))
        return json.dumps(self.replies.pop(0))


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    yield
    app.dependency_overrides.clear()


def use(llm):
    app.dependency_overrides[llm_dependency] = lambda: llm


def chat(**body):
    return client.post("/api/chat", json=body)


# ---------- chat off (no key): guards still work, everything else degrades politely ----------

def test_without_a_key_normal_questions_say_chat_is_unavailable():
    r = chat(report_id="P002", question="What does my SGPT mean?")
    assert r.status_code == 200
    assert r.json()["answer_type"] == "unavailable" and r.json()["llm_used"] is False


def test_without_a_key_the_guards_still_refuse():
    assert chat(report_id="P002", question="Do I have diabetes?").json()["answer_type"] == "refused_diagnosis"
    assert chat(report_id="P002", question="What is Alice's result?").json()["answer_type"] == "refused_other_patient"


# ---------- with a (fake) model ----------

def test_grounded_answer_with_resolved_sources():
    use(FakeLLM({"answer": "Your ALT is 45 U/L. That is inside the range.", "answer_type": "answered", "sources": ["RES1", "R07"]}))
    body = chat(report_id="P002", question="Is my SGPT normal?").json()
    assert body["answer_type"] == "answered" and body["llm_used"] is True
    assert {s["id"] for s in body["sources"]} == {"RES1", "R07"}
    r07 = next(s for s in body["sources"] if s["id"] == "R07")
    assert (r07["file"], r07["line"]) == ("5_ranges_biochemistry.md", 6)


def test_ferritin_question_is_not_in_the_files():
    use(FakeLLM({"answer": "A ferritin range is not in the files.", "answer_type": "not_in_files", "sources": []}))
    body = chat(report_id="P006", question="What is my ferritin range?").json()
    assert body["answer_type"] == "not_in_files"


def test_supplied_demographics_reach_the_model():
    llm = FakeLLM({"answer": "Your sugar is above the range.", "answer_type": "answered", "sources": ["RES1"]})
    use(llm)
    chat(report_id="P003", question="Is my sugar high?", age=40, sex="Male")
    assert "age 40, sex Male" in llm.calls[0][1]


def test_pasted_text_chat():
    use(FakeLLM({"answer": "Your ALT is high.", "answer_type": "answered", "sources": ["RES1"]}))
    body = chat(text="Recorded Age: 30\nBiological Sex: Male\nALT: 85 U/L", question="Is my ALT high?").json()
    assert body["answer_type"] == "answered" and body["report_id"] is None


# ---------- validation ----------

@pytest.mark.parametrize(
    "body",
    [
        {"report_id": "P002"},  # no question
        {"report_id": "P002", "question": ""},
        {"report_id": "P002", "question": "   "},
        {"report_id": "P002", "question": "x" * 501},
        {"question": "Is my SGPT normal?"},  # no report
        {"report_id": "P002", "text": "ALT: 40 U/L", "question": "hi"},  # both
    ],
)
def test_bad_chat_requests_are_422(body):
    assert client.post("/api/chat", json=body).status_code == 422


def test_unknown_report_is_404():
    assert chat(report_id="P999", question="hello").status_code == 404
