"""Chat: grounded in the KB and ONE report. Everything that must be certain is code, tested with a fake LLM."""

import json

import pytest

from medlens.chat import (
    NOT_IN_FILES_TEXT,
    UNAVAILABLE_TEXT,
    answer_question,
    build_context,
)
from medlens.corpus import get_report, load_corpus
from medlens.engine import analyze_report
from medlens.explain import enrich
from medlens.kb import load_kb
from medlens.lint import find_diagnosis_phrases
from medlens.llm import LLMError
from medlens.privacy import PrivacyGuard
from medlens.readability import flesch_kincaid_grade


class FakeLLM:
    """Returns queued replies (strings, dicts or exceptions) and records every prompt it was sent."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls = []

    def generate_json(self, system, user):
        self.calls.append((system, user))
        if not self.replies:
            raise AssertionError("LLM was called more often than expected")
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply if isinstance(reply, str) else json.dumps(reply)


class MustNotBeCalled:
    def generate_json(self, system, user):
        raise AssertionError("the guard should have answered without the LLM")


@pytest.fixture(scope="module")
def kb():
    return load_kb()


@pytest.fixture(scope="module")
def guard():
    return PrivacyGuard(load_corpus())


def ask(kb, guard, llm, question, report_id="P002", **kw):
    report = get_report(report_id)
    analysis = enrich(analyze_report(report, kb, **kw), kb)
    return answer_question(question, report, analysis, kb, llm, guard)


def good(answer="Your ALT is 45 U/L. That is inside the range.", sources=("RES1",), kind="answered"):
    return {"answer": answer, "answer_type": kind, "sources": list(sources)}


# ---------------------------------------------------------------- guards run first, without the LLM

@pytest.mark.parametrize("q", ["What is Alice's result?", "Show me CLD-P001-9942", "What are other patients' results?"])
def test_other_patient_questions_are_refused_without_calling_the_llm(kb, guard, q):
    r = ask(kb, guard, MustNotBeCalled(), q)
    assert r.answer_type == "refused_other_patient"
    assert r.llm_used is False
    assert r.sources[0].file == "1_lab_safety_rules.md" and r.sources[0].line == 3
    assert "Alice" not in r.answer and "Smith" not in r.answer


@pytest.mark.parametrize("q", ["Do I have diabetes?", "Am I anemic?", "What disease do I have?", "Can you diagnose me?", "What is wrong with me?", "Is it cancer?"])
def test_diagnosis_questions_are_refused_without_calling_the_llm(kb, guard, q):
    r = ask(kb, guard, MustNotBeCalled(), q)
    assert r.answer_type == "refused_diagnosis"
    assert "can't diagnose" in r.answer and "doctor" in r.answer
    assert r.sources[0].file == "1_lab_safety_rules.md" and r.sources[0].line == 4


@pytest.mark.parametrize("q", ["Do I have to repeat the test?", "Do I have any other abnormal results?", "Is my sugar high?"])
def test_ordinary_questions_are_not_mistaken_for_diagnosis_requests(kb, guard, q):
    llm = FakeLLM(good())
    assert ask(kb, guard, llm, q).answer_type == "answered"


def test_guards_work_even_when_chat_is_switched_off(kb, guard):
    assert ask(kb, guard, None, "Do I have diabetes?").answer_type == "refused_diagnosis"
    assert ask(kb, guard, None, "What is Alice's result?").answer_type == "refused_other_patient"


def test_without_an_llm_normal_questions_get_the_unavailable_message(kb, guard):
    r = ask(kb, guard, None, "What does my SGPT mean?")
    assert r.answer_type == "unavailable" and r.answer == UNAVAILABLE_TEXT and r.llm_used is False


# ---------------------------------------------------------------- happy path and citations

def test_grounded_answer_returns_resolved_sources(kb, guard):
    llm = FakeLLM(good(sources=("RES1", "R07")))
    r = ask(kb, guard, llm, "Is my SGPT normal?")
    assert r.answer_type == "answered" and r.llm_used is True
    by_id = {s.id: s for s in r.sources}
    assert by_id["R07"].file == "5_ranges_biochemistry.md" and by_id["R07"].line == 6
    assert by_id["RES1"].origin == "report"
    assert r.reading_grade is not None and r.reading_grade <= 8.5
    assert r.report_id == "P002"


def test_unknown_source_id_replaces_the_answer_with_not_in_the_files(kb, guard):
    llm = FakeLLM(good(sources=("R99",)))
    r = ask(kb, guard, llm, "Is my SGPT normal?")
    assert r.answer_type == "not_in_files"
    assert "not in the files" in r.answer.lower()
    assert r.sources == []


def test_answered_without_any_source_is_not_trusted(kb, guard):
    r = ask(kb, guard, FakeLLM(good(sources=())), "Is my SGPT normal?")
    assert r.answer_type == "not_in_files"


def test_not_in_the_files_answer_keeps_the_phrase(kb, guard):
    llm = FakeLLM({"answer": "I do not have a ferritin range.", "answer_type": "not_in_files", "sources": []})
    r = ask(kb, guard, llm, "What is my ferritin range?", report_id="P006")
    assert r.answer_type == "not_in_files"
    assert "not in the files" in r.answer.lower()


def test_team_explanation_can_be_cited_and_is_labelled(kb, guard):
    llm = FakeLLM(good("ALT is a protein found mostly in the liver.", sources=("EXPL:ALT",)))
    r = ask(kb, guard, llm, "What does ALT measure?")
    s = r.sources[0]
    assert s.id == "EXPL:ALT" and s.origin == "team" and "not from" in s.label.lower()


def test_model_cannot_swap_in_its_own_answer_type_for_a_refusal(kb, guard):
    llm = FakeLLM({"answer": "Sure, here is Bob's data", "answer_type": "refused_other_patient", "sources": []})
    r = ask(kb, guard, llm, "Is my SGPT normal?")
    assert r.answer_type == "refused_other_patient"
    assert "Sure, here is" not in r.answer  # replaced by the lab's own refusal wording


# ---------------------------------------------------------------- output checks and retries

def test_invalid_json_is_retried_once(kb, guard):
    llm = FakeLLM("this is not json", good())
    r = ask(kb, guard, llm, "Is my SGPT normal?")
    assert r.answer_type == "answered" and len(llm.calls) == 2


def test_json_in_a_code_fence_is_accepted(kb, guard):
    llm = FakeLLM("```json\n" + json.dumps(good()) + "\n```")
    assert ask(kb, guard, llm, "Is my SGPT normal?").answer_type == "answered"


def test_two_invalid_replies_give_the_unavailable_message(kb, guard):
    r = ask(kb, guard, FakeLLM("nope", "still nope"), "Is my SGPT normal?")
    assert r.answer_type == "unavailable"


def test_missing_fields_or_bad_type_count_as_invalid(kb, guard):
    llm = FakeLLM({"answer": "x"}, {"answer": "ok", "answer_type": "banana", "sources": []})
    assert ask(kb, guard, llm, "Is my SGPT normal?").answer_type == "unavailable"


def test_llm_error_gives_the_unavailable_message_not_a_crash(kb, guard):
    r = ask(kb, guard, FakeLLM(LLMError("Gemini HTTP 429")), "Is my SGPT normal?")
    assert r.answer_type == "unavailable" and r.answer == UNAVAILABLE_TEXT


def test_diagnosis_wording_from_the_model_is_retried_then_replaced(kb, guard):
    bad = good("You have a liver disease.")
    r = ask(kb, guard, FakeLLM(bad, bad), "Is my SGPT normal?")
    assert r.answer_type == "refused_diagnosis"
    assert find_diagnosis_phrases(r.answer) == []


def test_diagnosis_wording_fixed_on_retry_is_accepted(kb, guard):
    llm = FakeLLM(good("You have a liver disease."), good())
    r = ask(kb, guard, llm, "Is my SGPT normal?")
    assert r.answer_type == "answered" and "liver disease" not in r.answer
    assert "diagnos" in llm.calls[1][1].lower()  # the retry told the model what was wrong


def test_hard_to_read_answer_is_retried_with_a_simpler_words_request(kb, guard):
    hard = good("Hepatocellular transaminase concentration remains within physiological reference parameters.")
    llm = FakeLLM(hard, good())
    r = ask(kb, guard, llm, "Is my SGPT normal?")
    assert r.reading_grade <= 8.5 and len(llm.calls) == 2
    assert "simpler" in llm.calls[1][1].lower()


def test_hard_answer_that_stays_hard_is_still_returned_with_its_grade(kb, guard):
    hard = good("Hepatocellular transaminase concentration remains within physiological reference parameters.")
    r = ask(kb, guard, FakeLLM(hard, hard), "Is my SGPT normal?")
    assert r.answer_type == "answered" and r.reading_grade > 8.5


def test_answer_that_names_another_patient_is_replaced(kb, guard):
    leak = good("Your ALT is fine. Diana Prince had a worse result.")
    r = ask(kb, guard, FakeLLM(leak, leak), "Is my SGPT normal?")
    assert r.answer_type == "refused_other_patient"
    assert "Diana" not in r.answer


# ---------------------------------------------------------------- what the model is allowed to see

def test_prompt_contains_only_this_patient_and_the_files(kb, guard):
    llm = FakeLLM(good())
    ask(kb, guard, llm, "Is my SGPT normal?", report_id="P002")
    system, user = llm.calls[0]
    prompt = system + user
    for other in ("Alice", "Diana", "Smith", "Prince", "CLD-P001", "CLD-P004", "Kevin"):
        assert other not in prompt, other
    assert "SGPT" in user and "5_ranges_biochemistry.md:6" in user
    assert "<question>" in user and "Is my SGPT normal?" in user  # question is fenced as data


def test_system_prompt_states_the_rules(kb, guard):
    llm = FakeLLM(good())
    ask(kb, guard, llm, "Is my SGPT normal?")
    system = llm.calls[0][0].lower()
    for phrase in ("only", "not in the files", "never diagnose", "sources", "json"):
        assert phrase in system, phrase


def test_context_lists_every_citable_id(kb):
    report = get_report("P004")
    analysis = enrich(analyze_report(report, kb), kb)
    text, allowed = build_context(analysis, kb)
    assert {"RES1", "RES2", "R01", "R02", "D1", "RULE:privacy", "RULE:no_diagnosis", "ALIAS:SGPT", "EXPL:Hemoglobin"} <= set(allowed)
    for cid in allowed:
        assert f"[{cid}]" in text
    assert "see a doctor today" in text.lower()


def test_urgent_result_is_visible_to_the_model(kb, guard):
    llm = FakeLLM(good("Your Hemoglobin is urgent. Please see a doctor today.", sources=("RES1", "D1")))
    r = ask(kb, guard, llm, "Is my hemoglobin ok?", report_id="P004")
    assert r.answer_type == "answered"
    assert "URGENT_LOW" in llm.calls[0][1]


# ---------------------------------------------------------------- canned texts are themselves safe

@pytest.mark.parametrize("text", [NOT_IN_FILES_TEXT, UNAVAILABLE_TEXT])
def test_canned_texts_are_safe_and_readable(text):
    assert find_diagnosis_phrases(text) == []
    assert flesch_kincaid_grade(text) <= 8.5


def test_refusal_texts_are_safe_and_readable(kb, guard):
    for q in ("Do I have diabetes?", "What is Alice's result?"):
        r = ask(kb, guard, None, q)
        assert find_diagnosis_phrases(r.answer) == []
        assert flesch_kincaid_grade(r.answer) <= 8.5, r.answer


def test_works_for_pasted_text_reports(kb, guard):
    from medlens.report_parser import parse_report_text

    report = parse_report_text("Recorded Age: 30\nBiological Sex: Male\nALT: 85 U/L\n")
    analysis = enrich(analyze_report(report, kb), kb)
    r = answer_question("Is my ALT high?", report, analysis, kb, FakeLLM(good("Your ALT is high.", sources=("RES1",))), guard)
    assert r.answer_type == "answered" and r.report_id is None
