"""LLM adapters are tested with a fake HTTP transport: no network, no key."""

import json

import httpx
import pytest

from medlens import config
from medlens.llm import GeminiClient, GroqClient, LLMError, get_llm, supports_sampling_params


def client_with(handler):
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_gemini_request_shape_and_parsing():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"] = str(request.url)
        seen["headers"] = dict(request.headers)
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": '{"answer":"hi"}'}]}}]})

    c = GeminiClient("secret-key", "gemini-2.5-flash", http=client_with(handler))
    out = c.generate_json("SYSTEM", "USER")
    assert out == '{"answer":"hi"}'
    assert seen["url"].endswith("/v1beta/models/gemini-2.5-flash:generateContent")
    assert "secret-key" not in seen["url"]  # key goes in a header, never in the URL
    assert seen["headers"]["x-goog-api-key"] == "secret-key"
    body = seen["body"]
    assert body["system_instruction"]["parts"][0]["text"] == "SYSTEM"
    assert body["contents"][0]["parts"][0]["text"] == "USER"
    cfg = body["generationConfig"]
    assert cfg["responseMimeType"] == "application/json"
    assert cfg["responseSchema"]["properties"]["answer_type"]["enum"]
    assert cfg["temperature"] == 0


@pytest.mark.parametrize("model, expected", [("gemini-2.5-flash", True), ("gemini-3.5-flash", True), ("gemini-3.6-flash", False), ("gemini-3.8-flash", False), ("gemini-4-pro", False), ("weird-name", True)])
def test_newer_models_do_not_get_sampling_parameters(model, expected):
    assert supports_sampling_params(model) is expected


def test_gemini_omits_temperature_for_models_that_ignore_it():
    seen = {}

    def handler(request):
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "{}"}]}}]})

    GeminiClient("k", "gemini-3.8-flash", http=client_with(handler)).generate_json("s", "u")
    assert "temperature" not in seen["body"]["generationConfig"]


@pytest.mark.parametrize("status", [400, 401, 403, 429, 500, 503])
def test_gemini_http_errors_become_llm_error_without_leaking_the_key(status):
    c = GeminiClient("secret-key", "m", http=client_with(lambda r: httpx.Response(status, json={"error": {"message": "x secret-key x"}})))
    with pytest.raises(LLMError) as exc:
        c.generate_json("s", "u")
    assert "secret-key" not in str(exc.value)
    assert str(status) in str(exc.value)


def _model_in(request: httpx.Request) -> str:
    return str(request.url).split("/models/")[1].split(":")[0]


OK_BODY = {"candidates": [{"content": {"parts": [{"text": '{"answer":"hi"}'}]}}]}


@pytest.mark.parametrize("status", [429, 500, 503])
def test_gemini_falls_back_to_the_second_model_when_the_first_is_busy(status):
    tried = []

    def handler(request):
        tried.append(_model_in(request))
        return httpx.Response(status) if _model_in(request) == "primary" else httpx.Response(200, json=OK_BODY)

    c = GeminiClient("k", "primary", fallback_model="backup", http=client_with(handler))
    assert c.generate_json("s", "u") == '{"answer":"hi"}'
    assert tried == ["primary", "backup"]


def test_gemini_falls_back_after_a_timeout():
    tried = []

    def handler(request):
        tried.append(_model_in(request))
        if _model_in(request) == "primary":
            raise httpx.ReadTimeout("slow")
        return httpx.Response(200, json=OK_BODY)

    c = GeminiClient("k", "primary", fallback_model="backup", http=client_with(handler))
    assert c.generate_json("s", "u")
    assert tried == ["primary", "backup"]


@pytest.mark.parametrize("status", [400, 401, 403])
def test_a_bad_key_or_request_does_not_waste_a_fallback_call(status):
    tried = []

    def handler(request):
        tried.append(_model_in(request))
        return httpx.Response(status)

    c = GeminiClient("k", "primary", fallback_model="backup", http=client_with(handler))
    with pytest.raises(LLMError):
        c.generate_json("s", "u")
    assert tried == ["primary"]


