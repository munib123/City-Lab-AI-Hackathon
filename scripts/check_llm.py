"""Check that the LLM key works. Run this once after adding your key.

    python scripts/check_llm.py

It reads LLM settings from the environment or from .env.local, lists the models your
key can use (Gemini), and makes one tiny JSON call with the configured model.
The key is never printed.
"""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(ROOT / ".env.local")
load_env_file(ROOT / ".env")

import httpx  # noqa: E402

from medlens import config  # noqa: E402
from medlens.llm import GEMINI_BASE, LLMError, get_llm  # noqa: E402


def list_gemini_models(api_key: str) -> list[str]:
    response = httpx.get(f"{GEMINI_BASE}/models", params={"pageSize": 100}, headers={"x-goog-api-key": api_key}, timeout=20)
    response.raise_for_status()
    models = response.json().get("models", [])
    return sorted(
        m["name"].removeprefix("models/")
        for m in models
        if "generateContent" in m.get("supportedGenerationMethods", []) and "gemini" in m["name"]
    )


def main() -> int:
    s = config.llm_settings()
    print(f"provider={s.provider} model={s.model} key={'set' if s.enabled else 'MISSING'}")
    if not s.enabled:
        print("No key found. Put GEMINI_API_KEY=... in .env.local (see .env.example).")
        return 1

    if s.provider == "gemini":
        try:
            names = list_gemini_models(s.api_key)
            print(f"\nModels this key can use ({len(names)}):")
            print("  " + "\n  ".join(names[:40]))
            if s.model not in names:
                print(f"\nWARNING: GEMINI_MODEL={s.model!r} is not in that list. Pick one from the list above.")
        except httpx.HTTPError as exc:
            print(f"\nCould not list models ({type(exc).__name__}). Check the key and your internet connection.")

    print("\nTest call ...")
    llm = get_llm()
    try:
        raw = llm.generate_json(
            'Reply with JSON only: {"answer": string, "answer_type": "answered", "sources": []}',
            'Say the word "ready" in the answer field.',
        )
    except LLMError as exc:
        print(f"FAILED: {exc}")
        return 2
    print(f"OK. Model replied: {raw.strip()[:200]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
