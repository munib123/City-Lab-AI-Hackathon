"""The report email: content, safety, and the Gmail SMTP sender (tested with a fake SMTP, no network)."""

import smtplib

import pytest

from medlens import config
from medlens.corpus import get_report
from medlens.engine import analyze_report
from medlens.explain import enrich
from medlens.kb import load_kb
from medlens.lint import find_diagnosis_phrases
from medlens.mailer import GmailSMTP, MailError, build_message, mask_address, valid_address

SENDER = "sender@gmail.com"
PASSWORD = "abcdefghijklmnop"


@pytest.fixture(scope="module")
def kb():
    return load_kb()


def analysis(kb, rid="P004", **kw):
    return enrich(analyze_report(get_report(rid), kb, **kw), kb)


def parts(msg):
    text = msg.get_body(preferencelist=("plain",)).get_content()
    html = msg.get_body(preferencelist=("html",)).get_content()
    return text, html


# ---------------------------------------------------------------- addresses

@pytest.mark.parametrize("addr", ["a@b.co", "first.last+tag@example.com", "x_y@sub.domain.org"])
def test_normal_addresses_are_valid(addr):
    assert valid_address(addr)


@pytest.mark.parametrize(
    "addr",
    ["", "nope", "a@b", "@b.com", "a@@b.com", "a b@c.com", "a@b.com\nBcc: evil@x.com", "a@b.com\r\n", "a@b.com,c@d.com",
     "<a@b.com>", "a@b.com;c@d.com", "a" * 250 + "@b.com", "a@b..com", "a@-b.com"],
)
def test_bad_or_injected_addresses_are_rejected(addr):
    assert not valid_address(addr)


def test_masking_hides_most_of_the_address():
    assert mask_address("muneeb@gmail.com") == "m*****@gmail.com"
    assert mask_address("ab@x.org") == "a*@x.org"


# ---------------------------------------------------------------- the message

def test_headers(kb):
    msg = build_message(analysis(kb), "pat@example.com", SENDER)
    assert msg["To"] == "pat@example.com"
    assert "MedLens" in msg["From"] and SENDER in msg["From"]
    assert msg["Subject"] == "MedLens: urgent result in your lab report"


def test_subject_depends_on_whether_anything_is_urgent(kb):
    assert build_message(analysis(kb, "P001"), "a@b.co", SENDER)["Subject"] == "MedLens: your lab report explained"


def test_text_part_has_the_explanation(kb):
    text, _ = parts(build_message(analysis(kb), "pat@example.com", SENDER))
    assert "Report P004" in text
    assert "see a doctor today" in text.lower()
    assert "Hemoglobin: 6.5 g/dL" in text and "URGENT" in text
    assert "carries oxygen" in text  # what it measures
    assert "Questions to ask your doctor" in text and "1. " in text
    assert "licensed medical doctor" in text  # disclaimer
    assert "General information, not from CityLab's files" in text


def test_conversion_working_is_shown_and_labelled(kb):
    text, _ = parts(build_message(analysis(kb, "P005"), "a@b.co", SENDER))
    assert "6.0 mmol/L × 18 = 108 mg/dL" in text and "not from the lab's files" in text.lower()


def test_missing_demographics_prompt_is_included(kb):
    text, _ = parts(build_message(analysis(kb, "P003"), "a@b.co", SENDER))
    assert "age and sex are missing" in text and "Needs your age or sex" in text


def test_html_part_matches_and_is_a_real_document(kb):
    _, html = parts(build_message(analysis(kb), "a@b.co", SENDER))
    assert html.lstrip().lower().startswith("<!doctype html")
    assert "Hemoglobin" in html and "URGENT" in html and "Questions to ask your doctor" in html


def test_no_patient_name_or_mrn_is_ever_in_the_email(kb):
    for rid in ("P001", "P004", "P009", "P012"):
        a = analysis(kb, rid)
        msg = build_message(a, "a@b.co", SENDER)
        text, html = parts(msg)
        blob = text + html + msg.as_string()
        assert a.patient.name.split()[0] not in blob and a.patient.mrn not in blob


def test_file_references_are_not_in_the_email_body(kb):
    text, html = parts(build_message(analysis(kb), "a@b.co", SENDER))
    assert ".md:" not in text and ".md:" not in html


def test_everything_is_html_escaped(kb):
    a = analysis(kb, "P009")
    a.results[0].raw_name = "<script>alert(1)</script>"
    a.results[0].canonical_name = None
    a.doctor_questions[0] = 'Is "this" <b>bold</b> & risky?'
    _, html = parts(build_message(a, "a@b.co", SENDER))
    assert "<script>" not in html and "&lt;script&gt;" in html
    assert "<b>bold</b>" not in html and "&lt;b&gt;bold&lt;/b&gt;" in html and "&amp; risky" in html


