"""Knowledge Base data models. Every fact keeps the file, line and quote it came from."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, PrivateAttr


class Source(BaseModel):
    file: str
    line: int
    quote: str


class RangeRow(BaseModel):
    id: str
    analyte: str
    aliases: list[str] = Field(default_factory=list)
    sex: Literal["Male", "Female", "All"]
    age_min: int
    age_max: int
    low: float | None = None
    high: float | None = None
    unit: str = ""
    qualitative: str | None = None
    source: Source


class DangerRule(BaseModel):
    id: str
    analyte: str
    condition: Literal["less_than", "greater_than"]
    threshold: float
    unit: str
    source: Source


class Alias(BaseModel):
    alias: str
    canonical: str
    full_name: str | None = None
    origin: Literal["files", "team"] = "files"
    source: Source | None = None


class SafetyRule(BaseModel):
    id: str
    title: str
    text: str
    source: Source


class Directive(BaseModel):
    key: str
    text: str
    source: Source


class NoiseStats(BaseModel):
    files_scanned: int = 0
    repeated_paragraphs: int = 0
    lines_ignored: int = 0


class NameResolution(BaseModel):
    canonical: str | None
    matched: str
    origin: Literal["files", "team"] | None = None


class ParsedResult(BaseModel):
    """One test result exactly as written in a report."""

    raw_name: str
    value_text: str
    value: float | None = None  # None for qualitative ("Negative") or unreadable values
    unit: str = ""
    source: Source


class ParsedReport(BaseModel):
    report_id: str | None = None
    file: str | None = None
    patient_name: str | None = None
    mrn: str | None = None
    issued: str | None = None
    age: int | None = None
    age_state: Literal["ok", "missing", "corrupted"] = "missing"
    sex: Literal["Male", "Female"] | None = None
    sex_state: Literal["ok", "missing", "corrupted"] = "missing"
    results: list[ParsedResult] = Field(default_factory=list)


def normalize_name(text: str) -> str:
    """Lower-case, drop punctuation and extra spaces so 'SGPT', ' sgpt ' and 'S.G.P.T' agree."""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


class KnowledgeBase(BaseModel):
    version: int = 1
    ranges: list[RangeRow] = Field(default_factory=list)
    danger: list[DangerRule] = Field(default_factory=list)
    aliases: list[Alias] = Field(default_factory=list)
    safety_rules: list[SafetyRule] = Field(default_factory=list)
    directives: list[Directive] = Field(default_factory=list)
    urgent_phrase: str = ""
    noise: NoiseStats = Field(default_factory=NoiseStats)

    _index: dict[str, NameResolution] = PrivateAttr(default_factory=dict)

    def model_post_init(self, __context) -> None:
        self._index = self._build_index()

    # ----- lookups -----

    def _build_index(self) -> dict[str, NameResolution]:
        index: dict[str, NameResolution] = {}

        def put(text: str, canonical: str, origin: Literal["files", "team"]) -> None:
            key = normalize_name(text)
            if key and key not in index:
                index[key] = NameResolution(canonical=canonical, matched=text, origin=origin)

        for row in self.ranges:
            put(row.analyte, row.analyte, "files")
            for alias in row.aliases:
                put(alias, row.analyte, "files")
        for a in self.aliases:
            if a.origin == "files":
                put(a.alias, a.canonical, "files")
                put(a.canonical, a.canonical, "files")
                if a.full_name:
                    put(a.full_name, a.canonical, "files")
        for a in self.aliases:
            if a.origin == "team":
                put(a.alias, a.canonical, "team")
        return index

    def resolve_name(self, raw: str) -> NameResolution:
        hit = self._index.get(normalize_name(raw))
        if hit is None:
            return NameResolution(canonical=None, matched=raw, origin=None)
        return hit

    def ranges_for(self, canonical: str) -> list[RangeRow]:
        return [r for r in self.ranges if r.analyte == canonical]

    def danger_for(self, canonical: str) -> list[DangerRule]:
        return [d for d in self.danger if d.analyte == canonical]

    def rule(self, rule_id: str) -> SafetyRule:
        for r in self.safety_rules:
            if r.id == rule_id:
                return r
        raise KeyError(rule_id)

    def directive(self, key: str) -> Directive | None:
        for d in self.directives:
            if d.key == key:
                return d
        return None
