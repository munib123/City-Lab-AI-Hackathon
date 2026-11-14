"""No-diagnosis lint. The lab's rule 2: never say a patient has a specific disease.

The check is deliberately conservative: it would rather flag a harmless sentence
than let "you have diabetes" through. It is used on every explanation we write
and on every chat answer before it is shown.
"""

from __future__ import annotations

import re

_CONDITION = (
    r"(?:diabet\w*|an[a]?emi\w*|\w+itis|\w+osis|\w+emia|\w+pathy|\w+oma|\w*cancer|\w*disease|"
    r"infection|disorder|syndrome|deficien\w*|hypo\w+|hyper\w+|failure|cholesterol|condition)"
)

_PATTERNS = [
    # "you have diabetes", "you've got an infection", "you definitely have a liver disease"
    re.compile(
        rf"\byou(?:'ve|\s+(?:definitely\s+|probably\s+|clearly\s+)?(?:have|has))\s+"
        rf"(?:got\s+)?(?:an?\s+|the\s+)?(?:\w+\s+){{0,2}}?{_CONDITION}\b",
        re.I,
    ),
    # "you are diabetic", "you're anemic"
    re.compile(r"\byou(?:'re|\s+are)\s+(?:\w+\s+)?(?:diabetic|an[a]?emic|\w+emic|sick|ill)\b", re.I),
    # "diagnosed with ...", "diagnosed as ..."
    re.compile(r"\bdiagnos(?:ed|is)\s+(?:with|as|of)\b", re.I),
    re.compile(r"\byou\s+suffer(?:ing)?\s+from\b", re.I),
    re.compile(r"\bI\s+diagnose\b", re.I),
    re.compile(r"\bthis\s+(?:confirms|proves)\b", re.I),
]


def find_diagnosis_phrases(text: str) -> list[str]:
    """Return the phrases that sound like a diagnosis (empty list = safe)."""
    found: list[str] = []
    for pattern in _PATTERNS:
        found.extend(m.group(0) for m in pattern.finditer(text))
    return found