@pytest.mark.parametrize("rid", [f"P{n:03d}" for n in range(1, 15)])
def test_no_email_diagnoses(kb, rid):
    text, html = parts(build_message(analysis(kb, rid), "a@b.co", SENDER))
    assert find_diagnosis_phrases(text) == []


def test_footer_says_why_the_email_arrived(kb):
    text, _ = parts(build_message(analysis(kb), "a@b.co", SENDER))
    assert "someone entered your address" in text.lower() and "ignore" in text.lower()


def test_body_is_plain_text_safe_for_odd_characters(kb):
    msg = build_message(analysis(kb, "P005"), "a@b.co", SENDER)
    assert "×" in msg.as_string() or "=C3=97" in msg.as_string()  # the multiplication sign survives encoding


# ---------------------------------------------------------------- sending through Gmail SMTP

class FakeSMTP:
    instances = []
    auth_error = recipients_error = connect_error = timeout = None

    def __init__(self, host, port, timeout=None):
        if FakeSMTP.connect_error:
            raise FakeSMTP.connect_error
        self.host, self.port, self.timeout = host, port, timeout
        self.calls = []
        FakeSMTP.instances.append(self)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.calls.append("quit")
        return False

    def starttls(self, context=None):
        self.calls.append(("starttls", context is not None))

    def login(self, user, password):
        if FakeSMTP.auth_error:
            raise FakeSMTP.auth_error
        self.calls.append(("login", user, password))

    def send_message(self, msg):
        if FakeSMTP.recipients_error:
            raise FakeSMTP.recipients_error
        self.calls.append(("send", msg["To"]))


@pytest.fixture(autouse=True)
def _fake_smtp():
    FakeSMTP.instances = []
    FakeSMTP.auth_error = FakeSMTP.recipients_error = FakeSMTP.connect_error = None
    yield


def settings():
    return config.SMTPSettings(host="smtp.gmail.com", port=587, email=SENDER, password=PASSWORD)


def test_it_connects_encrypts_signs_in_and_sends(kb):
    msg = build_message(analysis(kb), "pat@example.com", SENDER)
    GmailSMTP(settings(), smtp_factory=FakeSMTP).send(msg)
    smtp = FakeSMTP.instances[0]
    assert (smtp.host, smtp.port) == ("smtp.gmail.com", 587) and smtp.timeout and smtp.timeout <= 20
    # encryption must start BEFORE the password is sent
    assert smtp.calls[0] == ("starttls", True)
    assert smtp.calls[1] == ("login", SENDER, PASSWORD)
    assert smtp.calls[2] == ("send", "pat@example.com")


def test_the_password_is_never_in_the_message(kb):
    msg = build_message(analysis(kb), "a@b.co", SENDER)
    assert PASSWORD not in msg.as_string()


@pytest.mark.parametrize(
    "error, phrase",
    [
        (smtplib.SMTPAuthenticationError(535, b"bad credentials " + PASSWORD.encode()), "sign-in"),
        (smtplib.SMTPRecipientsRefused({"a@b.co": (550, b"no such user")}), "recipient"),
        (smtplib.SMTPServerDisconnected("gone"), "SMTPServerDisconnected"),
        (TimeoutError("slow"), "TimeoutError"),
        (OSError("network down"), "OSError"),
    ],
)
def test_failures_become_a_mail_error_without_leaking_the_password(kb, error, phrase):
    FakeSMTP.auth_error = error if isinstance(error, smtplib.SMTPAuthenticationError) else None
    FakeSMTP.recipients_error = error if isinstance(error, smtplib.SMTPRecipientsRefused) else None
    FakeSMTP.connect_error = error if not isinstance(error, (smtplib.SMTPAuthenticationError, smtplib.SMTPRecipientsRefused)) else None
    msg = build_message(analysis(kb), "a@b.co", SENDER)
    with pytest.raises(MailError) as exc:
        GmailSMTP(settings(), smtp_factory=FakeSMTP).send(msg)
    assert phrase in str(exc.value) and PASSWORD not in str(exc.value)


def test_a_non_ascii_password_cannot_crash_it(kb):
    class Strict(FakeSMTP):
        def login(self, user, password):
            password.encode("ascii")  # smtplib does this and raises UnicodeEncodeError

    bad = config.SMTPSettings(host="h", port=587, email=SENDER, password="café")
    with pytest.raises(MailError):
        GmailSMTP(bad, smtp_factory=Strict).send(build_message(analysis(kb), "a@b.co", SENDER))
