"""QR code per report. It encodes a link to that report's page."""

import io

import pytest
import segno
from fastapi.testclient import TestClient

from medlens.api import app, store_dependency
from medlens.qr import make_qr, report_link

client = TestClient(app)
APP = "https://app.example.com"


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.delenv("PUBLIC_APP_URL", raising=False)
    app.dependency_overrides[store_dependency] = lambda: None
    yield
    app.dependency_overrides.clear()


# ---------- the link ----------

def test_link_uses_the_public_app_url_when_set():
    assert report_link("P004", app_url=f"{APP}/", api_base="https://api.example.com/") == f"{APP}/reports/P004"


def test_link_falls_back_to_the_api_report_page():
    assert report_link("P004", app_url="", api_base="https://api.example.com/") == "https://api.example.com/api/reports/P004"


# ---------- the image ----------

def test_svg_encodes_exactly_the_link():
    data, media = make_qr("https://x.test/reports/P004", fmt="svg")
    assert media == "image/svg+xml"
    expected = io.BytesIO()
    segno.make("https://x.test/reports/P004", error="m").save(expected, kind="svg", scale=8, border=4)
    assert data == expected.getvalue()
    other, _ = make_qr("https://x.test/reports/P005", fmt="svg")
    assert data != other  # a different link gives a different code


def test_png_is_a_real_png():
    data, media = make_qr("https://x.test/reports/P004", fmt="png")
    assert media == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n")


def test_unknown_format_is_rejected():
    with pytest.raises(ValueError):
        make_qr("https://x.test", fmt="gif")


# ---------- endpoints ----------

def test_qr_endpoint_returns_an_svg_for_a_corpus_report(monkeypatch):
    monkeypatch.setenv("PUBLIC_APP_URL", APP)
    r = client.get("/api/reports/P004/qr")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("image/svg+xml")
    expected, _ = make_qr(f"{APP}/reports/P004", fmt="svg")
    assert r.content == expected
    assert "max-age" in r.headers["cache-control"]


def test_qr_endpoint_png_format():
    r = client.get("/api/reports/P004/qr?format=png")
    assert r.status_code == 200 and r.content.startswith(b"\x89PNG")


def test_qr_endpoint_without_an_app_url_points_at_the_api_report_page():
    r = client.get("/api/reports/P004/qr")
    expected, _ = make_qr("http://testserver/api/reports/P004", fmt="svg")
    assert r.content == expected


@pytest.mark.parametrize("path", ["/api/reports/P999/qr", "/api/reports/hello world/qr", "/api/reports/P004%20x/qr"])
def test_qr_only_exists_for_corpus_reports(path):
    assert client.get(path).status_code == 404  # not a free QR generator for arbitrary text


def test_bad_format_is_422():
    assert client.get("/api/reports/P004/qr?format=gif").status_code == 422


def test_link_endpoint(monkeypatch):
    monkeypatch.setenv("PUBLIC_APP_URL", APP)
    body = client.get("/api/reports/P004/link").json()
    assert body == {"report_id": "P004", "url": f"{APP}/reports/P004", "qr": "/api/reports/P004/qr"}


def test_reports_list_carries_link_and_qr(monkeypatch):
    monkeypatch.setenv("PUBLIC_APP_URL", APP)
    item = client.get("/api/reports").json()[3]
    assert item == {
        "report_id": "P004", "patient_name": "Diana Prince", "result_count": 2,
        "link": f"{APP}/reports/P004", "qr": "/api/reports/P004/qr",
    }


# ---------- the QR target must work even before the frontend exists ----------

def test_get_report_returns_the_same_analysis_as_post():
    got = client.get("/api/reports/P004")
    posted = client.post("/api/analyze", json={"report_id": "P004"})
    assert got.status_code == 200 and got.json() == posted.json()


def test_get_unknown_report_is_404():
    assert client.get("/api/reports/P999").status_code == 404
