"""Email the explanation of a report through Gmail SMTP.

The mail goes out from a personal Gmail account, so everything here is deliberately narrow:
the content is generated only from a report's analysis (callers cannot supply a subject or body),
no patient name or record number is included, and every piece of text is escaped.
"""

from __future__ import annotations

import html
import re
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr

from . import config
from .schemas import Analysis, ResultAnalysis

SMTP_TIMEOUT = 15.0

_ADDRESS = re.compile(r"[A-Za-z0-9._%+\-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}")
_FILE_REF = re.compile(r"\s*\([^()]*\.md:\d+[^()]*\)")

STATUS_LABEL = {
    "NORMAL": "Normal",
    "LOW": "Low",
    "HIGH": "High",
    "ABNORMAL": "Not the normal result",
    "URGENT_LOW": "URGENT - low",
    "URGENT_HIGH": "URGENT - high",
    "NEEDS_INFO": "Needs your age or sex",
    "UNCLASSIFIED": "Cannot be classified from the files",
}

FOOTER = (
    "You received this email because someone entered your address on the MedLens site. "
    "If that was not you, you can ignore this message; nothing else will be sent."
)
LEGEND = "Lines marked \"What it measures\" and \"What this can mean\" are {label}."


class MailError(Exception):
    """The email could not be sent. Never carries the password or the server's raw reply."""


def valid_address(address: str) -> bool:
    """A plain single address. Rejects line breaks (header injection), lists, names and brackets."""
    if not isinstance(address, str) or not 3 <= len(address) <= 254:
        return False
    local = address.partition("@")[0]
    if len(local) > 64 or ".." in address:
        return False
    return _ADDRESS.fullmatch(address) is not None


def mask_address(address: str) -> str:
    local, _, domain = address.partition("@")
    return f"{local[:1]}{'*' * max(len(local) - 1, 1)}@{domain}"


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", _FILE_REF.sub("", text)).strip()


def _name(r: ResultAnalysis) -> str:
    return r.canonical_name or r.raw_name


def _blocks(a: Analysis) -> list[dict]:
    """The report as plain data; the text and HTML versions are both rendered from this."""
    results = []
    for r in a.results:
        results.append(
            {
                "title": f"{_name(r)}: {r.value_text} {r.unit}".strip(),
                "status": STATUS_LABEL.get(r.status, r.status),
                "urgent": r.status.startswith("URGENT"),
                "conversion": r.conversion.working if r.conversion else None,
                "measures": r.explanation.measures if r.explanation else None,
                "meaning": r.explanation.meaning if r.explanation else None,
                "why": _clean(r.reason),
            }
        )
    label = next((r.explanation.label for r in a.results if r.explanation), "General information, not from CityLab's files")
    return results, label


def _subject(a: Analysis) -> str:
    return "MedLens: urgent result in your lab report" if a.urgent_banner else "MedLens: your lab report explained"


def _render_text(a: Analysis) -> str:
    results, label = _blocks(a)
    out = ["MedLens - your lab report explained", f"Report {a.report_id}" if a.report_id else "Your report", ""]
    if a.urgent_banner:
        out += [a.urgent_banner.title.upper(), _clean(a.urgent_banner.message), ""]
    if a.demographics_prompt:
        out += [_clean(a.demographics_prompt), ""]
    out.append("RESULTS")
    for b in results:
        out.append(f"- {b['title']} - {b['status']}")
        if b["conversion"]:
            out.append(f"    Unit conversion (general information, not from the lab's files): {b['conversion']}")
        if b["measures"]:
            out.append(f"    What it measures: {b['measures']}")
        if b["meaning"]:
            out.append(f"    What this can mean: {b['meaning']}")
        out.append(f"    Why: {b['why']}")
    out += ["", "Questions to ask your doctor"]
    out += [f"{n}. {q}" for n, q in enumerate(a.doctor_questions, start=1)]
    out += ["", LEGEND.format(label=label) if any(b["measures"] for b in results) else "", a.disclaimer, "", FOOTER]
    return "\n".join(line for i, line in enumerate(out) if line or (i and out[i - 1]))


