"""HTTP API (FastAPI). Everything is under /api so one rewrite rule can route it on Vercel."""

from __future__ import annotations

import os
from typing import Literal

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from . import __version__, config
from .chat import answer_question
from .corpus import get_report, load_corpus
from .engine import analyze_report
from .explain import enrich
from .kb import load_kb
from .llm import LLMClient, get_llm
from .mailer import GmailSMTP, MailError, build_message, mask_address, valid_address
from .models import KnowledgeBase, ParsedReport
from .privacy import PrivacyGuard
from .qr import make_qr, report_link
from .report_parser import parse_report_text
from .speech import DEFAULT_VOICE, VOICES, audio_key, chat_speech, report_speech
from .tts import EdgeTTS, TTSError
from .schemas import Analysis, ChatResponse
from .store import Store, get_store

MAX_TEXT = 20_000  # characters of pasted report text

app = FastAPI(title="MedLens API", version=__version__)

_origins = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- request models

def _clean_sex(value):
    if value is None:
        return None
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ("male", "m"):
            return "Male"
        if v in ("female", "f"):
            return "Female"
    raise ValueError("sex must be Male or Female")


class AnalyzeRequest(BaseModel):
    report_id: str | None = Field(default=None, max_length=20)
    text: str | None = Field(default=None, max_length=MAX_TEXT)
    age: int | None = Field(default=None, ge=0, le=130, strict=True)
    sex: Literal["Male", "Female"] | None = None

    _sex = field_validator("sex", mode="before")(_clean_sex)

    @model_validator(mode="after")
    def exactly_one_source(self):
        has_id = bool(self.report_id and self.report_id.strip())
        has_text = bool(self.text and self.text.strip())
        if has_id == has_text:
            raise ValueError("send exactly one of report_id or text")
        return self


class DemographicsRequest(AnalyzeRequest):
    @model_validator(mode="after")
    def needs_age_or_sex(self):
        if self.age is None and self.sex is None:
            raise ValueError("send age, sex, or both")
        return self


class ChatRequest(AnalyzeRequest):
    question: str = Field(min_length=1, max_length=500)

    @field_validator("question")
    @classmethod
    def question_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("question must not be blank")
        return v.strip()


class TTSRequest(BaseModel):
    """Read-aloud request. Only things the API itself produced can be spoken, never arbitrary text."""

    model_config = ConfigDict(extra="forbid")

    chat_id: str | None = None  # a stored chat answer (the `id` returned by /api/chat)
    report_id: str | None = Field(default=None, max_length=20)  # or a part of a corpus report
    part: Literal["summary", "urgent", "questions", "result"] | None = None
    index: int | None = Field(default=None, ge=0, le=50, strict=True)  # which result, for part="result"
    voice: str | None = None
    age: int | None = Field(default=None, ge=0, le=130, strict=True)
    sex: Literal["Male", "Female"] | None = None

    _sex = field_validator("sex", mode="before")(_clean_sex)

    @field_validator("chat_id")
    @classmethod
    def chat_id_is_a_uuid(cls, v):
        if v is None:
            return v
        try:
            return str(uuid.UUID(v))
        except ValueError:
            raise ValueError("chat_id must be the id returned by /api/chat") from None

    @field_validator("voice")
    @classmethod
    def voice_is_allowed(cls, v):
        if v is not None and v not in VOICES:
            raise ValueError(f"voice must be one of {', '.join(VOICES)}")
        return v

    @model_validator(mode="after")
    def consistent_fields(self):
        has_chat = self.chat_id is not None
        has_report = bool(self.report_id and self.report_id.strip())
        if has_chat == has_report:
            raise ValueError("send exactly one of chat_id or report_id")
        if has_chat and (self.part is not None or self.index is not None):
            raise ValueError("part and index go with report_id, not chat_id")
        if has_report:
            if self.part is None:
                raise ValueError("part is required with report_id")
            if (self.part == "result") != (self.index is not None):
                raise ValueError("index is needed for part=result, and only for it")
        return self


