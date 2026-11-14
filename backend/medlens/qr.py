"""QR codes for corpus reports. A QR encodes the link to that report's page."""

from __future__ import annotations

import io

import segno

MEDIA_TYPES = {"svg": "image/svg+xml", "png": "image/png"}


def report_link(report_id: str, app_url: str, api_base: str) -> str:
    """Where scanning the QR leads.

    With PUBLIC_APP_URL set (the frontend's address) it opens the frontend page /reports/<id>.
    Without it, it opens this API's own read-only page for the report, so the QR always leads somewhere that works.
    """
    app = (app_url or "").strip().rstrip("/")
    if app:
        return f"{app}/reports/{report_id}"
    return f"{api_base.rstrip('/')}/api/reports/{report_id}"


def make_qr(url: str, fmt: str = "svg", scale: int = 8, border: int = 4) -> tuple[bytes, str]:
    """Return (image bytes, media type). Error correction M survives a smudged print."""
    if fmt not in MEDIA_TYPES:
        raise ValueError(f"format must be one of {sorted(MEDIA_TYPES)}")
    buffer = io.BytesIO()
    segno.make(url, error="m").save(buffer, kind=fmt, scale=scale, border=border)
    return buffer.getvalue(), MEDIA_TYPES[fmt]
