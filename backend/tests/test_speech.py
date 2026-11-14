"""What may be spoken, and exactly how it is worded. Only text the API itself produced is ever read aloud."""

import pytest

from medlens.corpus import get_report
from medlens.engine import analyze_report
from medlens.explain import enrich
from medlens.kb import load_kb
from medlens.lint import find_diagnosis_phrases
from medlens.readability import flesch_kincaid_grade
from medlens.speech import DEFAULT_VOICE, MAX_CHARS, VOICES, audio_key, chat_speech, clean_for_speech, report_speech


@pytest.fixture(scope="module")
def kb():
    return load_kb()


def analysis(kb, rid, **kw):
    return enrich(analyze_report(get_report(rid), kb, **kw), kb)


# ---------- cleaning for the ear ----------

def test_file_references_are_not_read_aloud():
    text = "108 mg/dL is above the range 70-99 mg/dL (5_ranges_biochemistry.md:4). Please see a doctor today."
    assert clean_for_speech(text) == "108 mg/dL is above the range 70-99 mg/dL. Please see a doctor today."


def test_multiplication_sign_is_spoken_as_times():
    assert clean_for_speech("6.0 mmol/L × 18 = 108 mg/dL") == "6.0 mmol/L times 18 = 108 mg/dL"


def test_long_text_is_cut_at_a_sentence_end():
    long = ("This is a sentence. " * 200).strip()
    out = clean_for_speech(long)
    assert len(out) <= MAX_CHARS and out.endswith(".") and out.count("sentence") >= 1


def test_whitespace_is_collapsed():
    assert clean_for_speech("a  b\n\n c") == "a b c"


# ---------- chat answers ----------

def test_chat_speech_cleans_the_stored_answer():
    assert chat_speech("Your ALT is 45 U/L (5_ranges_biochemistry.md:6).") == "Your ALT is 45 U/L."


def test_blank_chat_answer_is_rejected():
    with pytest.raises(ValueError):
        chat_speech("   ")


# ---------- report parts ----------

def test_summary_for_an_urgent_report_leads_with_the_warning(kb):
    text = report_speech(analysis(kb, "P004"), "summary")
    assert text.startswith("Some results are urgent. Please see a doctor today.")
    assert "Hemoglobin: 6.5 g/dL." in text and "Platelet Count" in text
    assert "This is urgent" in text and "below the range" in text


def test_summary_for_an_all_normal_report(kb):
    text = report_speech(analysis(kb, "P001"), "summary")
    assert text.startswith("All results are inside the ranges.")


def test_summary_mentions_what_is_missing(kb):
    text = report_speech(analysis(kb, "P003"), "summary")
    assert "could not be checked" in text and "age or sex is needed" in text.lower()


def test_urgent_part_only_exists_when_something_is_urgent(kb):
    text = report_speech(analysis(kb, "P013"), "urgent")
    assert "see a doctor today" in text.lower() and "Fasting Blood Sugar" in text
    with pytest.raises(LookupError):
        report_speech(analysis(kb, "P001"), "urgent")


def test_questions_are_read_as_a_numbered_list(kb):
    a = analysis(kb, "P004")
    text = report_speech(a, "questions")
    assert text.startswith("Questions to ask your doctor.")
    for n, q in enumerate(a.doctor_questions, start=1):
        assert f"{n}. {q}" in text


def test_single_result_part_includes_its_explanation(kb):
    text = report_speech(analysis(kb, "P009"), "result", index=0)
    assert text.startswith("ALT.") and "liver" in text and "high" in text.lower()


def test_result_index_out_of_range(kb):
    with pytest.raises(LookupError):
        report_speech(analysis(kb, "P001"), "result", index=5)


def test_unknown_part_is_rejected(kb):
    with pytest.raises(ValueError):
        report_speech(analysis(kb, "P001"), "everything")


@pytest.mark.parametrize("rid", [f"P{n:03d}" for n in range(1, 15)])
def test_spoken_text_is_safe_short_and_has_no_names_or_file_refs(kb, rid):
    a = analysis(kb, rid)
    parts = ["summary", "questions"] + (["urgent"] if a.urgent_banner else [])
    texts = [report_speech(a, p) for p in parts] + [report_speech(a, "result", index=i) for i in range(len(a.results))]
    for text in texts:
        assert 0 < len(text) <= MAX_CHARS
        assert find_diagnosis_phrases(text) == []
        assert ".md" not in text and "×" not in text
        assert a.patient.name.split()[0] not in text  # a name is never spoken
        assert a.patient.mrn not in text


# ---------- cache key and voices ----------

def test_audio_key_depends_on_text_and_voice():
    assert audio_key("v1", "hello") == audio_key("v1", "hello")
    assert audio_key("v1", "hello") != audio_key("v2", "hello")
    assert audio_key("v1", "hello") != audio_key("v1", "hello!")
    assert len(audio_key("v1", "hello")) == 64


def test_default_voice_is_in_the_allowed_list():
    assert DEFAULT_VOICE in VOICES and "en-IN-NeerjaNeural" in VOICES
