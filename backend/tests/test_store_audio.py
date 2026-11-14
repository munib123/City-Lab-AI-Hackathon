"""Audio-related Supabase calls (REST + Storage). Same contract: never raise, never leak the key."""

import json
import logging

import httpx
import pytest

from medlens.store import Store

URL = "https://proj.supabase.co"
KEY = "eyJhbGciOi.payload.signature"
CHAT_ID = "0f6c1a52-8a0e-4c3a-9e0a-2d3f5a6b7c8d"


def store_with(handler):
    return Store(URL, KEY, http=httpx.Client(transport=httpx.MockTransport(handler)))


# ---------- reading a stored chat answer ----------

def test_get_chat_answer_selects_only_the_answer():
    seen = {}

    def handler(request: httpx.Request):
        seen["method"], seen["url"] = request.method, request.url
        return httpx.Response(200, json=[{"answer": "Your ALT is fine."}])

    assert store_with(handler).get_chat_answer(CHAT_ID) == "Your ALT is fine."
    assert seen["method"] == "GET" and seen["url"].path == "/rest/v1/chat_messages"
    assert dict(seen["url"].params) == {"id": f"eq.{CHAT_ID}", "select": "answer", "limit": "1"}


def test_get_chat_answer_missing_row_is_none():
    assert store_with(lambda r: httpx.Response(200, json=[])).get_chat_answer(CHAT_ID) is None


# ---------- cache lookup ----------

def test_find_audio_looks_up_by_hash_and_voice():
    seen = {}

    def handler(request):
        seen["params"] = dict(request.url.params)
        return httpx.Response(200, json=[{"storage_path": "ab/abc.mp3"}])

    assert store_with(handler).find_audio("abc", "en-US-AriaNeural") == "ab/abc.mp3"
    assert seen["params"] == {"text_hash": "eq.abc", "voice": "eq.en-US-AriaNeural", "select": "storage_path", "limit": "1"}


def test_find_audio_miss_is_none():
    assert store_with(lambda r: httpx.Response(200, json=[])).find_audio("abc", "v") is None


# ---------- uploading and signing ----------

def test_upload_audio_posts_to_the_private_bucket():
    seen = {}

    def handler(request: httpx.Request):
        seen["method"], seen["url"] = request.method, str(request.url)
        seen["headers"], seen["body"] = dict(request.headers), request.content
        return httpx.Response(200, json={"Key": "tts-audio/ab/abc.mp3"})

    assert store_with(handler).upload_audio("ab/abc.mp3", b"\xff\xf3dATA") is True
    assert seen["method"] == "POST" and seen["url"] == f"{URL}/storage/v1/object/tts-audio/ab/abc.mp3"
    assert seen["headers"]["content-type"] == "audio/mpeg"
    assert seen["headers"]["x-upsert"] == "true"
    assert seen["headers"]["authorization"] == f"Bearer {KEY}"
    assert seen["body"] == b"\xff\xf3dATA"


def test_signed_url_is_absolute_and_expires():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"], seen["body"] = str(request.url), json.loads(request.content)
        return httpx.Response(200, json={"signedURL": "/object/sign/tts-audio/ab/abc.mp3?token=T0K"})

    url = store_with(handler).signed_audio_url("ab/abc.mp3", expires_in=900)
    assert seen["url"] == f"{URL}/storage/v1/object/sign/tts-audio/ab/abc.mp3"
    assert seen["body"] == {"expiresIn": 900}
    assert url == f"{URL}/storage/v1/object/sign/tts-audio/ab/abc.mp3?token=T0K"


def test_save_audio_upserts_the_cache_row():
    seen = {}

    def handler(request: httpx.Request):
        seen["url"], seen["body"], seen["prefer"] = str(request.url), json.loads(request.content), request.headers["prefer"]
        return httpx.Response(201)

    ok = store_with(handler).save_audio("abc", "en-US-AriaNeural", "chat:1", "Hello.", "ab/abc.mp3", 1234)
    assert ok is True
    assert "on_conflict=text_hash%2Cvoice" in seen["url"] and "merge-duplicates" in seen["prefer"]
    assert seen["body"] == {
        "text_hash": "abc", "voice": "en-US-AriaNeural", "source": "chat:1", "text": "Hello.",
        "storage_path": "ab/abc.mp3", "byte_size": 1234,
    }


# ---------- failures ----------

@pytest.mark.parametrize("status", [400, 404, 500])
def test_audio_calls_fail_quietly(status, caplog):
    caplog.set_level(logging.WARNING)
    s = store_with(lambda r: httpx.Response(status, json={"message": f"bad {KEY}"}))
    assert s.get_chat_answer(CHAT_ID) is None
    assert s.find_audio("a", "v") is None
    assert s.upload_audio("a/b.mp3", b"x") is False
    assert s.signed_audio_url("a/b.mp3") is None
    assert s.save_audio("a", "v", "s", "t", "p", 1) is False
    assert KEY not in caplog.text


def test_audio_calls_survive_exceptions(caplog):
    caplog.set_level(logging.WARNING)

    def boom(request):
        raise RuntimeError(f"boom {KEY}")

    s = store_with(boom)
    assert s.get_chat_answer(CHAT_ID) is None and s.find_audio("a", "v") is None
    assert s.upload_audio("a/b.mp3", b"x") is False and s.signed_audio_url("a/b.mp3") is None
    assert KEY not in caplog.text
