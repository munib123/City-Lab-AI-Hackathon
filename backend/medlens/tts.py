"""Text to speech with Microsoft Edge's read-aloud voices (the `edge-tts` package, no API key).

It is an unofficial, free service, so every failure becomes a TTSError the API turns into a clean 502.
"""

from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor

import edge_tts


class TTSError(Exception):
    """Speech could not be produced. Never carries secrets."""


class EdgeTTS:
    def __init__(self, timeout: float = 25.0):
        self.timeout = timeout

    def synthesize(self, text: str, voice: str) -> bytes:
        """Return MP3 bytes for the text in the given voice."""

        async def run() -> bytes:
            audio = bytearray()
            async for chunk in edge_tts.Communicate(text, voice).stream():
                if chunk.get("type") == "audio":
                    audio += chunk["data"]
            return bytes(audio)

        async def guarded() -> bytes:
            return await asyncio.wait_for(run(), timeout=self.timeout)

        try:
            # a fresh thread gives the coroutine its own event loop, even if the caller already has one running
            with ThreadPoolExecutor(max_workers=1) as pool:
                data = pool.submit(asyncio.run, guarded()).result()
        except asyncio.TimeoutError:
            raise TTSError("Edge TTS took too long to answer") from None
        except Exception as exc:
            raise TTSError(f"Edge TTS failed ({type(exc).__name__})") from None
        if not data:
            raise TTSError("Edge TTS returned no audio")
        return data
