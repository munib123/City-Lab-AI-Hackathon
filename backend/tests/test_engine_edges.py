"""Edge cases: boundaries, danger limits, units, bands and unreadable input."""

import pytest

from medlens.engine import analyze_report
from medlens.kb import load_kb
from medlens.report_parser import parse_report_text


@pytest.fixture(scope="module")
def kb():
    return load_kb()


def one(kb, test_line, age=30, sex="Female", **kw):
    """Analyse a single pasted result with chosen demographics and return its ResultAnalysis."""
    text = f"Recorded Age: {age}\nBiological Sex: {sex}\n{test_line}\n"
    a = analyze_report(parse_report_text(text), kb, **kw)
    assert len(a.results) == 1, a.results
    return a.results[0]


# ---------- value exactly on a limit is NORMAL (file rule), just outside is not ----------

@pytest.mark.parametrize(
    "line, status",
    [
        ("Hemoglobin: 12.1 g/dL", "NORMAL"),  # female lower limit
        ("Hemoglobin: 15.1 g/dL", "NORMAL"),  # female upper limit
        ("Hemoglobin: 12.0 g/dL", "LOW"),
        ("Hemoglobin: 15.2 g/dL", "HIGH"),
        ("Fasting Blood Sugar: 70 mg/dL", "NORMAL"),
        ("Fasting Blood Sugar: 99 mg/dL", "NORMAL"),
        ("Fasting Blood Sugar: 100 mg/dL", "HIGH"),
        ("Fasting Blood Sugar: 69 mg/dL", "LOW"),
        ("Cholesterol: 125 mg/dL", "NORMAL"),
        ("Cholesterol: 201 mg/dL", "HIGH"),
        ("TSH: 0.4 mIU/L", "NORMAL"),
        ("TSH: 4.0 mIU/L", "NORMAL"),
        ("TSH: 4.1 mIU/L", "HIGH"),
    ],
)
def test_limits_are_inclusive(kb, line, status):
    assert one(kb, line).status == status


def test_boundary_flag_only_when_exactly_on_a_limit(kb):
    assert one(kb, "Hemoglobin: 12.1 g/dL").boundary is True
    assert one(kb, "Hemoglobin: 13.0 g/dL").boundary is False


# ---------- age bands: upper bound inclusive, outside the files' bands is unclassifiable ----------

@pytest.mark.parametrize("age", [18, 100])
def test_age_band_edges_are_included(kb, age):
    assert one(kb, "ALT: 40 U/L", age=age).status == "NORMAL"


@pytest.mark.parametrize("age", [17, 101, 5])
def test_age_outside_the_bands_in_the_files_is_unclassified(kb, age):
    r = one(kb, "ALT: 40 U/L", age=age)
    assert r.status == "UNCLASSIFIED"
    assert "18" in r.reason and "100" in r.reason
    assert "cannot be classified from the files" in r.reason


# ---------- danger limits (inclusive: "hit or pass") ----------

@pytest.mark.parametrize(
    "line, status",
    [
        ("Hemoglobin: 7.0 g/dL", "URGENT_LOW"),
        ("Hemoglobin: 6.9 g/dL", "URGENT_LOW"),
        ("Hemoglobin: 7.1 g/dL", "LOW"),
        ("Fasting Blood Sugar: 300 mg/dL", "URGENT_HIGH"),
        ("Fasting Blood Sugar: 299 mg/dL", "HIGH"),
        ("Platelet Count: 50000 cells/mcL", "URGENT_LOW"),
        ("Platelet Count: 50001 cells/mcL", "LOW"),
        ("ALT: 1000 U/L", "URGENT_HIGH"),
        ("ALT: 999 U/L", "HIGH"),
    ],
)
def test_danger_limits_are_inclusive(kb, line, status):
    assert one(kb, line, sex="Male").status == status


def test_urgent_beats_the_normal_range_check_and_names_its_source(kb):
    r = one(kb, "Hemoglobin: 6.0 g/dL")
    assert r.status == "URGENT_LOW"
    assert r.danger.source.line == 6
    assert "see a doctor today" in r.reason


def test_urgent_value_is_still_flagged_when_sex_is_unknown(kb):
    text = "Recorded Age: 40\nBiological Sex: [NOT PROVIDED]\nHemoglobin: 5.0 g/dL\n"
    a = analyze_report(parse_report_text(text), kb)
    r = a.results[0]
    assert r.status == "URGENT_LOW"
    assert r.needs == ["sex"]  # still asks, but the warning is not held back
    assert a.overall == "URGENT"


def test_urgent_value_is_still_flagged_when_age_is_unknown(kb):
    a = analyze_report(parse_report_text("Fasting Blood Sugar: 450 mg/dL\n"), kb)
    assert a.results[0].status == "URGENT_HIGH"
    assert a.overall == "URGENT"


# ---------- demographics ----------

def test_sex_is_only_asked_for_when_the_range_depends_on_it(kb):
    text = "Recorded Age: 40\nBiological Sex: [NOT PROVIDED]\nTSH: 2.0 mIU/L\n"
    a = analyze_report(parse_report_text(text), kb)
    assert a.results[0].status == "NORMAL"  # TSH range is the same for all sexes
    assert a.results[0].needs == []


