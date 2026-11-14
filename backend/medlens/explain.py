"""Plain-language layer: explanations, 3-5 doctor questions, urgent banner, demographics prompt.

This module never changes a status. It only adds words around what the engine decided.
"""

from __future__ import annotations

from .explanations import LABEL, Explanations, load_explanations
from .models import KnowledgeBase
from .schemas import Analysis, Explanation, ResultAnalysis, UrgentBanner, UrgentItem

DISCLAIMER = (
    "Only a licensed medical doctor can diagnose conditions. "
    "This page only explains the numbers on your report in simple words."
)

FOLLOWUP = "Do I need any more tests or a repeat test, and when?"
HABITS = "Could my food, medicines or daily habits change these results?"
FIRST = "Which result should I talk about first?"
NEXT_STEPS = "What should I do before my next visit?"
FILLERS = [FOLLOWUP, HABITS, FIRST, NEXT_STEPS]

LOW_STATUSES = {"LOW", "URGENT_LOW"}
HIGH_STATUSES = {"HIGH", "URGENT_HIGH", "ABNORMAL"}
URGENT_STATUSES = {"URGENT_LOW", "URGENT_HIGH"}


def _name(r: ResultAnalysis) -> str:
    return r.canonical_name or r.raw_name


def _shown(r: ResultAnalysis) -> str:
    return f"{r.value_text} {r.unit}".strip()


def _explanation(r: ResultAnalysis, ex: Explanations) -> Explanation | None:
    if r.canonical_name is None or r.status == "UNCLASSIFIED":
        return None
    item = ex.items.get(r.canonical_name)
    if item is None:
        return None
    meaning = None
    if r.status in LOW_STATUSES:
        meaning = item.low
    elif r.status in HIGH_STATUSES:
        meaning = item.high
    return Explanation(measures=item.measures, meaning=meaning, label=ex.label or LABEL)


def _question(r: ResultAnalysis) -> str | None:
    name = _name(r)
    if r.status in URGENT_STATUSES:
        return f"My {name} result is {_shown(r)}. The lab says this is urgent. What should I do today?"
    if r.status in LOW_STATUSES:
        return f"My {name} is lower than the lab range ({_shown(r)}). What could be causing this?"
    if r.status == "HIGH":
        return f"My {name} is higher than the lab range ({_shown(r)}). What could be causing this?"
    if r.status == "ABNORMAL":
        return f"My {name} result was {r.value_text}. What does this mean, and should it be tested again?"
    if r.status == "NEEDS_INFO":
        what = " and ".join(r.needs)
        return f"Can we confirm my {what} so my {name} result can be checked?"
    if r.status == "UNCLASSIFIED":
        return f"The lab files could not classify {name}. What does this result mean for me?"
    return None


def _doctor_questions(results: list[ResultAnalysis]) -> list[str]:
    def group(statuses: set[str]) -> list[str]:
        return [q for r in results if r.status in statuses for q in [_question(r)] if q]

    candidates = (
        group(URGENT_STATUSES)
        + group({"LOW", "HIGH", "ABNORMAL"})
        + group({"NEEDS_INFO"})
        + group({"UNCLASSIFIED"})
    )
    candidates = list(dict.fromkeys(candidates))
    has_issue = bool(candidates)

    if len(candidates) > 4:
        questions = candidates[:4] + [FOLLOWUP]
    else:
        questions = candidates[:]
        for filler in FILLERS:
            if len(questions) >= 3:
                break
            questions.append(filler)
        if has_issue and FOLLOWUP not in questions and len(questions) < 5:
            questions.append(FOLLOWUP)
    return list(dict.fromkeys(questions))[:5]


def _banner(results: list[ResultAnalysis], kb: KnowledgeBase) -> UrgentBanner | None:
    urgent = [r for r in results if r.status in URGENT_STATUSES]
    if not urgent:
        return None
    phrase = kb.urgent_phrase or "see a doctor"
    return UrgentBanner(
        title=f"Urgent: {phrase}",
        message=(
            f"One or more results are at an urgent level. Please {phrase}. "
            "This is not a diagnosis. Only a doctor can say what it means."
        ),
        items=[UrgentItem(test=_name(r), value=_shown(r), reason=r.reason) for r in urgent],
    )


def _demographics_prompt(analysis: Analysis, kb: KnowledgeBase) -> str | None:
    if not analysis.missing_demographics or not any(r.needs for r in analysis.results):
        return None
    what = " and ".join(analysis.missing_demographics)
    verb = "is" if len(analysis.missing_demographics) == 1 else "are"
    try:
        s = kb.rule("missing_demographics").source
        ref = f" ({s.file}:{s.line})"
    except KeyError:
        ref = ""
    return (
        f"The right normal range cannot be chosen for some results because {what} {verb} missing. "
        f"Please tell us your {what}. We do not guess it from your name{ref}."
    )


def enrich(analysis: Analysis, kb: KnowledgeBase, explanations: Explanations | None = None) -> Analysis:
    """Return a copy of the analysis with explanations, questions, banner and prompt added."""
    ex = explanations or load_explanations()
    results = [r.model_copy(update={"explanation": _explanation(r, ex)}) for r in analysis.results]
    return analysis.model_copy(
        update={
            "results": results,
            "doctor_questions": _doctor_questions(results),
            "urgent_banner": _banner(results, kb),
            "demographics_prompt": _demographics_prompt(analysis, kb),
            "disclaimer": DISCLAIMER,
        }
    )
