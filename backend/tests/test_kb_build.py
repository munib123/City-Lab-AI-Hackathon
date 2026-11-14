"""Knowledge Base built from the real CityLab files.

Every fact must carry {file, line, quote} and the quote must really be on that
line of that file, so a judge can check any number against the source.
"""

import pytest

from medlens import config
from medlens.kb_build import build_kb


@pytest.fixture(scope="module")
def kb():
    return build_kb(config.CORPUS_DIR)


def _ranges(kb, analyte, sex=None):
    rows = [r for r in kb.ranges if r.analyte == analyte]
    return [r for r in rows if sex is None or r.sex == sex]


# ---------- ranges (all three file layouts) ----------

def test_thirteen_range_rows_in_total(kb):
    assert len(kb.ranges) == 13


def test_hematology_bullets_are_split_by_sex(kb):
    male = _ranges(kb, "Hemoglobin", "Male")[0]
    female = _ranges(kb, "Hemoglobin", "Female")[0]
    assert (male.low, male.high, male.unit) == (13.8, 17.2, "g/dL")
    assert (female.low, female.high, female.unit) == (12.1, 15.1, "g/dL")
    assert (male.age_min, male.age_max) == (18, 100)


def test_all_sexes_rows_are_stored_as_all(kb):
    wbc = _ranges(kb, "White Blood Cell Count")[0]
    plt = _ranges(kb, "Platelet Count")[0]
    assert (wbc.sex, wbc.low, wbc.high, wbc.unit) == ("All", 4500, 11000, "cells/mcL")
    assert (plt.sex, plt.low, plt.high) == ("All", 150000, 450000)


def test_biochemistry_table_rows(kb):
    assert [(r.low, r.high) for r in _ranges(kb, "ALT", "Male")] == [(7, 55)]
    assert [(r.low, r.high) for r in _ranges(kb, "ALT", "Female")] == [(7, 45)]
    assert [(r.low, r.high) for r in _ranges(kb, "AST", "Male")] == [(8, 48)]
    assert [(r.low, r.high) for r in _ranges(kb, "AST", "Female")] == [(8, 43)]
    chol = _ranges(kb, "Cholesterol")[0]
    assert (chol.sex, chol.low, chol.high, chol.unit) == ("All", 125, 200, "mg/dL")
    fbs = _ranges(kb, "Fasting Blood Sugar")[0]
    assert (fbs.low, fbs.high, fbs.unit) == (70, 99, "mg/dL")


def test_thyroid_and_urine_bullets(kb):
    tsh = _ranges(kb, "TSH")[0]
    assert (tsh.low, tsh.high, tsh.unit) == (0.4, 4.0, "mIU/L")
    ph = _ranges(kb, "Urine pH")[0]
    assert (ph.low, ph.high, ph.unit) == (4.5, 8.0, "")


def test_urine_protein_is_qualitative(kb):
    protein = _ranges(kb, "Urine Protein")[0]
    assert protein.qualitative == "Negative"
    assert protein.low is None and protein.high is None


def test_abbreviation_in_brackets_becomes_an_alias(kb):
    hb = _ranges(kb, "Hemoglobin", "Male")[0]
    assert "Hb" in hb.aliases


# ---------- danger list ----------

def test_four_danger_rules(kb):
    got = {(d.analyte, d.condition, d.threshold, d.unit) for d in kb.danger}
    assert got == {
        ("Hemoglobin", "less_than", 7.0, "g/dL"),
        ("Fasting Blood Sugar", "greater_than", 300.0, "mg/dL"),
        ("Platelet Count", "less_than", 50000.0, "cells/mcL"),
        ("ALT", "greater_than", 1000.0, "U/L"),
    }


# ---------- aliases (glossary) ----------

def test_seven_glossary_aliases(kb):
    pairs = {(a.alias, a.canonical) for a in kb.aliases if a.origin == "files"}
    assert pairs == {
        ("SGPT", "ALT"),
        ("SGOT", "AST"),
        ("FBS", "Fasting Blood Sugar"),
        ("Hb", "Hemoglobin"),
        ("PLT", "Platelet Count"),
        ("RBC", "Red Blood Cell Count"),
        ("WBC", "White Blood Cell Count"),
    }


# ---------- safety rules and directives ----------

def test_four_safety_rules_with_stable_ids(kb):
    ids = [r.id for r in kb.safety_rules]
    assert ids == ["privacy", "no_diagnosis", "missing_demographics", "unknown_tests"]
    assert "another patient" in kb.rule("privacy").text
    assert "cannot be classified from the files" in kb.rule("unknown_tests").text


def test_edge_case_directives_are_captured(kb):
    assert kb.directive("boundary_normal") is not None
    assert kb.directive("age_upper_inclusive") is not None
    assert kb.directive("danger_inclusive") is not None


def test_urgent_phrase_comes_from_the_file(kb):
    assert kb.urgent_phrase == "see a doctor today"


# ---------- provenance: every quote is really on that line ----------

def _all_sourced(kb):
    items = [*kb.ranges, *kb.danger, *kb.safety_rules, *kb.directives]
    items += [a for a in kb.aliases if a.origin == "files"]
    return items


def test_every_fact_quote_is_on_its_cited_line(kb):
    items = _all_sourced(kb)
    assert items, "no facts parsed"
    for item in items:
        src = item.source
        lines = (config.CORPUS_DIR / src.file).read_text(encoding="utf-8").splitlines()
        assert src.quote in lines[src.line - 1], f"{src.file}:{src.line} does not contain {src.quote!r}"


def test_noise_is_reported_not_parsed(kb):
    # 7 identical boilerplate paragraphs appear in all 20 files
    assert kb.noise.repeated_paragraphs == 7
    assert kb.noise.files_scanned == 20
