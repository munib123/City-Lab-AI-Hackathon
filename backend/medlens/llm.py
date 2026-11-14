"""LLM adapters (Gemini, Groq). Chat is the only feature that uses an LLM.

Both adapters send JSON-only requests and never put the API key in a URL or an
error message. Without a key, get_llm() returns None and chat degrades gracefully.
"""

from __future__ import annotations

import re
from typing import Protocol

import httpx

from . import config

# Types the model may answer with. 'unavailable' is only ever produced by our own code.
MODEL_ANSWER_TYPES = ("answered", "not_in_files", "refused_other_patient", "refused_diagnosis", "needs_info")

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "answer": {"type": "STRING"},
        "answer_type": {"type": "STRING", "enum": list(MODEL_ANSWER_TYPES)},
        "sources": {"type": "ARRAY", "items": {"type": "STRING"}},
    },
    "required": ["answer", "answer_type", "sources"],
}


class LLMError(Exception):
    """The model could not be reached or gave no usable reply. Never contains the API key."""


class LLMClient(Protocol):
    def generate_json(self, system: str, user: str) -> str: ...


def supports_sampling_params(model: str) -> bool:
    """Gemini 3.6+ and 4 ignore temperature (and warn), so it is not sent for them."""
    m = re.search(r"gemini-(\d+)(?:\.(\d+))?", model.lower())
    if not m:
        return True
    major, minor = int(m.group(1)), int(m.group(2) or 0)
    return not (major >= 4 or (major == 3 and minor >= 6))


class GeminiClient:
    def __init__(self, api_key: str, model: str, http: httpx.Client | None = None, timeout: float = 25.0):
        self.api_key = api_key
        self.model = model
        self.http = http or httpx.Client(timeout=timeout)

    def generate_json(self, system: str, user: str) -> str:
        config_body: dict = {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            "maxOutputTokens": 1024,
        }
        if supports_sampling_params(self.model):
            config_body["temperature"] = 0
        body = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": config_body,
        }
        url = f"{GEMINI_BASE}/models/{self.model}:generateContent"
        try:
            response = self.http.post(url, json=body, headers={"x-goog-api-key": self.api_key})
        except httpx.HTTPError as exc:
            raise LLMError(f"Gemini request failed ({type(exc).__name__})") from None
        if response.status_code != 200:
            raise LLMError(f"Gemini returned HTTP {response.status_code}")
        try:
            return response.json()["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError, ValueError):
            raise LLMError("Gemini returned no usable answer (it may have been blocked)") from None


class GroqClient:
    def __init__(self, api_key: str, model: str, http: httpx.Client | None = None, timeout: float = 25.0):
        self.api_key = api_key
        self.model = model
        self.http = http or httpx.Client(timeout=timeout)

    def generate_json(self, system: str, user: str) -> str:
        body = {
            "model": self.model,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
        }
        try:
            response = self.http.post(GROQ_URL, json=body, headers={"Authorization": f"Bearer {self.api_key}"})
        except httpx.HTTPError as exc:
            raise LLMError(f"Groq request failed ({type(exc).__name__})") from None
        if response.status_code != 200:
            raise LLMError(f"Groq returned HTTP {response.status_code}")
        try:
            return response.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError, ValueError):
            raise LLMError("Groq returned no usable answer") from None


_clients: dict[tuple[str, str, str], LLMClient] = {}


def get_llm() -> LLMClient | None:
    """Build the configured client, or None when no key is set (chat is then off).

    Clients are cached per (provider, key, model) so connections are reused between requests.
    """
    s = config.llm_settings()
    if not s.enabled:
        return None
    key = (s.provider, s.api_key, s.model)
    if key not in _clients:
        _clients[key] = GroqClient(s.api_key, s.model) if s.provider == "groq" else GeminiClient(s.api_key, s.model)
    return _clients[key]
