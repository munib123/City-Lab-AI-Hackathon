"""What may be read aloud, and how it is worded for the ear.

Only text the API itself produced is ever spoken: a stored chat answer, or a part of a corpus report's analysis.
Arbitrary text is never accepted, and patient names and ids are never spoken.
"""

from __future__ import annotations

import hashlib
import re

from .schemas import Analysis, ResultAnalysis

VOICES = (
    "en-US-AriaNeural",
    "en-US-GuyNeural",
    "en-GB-SoniaNeural",
    "en-IN-NeerjaNeural",
    "en-IN-PrabhatNeural",
)
DEFAULT_VOICE = "en-US-AriaNeural"
MAX_CHARS = 1500  # about a minute of speech

_FILE_REF = re.compile(r"\s*\([^()]*\.md:\d+[^()]*\)")

_OVERALL = {
    "ALL_NORMAL": "All results are inside the ranges.",
    "NOT_NORMAL": "Some results are outside the ranges.",
    "INCOMPLETE": "Some results could not be checked.",
    "NO_RESULTS": "No results were found.",
}
_STATUS = {
    "NORMAL": "This is inside the range.",
    "LOW": "This is below the range.",
    "HIGH": "This is above the range.",
    "ABNORMAL": "This is not the normal result.",
    "URGENT_LOW": "This is urgent.",
    "URGENT_HIGH": "This is urgent.",
    "NEEDS_INFO": "Your age or sex is needed to check this.",
    "UNCLASSIFIED": "This cannot be classified from the files.",
}


def clean_for_speech(text: str) -> str:
    """Remove file references and symbols that sound wrong aloud; cap the length at a sentence end."""
    text = _FILE_REF.sub("", text).replace("×", "times")
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > MAX_CHARS:
        cut = text[:MAX_CHARS]
        end = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "))
        text = cut[: end + 1] if end > 0 else cut.rstrip()
    return text


def audio_key(voice: str, text: str) -> str:
    """Cache key: the same words in the same voice are synthesized only once."""
    return hashlib.sha256(f"{voice}\n{text}".encode("utf-8")).hexdigest()


def chat_speech(answer: str) -> str:
    text = clean_for_speech(answer)
    if not text:
        raise ValueError("this answer has no text to read")
    return text


def _name(r: ResultAnalysis) -> str:
    return r.canonical_name or r.raw_name


def _value(r: ResultAnalysis) -> str:
    return f"{r.value_text} {r.unit}".strip()


def _urgent_phrase(analysis: Analysis) -> str:
    title = analysis.urgent_banner.title if analysis.urgent_banner else ""
    return title.split(":", 1)[-1].strip() or "see a doctor today"


def report_speech(analysis: Analysis, part: str, index: int | None = None) -> str:
    """Text for one part of a report: summary, urgent, questions, or one result.

    Raises ValueError for an unknown part and LookupError when the part does not exist for this report.
    """
    if part == "summary":
        if analysis.urgent_banner:
            lines = [f"Some results are urgent. Please {_urgent_phrase(analysis)}."]
        else:
            lines = [_OVERALL.get(analysis.overall, "")]
        for r in analysis.results:
            lines.append(f"{_name(r)}: {_value(r)}. {_STATUS.get(r.status, '')}")
        return clean_for_speech(" ".join(lines))

    if part == "urgent":
        if not analysis.urgent_banner:
            raise LookupError("this report has no urgent results")
        items = " ".join(f"{i.test}: {i.value}." for i in analysis.urgent_banner.items)
        return clean_for_speech(f"{analysis.urgent_banner.message} {items}")

    if part == "questions":
        numbered = " ".join(f"{n}. {q}" for n, q in enumerate(analysis.doctor_questions, start=1))
        return clean_for_speech(f"Questions to ask your doctor. {numbered}")

    if part == "result":
        if index is None or not 0 <= index < len(analysis.results):
            raise LookupError("this report has no result with that index")
        r = analysis.results[index]
        pieces = [f"{_name(r)}."]
        if r.explanation:
            pieces.append(r.explanation.measures)
        pieces.append(r.reason)
        if r.explanation and r.explanation.meaning:
            pieces.append(r.explanation.meaning)
        return clean_for_speech(" ".join(pieces))

    raise ValueError(f"unknown part {part!r}")
