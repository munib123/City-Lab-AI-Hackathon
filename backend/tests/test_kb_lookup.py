"""Name resolution: map whatever the report calls a test to the file's name."""

import pytest

from medlens import config
from medlens.kb_build import build_kb


@pytest.fixture(scope="module")
def kb():
    return build_kb(config.CORPUS_DIR)


@pytest.mark.parametrize(
    "raw, canonical",
    [
        ("SGPT", "ALT"),
        ("sgpt", "ALT"),
        ("  SGOT ", "AST"),
        ("FBS", "Fasting Blood Sugar"),
        ("Fasting Blood Sugar", "Fasting Blood Sugar"),
        ("Hb", "Hemoglobin"),
        ("Hemoglobin", "Hemoglobin"),
        ("PLT", "Platelet Count"),
        ("Platelet Count", "Platelet Count"),
        ("WBC", "White Blood Cell Count"),
        ("Alanine Aminotransferase", "ALT"),
        ("Cholesterol", "Cholesterol"),
        ("TSH", "TSH"),
    ],
)
def test_resolves_names_and_aliases(kb, raw, canonical):
    res = kb.resolve_name(raw)
    assert res.canonical == canonical


def test_unknown_test_does_not_resolve(kb):
    res = kb.resolve_name("Serum Ferritin")
    assert res.canonical is None


def test_name_in_glossary_but_without_range_is_recognised(kb):
    res = kb.resolve_name("RBC")
    assert res.canonical == "Red Blood Cell Count"
    assert kb.ranges_for("Red Blood Cell Count") == []


def test_team_aliases_are_flagged_as_not_from_the_files(kb):
    res = kb.resolve_name("pH Level")
    assert res.canonical == "Urine pH"
    assert res.origin == "team"
    res = kb.resolve_name("Protein")
    assert res.canonical == "Urine Protein"
    assert res.origin == "team"


def test_file_aliases_are_flagged_as_files(kb):
    assert kb.resolve_name("SGPT").origin == "files"
    assert kb.resolve_name("Hemoglobin").origin == "files"


def test_ranges_for_returns_all_rows_of_an_analyte(kb):
    assert len(kb.ranges_for("ALT")) == 2
    assert len(kb.ranges_for("TSH")) == 1
