"""Plain-language layer on top of the engine: explanations, 3-5 doctor questions, urgent banner."""

import pytest

from medlens.corpus import get_report, load_corpus
from medlens.engine import analyze_report
from medlens.explain import DISCLAIMER, enrich
from medlens.kb import load_kb
from medlens.lint import find_diagnosis_phrases
from medlens.readability import flesch_kincaid_grade


@pytest.fixture(scope="module")
def kb():
    return load_kb()


def view(kb, report_id, **kw):
    return enrich(analyze_report(get_report(report_id), kb, **kw), kb)


def all_text(a):
    parts = [a.disclaimer, *a.doctor_questions]
    if a.urgent_banner:
        parts += [a.urgent_banner.title, a.urgent_banner.message]
    if a.demographics_prompt:
        parts.append(a.demographics_prompt)
    for r in a.results:
        if r.explanation:
            parts += [p for p in (r.explanation.measures, r.explanation.meaning) if p]
    return parts


# ---------- doctor questions: always 3 to 5 ----------

@pytest.mark.parametrize("report", load_corpus(), ids=lambda r: r.report_id)
def test_every_report_gets_three_to_five_questions(kb, report):
    a = enrich(analyze_report(report, kb), kb)
    assert 3 <= len(a.doctor_questions) <= 5, a.doctor_questions
    assert len(set(a.doctor_questions)) == len(a.doctor_questions)


def test_urgent_question_comes_first_and_names_the_test(kb):
    a = view(kb, "P004")
    assert "Hemoglobin" in a.doctor_questions[0]
    assert "urgent" in a.doctor_questions[0].lower()


def test_questions_are_about_this_patients_results(kb):
    a = view(kb, "P009")
    joined = " ".join(a.doctor_questions)
    assert "ALT" in joined and "AST" in joined


def test_unclassified_test_gets_its_own_question(kb):
    a = view(kb, "P006")
    assert any("Serum Ferritin" in q for q in a.doctor_questions)


def test_all_normal_report_still_gets_general_questions(kb):
    a = view(kb, "P001")
    assert len(a.doctor_questions) >= 3


# ---------- urgent banner ----------

def test_urgent_report_has_a_banner_with_the_files_phrase(kb):
    a = view(kb, "P004")
    assert a.urgent_banner is not None
    assert "see a doctor today" in a.urgent_banner.title.lower()
    assert [i.test for i in a.urgent_banner.items] == ["Hemoglobin"]
    assert "3_dangerous_urgent_values.md" in a.urgent_banner.items[0].reason


def test_p013_banner_lists_the_sugar_result(kb):
    a = view(kb, "P013")
    assert [i.test for i in a.urgent_banner.items] == ["Fasting Blood Sugar"]


@pytest.mark.parametrize("pid", ["P001", "P003", "P005", "P006", "P009", "P012"])
def test_no_banner_when_nothing_is_urgent(kb, pid):
    assert view(kb, pid).urgent_banner is None


# ---------- explanations on each result ----------

def test_known_test_gets_a_labelled_explanation(kb):
    r = view(kb, "P009").results[0]
    assert r.explanation.measures
    assert r.explanation.meaning and "doctor" in r.explanation.meaning.lower()
    assert "not from" in r.explanation.label.lower()


def test_meaning_follows_the_status(kb):
    low = view(kb, "P011").results[1]  # PLT LOW
    high = view(kb, "P011").results[0]  # WBC HIGH
    assert low.explanation.meaning != high.explanation.meaning


def test_normal_result_explains_the_test_but_has_no_meaning_text(kb):
    r = view(kb, "P007").results[0]
    assert r.explanation.measures and r.explanation.meaning is None


def test_unclassified_result_has_no_explanation(kb):
    assert view(kb, "P006").results[0].explanation is None


# ---------- missing demographics prompt ----------

def test_missing_age_and_sex_are_asked_for_with_the_rule_cited(kb):
    a = view(kb, "P003")
    assert "age" in a.demographics_prompt and "sex" in a.demographics_prompt
    assert "1_lab_safety_rules.md:5" in a.demographics_prompt


def test_no_prompt_when_demographics_are_complete(kb):
    assert view(kb, "P001").demographics_prompt is None


# ---------- safety of every generated sentence ----------

def test_disclaimer_says_only_a_doctor_can_diagnose(kb):
    assert "licensed medical doctor" in DISCLAIMER
    assert view(kb, "P001").disclaimer == DISCLAIMER


@pytest.mark.parametrize("report", load_corpus(), ids=lambda r: r.report_id)
def test_nothing_generated_diagnoses(kb, report):
    a = enrich(analyze_report(report, kb), kb)
    for text in all_text(a):
        assert find_diagnosis_phrases(text) == [], text


@pytest.mark.parametrize("report", load_corpus(), ids=lambda r: r.report_id)
def test_generated_text_reads_at_class_8_or_below(kb, report):
    a = enrich(analyze_report(report, kb), kb)
    for text in all_text(a):
        assert flesch_kincaid_grade(text) <= 8.5, (round(flesch_kincaid_grade(text), 1), text)


# ---------- enrich must not change any decision ----------

def test_enrich_does_not_change_statuses_or_the_input(kb):
    base = analyze_report(get_report("P004"), kb)
    before = [r.status for r in base.results]
    enriched = enrich(base, kb)
    assert [r.status for r in enriched.results] == before
    assert base.doctor_questions == [] and base.urgent_banner is None  # input untouched
