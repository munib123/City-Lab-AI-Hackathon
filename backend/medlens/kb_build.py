"""Build the Knowledge Base from the CityLab knowledge files (everything not named report_*.md).

Lines are recognised by their shape (bullet, table row, numbered rule), not by file
name, so a re-ordered or re-split corpus still parses. Anything that is not
recognised is ignored rather than guessed.
"""

from __future__ import annotations

import re
from pathlib import Path

from .models import (
    Alias,
    DangerRule,
    Directive,
    KnowledgeBase,
    NoiseStats,
    RangeRow,
    SafetyRule,
    Source,
)
from .noise import content_lines, find_repeated_paragraphs

# Names the lab's own glossary does not cover but the corpus reports use.
# They are labelled origin="team" everywhere so the UI can say "not from the files".
TEAM_ALIASES: dict[str, str] = {
    "pH Level": "Urine pH",
    "Protein": "Urine Protein",
}

_NUM = r"\d+(?:\.\d+)?"

RE_RANGE_HEADER = re.compile(r"^\*\s+\*\*(?P<name>[^*]+)\*\*:\s*$")
RE_RANGE_SUB = re.compile(
    rf"^\s+\*\s+(?P<sex>Male|Female|All Sexes?)(?:\s+Demographic)?\s*"
    rf"\((?P<amin>\d+)\s*-\s*(?P<amax>\d+)\s*yrs?\):\s*"
    rf"(?P<lo>{_NUM})\s*-\s*(?P<hi>{_NUM})\s*(?P<unit>\S*)\s*$",
    re.I,
)
RE_RANGE_INLINE = re.compile(
    r"^\*\s+\*\*(?P<name>[^*]+)\*\*:\s*(?P<body>.+?)\s*"
    r"\(Applicable to (?P<sex>[^,]+),\s*(?P<amin>\d+)\s*-\s*(?P<amax>\d+)\s*yrs?\)\.?\s*$",
    re.I,
)
RE_BODY_NUMERIC = re.compile(rf"^(?P<lo>{_NUM})\s*-\s*(?P<hi>{_NUM})\s*(?P<unit>\S*)$")
RE_NAME_ABBR = re.compile(r"^(?P<base>.+?)\s*\((?P<abbr>[^)]+)\)\s*$")

RE_ALIAS = re.compile(
    r"^\*\s+\*\*(?P<alias>[^*]+)\*\*\s+(?:is the exact equivalent of|maps to)\s+"
    r"\*\*(?P<canon>[^*]+)\*\*\s*(?:\((?P<full>[^)]+)\))?",
    re.I,
)
RE_SAFETY_RULE = re.compile(r"^\d+\.\s+\*\*(?P<title>[^*]+)\*\*:\s*(?P<text>.+)$")

RULE_IDS = {
    "PRIVACY": "privacy",
    "NO DIAGNOSTIC": "no_diagnosis",
    "MISSING DEMOGRAPHICS": "missing_demographics",
    "UNKNOWN TESTS": "unknown_tests",
}

DIRECTIVE_PATTERNS = {
    "boundary_normal": re.compile(r"exactly\*{0,2} on a lower or upper range limit", re.I),
    "age_upper_inclusive": re.compile(r"Age boundaries are inclusive of the upper bound", re.I),
    "danger_inclusive": re.compile(r"hit or pass", re.I),
}
RE_URGENT_PHRASE = re.compile(r'e\.g\.,\s*"(?P<phrase>[^"]+)"')


def _sex(text: str) -> str:
    t = text.strip().lower()
    if t.startswith("male"):
        return "Male"
    if t.startswith("female"):
        return "Female"
    return "All"


def _split_name(raw: str) -> tuple[str, list[str]]:
    name = raw.strip().strip("*").strip()
    m = RE_NAME_ABBR.match(name)
    if m:
        return m.group("base").strip(), [m.group("abbr").strip()]
    return name, []


def _cells(line: str) -> list[str]:
    return [c.strip().replace("**", "") for c in line.strip().strip("|").split("|")]