class EmailRequest(BaseModel):
    """Email the explanation of one corpus report. Nothing else can be sent: no subject, body, cc or free text."""

    model_config = ConfigDict(extra="forbid")

    report_id: str = Field(min_length=1, max_length=20)
    to: str
    age: int | None = Field(default=None, ge=0, le=130, strict=True)
    sex: Literal["Male", "Female"] | None = None

    _sex = field_validator("sex", mode="before")(_clean_sex)

    @field_validator("to")
    @classmethod
    def to_is_one_plain_address(cls, v: str) -> str:
        if not valid_address(v):
            raise ValueError("to must be one email address, for example name@example.com")
        return v


# ---------------------------------------------------------------- helpers

# Report emails go out from a personal Gmail account, so sending is tightly limited.
EMAIL_PER_IP_HOUR = 5
EMAIL_PER_RECIPIENT_HOUR = 3
EMAIL_PER_RECIPIENT_DAY = 5
EMAIL_DAILY_CAP = 100  # Gmail allows about 500 a day; stay far below. Override with EMAIL_DAILY_LIMIT.


def mailer_dependency() -> GmailSMTP | None:
    """Overridable in tests. None means email is not configured (no SMTP settings)."""
    settings = config.smtp_settings()
    return GmailSMTP(settings) if settings.enabled else None


def _hash(value: str) -> str:
    """Salted hash, so the log can rate-limit without ever holding an address or an IP in clear."""
    salt = config.clean_env("EMAIL_HASH_SALT") or hashlib.sha256(config.supabase_settings().key.encode()).hexdigest()
    return hashlib.sha256(f"{salt}|{value}".encode("utf-8")).hexdigest()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    return forwarded or (request.client.host if request.client else "unknown")


def _daily_cap() -> int:
    try:
        return max(int(config.clean_env("EMAIL_DAILY_LIMIT") or EMAIL_DAILY_CAP), 0)
    except ValueError:
        return EMAIL_DAILY_CAP


_tts_engine = EdgeTTS()
AUDIO_LINK_SECONDS = 3600


def tts_dependency() -> EdgeTTS:
    """Overridable in tests."""
    return _tts_engine


def _default_voice() -> str:
    wanted = config.clean_env("TTS_VOICE")
    return wanted if wanted in VOICES else DEFAULT_VOICE


@lru_cache(maxsize=1)
def _guard() -> PrivacyGuard:
    return PrivacyGuard(load_corpus())


def llm_dependency() -> LLMClient | None:
    """Overridable in tests. None means chat is switched off (no API key)."""
    return get_llm()


def store_dependency() -> Store | None:
    """Overridable in tests. None means nothing is stored (no Supabase variables)."""
    return get_store()


def _is_corpus_request(req: AnalyzeRequest) -> bool:
    """Only corpus reports are ever stored. Pasted report text may be a real person's data and is never saved."""
    return bool(req.report_id and req.report_id.strip())


def _report_for(req: AnalyzeRequest) -> ParsedReport:
    if req.report_id and req.report_id.strip():
        report = get_report(req.report_id.strip())
        if report is None:
            raise HTTPException(status_code=404, detail=f"No report with id {req.report_id!r}.")
        return report
    report = parse_report_text(req.text or "")
    if not report.results:
        raise HTTPException(status_code=422, detail="No test results could be read from this text.")
    return report


def _analyze(req: AnalyzeRequest, store: Store | None = None) -> Analysis:
    kb = load_kb()
    report = _report_for(req)
    try:
        analysis = enrich(analyze_report(report, kb, age=req.age, sex=req.sex), kb)
    except ValueError as exc:  # invalid demographics that slipped past validation
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if store is not None and _is_corpus_request(req):
        store.save_analysis(
            analysis.report_id or req.report_id.strip(),
            analysis.patient.age,
            analysis.patient.sex,
            analysis.overall,
            analysis.model_dump(mode="json"),
        )
    return analysis


# ---------------------------------------------------------------- routes

@app.get("/", include_in_schema=False)
@app.get("/api", include_in_schema=False)
def root():
    """What a visitor sees at the bare link, instead of a 404."""
    return {
        "name": "MedLens API",
        "version": __version__,
        "message": "This is the MedLens API. Open /docs to try it in the browser.",
        "docs": "/docs",
        "health": "/api/health",
        "endpoints": [
            "/api/health",
            "/api/reports",
            "/api/kb",
            "/api/analyze",
            "/api/analyze/demographics",
            "/api/chat",
        ],
    }


