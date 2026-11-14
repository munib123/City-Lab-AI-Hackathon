"""Privacy guard (lab rule 1): only the report being viewed may be discussed.

This is plain code that runs before the model sees anything and again on the
model's answer, so a clever question cannot talk the model into leaking records.
It would rather refuse too much than too little.
"""

from __future__ import annotations

import re

from .models import ParsedReport

_GENERIC = [
    re.compile(r"\b(?:other|another|different|all|every)\s+(?:the\s+)?(?:patients?|people|persons?|clients?)\b", re.I),
    re.compile(r"\b(?:someone|somebody|anyone|anybody)\s+else\b", re.I),
    re.compile(r"\b(?:everyone|everybody)'?s\s+(?:results?|records?|reports?|data|numbers?)\b", re.I),
    re.compile(r"\b(?:results?|records?|reports?)\s+(?:of|for)\s+(?:everyone|everybody|all)\b", re.I),
    re.compile(
        r"\bmy\s+(?:mother|father|mom|mum|dad|wife|husband|son|daughter|brother|sister|friend|boss|"
        r"colleague|neighbou?r|cousin|uncle|aunt|grand\w+)'?s?\b",
        re.I,
    ),
]


def _word(pattern: str, flags: int = re.I) -> re.Pattern:
    return re.compile(rf"(?<![A-Za-z0-9]){pattern}(?![A-Za-z0-9])", flags)


class PrivacyGuard:
    def __init__(self, corpus: list[ParsedReport]):
        self.corpus = corpus

    def mentions_other_patient(self, text: str, own: ParsedReport | None) -> str | None:
        """Return what matched (a name, id or phrase) if the text is about someone else, else None."""
        own_tokens = {t.lower() for t in re.findall(r"[A-Za-z]+", (own.patient_name or "") if own else "")}
        own_id = (own.report_id or "").lower() if own else ""
        own_mrn = (own.mrn or "").lower() if own else ""

        for other in self.corpus:
            if own and (
                (other.report_id and other.report_id.lower() == own_id)
                or (other.mrn and other.mrn.lower() == own_mrn)
            ):
                continue
            tokens = re.findall(r"[A-Za-z]+", other.patient_name or "")
            candidates: list[tuple[str, int]] = []  # (pattern text, regex flags)
            if tokens:
                full = r"\s+".join(map(re.escape, tokens))
                candidates.append((full, re.I))
                if tokens[0].lower() not in own_tokens:
                    candidates.append((re.escape(tokens[0]), re.I))
                if len(tokens) > 1 and tokens[-1].lower() not in own_tokens:
                    candidates.append((re.escape(tokens[-1]), 0))  # surname: capitalised only
            if other.mrn:
                candidates.append((re.escape(other.mrn), re.I))
            if other.report_id:
                candidates.append((re.escape(other.report_id), re.I))
            for pattern, flags in candidates:
                m = _word(pattern, flags).search(text)
                if m:
                    return m.group(0)

        for pattern in _GENERIC:
            m = pattern.search(text)
            if m:
                return m.group(0)
        return None
