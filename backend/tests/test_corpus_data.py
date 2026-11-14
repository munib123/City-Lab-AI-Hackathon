from medlens import config
from medlens.corpus import get_report, load_corpus
from medlens.report_parser import build_corpus


def test_committed_corpus_matches_a_fresh_parse():
    fresh = [r.model_dump() for r in build_corpus(config.CORPUS_DIR)]
    committed = [r.model_dump() for r in load_corpus()]
    assert committed == fresh, "run: python scripts/build_data.py"


def test_get_report_by_id():
    assert get_report("P004").patient_name == "Diana Prince"


def test_get_report_unknown_id_returns_none():
    assert get_report("P999") is None
    assert get_report("") is None
