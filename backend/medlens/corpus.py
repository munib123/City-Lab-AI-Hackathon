"""The 14 parsed corpus reports, loaded from the committed data/corpus.json."""

from __future__ import annotations

import json
from functools import lru_cache

from . import config
from .models import ParsedReport
from .report_parser import build_corpus


@lru_cache(maxsize=1)
def load_corpus() -> list[ParsedReport]:
    if config.CORPUS_PATH.exists():
        raw = json.loads(config.CORPUS_PATH.read_text(encoding="utf-8"))
        return [ParsedReport.model_validate(item) for item in raw]
    return build_corpus(config.CORPUS_DIR)


def get_report(report_id: str) -> ParsedReport | None:
    for report in load_corpus():
        if report.report_id == report_id:
            return report
    return None