def _render_html(a: Analysis) -> str:
    e = html.escape
    results, label = _blocks(a)
    parts = [
        "<!doctype html><html><body style=\"font-family:Arial,Helvetica,sans-serif;color:#1b2430;max-width:640px;margin:auto;line-height:1.5\">",
        "<h2 style=\"margin-bottom:0\">MedLens - your lab report explained</h2>",
        f"<p style=\"color:#5b6675;margin-top:4px\">{e(f'Report {a.report_id}' if a.report_id else 'Your report')}</p>",
    ]
    if a.urgent_banner:
        parts.append(
            "<div style=\"border-left:4px solid #c0392b;background:#fdecea;padding:10px 14px;margin:12px 0\">"
            f"<strong>{e(a.urgent_banner.title)}</strong><br>{e(_clean(a.urgent_banner.message))}</div>"
        )
    if a.demographics_prompt:
        parts.append(f"<p style=\"background:#eef4fb;padding:10px 14px\">{e(_clean(a.demographics_prompt))}</p>")
    parts.append("<h3>Results</h3>")
    for b in results:
        colour = "#c0392b" if b["urgent"] else "#1b2430"
        parts.append(f"<div style=\"margin:0 0 14px\"><strong>{e(b['title'])}</strong> - <span style=\"color:{colour}\">{e(b['status'])}</span>")
        if b["conversion"]:
            parts.append(f"<br><em>Unit conversion (general information, not from the lab's files):</em> {e(b['conversion'])}")
        if b["measures"]:
            parts.append(f"<br><em>What it measures:</em> {e(b['measures'])}")
        if b["meaning"]:
            parts.append(f"<br><em>What this can mean:</em> {e(b['meaning'])}")
        parts.append(f"<br><em>Why:</em> {e(b['why'])}</div>")
    parts.append("<h3>Questions to ask your doctor</h3><ol>")
    parts += [f"<li>{e(q)}</li>" for q in a.doctor_questions]
    parts.append("</ol>")
    if any(b["measures"] for b in results):
        parts.append(f"<p style=\"font-size:13px;color:#5b6675\">{e(LEGEND.format(label=label))}</p>")
    parts.append(f"<p><strong>{e(a.disclaimer)}</strong></p>")
    parts.append(f"<hr><p style=\"font-size:12px;color:#7a8594\">{e(FOOTER)}</p></body></html>")
    return "".join(parts)


def build_message(analysis: Analysis, to: str, sender: str, sender_name: str = "MedLens") -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr((sender_name, sender))
    msg["To"] = to
    msg["Subject"] = _subject(analysis)
    msg.set_content(_render_text(analysis))
    msg.add_alternative(_render_html(analysis), subtype="html")
    return msg


class GmailSMTP:
    def __init__(self, settings: config.SMTPSettings, smtp_factory=smtplib.SMTP, timeout: float = SMTP_TIMEOUT):
        self.settings = settings
        self._factory = smtp_factory
        self.timeout = timeout

    def send(self, message: EmailMessage) -> None:
        s = self.settings
        try:
            with self._factory(s.host, s.port, timeout=self.timeout) as smtp:
                smtp.starttls(context=ssl.create_default_context())  # encrypt BEFORE the password is sent
                smtp.login(s.email, s.password)
                smtp.send_message(message)
        except smtplib.SMTPAuthenticationError:
            raise MailError("The mail server rejected the sign-in.") from None
        except smtplib.SMTPRecipientsRefused:
            raise MailError("The mail server did not accept the recipient address.") from None
        except Exception as exc:  # network errors, timeouts, a password that cannot be encoded, ...
            raise MailError(f"The mail could not be sent ({type(exc).__name__}).") from None
