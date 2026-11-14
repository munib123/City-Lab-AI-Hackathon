"""data/kb.json is committed so the deployed app does not re-parse files on every request.
These tests make sure it can never drift from the corpus."""

from medlens import config
from medlens.kb import audit_table, load_kb
from medlens.kb_build import build_kb


def test_committed_kb_matches_a_fresh_build():
    fresh = build_kb(config.CORPUS_DIR)
    committed = load_kb()
    assert committed.model_dump() == fresh.model_dump(), "run: python scripts/build_data.py"


def test_load_kb_resolves_names_after_loading_from_json():
    kb = load_kb()
    assert kb.resolve_name("SGPT").canonical == "ALT"


def test_audit_table_lists_every_fact_with_its_line_number():
    kb = load_kb()
    table = audit_table(kb)
    assert "4_ranges_hematology.md:5" in table  # Male haemoglobin row
    assert "3_dangerous_urgent_values.md:6" in table  # Hb danger limit
    assert "2_medical_glossary.md:3" in table  # SGPT alias
    assert table.count("\n") >= 13 + 4 + 7 + 4