@app.get("/api/health")
def health():
    kb = load_kb()
    llm = config.llm_settings()
    return {
        "status": "ok",
        "version": __version__,
        "llm_enabled": llm.enabled,
        "llm_provider": llm.provider,
        "llm_model": llm.model,
        "storage_enabled": config.supabase_settings().enabled,
        "email_enabled": config.smtp_settings().enabled,
        "kb": {
            "ranges": len(kb.ranges),
            "danger_limits": len(kb.danger),
            "aliases": len(kb.aliases),
            "safety_rules": len(kb.safety_rules),
        },
    }


def _link(report_id: str, request: Request) -> str:
    return report_link(report_id, config.public_app_url(), str(request.base_url))


def _require_corpus_report(report_id: str) -> None:
    if get_report(report_id) is None:
        raise HTTPException(status_code=404, detail=f"No report with id {report_id!r}.")


@app.get("/api/reports")
def list_reports(request: Request):
    return [
        {
            "report_id": r.report_id,
            "patient_name": r.patient_name,
            "result_count": len(r.results),
            "link": _link(r.report_id, request),
            "qr": f"/api/reports/{r.report_id}/qr",
        }
        for r in load_corpus()
    ]


@app.get("/api/reports/{report_id}", response_model=Analysis)
def get_report_analysis(report_id: str, store: Store | None = Depends(store_dependency)):
    """Read-only page for one corpus report (this is where a QR leads until the frontend address is set)."""
    _require_corpus_report(report_id)
    return _analyze(AnalyzeRequest(report_id=report_id), store)


@app.get("/api/reports/{report_id}/link")
def report_link_info(report_id: str, request: Request):
    _require_corpus_report(report_id)
    return {"report_id": report_id, "url": _link(report_id, request), "qr": f"/api/reports/{report_id}/qr"}


@app.get("/api/reports/{report_id}/qr")
def report_qr(report_id: str, request: Request, format: Literal["svg", "png"] = "svg"):
    """QR code image that opens this report. Only corpus reports get one (this is not a general QR generator)."""
    _require_corpus_report(report_id)
    data, media_type = make_qr(_link(report_id, request), fmt=format)
    return Response(content=data, media_type=media_type, headers={"Cache-Control": "public, max-age=86400"})


@app.get("/api/kb", response_model=KnowledgeBase)
def knowledge_base():
    return load_kb()


@app.post("/api/analyze", response_model=Analysis)
def analyze(req: AnalyzeRequest, store: Store | None = Depends(store_dependency)):
    return _analyze(req, store)


@app.post("/api/analyze/demographics", response_model=Analysis)
def analyze_with_demographics(req: DemographicsRequest, store: Store | None = Depends(store_dependency)):
    return _analyze(req, store)


@app.post("/api/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    llm: LLMClient | None = Depends(llm_dependency),
    store: Store | None = Depends(store_dependency),
):
    kb = load_kb()
    report = _report_for(req)
    try:
        analysis = enrich(analyze_report(report, kb, age=req.age, sex=req.sex), kb)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    answer = answer_question(req.question, report, analysis, kb, llm, _guard())
    if store is not None and _is_corpus_request(req):
        answer.id = store.log_chat(
            report_id=analysis.report_id or req.report_id.strip(),
            question=req.question,
            answer=answer.answer,
            answer_type=answer.answer_type,
            llm_used=answer.llm_used,
            reading_grade=answer.reading_grade,
            sources=[s.model_dump(mode="json") for s in answer.sources],
            model=config.llm_settings().model if answer.llm_used else None,
            age=analysis.patient.age,
            sex=analysis.patient.sex,
        )
    return answer


