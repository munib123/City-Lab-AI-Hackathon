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


_INVISIBLE = re.compile("[\u200b-\u200f\u2060\ufeff]")


def _clean_key(value: str) -> str:
    """Drop byte-order marks, zero-width characters and whitespace that sneak into pasted or piped keys."""
    return _INVISIBLE.sub("", value).strip()


@dataclass(frozen=True)
class SupabaseSettings:
    url: str
    key: str

    @property
    def enabled(self) -> bool:
        return bool(self.url and self.key)


def clean_env(name: str) -> str:
    """An environment variable, cleaned of invisible characters and whitespace ('' if unset)."""
    return _clean_key(os.environ.get(name, ""))


@dataclass(frozen=True)
class SMTPSettings:
    host: str
    port: int
    email: str
    password: str

    @property
    def enabled(self) -> bool:
        return bool(self.host and self.email and self.password)


def smtp_settings() -> SMTPSettings:
    """Gmail SMTP settings. The password is a Gmail *app password* (Gmail shows it in groups of four, with spaces)."""
    try:
        port = int(clean_env("SMTP_PORT") or 587)
    except ValueError:
        port = 587
    return SMTPSettings(
        host=clean_env("SMTP_HOST") or "smtp.gmail.com",
        port=port,
        email=clean_env("SMTP_EMAIL").strip("\"'"),
        password=re.sub(r"\s+", "", clean_env("SMTP_APP_PASSWORD")).strip("\"'"),
    )


def public_app_url() -> str:
    """The frontend's public address (for QR links). Empty until the frontend is deployed."""
    return _clean_key(os.environ.get("PUBLIC_APP_URL", "")).rstrip("/")


def supabase_settings() -> SupabaseSettings:
    """Supabase REST settings. Variables are injected by the Vercel Supabase integration."""
    url = _clean_key(os.environ.get("SUPABASE_URL", "")).rstrip("/")
    key = _clean_key(os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")) or _clean_key(os.environ.get("SUPABASE_SECRET_KEY", ""))
    return SupabaseSettings(url=url, key=key)


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
