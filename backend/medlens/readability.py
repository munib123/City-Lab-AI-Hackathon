"""Flesch-Kincaid grade level, to keep explanations at about class 8 or below.

Numbers are not counted as words (lab values would otherwise distort the score).
"""

from __future__ import annotations

import re

_WORD = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
_SENTENCE_END = re.compile(r"[.!?]+")


def _syllables(word: str) -> int:
    w = re.sub(r"[^a-z]", "", word.lower())
    if len(w) <= 3:
        return 1
    w = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", w)
    w = re.sub(r"^y", "", w)
    return max(1, len(re.findall(r"[aeiouy]{1,2}", w)))


def flesch_kincaid_grade(text: str) -> float:
    words = _WORD.findall(text)
    if not words:
        return 0.0
    sentences = [s for s in _SENTENCE_END.split(text) if _WORD.search(s)]
    n_sent = max(1, len(sentences))
    syllables = sum(_syllables(w) for w in words)
    return 0.39 * (len(words) / n_sent) + 11.8 * (syllables / len(words)) - 15.59
