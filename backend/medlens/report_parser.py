"""Read patient reports (corpus files or pasted text) into structured results.

No medical knowledge lives here. The parser only reads what is written: names,
numbers, units and demographics. Missing or corrupted age/sex is flagged, never
guessed. Anything that looks like prose is left alone.
"""

from __future__ import annotations

import re
from pathlib import Path

from .models import ParsedReport, ParsedResult, Source
from .noise import content_lines, find_repeated_paragraphs

SOURCE_PASTED = "pasted text"
MAX_LINE = 200  # real result lines are short; longer lines are prose or boilerplate

QUALITATIVE = r"negative|positive|trace|normal|abnormal|nil|present|absent|reactive|non-reactive"

RE_BULLET = re.compile(r"^\s*(?:[-*•]\s+)")
RE_SEPARATOR = re.compile(r"^(?P<name>[^:=]+?)\s*(?::|=|->|→)\s*(?P<rest>\S.*)$")
RE_NUMBER = re.compile(r"^(?P<qual>[<>≤≥]=?\s*)?(?P<num>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)\s*(?P<unit>.*)$")
RE_QUALITATIVE = re.compile(rf"^(?P<word>{QUALITATIVE})\b\s*(?P<unit>.*)$", re.I)

RE_NAME = re.compile(r"\b(?:patient\s+(?:full\s+)?name|full\s+name|patient)\b\W*[:\-]\s*(?P<v>.+)$", re.I)
RE_AGE = re.compile(r"\b(?:recorded\s+)?age\b\W*[:\-]\s*(?P<v>.*)$", re.I)
RE_SEX = re.compile(r"\b(?:biological\s+)?(?:sex|gender)\b\W*[:\-]\s*(?P<v>.*)$", re.I)
RE_MRN = re.compile(r"(?:\bmrn\b|medical\s+record\s+number).*?[:\-]\s*(?P<v>\S+)\s*$", re.I)
RE_DATE = re.compile(r"\bdate\s+of\s+issuance\b\W*[:\-]\s*(?P<v>\S+)", re.I)

NAME_LABELS = {"test conducted", "test name", "test", "analyte"}
VALUE_LABELS = {"value recorded", "result", "value", "result value"}


def _clean(raw: str) -> str:
    text = RE_BULLET.sub("", raw).replace("**", "").strip()
    return text


def _state_of(text: str) -> str:
    t = text.lower()
    if "corrupt" in t:
        return "corrupted"
    return "missing"


def _parse_age(value: str) -> tuple[int | None, str]:
    m = re.match(r"^(\d{1,3})\b", value.strip())
    if m:
        return int(m.group(1)), "ok"
    return None, _state_of(value)


def _parse_sex(value: str) -> tuple[str | None, str]:
    v = value.strip().lower()
    if v in ("male", "m"):
        return "Male", "ok"
    if v in ("female", "f"):
        return "Female", "ok"
    return None, _state_of(value)


def _number(text: str) -> float:
    if re.fullmatch(r"\d{1,3}(?:,\d{3})+(?:\.\d+)?", text):
        return float(text.replace(",", ""))
    return float(text.replace(",", "."))


def _clean_unit(unit: str) -> str:
    unit = unit.split("(")[0].strip()
    return re.sub(r"\s+[HL*]$", "", unit).strip()


def _read_value(rest: str) -> tuple[str, float | None, str] | None:
    """Return (value_text, value, unit) or None if the text does not look like a result value."""
    rest = rest.strip()
    m = RE_NUMBER.match(rest)
    if m:
        value_text = (m.group("qual") or "") + m.group("num")
        value = None if m.group("qual") else _number(m.group("num"))
        return value_text.strip(), value, _clean_unit(m.group("unit"))
    m = RE_QUALITATIVE.match(rest)
    if m:
        return m.group("word").capitalize(), None, _clean_unit(m.group("unit"))
    return None


def _plausible_name(name: str) -> bool:
    name = name.strip()
    return 0 < len(name) <= 40 and len(name.split()) <= 5 and bool(re.match(r"[A-Za-z]", name))


def _table_cells(text: str) -> list[str]:
    return [c.strip() for c in text.strip().strip("|").split("|")]


