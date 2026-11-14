"""The Edge TTS wrapper, tested with a fake edge_tts so no network is used."""

import asyncio

import pytest

from medlens import tts
from medlens.tts import EdgeTTS, TTSError


class FakeCommunicate:
    chunks = [{"type": "WordBoundary", "offset": 0}, {"type": "audio", "data": b"\xff\xf3AB"}, {"type": "audio", "data": b"CD"}]
    error = None
    calls = []

    def __init__(self, text, voice):
        FakeCommunicate.calls.append((text, voice))

    async def stream(self):
        if FakeCommunicate.error:
            raise FakeCommunicate.error
        for chunk in FakeCommunicate.chunks:
            yield chunk


@pytest.fixture(autouse=True)
def fake(monkeypatch):
    FakeCommunicate.chunks = [{"type": "WordBoundary", "offset": 0}, {"type": "audio", "data": b"\xff\xf3AB"}, {"type": "audio", "data": b"CD"}]
    FakeCommunicate.error = None
    FakeCommunicate.calls = []
    monkeypatch.setattr(tts.edge_tts, "Communicate", FakeCommunicate)


def test_audio_chunks_are_joined_and_other_events_ignored():
    assert EdgeTTS().synthesize("Hello there.", "en-US-AriaNeural") == b"\xff\xf3ABCD"
    assert FakeCommunicate.calls == [("Hello there.", "en-US-AriaNeural")]


def test_no_audio_is_an_error():
    FakeCommunicate.chunks = [{"type": "WordBoundary"}]
    with pytest.raises(TTSError):
        EdgeTTS().synthesize("Hello.", "v")


def test_service_failure_is_a_tts_error():
    FakeCommunicate.error = ConnectionError("refused")
    with pytest.raises(TTSError) as exc:
        EdgeTTS().synthesize("Hello.", "v")
    assert "ConnectionError" in str(exc.value)


def test_slow_service_times_out(monkeypatch):
    class Slow(FakeCommunicate):
        async def stream(self):
            await asyncio.sleep(5)
            yield {"type": "audio", "data": b"x"}

    monkeypatch.setattr(tts.edge_tts, "Communicate", Slow)
    with pytest.raises(TTSError) as exc:
        EdgeTTS(timeout=0.05).synthesize("Hello.", "v")
    assert "too long" in str(exc.value)


def test_it_works_when_called_from_inside_a_running_loop():
    # FastAPI may call a sync dependency from a worker that already has a loop
    async def inner():
        return EdgeTTS().synthesize("Hello.", "v")

    assert asyncio.run(inner()) == b"\xff\xf3ABCD"
