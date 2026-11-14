"""Load the committed Knowledge Base and print an audit table for checking it by eye."""

from __future__ import annotations

from functools import lru_cache

from . import config
from .kb_build import build_kb
from .models import KnowledgeBase


@lru_cache(maxsize=1)
def load_kb() -> KnowledgeBase:
    """Read data/kb.json; if it is missing, build from the corpus files."""
    if config.KB_PATH.exists():
        return KnowledgeBase.model_validate_json(config.KB_PATH.read_text(encoding="utf-8"))
    return build_kb(config.CORPUS_DIR)


def _where(src) -> str:
    return f"{src.file}:{src.line}" if src else "(team, not in files)"


def audit_table(kb: KnowledgeBase) -> str:
    """One line per fact with its file:line, so every number can be checked against the source."""
    rows: list[str] = []
    for r in kb.ranges:
        limits = r.qualitative if r.qualitative else f"{r.low:g} - {r.high:g} {r.unit}".strip()
        rows.append(f"RANGE   {r.id}  {r.analyte:<24} {r.sex:<6} {r.age_min}-{r.age_max}  {limits:<22} {_where(r.source)}")
    for d in kb.danger:
        sign = "<" if d.condition == "less_than" else ">"
        rows.append(f"DANGER  {d.id:<4} {d.analyte:<24} {sign} {d.threshold:g} {d.unit:<10} {_where(d.source)}")
    for a in kb.aliases:
        rows.append(f"ALIAS   {a.alias:<10} -> {a.canonical:<24} [{a.origin}] {_where(a.source)}")
    for s in kb.safety_rules:
        rows.append(f"RULE    {s.id:<22} {_where(s.source)}")
    for d in kb.directives:
        rows.append(f"DIRECT  {d.key:<22} {_where(d.source)}")
    return "\n".join(rows) + "\n"
