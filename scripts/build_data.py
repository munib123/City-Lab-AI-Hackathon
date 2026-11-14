"""Regenerate data/kb.json from lab_reports/ and print the audit table.

Run from the repo root:  python scripts/build_data.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from medlens import config  # noqa: E402
from medlens.kb import audit_table  # noqa: E402
from medlens.kb_build import build_kb  # noqa: E402
from medlens.report_parser import build_corpus  # noqa: E402


def main() -> None:
    kb = build_kb(config.CORPUS_DIR)
    config.DATA_DIR.mkdir(exist_ok=True)
    config.KB_PATH.write_text(kb.model_dump_json(indent=2) + "\n", encoding="utf-8")
    corpus = build_corpus(config.CORPUS_DIR)
    config.CORPUS_PATH.write_text(
        json.dumps([r.model_dump() for r in corpus], indent=2) + "\n", encoding="utf-8"
    )
    print(audit_table(kb))
    print(f"corpus.json written: {len(corpus)} reports, {sum(len(r.results) for r in corpus)} results")
    print(
        f"kb.json written: {len(kb.ranges)} ranges, {len(kb.danger)} danger limits, "
        f"{len(kb.aliases)} aliases, {len(kb.safety_rules)} rules; "
        f"{kb.noise.repeated_paragraphs} boilerplate paragraphs and {kb.noise.lines_ignored} lines ignored"
    )


if __name__ == "__main__":
    main()