def test_error_keeps_the_http_status_and_knows_when_the_service_is_busy():
    c = GeminiClient("k", "primary", fallback_model="backup", http=client_with(lambda r: httpx.Response(429)))
    with pytest.raises(LLMError) as exc:
        c.generate_json("s", "u")
    assert exc.value.status == 429 and exc.value.busy is True
    c = GeminiClient("k", "m", http=client_with(lambda r: httpx.Response(401)))
    with pytest.raises(LLMError) as exc:
        c.generate_json("s", "u")
    assert exc.value.status == 401 and exc.value.busy is False


def test_no_fallback_configured_means_one_call():
    tried = []

    def handler(request):
        tried.append(1)
        return httpx.Response(503)

    with pytest.raises(LLMError):
        GeminiClient("k", "m", http=client_with(handler)).generate_json("s", "u")
    assert len(tried) == 1


def test_get_llm_passes_the_fallback_model_through(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k-fb")
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("GEMINI_FALLBACK_MODEL", raising=False)
    assert get_llm().fallback_model == "gemini-2.5-flash-lite"


def test_gemini_blocked_or_empty_candidates_are_an_llm_error():
    c = GeminiClient("k", "m", http=client_with(lambda r: httpx.Response(200, json={"candidates": []})))
    with pytest.raises(LLMError):
        c.generate_json("s", "u")


def test_a_key_with_non_ascii_characters_is_an_llm_error_not_a_crash():
    # httpx raises UnicodeEncodeError (not an HTTPError) while building the header
    called = []
    c = GeminiClient("café-key", "m", http=client_with(lambda r: called.append(1) or httpx.Response(200)))
    with pytest.raises(LLMError) as exc:
        c.generate_json("s", "u")
    assert "café-key" not in str(exc.value)
    assert called == []  # nothing was sent
    g = GroqClient("café-key", "m", http=client_with(lambda r: httpx.Response(200)))
    with pytest.raises(LLMError):
        g.generate_json("s", "u")


@pytest.mark.parametrize("client_cls", [GeminiClient, GroqClient])
def test_any_unexpected_error_while_calling_the_model_is_an_llm_error(client_cls):
    def boom(request):
        raise RuntimeError("something odd secret-key")

    with pytest.raises(LLMError) as exc:
        client_cls("secret-key", "m", http=client_with(boom)).generate_json("s", "u")
    assert "secret-key" not in str(exc.value)


def test_gemini_network_failure_is_an_llm_error():
    def boom(request):
        raise httpx.ConnectError("down")

    with pytest.raises(LLMError):
        GeminiClient("k", "m", http=client_with(boom)).generate_json("s", "u")


def test_groq_request_shape_and_parsing():
    seen = {}

    def handler(request):
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"choices": [{"message": {"content": '{"answer":"ok"}'}}]})

    c = GroqClient("gk", "llama-x", http=client_with(handler))
    assert c.generate_json("SYS", "USR") == '{"answer":"ok"}'
    assert seen["url"] == "https://api.groq.com/openai/v1/chat/completions"
    assert seen["auth"] == "Bearer gk"
    assert seen["body"]["temperature"] == 0
    assert seen["body"]["response_format"] == {"type": "json_object"}
    assert [m["role"] for m in seen["body"]["messages"]] == ["system", "user"]


def test_get_llm_returns_none_without_a_key(monkeypatch):
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    assert get_llm() is None


def test_get_llm_builds_the_configured_provider(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "k")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-test")
    c = get_llm()
    assert isinstance(c, GeminiClient) and c.model == "gemini-test"
    monkeypatch.setenv("LLM_PROVIDER", "groq")
    monkeypatch.setenv("GROQ_API_KEY", "g")
    assert isinstance(get_llm(), GroqClient)
    assert config.llm_settings().provider == "groq"
