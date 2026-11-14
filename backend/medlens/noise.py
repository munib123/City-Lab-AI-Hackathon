"""Find the real content in the corpus files and set the boilerplate aside.

Every file ends with the same 'APPENDIX n' paragraphs (legal, HIPAA, ISO text).
Two independent signals mark them as noise:
  1. structure: everything from the first 'APPENDIX' heading onward
  2. repetition: a long paragraph that appears in 3 or more files
"""

from __future__ import annotations

from collections import defaultdict

MIN_LEN = 200  # characters; real data lines are much shorter than boilerplate
MIN_FILES = 3


def find_repeated_paragraphs(files: dict[str, list[str]]) -> set[str]:
    seen: dict[str, set[str]] = defaultdict(set)
    for name, lines in files.items():
        for line in lines:
            text = line.strip()
            if len(text) >= MIN_LEN:
                seen[text].add(name)
    return {text for text, names in seen.items() if len(names) >= MIN_FILES}


def content_lines(lines: list[str], repeated: set[str]) -> list[tuple[int, str]]:
    """Return (1-based line number, text) for lines that are real content."""
    out: list[tuple[int, str]] = []
    for number, raw in enumerate(lines, start=1):
        if "APPENDIX" in raw:
            break
        text = raw.rstrip()
        if not text.strip() or text.strip() in repeated:
            continue
        out.append((number, text))
    return out
