from medlens import config


def test_corpus_dir_has_the_expected_files():
    files = sorted(p.name for p in config.CORPUS_DIR.glob("*.md"))
    assert len(files) == 20
    assert sum(name.startswith("report_") for name in files) == 14


def test_llm_disabled_without_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    s = config.llm_settings()
    assert s.provider == "gemini"
    assert not s.enabled


def test_gemini_defaults_to_flash_with_a_flash_lite_fallback(monkeypatch):
    for name in ("GEMINI_MODEL", "GEMINI_FALLBACK_MODEL", "LLM_PROVIDER"):
        monkeypatch.delenv(name, raising=False)
    s = config.llm_settings()
    assert s.model == "gemini-2.5-flash"
    assert s.fallback_model == "gemini-2.5-flash-lite"


def test_fallback_model_can_be_changed_or_switched_off(monkeypatch):
    monkeypatch.setenv("GEMINI_FALLBACK_MODEL", "gemini-x")
    assert config.llm_settings().fallback_model == "gemini-x"
    monkeypatch.setenv("GEMINI_FALLBACK_MODEL", "")
    assert config.llm_settings().fallback_model is None


def test_groq_has_no_fallback(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    assert config.llm_settings().fallback_model is None


def test_llm_provider_switch(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "x")
    s = config.llm_settings()
    assert (s.provider, s.enabled) == ("groq", True)
