"""Deployment files: Vercel entrypoint, bundle config, Docker fallback, and no committed secrets."""

import importlib.util
import json
import re

import pytest

from medlens import config

ROOT = config.ROOT


def _text(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


# ---------- Vercel ----------

def test_root_index_exposes_the_fastapi_app():
    spec = importlib.util.spec_from_file_location("vercel_entry", ROOT / "index.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    from medlens.api import app

    assert module.app is app


def test_vercel_json_declares_the_fastapi_preset_and_the_database_region():
    cfg = json.loads(_text("vercel.json"))
    assert cfg["framework"] == "fastapi"  # without a preset Vercel looks for functions in api/ and the build fails
    assert cfg["regions"] == ["bom1"]  # same region as the Supabase database


def test_python_version_file_matches_a_version_vercel_supports():
    assert _text(".python-version").strip() in {"3.12", "3.13", "3.14"}


def test_runtime_requirements_do_not_include_dev_tools():
    reqs = _text("requirements.txt").lower()
    for needed in ("fastapi", "pydantic", "httpx"):
        assert needed in reqs
    for dev in ("pytest", "uvicorn"):
        assert dev not in reqs


def test_pyproject_declares_the_runtime_dependencies_vercel_installs():
    """Vercel installs from pyproject.toml when it exists and ignores requirements.txt (it did, and the
    first deploy crashed with 'No module named fastapi'). Keep the two lists in sync."""
    import tomllib

    declared = tomllib.loads(_text("pyproject.toml"))["project"].get("dependencies", [])

    def names(specs):
        return {re.split(r"[<>=!~\[ ;]", s.strip(), maxsplit=1)[0].lower() for s in specs if s.strip() and not s.startswith("-")}

    wanted = names(_text("requirements.txt").splitlines())
    assert wanted and wanted <= names(declared), wanted - names(declared)


def test_vercel_ignores_local_only_files():
    ignore = _text(".vercelignore")
    for part in (".venv", ".env", "backend/tests"):
        assert part in ignore


# ---------- Docker fallback (the README asks for docker-compose.yml) ----------

def test_dockerfile_runs_the_api_with_uvicorn():
    d = _text("Dockerfile")
    assert d.startswith("FROM python:3.12")
    assert "uvicorn" in d and "medlens.api:app" in d and "8000" in d
    assert "COPY data" in d and "COPY backend" in d
    assert ".env" not in d  # secrets are passed at run time, never baked into the image


def test_compose_defines_the_api_service_and_passes_keys_from_the_environment():
    c = _text("docker-compose.yml")
    assert "services:" in c and "api:" in c and "8000:8000" in c
    assert "GEMINI_API_KEY=${GEMINI_API_KEY:-}" in c
    assert "healthcheck" in c


def test_dockerignore_keeps_secrets_and_junk_out_of_the_image():
    ignore = _text(".dockerignore")
    for part in (".env", ".git", ".venv", "node_modules"):
        assert part in ignore


# ---------- secrets ----------

SECRET_PATTERNS = {
    "Google API key": re.compile(r"AIza[0-9A-Za-z_\-]{30,}"),
    "Groq key": re.compile(r"gsk_[0-9A-Za-z]{20,}"),
    "JWT / Supabase key": re.compile(r"eyJ[0-9A-Za-z_\-]{20,}\.[0-9A-Za-z_\-]{20,}\.[0-9A-Za-z_\-]{10,}"),
    "Postgres URL with password": re.compile(r"postgres(?:ql)?://[^\s:@/]+:[^\s@/]{6,}@"),
    "Vercel token": re.compile(r"vercel_[a-z]+_[0-9A-Za-z]{20,}"),
}
SKIP_DIRS = {"node_modules", "__pycache__"}


def _files_to_scan():
    for path in ROOT.rglob("*"):
        parts = path.relative_to(ROOT).parts
        # skip every hidden directory (.git, .venv, .vercel, local tool folders) and dependency folders
        if not path.is_file() or SKIP_DIRS & set(parts) or any(p.startswith(".") for p in parts[:-1]):
            continue
        name = path.name
        if name.startswith(".env") and name != ".env.example":
            continue  # local secret files are git-ignored
        if path.suffix.lower() in {".png", ".jpg", ".ico", ".pyc", ".woff", ".woff2"}:
            continue
        yield path


@pytest.mark.parametrize("label", SECRET_PATTERNS)
def test_no_secret_shaped_strings_in_the_repo(label):
    pattern = SECRET_PATTERNS[label]
    offenders = []
    for path in _files_to_scan():
        if path.name == "test_deploy_files.py":
            continue  # this file holds the patterns themselves
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if pattern.search(text):
            offenders.append(str(path.relative_to(ROOT)))
    assert not offenders, f"{label} found in: {offenders}"


def test_env_example_has_empty_keys():
    for line in _text(".env.example").splitlines():
        if line.startswith(("GEMINI_API_KEY=", "GROQ_API_KEY=", "SMTP_APP_PASSWORD=", "SMTP_EMAIL=")):
            assert line.split("=", 1)[1].strip() == "", line
