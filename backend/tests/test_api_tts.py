"""POST /api/tts: read answers aloud. Fake store and fake voice, so no network and no real database."""

import pytest
from fastapi.testclient import TestClient

from medlens.api import app, store_dependency, tts_dependency
from medlens.speech import DEFAULT_VOICE, audio_key
from medlens.tts import TTSError

client = TestClient(app)
CHAT_ID = "0f6c1a52-8a0e-4c3a-9e0a-2d3f5a6b7c8d"
MP3 = b"\xff\xf3FAKE-MP3"


class FakeStore:
    def __init__(self, upload_ok=True, sign_ok=True):
        self.chats = {CHAT_ID: "Your ALT is 45 U/L (5_ranges_biochemistry.md:6). That is inside the range."}
        self.audio, self.files, self.rows = {}, {}, []
        self.upload_ok, self.sign_ok = upload_ok, sign_ok

    def get_chat_answer(self, cid):
        return self.chats.get(cid)

    def find_audio(self, h, v):
        return self.audio.get((h, v))

    def upload_audio(self, path, data):
        if self.upload_ok:
            self.files[path] = data
        return self.upload_ok

    def save_audio(self, text_hash, voice, source, text, storage_path, byte_size):
        self.rows.append(dict(text_hash=text_hash, voice=voice, source=source, text=text, storage_path=storage_path, byte_size=byte_size))
        self.audio[(text_hash, voice)] = storage_path
        return True

    def signed_audio_url(self, path, expires_in=3600):
        return f"https://signed.example/{path}?t=1" if self.sign_ok else None

    def save_analysis(self, *a, **k):
        return True

    def log_chat(self, **k):
        return "x"


class FakeVoice:
    def __init__(self, error=None):
        self.calls, self.error = [], error

    def synthesize(self, text, voice):
        self.calls.append((text, voice))
        if self.error:
            raise self.error
        return MP3


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    monkeypatch.delenv("TTS_VOICE", raising=False)
    yield
    app.dependency_overrides.clear()


def use(store, voice):
    app.dependency_overrides[store_dependency] = lambda: store
    app.dependency_overrides[tts_dependency] = lambda: voice


def tts(**body):
    return client.post("/api/tts", json=body)


# ---------------------------------------------------------------- a stored chat answer

def test_chat_answer_is_synthesized_uploaded_cached_and_linked():
    store, voice = FakeStore(), FakeVoice()
    use(store, voice)
    r = tts(chat_id=CHAT_ID)
    assert r.status_code == 200
    body = r.json()
    spoken = "Your ALT is 45 U/L. That is inside the range."  # the file reference is not read aloud
    assert voice.calls == [(spoken, DEFAULT_VOICE)]
    key = audio_key(DEFAULT_VOICE, spoken)
    path = f"{key[:2]}/{key}.mp3"
    assert store.files == {path: MP3}
    assert store.rows == [dict(text_hash=key, voice=DEFAULT_VOICE, source=f"chat:{CHAT_ID}", text=spoken, storage_path=path, byte_size=len(MP3))]
    assert body == {
        "audio_url": f"https://signed.example/{path}?t=1", "cached": False, "voice": DEFAULT_VOICE,
        "characters": len(spoken), "source": f"chat:{CHAT_ID}", "expires_in": 3600,
    }


def test_the_second_request_is_served_from_the_cache():
    store, voice = FakeStore(), FakeVoice()
    use(store, voice)
    first = tts(chat_id=CHAT_ID).json()
    second = tts(chat_id=CHAT_ID).json()
    assert len(voice.calls) == 1  # synthesized once
    assert second["cached"] is True and first["cached"] is False
    assert second["audio_url"] == first["audio_url"]


def test_a_different_voice_is_a_different_recording():
    store, voice = FakeStore(), FakeVoice()
    use(store, voice)
    tts(chat_id=CHAT_ID)
    body = tts(chat_id=CHAT_ID, voice="en-IN-NeerjaNeural").json()
    assert body["voice"] == "en-IN-NeerjaNeural" and body["cached"] is False
    assert [c[1] for c in voice.calls] == [DEFAULT_VOICE, "en-IN-NeerjaNeural"]


