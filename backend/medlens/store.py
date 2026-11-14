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

AUDIO_BUCKET = "tts-audio"


def demographics_key(age: int | None, sex: str | None) -> str:
    return f"age={'' if age is None else age}|sex={sex or ''}"


class Store:
    def __init__(self, url: str, key: str, http: httpx.Client | None = None, timeout: float = 4.0):
        self.url = url.rstrip("/")
        self.key = key
        self.http = http or httpx.Client(timeout=timeout)

    # ------------------------------------------------------------ plumbing

    def _auth(self) -> dict[str, str]:
        headers = {"apikey": self.key}
        if self.key.startswith("eyJ"):  # legacy service_role JWT; new sb_secret_ keys are not JWTs
            headers["Authorization"] = f"Bearer {self.key}"
        return headers

    def _headers(self, prefer: str) -> dict[str, str]:
        return {**self._auth(), "Content-Type": "application/json", "Prefer": prefer}

    def _get(self, table: str, params: dict) -> list | None:
        try:
            response = self.http.get(f"{self.url}/rest/v1/{table}", params=params, headers=self._auth())
        except Exception as exc:
            log.warning("Supabase %s read failed (%s)", table, type(exc).__name__)
            return None
        if response.status_code >= 300:
            log.warning("Supabase %s read failed (HTTP %s)", table, response.status_code)
            return None
        try:
            rows = response.json()
        except ValueError:
            return None
        return rows if isinstance(rows, list) else None

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


    # ------------------------------------------------------------ read-aloud audio

    def get_chat_answer(self, chat_id: str) -> str | None:
        """The stored answer of one chat row (so only text the API itself produced is ever spoken)."""
        rows = self._get("chat_messages", {"id": f"eq.{chat_id}", "select": "answer", "limit": "1"})
        return rows[0].get("answer") if rows else None

    def find_audio(self, text_hash: str, voice: str) -> str | None:
        """Storage path of already-synthesized audio for this text and voice, if any."""
        rows = self._get(
            "tts_audio",
            {"text_hash": f"eq.{text_hash}", "voice": f"eq.{voice}", "select": "storage_path", "limit": "1"},
        )
        return rows[0].get("storage_path") if rows else None

    def upload_audio(self, path: str, data: bytes) -> bool:
        """Put an MP3 in the private tts-audio bucket (overwrites the same path)."""
        try:
            response = self.http.post(
                f"{self.url}/storage/v1/object/{AUDIO_BUCKET}/{path}",
                content=data,
                headers={**self._auth(), "Content-Type": "audio/mpeg", "x-upsert": "true"},
            )
        except Exception as exc:
            log.warning("Supabase audio upload failed (%s)", type(exc).__name__)
            return False
        if response.status_code >= 300:
            log.warning("Supabase audio upload failed (HTTP %s)", response.status_code)
            return False
        return True

    def signed_audio_url(self, path: str, expires_in: int = 3600) -> str | None:
        """A temporary link to a private audio file."""
        try:
            response = self.http.post(
                f"{self.url}/storage/v1/object/sign/{AUDIO_BUCKET}/{path}",
                json={"expiresIn": expires_in},
                headers={**self._auth(), "Content-Type": "application/json"},
            )
        except Exception as exc:
            log.warning("Supabase audio signing failed (%s)", type(exc).__name__)
            return None
        if response.status_code >= 300:
            log.warning("Supabase audio signing failed (HTTP %s)", response.status_code)
            return None
        try:
            signed = response.json()["signedURL"]
        except (KeyError, TypeError, ValueError):
            return None
        return f"{self.url}/storage/v1{signed}"

    def save_audio(self, text_hash: str, voice: str, source: str, text: str, storage_path: str, byte_size: int) -> bool:
        row = {
            "text_hash": text_hash,
            "voice": voice,
            "source": source,
            "text": text,
            "storage_path": storage_path,
            "byte_size": byte_size,
        }
        response = self._post(
            "tts_audio", row, prefer="resolution=merge-duplicates,return=minimal", params={"on_conflict": "text_hash,voice"}
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
