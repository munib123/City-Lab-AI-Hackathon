"""POST /api/email: send the explanation of a corpus report. Abuse protection is the point of most tests."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from medlens import config
from medlens.api import app, mailer_dependency, store_dependency
from medlens.mailer import MailError

client = TestClient(app)
GOOD = {"report_id": "P004", "to": "pat@example.com"}


class FakeStore:
    """Counts log rows the way the real table would, so the limits can be tested for real."""

    def __init__(self, count_fails=False, log_fails=False):
        self.rows, self.count_fails, self.log_fails = [], count_fails, log_fails

    def count_emails(self, since, ip_hash=None, to_hash=None):
        if self.count_fails:
            return None
        return sum(
            1 for r in self.rows
            if r["created_at"] >= since and (ip_hash is None or r["ip_hash"] == ip_hash) and (to_hash is None or r["to_hash"] == to_hash)
        )

    def log_email(self, ip_hash, to_hash, report_id, status):
        if self.log_fails:
            return False
        self.rows.append(dict(ip_hash=ip_hash, to_hash=to_hash, report_id=report_id, status=status, created_at=datetime.now(timezone.utc)))
        return True

    def age(self, **delta):
        for r in self.rows:
            r["created_at"] -= timedelta(**delta)


class FakeMailer:
    def __init__(self, error=None):
        self.sent, self.error = [], error

    def send(self, message):
        if self.error:
            raise self.error
        self.sent.append(message)


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    for name in ("EMAIL_DAILY_LIMIT", "EMAIL_HASH_SALT"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("SMTP_EMAIL", "sender@gmail.com")
    monkeypatch.setenv("SMTP_APP_PASSWORD", "abcdefghijklmnop")
    yield
    app.dependency_overrides.clear()


def use(store, mailer):
    app.dependency_overrides[store_dependency] = lambda: store
    app.dependency_overrides[mailer_dependency] = lambda: mailer


def send(fields=None, ip="1.1.1.1", **extra):
    """`fields` overrides the good request; `extra` adds more fields (names like `body` and `subject` are real test inputs)."""
    headers = {"x-forwarded-for": ip}
    return client.post("/api/email", json={**GOOD, **(fields or {}), **extra}, headers=headers)


# ---------------------------------------------------------------- the happy path

def test_report_is_emailed_and_the_recipient_is_masked_in_the_answer():
    store, mailer = FakeStore(), FakeMailer()
    use(store, mailer)
    r = send()
    assert r.status_code == 200
    assert r.json() == {"sent": True, "to": "p**@example.com", "report_id": "P004"}
    assert len(mailer.sent) == 1
    msg = mailer.sent[0]
    assert msg["To"] == "pat@example.com" and msg["Subject"] == "MedLens: urgent result in your lab report"


def test_supplied_demographics_change_the_email():
    mailer = FakeMailer()
    use(FakeStore(), mailer)
    send({"report_id": "P003", "age": 40, "sex": "Male"})
    body = mailer.sent[0].get_body(preferencelist=("plain",)).get_content()
    assert "High" in body and "age and sex are missing" not in body


def test_only_hashes_are_logged_never_the_address_or_the_ip():
    store = FakeStore()
    use(store, FakeMailer())
    send(ip="9.9.9.9")
    row = store.rows[0]
    assert row["status"] == "sent" and row["report_id"] == "P004"
    blob = " ".join(str(v) for v in row.values())
    assert "pat@example.com" not in blob and "example.com" not in blob and "9.9.9.9" not in blob
    assert len(row["ip_hash"]) == 64 and len(row["to_hash"]) == 64


def test_the_same_recipient_in_a_different_case_is_the_same_person():
    store = FakeStore()
    use(store, FakeMailer())
    send({"to": "Pat@Example.com"})
    send({"to": "pat@example.com"})
    assert store.rows[0]["to_hash"] == store.rows[1]["to_hash"]


# ---------------------------------------------------------------- nothing arbitrary can be sent

@pytest.mark.parametrize(
    "extra",
    [{"subject": "Win a prize"}, {"body": "click here"}, {"cc": "x@y.com"}, {"bcc": "x@y.com"}, {"text": "ALT: 40 U/L"}, {"message": "hi"}, {"html": "<b>x</b>"}],
)
def test_callers_cannot_add_a_subject_body_or_extra_recipients(extra):
    mailer = FakeMailer()
    use(FakeStore(), mailer)
    assert send(**extra).status_code == 422
    assert mailer.sent == []


@pytest.mark.parametrize(
    "to",
    ["", "nope", "a@b", "a@b.com\nBcc: evil@x.com", "a@b.com, c@d.com", "a@b.com;c@d.com", "Pat <a@b.com>", ["a@b.com"], 42, None],
)
def test_bad_recipients_are_422(to):
    mailer = FakeMailer()
    use(FakeStore(), mailer)
    assert send({"to": to}).status_code == 422
    assert mailer.sent == []


@pytest.mark.parametrize("body", [{"report_id": ""}, {"report_id": "x" * 50}, {"age": -1}, {"sex": "Robot"}])
def test_bad_report_or_demographics_are_422(body):
    use(FakeStore(), FakeMailer())
    assert send(body).status_code == 422


def test_only_corpus_reports_can_be_emailed():
    mailer = FakeMailer()
    use(FakeStore(), mailer)
    assert send({"report_id": "P999"}).status_code == 404
    assert mailer.sent == []


# ---------------------------------------------------------------- rate limits (this is a Gmail account, not a relay)

def test_one_sender_is_limited_per_hour():
    store, mailer = FakeStore(), FakeMailer()
    use(store, mailer)
    for n in range(5):
        assert send({"to": f"person{n}@example.com"}, ip="2.2.2.2").status_code == 200
    r = send({"to": "person9@example.com"}, ip="2.2.2.2")
    assert r.status_code == 429 and r.headers["retry-after"] == "3600"
    assert len(mailer.sent) == 5
    assert send({"to": "person9@example.com"}, ip="3.3.3.3").status_code == 200  # another sender is unaffected


def test_one_recipient_is_limited_per_hour_whoever_asks():
    mailer = FakeMailer()
    use(FakeStore(), mailer)
    for n in range(3):
        assert send(ip=f"5.5.5.{n}").status_code == 200
    r = send(ip="5.5.5.9")
    assert r.status_code == 429 and "recipient" in r.json()["detail"].lower()
    assert len(mailer.sent) == 3


def test_one_recipient_is_limited_per_day():
    store, mailer = FakeStore(), FakeMailer()
    use(store, mailer)
    for n in range(3):
        send(ip=f"6.6.6.{n}")
    store.age(hours=2)  # the hourly window has passed, the daily one has not
    for n in range(2):
        assert send(ip=f"7.7.7.{n}").status_code == 200
    r = send(ip="7.7.7.9")
    assert r.status_code == 429 and r.headers["retry-after"] == "86400"


def test_there_is_a_global_daily_cap(monkeypatch):
    monkeypatch.setenv("EMAIL_DAILY_LIMIT", "2")
    mailer = FakeMailer()
    use(FakeStore(), mailer)
    assert send({"to": "a1@example.com"}, ip="1.0.0.1").status_code == 200
    assert send({"to": "a2@example.com"}, ip="1.0.0.2").status_code == 200
    r = send({"to": "a3@example.com"}, ip="1.0.0.3")
    assert r.status_code == 429 and "today" in r.json()["detail"].lower()
    assert len(mailer.sent) == 2


def test_old_attempts_stop_counting():
    store, mailer = FakeStore(), FakeMailer()
    use(store, mailer)
    for n in range(5):
        send({"to": f"p{n}@example.com"}, ip="4.4.4.4")
    store.age(days=2)
    assert send({"to": "fresh@example.com"}, ip="4.4.4.4").status_code == 200


def test_failed_attempts_also_count_so_a_broken_server_cannot_be_hammered():
    store = FakeStore()
    use(store, FakeMailer(error=MailError("The mail could not be sent (OSError).")))
    for n in range(5):
        assert send({"to": f"p{n}@example.com"}, ip="8.8.8.8").status_code == 502
    assert send({"to": "p9@example.com"}, ip="8.8.8.8").status_code == 429
    assert {r["status"] for r in store.rows} == {"failed"}


def test_the_limit_is_checked_before_anything_is_sent():
    mailer = FakeMailer()
    use(FakeStore(), mailer)
    for n in range(5):
        send({"to": f"p{n}@example.com"}, ip="2.2.2.2")
    send({"to": "late@example.com"}, ip="2.2.2.2")
    assert "late@example.com" not in [m["To"] for m in mailer.sent]


# ---------------------------------------------------------------- when things are not available

def test_without_a_database_sending_is_switched_off_because_limits_cannot_be_enforced():
    mailer = FakeMailer()
    use(None, mailer)
    r = send()
    assert r.status_code == 503 and mailer.sent == []


def test_if_the_limits_cannot_be_checked_nothing_is_sent():
    mailer = FakeMailer()
    use(FakeStore(count_fails=True), mailer)
    assert send().status_code == 503 and mailer.sent == []


def test_without_smtp_settings_email_is_not_available():
    use(FakeStore(), None)
    r = send()
    assert r.status_code == 503 and "not configured" in r.json()["detail"].lower()


def test_a_mail_server_failure_is_a_clean_502_without_secrets():
    use(FakeStore(), FakeMailer(error=MailError("The mail server rejected the sign-in.")))
    r = send()
    assert r.status_code == 502 and r.json()["detail"] == "The mail server rejected the sign-in."


def test_a_logging_failure_does_not_stop_a_send_that_already_happened():
    mailer = FakeMailer()
    use(FakeStore(log_fails=True), mailer)
    assert send().status_code == 200 and len(mailer.sent) == 1


# ---------------------------------------------------------------- plumbing

def test_health_says_whether_email_is_on(monkeypatch):
    for name in ("SMTP_EMAIL", "SMTP_APP_PASSWORD"):
        monkeypatch.delenv(name, raising=False)
    assert client.get("/api/health").json()["email_enabled"] is False
    monkeypatch.setenv("SMTP_EMAIL", "me@gmail.com")
    monkeypatch.setenv("SMTP_APP_PASSWORD", "abcdefghijklmnop")
    assert client.get("/api/health").json()["email_enabled"] is True


def test_the_default_mailer_is_built_from_the_environment():
    app.dependency_overrides.clear()
    from medlens.mailer import GmailSMTP

    m = mailer_dependency()
    assert isinstance(m, GmailSMTP) and m.settings.email == "sender@gmail.com"


def test_no_default_mailer_without_settings(monkeypatch):
    monkeypatch.delenv("SMTP_APP_PASSWORD", raising=False)
    assert mailer_dependency() is None
    assert config.smtp_settings().enabled is False
