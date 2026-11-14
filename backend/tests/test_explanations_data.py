"""data/explanations.json is team-written general information (NOT from the CityLab files).
These tests keep it safe: hedged, points to a doctor, never diagnoses, readable at class 8."""

import pytest

from medlens.explanations import LABEL, load_explanations
from medlens.kb import load_kb
from medlens.lint import find_diagnosis_phrases
from medlens.readability import flesch_kincaid_grade

HEDGES = ("can mean", "may", "might", "can be", "can show", "can help")


@pytest.fixture(scope="module")
def ex():
    return load_explanations()


def _texts(ex):
    for name, item in ex.items.items():
        for field in ("measures", "low", "high"):
            text = getattr(item, field)
            if text:
                yield name, field, text


def test_every_analyte_with_a_range_has_an_explanation(ex):
    kb = load_kb()
    analytes = {r.analyte for r in kb.ranges}
    assert analytes <= set(ex.items), analytes - set(ex.items)


def test_every_entry_says_what_the_test_measures(ex):
    for name, item in ex.items.items():
        assert item.measures.strip(), name


def test_numeric_tests_explain_both_low_and_high(ex):
    for name in ("Hemoglobin", "White Blood Cell Count", "Platelet Count", "Fasting Blood Sugar", "ALT", "AST", "Cholesterol", "TSH", "Urine pH"):
        assert ex.items[name].low and ex.items[name].high, name


def test_label_says_it_is_not_from_the_lab_files():
    assert "not from" in LABEL.lower() and "files" in LABEL.lower()


def test_no_explanation_diagnoses(ex):
    for name, field, text in _texts(ex):
        assert find_diagnosis_phrases(text) == [], (name, field, text)


@pytest.mark.parametrize("field", ["low", "high"])
def test_meanings_are_hedged_and_send_the_reader_to_a_doctor(ex, field):
    for name, item in ex.items.items():
        text = getattr(item, field)
        if not text:
            continue
        low = text.lower()
        assert any(h in low for h in HEDGES), (name, field, text)
        assert "doctor" in low, (name, field, text)


def test_every_text_reads_at_class_8_or_below(ex):
    too_hard = [(n, f, round(flesch_kincaid_grade(t), 1)) for n, f, t in _texts(ex) if flesch_kincaid_grade(t) > 8.5]
    assert not too_hard, too_hard
