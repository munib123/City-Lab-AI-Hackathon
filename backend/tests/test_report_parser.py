"""Reading patient reports. Results are read exactly as written; nothing is guessed."""

import pytest

from medlens import config
from medlens.report_parser import build_corpus, parse_report_file, parse_report_text


def _file(prefix: str):
    return next(config.CORPUS_DIR.glob(f"report_{prefix}_*.md"))


def _triples(report):
    return [(r.raw_name, r.value_text, r.unit) for r in report.results]


# (report id, expected results) for all 14 real reports, covering every layout
EXPECTED = {
    "P001": [("Hemoglobin", "13.5", "g/dL"), ("WBC", "6000", "cells/mcL")],  # "- Name: v unit"
    "P002": [("SGPT", "45", "U/L")],  # markdown table
    "P003": [("Fasting Blood Sugar", "110", "mg/dL")],  # Test Conducted / Value Recorded
    "P004": [("Hemoglobin", "6.5", "g/dL"), ("Platelet Count", "120000", "cells/mcL")],  # "* **Name**: v"
    "P005": [("Fasting Blood Sugar", "6.0", "mmol/L")],
    "P006": [("Serum Ferritin", "25", "ng/mL")],
    "P007": [("TSH", "2.5", "mIU/L")],  # bare "Name: v unit"
    "P008": [("pH Level", "5.5", ""), ("Protein", "Negative", "")],  # "* Name -> v"
    "P009": [("ALT", "85", "U/L"), ("AST", "60", "U/L")],
    "P010": [("Cholesterol", "200", "mg/dL")],
    "P011": [("WBC", "12000", "cells/mcL"), ("PLT", "140000", "cells/mcL")],
    "P012": [("AST", "44", "U/L")],  # Test: / Result:
    "P013": [("Fasting Blood Sugar", "350", "mg/dL")],
    "P014": [("FBS", "85", "mg/dL"), ("SGOT", "22", "U/L")],
}


@pytest.mark.parametrize("pid, expected", EXPECTED.items())
def test_every_corpus_report_parses_to_the_expected_results(pid, expected):
    report = parse_report_file(_file(pid))
    assert report.report_id == pid
    assert _triples(report) == expected


def test_no_boilerplate_is_mistaken_for_a_result():
    for pid in EXPECTED:
        report = parse_report_file(_file(pid))
        for r in report.results:
            assert len(r.raw_name) < 40, r


def test_demographics_of_a_normal_report():
    r = parse_report_file(_file("P001"))
    assert (r.patient_name, r.age, r.sex, r.mrn) == ("Alice Smith", 28, "Female", "CLD-P001-9942")
    assert (r.age_state, r.sex_state) == ("ok", "ok")


def test_sex_is_taken_from_the_record_not_the_name():
    # "Bob Jones" is recorded Female; the parser must not "fix" that
    assert parse_report_file(_file("P002")).sex == "Female"


def test_corrupted_age_and_sex_are_flagged_not_guessed():
    r = parse_report_file(_file("P003"))
    assert (r.age, r.sex) == (None, None)
    assert (r.age_state, r.sex_state) == ("corrupted", "corrupted")


def test_missing_sex_is_flagged_but_age_is_kept():
    r = parse_report_file(_file("P012"))
    assert r.age == 32 and r.age_state == "ok"
    assert r.sex is None and r.sex_state == "missing"


def test_qualitative_result_has_no_number():
    r = parse_report_file(_file("P008"))
    protein = r.results[1]
    assert protein.value is None and protein.value_text == "Negative"
    assert r.results[0].value == 5.5


def test_each_result_keeps_its_source_line():
    r = parse_report_file(_file("P005"))
    res = r.results[0]
    assert res.source.file == _file("P005").name
    assert "6.0 mmol/L" in res.source.quote


# ---------- pasted / uploaded text (hidden test reports may use other layouts) ----------

def test_pasted_text_with_equals_layout():
    text = "Patient Full Name: Zed Test\nRecorded Age: 30\nBiological Sex: Male\n\nHemoglobin = 14.1 g/dL\nALT = 40 U/L\n"
    r = parse_report_text(text)
    assert _triples(r) == [("Hemoglobin", "14.1", "g/dL"), ("ALT", "40", "U/L")]
    assert (r.age, r.sex) == (30, "Male")


def test_pasted_text_with_short_sex_codes():
    r = parse_report_text("Age: 41\nSex: F\nTSH: 3.1 mIU/L\n")
    assert (r.age, r.sex) == (41, "Female")


def test_pasted_results_only_leaves_demographics_missing():
    r = parse_report_text("Hemoglobin: 13.0 g/dL\n")
    assert r.age is None and r.age_state == "missing"
    assert r.sex is None and r.sex_state == "missing"
    assert len(r.results) == 1


def test_pasted_prose_is_not_parsed_as_results():
    r = parse_report_text("The analytical phase was completed successfully with no machine errors reported:\nHemoglobin: 13.0 g/dL\n")
    assert [x.raw_name for x in r.results] == ["Hemoglobin"]


def test_demographic_lines_are_never_results():
    r = parse_report_text("Recorded Age: 28\nBiological Sex: Female\nMedical Record Number (MRN): X-1\nDate of Issuance: 2026-11-13\nALT: 40 U/L\n")
    assert [x.raw_name for x in r.results] == ["ALT"]


# ---------- corpus index ----------

def test_corpus_has_fourteen_reports_in_order():
    corpus = build_corpus(config.CORPUS_DIR)
    assert [r.report_id for r in corpus] == [f"P{n:03d}" for n in range(1, 15)]
    assert all(r.results for r in corpus), "every report must have at least one result"