def test_missing_age_always_blocks_because_every_range_has_an_age_band(kb):
    a = analyze_report(parse_report_text("Biological Sex: Male\nTSH: 2.0 mIU/L\n"), kb)
    assert a.results[0].status == "NEEDS_INFO" and a.results[0].needs == ["age"]


def test_needs_info_message_follows_the_missing_demographics_rule(kb):
    a = analyze_report(parse_report_text("Hemoglobin: 13.0 g/dL\n"), kb)
    r = a.results[0]
    assert r.status == "NEEDS_INFO" and r.needs == ["age", "sex"]
    assert "cannot be chosen" in r.reason
    assert "1_lab_safety_rules.md" in r.reason


def test_invalid_user_supplied_values_are_rejected(kb):
    rep = parse_report_text("Hemoglobin: 13.0 g/dL\n")
    with pytest.raises(ValueError):
        analyze_report(rep, kb, age=-3, sex="Male")
    with pytest.raises(ValueError):
        analyze_report(rep, kb, age=30, sex="Robot")


# ---------- units ----------

def test_same_unit_in_different_spelling_needs_no_conversion(kb):
    r = one(kb, "WBC: 6000 cells/µL")
    assert r.status == "NORMAL" and r.conversion is None


def test_known_conversions_are_shown(kb):
    r = one(kb, "Hemoglobin: 130 g/L")
    assert r.status == "NORMAL" and r.converted_value == 13.0
    assert r.conversion.working == "130 g/L × 0.1 = 13 g/dL"
    r = one(kb, "Cholesterol: 5.0 mmol/L")
    assert r.converted_value == 193.35 and r.status == "NORMAL"


def test_unit_without_a_known_conversion_is_unclassified(kb):
    r = one(kb, "ALT: 40 mg/dL")
    assert r.status == "UNCLASSIFIED"
    assert "cannot be classified from the files" in r.reason
    assert r.converted_value is None


def test_missing_unit_is_not_assumed(kb):
    r = one(kb, "Hemoglobin: 13.5")
    assert r.status == "UNCLASSIFIED"
    assert "unit" in r.reason


def test_urgent_check_uses_the_converted_value(kb):
    r = one(kb, "Hemoglobin: 60 g/L")  # = 6.0 g/dL
    assert r.status == "URGENT_LOW"
    r = one(kb, "Fasting Blood Sugar: 17.0 mmol/L", sex="Male")  # = 306 mg/dL
    assert r.status == "URGENT_HIGH"


# ---------- names, qualitative and unreadable values ----------

def test_name_in_glossary_without_a_range_is_unclassified(kb):
    r = one(kb, "RBC: 4.7 million/mcL")
    assert r.status == "UNCLASSIFIED"
    assert r.canonical_name == "Red Blood Cell Count"  # recognised, but no range in the files


@pytest.mark.parametrize("word, status", [("Negative", "NORMAL"), ("negative", "NORMAL"), ("Positive", "ABNORMAL"), ("Trace", "ABNORMAL")])
def test_qualitative_protein(kb, word, status):
    assert one(kb, f"Protein: {word}").status == status


def test_number_for_a_qualitative_test_is_unclassified(kb):
    assert one(kb, "Urine Protein: 30 mg/dL").status == "UNCLASSIFIED"


def test_word_for_a_numeric_test_is_unclassified(kb):
    assert one(kb, "TSH: Negative").status == "UNCLASSIFIED"


def test_value_with_a_less_than_sign_is_not_treated_as_a_plain_number(kb):
    r = one(kb, "TSH: <0.1 mIU/L")
    assert r.status == "UNCLASSIFIED"
    assert "plain number" in r.reason


def test_every_result_keeps_the_report_line_it_came_from(kb):
    r = one(kb, "Hemoglobin: 13.5 g/dL")
    assert "13.5" in r.source.quote and r.source.line >= 1


def test_overall_priority_urgent_then_not_normal_then_incomplete(kb):
    text = "Recorded Age: 30\nBiological Sex: Male\nSerum Ferritin: 25 ng/mL\nALT: 85 U/L\nHemoglobin: 5.0 g/dL\n"
    assert analyze_report(parse_report_text(text), kb).overall == "URGENT"
    text = "Recorded Age: 30\nBiological Sex: Male\nSerum Ferritin: 25 ng/mL\nALT: 85 U/L\n"
    assert analyze_report(parse_report_text(text), kb).overall == "NOT_NORMAL"
    text = "Recorded Age: 30\nBiological Sex: Male\nSerum Ferritin: 25 ng/mL\nALT: 40 U/L\n"
    assert analyze_report(parse_report_text(text), kb).overall == "INCOMPLETE"
    text = "Recorded Age: 30\nBiological Sex: Male\nALT: 40 U/L\n"
    assert analyze_report(parse_report_text(text), kb).overall == "ALL_NORMAL"
