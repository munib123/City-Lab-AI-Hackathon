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


def test_llm_provider_switch(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "x")
    s = config.llm_settings()
    assert (s.provider, s.enabled) == ("groq", True)
