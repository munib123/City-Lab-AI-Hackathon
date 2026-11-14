import pytest

from medlens.lint import find_diagnosis_phrases
from medlens.readability import flesch_kincaid_grade


# ---------- no-diagnosis lint ----------

@pytest.mark.parametrize(
    "text",
    [
        "You have diabetes.",
        "you have anemia",
        "You've got an infection.",
        "This means you have a liver disease.",
        "You are diabetic.",
        "You are anemic and need iron.",
        "You were diagnosed with hepatitis.",
        "This is diagnosed as hypothyroidism.",
        "You suffer from a thyroid disorder.",
        "I diagnose you with high cholesterol.",
        "This confirms you have kidney disease.",
        "You definitely have an infection.",
    ],
)
def test_diagnosis_wording_is_caught(text):
    assert find_diagnosis_phrases(text), text


@pytest.mark.parametrize(
    "text",
    [
        "A high number can mean the liver is under stress.",
        "If you have questions, ask your doctor.",
        "You have a result of 13.5 g/dL.",
        "Only a licensed medical doctor can diagnose conditions.",
        "This can be linked to low iron. A doctor can tell which.",
        "Ask your doctor what could be causing this.",
        "Do I have to repeat the test?",
    ],
)
def test_safe_wording_is_not_flagged(text):
    assert find_diagnosis_phrases(text) == [], text


# ---------- reading level ----------

def test_simple_text_has_a_low_grade():
    assert flesch_kincaid_grade("The cat sat on the mat. It was a big red cat.") < 2


def test_hard_text_has_a_high_grade():
    hard = (
        "Hepatocellular transaminase elevation necessitates comprehensive differential "
        "evaluation incorporating pharmacological, metabolic and autoimmune considerations."
    )
    assert flesch_kincaid_grade(hard) > 14


def test_empty_text_does_not_crash():
    assert flesch_kincaid_grade("") == 0.0
    assert flesch_kincaid_grade("   ") == 0.0


def test_grade_ignores_numbers_and_units_noise():
    # numbers are not words; they must not blow up the grade
    assert flesch_kincaid_grade("My ALT is 85 U/L. The range is 7-55 U/L. What does this mean?") < 8
