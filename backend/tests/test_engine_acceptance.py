"""The 14 CityLab reports: expected result for each test (the plan's acceptance table)."""

import pytest

from medlens.corpus import get_report
from medlens.engine import analyze_report
from medlens.kb import load_kb


@pytest.fixture(scope="module")
def kb():
    return load_kb()


def run(kb, report_id, **kw):
    return analyze_report(get_report(report_id), kb, **kw)


def statuses(analysis):
    return [r.status for r in analysis.results]


def test_p001_alice_all_normal(kb):
    a = run(kb, "P001")
    assert statuses(a) == ["NORMAL", "NORMAL"]
    assert [r.canonical_name for r in a.results] == ["Hemoglobin", "White Blood Cell Count"]
    assert a.overall == "ALL_NORMAL"


def test_p002_bob_sgpt_is_alt_and_exactly_on_the_limit(kb):
    a = run(kb, "P002")
    r = a.results[0]
    assert (r.raw_name, r.canonical_name, r.status) == ("SGPT", "ALT", "NORMAL")
    assert r.range_used.sex == "Female" and r.range_used.high == 45  # recorded sex, not the name
    assert r.boundary is True
    assert r.name_origin == "files"


def test_p003_charlie_needs_age_and_nothing_is_guessed(kb):
    a = run(kb, "P003")
    r = a.results[0]
    assert r.status == "NEEDS_INFO"
    assert r.needs == ["age"]
    assert r.range_used is None
    assert a.missing_demographics == ["age", "sex"]
    assert a.overall == "INCOMPLETE"


def test_p004_diana_urgent_low_hemoglobin_and_low_platelets(kb):
    a = run(kb, "P004")
    assert statuses(a) == ["URGENT_LOW", "LOW"]
    assert a.results[0].danger.threshold == 7.0
    assert a.results[0].danger.source.file == "3_dangerous_urgent_values.md"
    assert a.overall == "URGENT"


def test_p005_ethan_mmol_converted_and_shown(kb):
    r = run(kb, "P005").results[0]
    assert r.status == "HIGH"
    assert r.converted_value == 108.0 and r.converted_unit == "mg/dL"
    assert r.conversion.working == "6.0 mmol/L × 18 = 108 mg/dL"
    assert r.conversion.origin == "team"  # not from the CityLab files
    assert (r.range_used.low, r.range_used.high) == (70, 99)


def test_p006_ferritin_cannot_be_classified(kb):
    a = run(kb, "P006")
    r = a.results[0]
    assert r.status == "UNCLASSIFIED"
    assert r.canonical_name is None
    assert "cannot be classified from the files" in r.reason
    assert a.overall == "INCOMPLETE"


def test_p007_george_tsh_normal(kb):
    assert statuses(run(kb, "P007")) == ["NORMAL"]


def test_p008_haley_urine_ph_and_protein_normal(kb):
    a = run(kb, "P008")
    assert statuses(a) == ["NORMAL", "NORMAL"]
    assert [r.canonical_name for r in a.results] == ["Urine pH", "Urine Protein"]
    assert [r.name_origin for r in a.results] == ["team", "team"]  # not glossary aliases


def test_p009_ian_alt_and_ast_high(kb):
    a = run(kb, "P009")
    assert statuses(a) == ["HIGH", "HIGH"]
    assert a.overall == "NOT_NORMAL"


def test_p010_julia_cholesterol_exactly_200_is_normal(kb):
    r = run(kb, "P010").results[0]
    assert r.status == "NORMAL" and r.boundary is True


def test_p011_kevin_wbc_high_platelets_low(kb):
    assert statuses(run(kb, "P011")) == ["HIGH", "LOW"]


def test_p012_laura_sex_missing_needs_info_not_a_guess(kb):
    a = run(kb, "P012")
    r = a.results[0]
    assert r.status == "NEEDS_INFO" and r.needs == ["sex"]
    assert a.missing_demographics == ["sex"]


def test_p013_michael_fbs_350_urgent_high(kb):
    a = run(kb, "P013")
    assert statuses(a) == ["URGENT_HIGH"]
    assert a.overall == "URGENT"


def test_p014_nancy_fbs_and_sgot_normal(kb):
    a = run(kb, "P014")
    assert statuses(a) == ["NORMAL", "NORMAL"]
    assert [r.canonical_name for r in a.results] == ["Fasting Blood Sugar", "AST"]
    assert a.results[1].range_used.high == 43  # female AST range


# ---------- user supplies the missing demographics ----------

def test_supplying_age_and_sex_resolves_p003(kb):
    a = run(kb, "P003", age=40, sex="Male")
    assert a.results[0].status == "HIGH"  # 110 > 99
    assert a.demographics_source == {"age": "user_supplied", "sex": "user_supplied"}
    assert a.missing_demographics == []


def test_supplying_sex_resolves_p012_both_ways(kb):
    assert run(kb, "P012", sex="Male").results[0].status == "NORMAL"  # 44 <= 48
    assert run(kb, "P012", sex="Female").results[0].status == "HIGH"  # 44 > 43


def test_recorded_demographics_are_marked_as_recorded(kb):
    assert run(kb, "P001").demographics_source == {"age": "recorded", "sex": "recorded"}
