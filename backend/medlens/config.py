"""Paths and environment settings. No secrets are stored in the repo."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CORPUS_DIR = ROOT / "lab_reports"
DATA_DIR = ROOT / "data"

KB_PATH = DATA_DIR / "kb.json"
CORPUS_PATH = DATA_DIR / "corpus.json"
UNIT_FACTORS_PATH = DATA_DIR / "unit_factors.json"
EXPLANATIONS_PATH = DATA_DIR / "explanations.json"


DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_GEMINI_FALLBACK = "gemini-2.5-flash-lite"


@dataclass(frozen=True)
class LLMSettings:
    provider: str
    api_key: str
    model: str
    fallback_model: str | None = None  # tried once when the main model is busy, rate-limited or slow

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)


_INVISIBLE = re.compile("[​-‏⁠﻿]")


def _clean_key(value: str) -> str:
    """Drop byte-order marks, zero-width characters and whitespace that sneak into pasted or piped keys."""
    return _INVISIBLE.sub("", value).strip()


def llm_settings() -> LLMSettings:
    """Read LLM settings from the environment at call time (not import time)."""
    provider = os.environ.get("LLM_PROVIDER", "gemini").strip().lower()
    if provider == "groq":
        return LLMSettings(
            provider="groq",
            api_key=_clean_key(os.environ.get("GROQ_API_KEY", "")),
            model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
        )
    fallback = os.environ.get("GEMINI_FALLBACK_MODEL", DEFAULT_GEMINI_FALLBACK).strip() or None
    return LLMSettings(
        provider="gemini",
        api_key=_clean_key(os.environ.get("GEMINI_API_KEY", "")),
        model=os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL),
        fallback_model=fallback,
    )