def build_kb(corpus_dir: Path) -> KnowledgeBase:
    corpus_dir = Path(corpus_dir)
    all_files = {p.name: p.read_text(encoding="utf-8").splitlines() for p in sorted(corpus_dir.glob("*.md"))}
    repeated = find_repeated_paragraphs(all_files)

    kb = KnowledgeBase()
    ignored = 0
    range_n = danger_n = 0

    for name, lines in all_files.items():
        content = content_lines(lines, repeated)
        ignored += len(lines) - len(content)
        if name.startswith("report_"):
            continue  # patient reports are parsed by report_parser, not here

        def src(number: int, text: str, _n=name) -> Source:
            return Source(file=_n, line=number, quote=text.strip())

        current: tuple[str, list[str]] | None = None  # bullet header being filled by sub-bullets

        for number, text in content:
            # ---- safety rules (numbered list) ----
            m = RE_SAFETY_RULE.match(text.strip())
            if m:
                title = m.group("title").strip()
                rid = next((v for k, v in RULE_IDS.items() if title.upper().startswith(k)), re.sub(r"\W+", "_", title.lower()))
                kb.safety_rules.append(SafetyRule(id=rid, title=title, text=m.group("text").strip(), source=src(number, text)))
                continue

            # ---- directives (edge-case rules, danger wording) ----
            for key, pattern in DIRECTIVE_PATTERNS.items():
                if pattern.search(text) and kb.directive(key) is None:
                    kb.directives.append(Directive(key=key, text=text.strip(), source=src(number, text)))
            if "hit or pass" in text.lower():
                up = RE_URGENT_PHRASE.search(text)
                if up:
                    kb.urgent_phrase = up.group("phrase")

            # ---- glossary aliases ----
            m = RE_ALIAS.match(text.strip())
            if m:
                kb.aliases.append(
                    Alias(
                        alias=m.group("alias").strip(),
                        canonical=m.group("canon").strip(),
                        full_name=(m.group("full") or "").strip() or None,
                        origin="files",
                        source=src(number, text),
                    )
                )
                continue

            # ---- table rows: biochemistry ranges and the danger list ----
            if text.strip().startswith("|"):
                cells = _cells(text)
                if len(cells) >= 7 and re.fullmatch(_NUM, cells[2] or "x") and re.fullmatch(_NUM, cells[4] or "x"):
                    range_n += 1
                    kb.ranges.append(
                        RangeRow(
                            id=f"R{range_n:02d}",
                            analyte=cells[0],
                            sex=_sex(cells[1]),
                            age_min=int(cells[2]),
                            age_max=int(cells[3]),
                            low=float(cells[4]),
                            high=float(cells[5]),
                            unit=cells[6],
                            source=src(number, text),
                        )
                    )
                elif len(cells) >= 4 and cells[1].lower() in ("less than", "greater than") and re.fullmatch(_NUM, cells[2]):
                    danger_n += 1
                    kb.danger.append(
                        DangerRule(
                            id=f"D{danger_n}",
                            analyte=cells[0],
                            condition="less_than" if cells[1].lower() == "less than" else "greater_than",
                            threshold=float(cells[2]),
                            unit=cells[3],
                            source=src(number, text),
                        )
                    )
                continue

            # ---- bullets: hematology (header + sub-bullets) ----
            m = RE_RANGE_HEADER.match(text)
            if m:
                current = _split_name(m.group("name"))
                continue
            m = RE_RANGE_SUB.match(text)
            if m and current:
                range_n += 1
                analyte, aliases = current
                kb.ranges.append(
                    RangeRow(
                        id=f"R{range_n:02d}",
                        analyte=analyte,
                        aliases=aliases,
                        sex=_sex(m.group("sex")),
                        age_min=int(m.group("amin")),
                        age_max=int(m.group("amax")),
                        low=float(m.group("lo")),
                        high=float(m.group("hi")),
                        unit=m.group("unit"),
                        source=src(number, text),
                    )
                )
                continue

            # ---- bullets: one-line ranges (thyroid, urine) ----
            m = RE_RANGE_INLINE.match(text.strip())
            if m:
                range_n += 1
                analyte, aliases = _split_name(m.group("name"))
                body = m.group("body").strip()
                num = RE_BODY_NUMERIC.match(body)
                kb.ranges.append(
                    RangeRow(
                        id=f"R{range_n:02d}",
                        analyte=analyte,
                        aliases=aliases,
                        sex=_sex(m.group("sex")),
                        age_min=int(m.group("amin")),
                        age_max=int(m.group("amax")),
                        low=float(num.group("lo")) if num else None,
                        high=float(num.group("hi")) if num else None,
                        unit=num.group("unit") if num else "",
                        qualitative=None if num else body,
                        source=src(number, text),
                    )
                )

    # Range abbreviations ("Hemoglobin (Hb)") are glossary-style aliases too
    for alias, canonical in TEAM_ALIASES.items():
        kb.aliases.append(Alias(alias=alias, canonical=canonical, origin="team", source=None))

    kb.noise = NoiseStats(files_scanned=len(all_files), repeated_paragraphs=len(repeated), lines_ignored=ignored)
    kb.model_post_init(None)  # rebuild the name index now the lists are filled
    return kb