def test_the_default_voice_can_be_set_with_an_environment_variable(monkeypatch):
    monkeypatch.setenv("TTS_VOICE", "en-GB-SoniaNeural")
    use(FakeStore(), FakeVoice())
    assert tts(chat_id=CHAT_ID).json()["voice"] == "en-GB-SoniaNeural"
    monkeypatch.setenv("TTS_VOICE", "not-a-real-voice")
    assert tts(chat_id=CHAT_ID).json()["voice"] == DEFAULT_VOICE


# ---------------------------------------------------------------- parts of a corpus report

def test_urgent_report_summary_is_spoken():
    store, voice = FakeStore(), FakeVoice()
    use(store, voice)
    body = tts(report_id="P004", part="summary").json()
    assert voice.calls[0][0].startswith("Some results are urgent. Please see a doctor today.")
    assert body["source"] == "report:P004:summary"


def test_single_result_and_questions_parts():
    use(FakeStore(), FakeVoice())
    assert tts(report_id="P004", part="result", index=1).json()["source"] == "report:P004:result:1"
    assert tts(report_id="P004", part="questions").json()["source"] == "report:P004:questions"
    assert tts(report_id="P004", part="urgent").json()["source"] == "report:P004:urgent"


def test_supplied_demographics_are_used_for_the_spoken_text():
    voice = FakeVoice()
    use(FakeStore(), voice)
    tts(report_id="P003", part="summary", age=40, sex="Male")
    assert "above the range" in voice.calls[0][0]  # 110 mg/dL is HIGH once age and sex are known
    tts(report_id="P003", part="summary")
    assert "age or sex is needed" in voice.calls[1][0].lower()


# ---------------------------------------------------------------- not found

@pytest.mark.parametrize(
    "body",
    [
        {"chat_id": "11111111-2222-3333-4444-555555555555"},  # no such chat row
        {"report_id": "P999", "part": "summary"},
        {"report_id": "P001", "part": "urgent"},  # nothing urgent in P001
        {"report_id": "P001", "part": "result", "index": 9},
    ],
)
def test_missing_things_are_404_and_nothing_is_synthesized(body):
    voice = FakeVoice()
    use(FakeStore(), voice)
    assert tts(**body).status_code == 404
    assert voice.calls == []


# ---------------------------------------------------------------- validation

@pytest.mark.parametrize(
    "body",
    [
        {},
        {"chat_id": CHAT_ID, "report_id": "P004", "part": "summary"},  # both sources
        {"chat_id": CHAT_ID, "part": "summary"},
        {"chat_id": "not-a-uuid"},
        {"report_id": "P004"},  # no part
        {"report_id": "P004", "part": "result"},  # no index
        {"report_id": "P004", "part": "everything"},
        {"report_id": "P004", "part": "summary", "voice": "en-US-MadeUpNeural"},
        {"report_id": "P004", "part": "summary", "age": -4},
        {"text": "Say anything I like"},  # arbitrary text is never accepted
        {"chat_id": CHAT_ID, "text": "Say anything I like"},
    ],
)
def test_bad_requests_are_422(body):
    voice = FakeVoice()
    use(FakeStore(), voice)
    assert tts(**body).status_code == 422
    assert voice.calls == []


# ---------------------------------------------------------------- when things break

def test_no_database_means_503_because_audio_is_cached_there():
    use(None, FakeVoice())
    r = tts(chat_id=CHAT_ID)
    assert r.status_code == 503 and "storage" in r.json()["detail"].lower()


def test_a_voice_failure_is_a_clean_502():
    use(FakeStore(), FakeVoice(error=TTSError("Edge TTS failed (ConnectionError)")))
    r = tts(chat_id=CHAT_ID)
    assert r.status_code == 502 and "ConnectionError" in r.json()["detail"]


def test_upload_and_signing_failures_are_502():
    use(FakeStore(upload_ok=False), FakeVoice())
    assert tts(chat_id=CHAT_ID).status_code == 502
    use(FakeStore(sign_ok=False), FakeVoice())
    assert tts(chat_id=CHAT_ID).status_code == 502


def test_synthesis_is_not_repeated_after_a_failed_upload_is_fixed():
    store, voice = FakeStore(upload_ok=False), FakeVoice()
    use(store, voice)
    assert tts(chat_id=CHAT_ID).status_code == 502
    assert store.rows == []  # no cache row for a file that was never stored
    store.upload_ok = True
    assert tts(chat_id=CHAT_ID).status_code == 200
    assert len(voice.calls) == 2  # had to synthesize again, because nothing was cached