@app.post("/api/tts")
def read_aloud(
    req: TTSRequest,
    store: Store | None = Depends(store_dependency),
    engine: EdgeTTS = Depends(tts_dependency),
):
    """Read an answer or a part of a report aloud. Audio is made once and cached in Supabase."""
    if store is None:
        raise HTTPException(status_code=503, detail="Audio storage is not configured, so read-aloud is unavailable.")
    voice = req.voice or _default_voice()

    if req.chat_id:
        answer = store.get_chat_answer(req.chat_id)
        if answer is None:
            raise HTTPException(status_code=404, detail="No stored chat answer with that id.")
        try:
            text = chat_speech(answer)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        source = f"chat:{req.chat_id}"
    else:
        report_id = req.report_id.strip()
        report = get_report(report_id)
        if report is None:
            raise HTTPException(status_code=404, detail=f"No report with id {report_id!r}.")
        kb = load_kb()
        try:
            analysis = enrich(analyze_report(report, kb, age=req.age, sex=req.sex), kb)
            text = report_speech(analysis, req.part, req.index)
        except LookupError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        source = f"report:{report_id}:{req.part}" + (f":{req.index}" if req.part == "result" else "")

    key = audio_key(voice, text)
    path = store.find_audio(key, voice)
    cached = path is not None
    if path is None:
        try:
            audio = engine.synthesize(text, voice)
        except TTSError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        path = f"{key[:2]}/{key}.mp3"
        if not store.upload_audio(path, audio):
            raise HTTPException(status_code=502, detail="The audio could not be stored.")
        store.save_audio(key, voice, source, text, path, len(audio))  # best effort; the file is already stored

    url = store.signed_audio_url(path, AUDIO_LINK_SECONDS)
    if url is None:
        raise HTTPException(status_code=502, detail="The audio link could not be created.")
    return {
        "audio_url": url,
        "cached": cached,
        "voice": voice,
        "characters": len(text),
        "source": source,
        "expires_in": AUDIO_LINK_SECONDS,
    }


@app.post("/api/email")
def email_report(
    req: EmailRequest,
    request: Request,
    store: Store | None = Depends(store_dependency),
    mailer: GmailSMTP | None = Depends(mailer_dependency),
):
    """Email the explanation of a corpus report to one address (rate limited; see EMAIL_* limits)."""
    if mailer is None:
        raise HTTPException(status_code=503, detail="Email is not configured.")
    if store is None:
        raise HTTPException(status_code=503, detail="Email is switched off because the sending limits cannot be checked.")

    report_id = req.report_id.strip()
    report = get_report(report_id)
    if report is None:
        raise HTTPException(status_code=404, detail=f"No report with id {report_id!r}.")

    ip_hash, to_hash = _hash(_client_ip(request)), _hash(req.to.lower())
    now = datetime.now(timezone.utc)
    hour, day = now - timedelta(hours=1), now - timedelta(days=1)
    limits = [
        ("Too many emails were requested from your connection. Please try again later.", 3600,
         lambda: store.count_emails(hour, ip_hash=ip_hash), EMAIL_PER_IP_HOUR),
        ("This recipient has received too many emails recently. Please try again later.", 3600,
         lambda: store.count_emails(hour, to_hash=to_hash), EMAIL_PER_RECIPIENT_HOUR),
        ("This recipient has reached the daily limit. Please try again tomorrow.", 86400,
         lambda: store.count_emails(day, to_hash=to_hash), EMAIL_PER_RECIPIENT_DAY),
        ("The daily email limit for today has been reached. Please try again tomorrow.", 86400,
         lambda: store.count_emails(day), _daily_cap()),
    ]
    for message, retry_after, count, limit in limits:
        used = count()
        if used is None:  # cannot verify the limit, so do not send
            raise HTTPException(status_code=503, detail="Email is temporarily unavailable.")
        if used >= limit:
            raise HTTPException(status_code=429, detail=message, headers={"Retry-After": str(retry_after)})

    kb = load_kb()
    try:
        analysis = enrich(analyze_report(report, kb, age=req.age, sex=req.sex), kb)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    message = build_message(analysis, req.to, config.smtp_settings().email)
    try:
        mailer.send(message)
    except MailError as exc:
        store.log_email(ip_hash, to_hash, report_id, "failed")  # failed attempts count too
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    store.log_email(ip_hash, to_hash, report_id, "sent")  # best effort; the mail is already out
    return {"sent": True, "to": mask_address(req.to), "report_id": report_id}