def parse_report_text(
    text: str,
    file: str | None = None,
    report_id: str | None = None,
    repeated: set[str] | None = None,
) -> ParsedReport:
    lines = text.splitlines()
    content = content_lines(lines, repeated or set())
    source_name = file or SOURCE_PASTED

    report = ParsedReport(report_id=report_id, file=file)
    seen_age = seen_sex = False

    entries: list[tuple[int, str, str]] = []  # (line number, raw, cleaned)
    for number, raw in content:
        cleaned = _clean(raw)
        if cleaned and len(cleaned) <= MAX_LINE:
            entries.append((number, raw.strip(), cleaned))

    def src(number: int, quote: str) -> Source:
        return Source(file=source_name, line=number, quote=quote)

    i = 0
    while i < len(entries):
        number, raw, cleaned = entries[i]
        i += 1
        if cleaned.startswith("#"):
            continue

        # ---- demographics ----
        m = RE_MRN.search(cleaned)
        if m:
            report.mrn = m.group("v")
            continue
        m = RE_DATE.search(cleaned)
        if m:
            report.issued = m.group("v")
            continue
        m = RE_NAME.search(cleaned)
        if m:
            report.patient_name = m.group("v").strip()
            continue
        m = RE_AGE.search(cleaned)
        if m:
            report.age, report.age_state = _parse_age(m.group("v"))
            seen_age = True
            continue
        m = RE_SEX.search(cleaned)
        if m:
            report.sex, report.sex_state = _parse_sex(m.group("v"))
            seen_sex = True
            continue

        # ---- table row: | name | value | unit | ----
        if cleaned.startswith("|"):
            cells = _table_cells(cleaned.replace("**", ""))
            if len(cells) >= 2 and not re.fullmatch(r":?-{2,}:?", cells[0]):
                read = _read_value(" ".join(c for c in cells[1:3] if c))
                if read and _plausible_name(cells[0]):
                    value_text, value, unit = read
                    report.results.append(
                        ParsedResult(raw_name=cells[0], value_text=value_text, value=value, unit=unit or (cells[2] if len(cells) > 2 else ""), source=src(number, raw))
                    )
            continue

        m = RE_SEPARATOR.match(cleaned)
        if not m:
            continue
        name, rest = m.group("name").strip(), m.group("rest").strip()

        # ---- label pair: "Test: AST" followed by "Result: 44 U/L" ----
        if name.lower() in NAME_LABELS and i < len(entries):
            n2, raw2, cleaned2 = entries[i]
            m2 = RE_SEPARATOR.match(cleaned2)
            if m2 and m2.group("name").strip().lower() in VALUE_LABELS:
                read = _read_value(m2.group("rest"))
                if read:
                    value_text, value, unit = read
                    report.results.append(
                        ParsedResult(raw_name=rest, value_text=value_text, value=value, unit=unit, source=src(number, f"{raw} | {raw2}"))
                    )
                i += 1
                continue

        # ---- "Name: value unit", "Name = value", "Name -> value" ----
        read = _read_value(rest)
        if read and _plausible_name(name):
            value_text, value, unit = read
            report.results.append(ParsedResult(raw_name=name, value_text=value_text, value=value, unit=unit, source=src(number, raw)))

    if not seen_age:
        report.age_state = "missing"
    if not seen_sex:
        report.sex_state = "missing"
    return report


def parse_report_file(path: Path, repeated: set[str] | None = None) -> ParsedReport:
    path = Path(path)
    m = re.match(r"report_(P\d+)_", path.name)
    return parse_report_text(
        path.read_text(encoding="utf-8"),
        file=path.name,
        report_id=m.group(1) if m else None,
        repeated=repeated,
    )


def build_corpus(corpus_dir: Path) -> list[ParsedReport]:
    corpus_dir = Path(corpus_dir)
    all_files = {p.name: p.read_text(encoding="utf-8").splitlines() for p in sorted(corpus_dir.glob("*.md"))}
    repeated = find_repeated_paragraphs(all_files)
    return [parse_report_file(p, repeated) for p in sorted(corpus_dir.glob("report_*.md"))]
