"""Supabase storage over plain REST (no SDK). Best effort: a storage problem must never break an API request.

Contract of every method: it never raises, it never logs the key or the response body, and it
returns None / False when something went wrong.

Privacy: callers only store chat answers and analyses of CORPUS reports. Pasted report text is never stored.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import httpx

from . import config

log = logging.getLogger("medlens.store")


def demographics_key(age: int | None, sex: str | None) -> str:
    return f"age={'' if age is None else age}|sex={sex or ''}"


class Store:
    def __init__(self, url: str, key: str, http: httpx.Client | None = None, timeout: float = 4.0):
        self.url = url.rstrip("/")
        self.key = key
        self.http = http or httpx.Client(timeout=timeout)

    # ------------------------------------------------------------ plumbing

    def _headers(self, prefer: str) -> dict[str, str]:
        headers = {"apikey": self.key, "Content-Type": "application/json", "Prefer": prefer}
        if self.key.startswith("eyJ"):  # legacy service_role JWT; new sb_secret_ keys are not JWTs
            headers["Authorization"] = f"Bearer {self.key}"
        return headers

    def _post(self, table: str, row: dict, prefer: str, params: dict | None = None) -> httpx.Response | None:
        try:
            response = self.http.post(
                f"{self.url}/rest/v1/{table}", json=row, params=params, headers=self._headers(prefer)
            )
        except Exception as exc:  # timeouts, DNS, a key that cannot be sent as a header, ...
            log.warning("Supabase %s request failed (%s)", table, type(exc).__name__)
            return None
        if response.status_code >= 300:
            log.warning("Supabase %s request failed (HTTP %s)", table, response.status_code)
            return None
        return response

    # ------------------------------------------------------------ chat log

    def log_chat(
        self,
        *,
        report_id: str,
        question: str,
        answer: str,
        answer_type: str,
        llm_used: bool,
        reading_grade: float | None,
        sources: list,
        model: str | None,
        age: int | None,
        sex: str | None,
    ) -> str | None:
        """Store one chat question and answer. Returns the new row id."""
        row = {
            "report_id": report_id,
            "question": question,
            "answer": answer,
            "answer_type": answer_type,
            "llm_used": llm_used,
            "reading_grade": reading_grade,
            "sources": sources,
            "model": model,
            "age": age,
            "sex": sex,
        }
        response = self._post("chat_messages", row, prefer="return=representation")
        if response is None:
            return None
        try:
            return response.json()[0]["id"]
        except (KeyError, IndexError, TypeError, ValueError):
            return None

    # ------------------------------------------------------------ analyses

    def save_analysis(self, report_id: str, age: int | None, sex: str | None, overall: str, result: dict) -> bool:
        """Keep the latest analysis for this report and these demographics (insert or update)."""
        row = {
            "report_id": report_id,
            "demographics_key": demographics_key(age, sex),
            "age": age,
            "sex": sex,
            "overall": overall,
            "result": result,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        response = self._post(
            "analyses",
            row,
            prefer="resolution=merge-duplicates,return=minimal",
            params={"on_conflict": "report_id,demographics_key"},
        )
        return response is not None


_stores: dict[tuple[str, str], Store] = {}


def get_store() -> Store | None:
    """The configured Store, or None when Supabase variables are missing (local runs and tests)."""
    s = config.supabase_settings()
    if not s.enabled:
        return None
    key = (s.url, s.key)
    if key not in _stores:
        _stores[key] = Store(s.url, s.key)
    return _stores[key]
