"""HTTP API (FastAPI). Everything is under /api so one rewrite rule can route it on Vercel."""

from __future__ import annotations

import os
from typing import Literal

from functools import lru_cache

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator

from . import __version__, config
from .chat import answer_question
from .corpus import get_report, load_corpus
from .engine import analyze_report
from .explain import enrich
from .kb import load_kb
from .llm import LLMClient, get_llm
from .models import KnowledgeBase, ParsedReport
from .privacy import PrivacyGuard
from .report_parser import parse_report_text
from .schemas import Analysis, ChatResponse

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


# ---------------------------------------------------------------- helpers

@lru_cache(maxsize=1)
def _guard() -> PrivacyGuard:
    return PrivacyGuard(load_corpus())


def llm_dependency() -> LLMClient | None:
    """Overridable in tests. None means chat is switched off (no API key)."""
    return get_llm()


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


def _analyze(req: AnalyzeRequest) -> Analysis:
    kb = load_kb()
    report = _report_for(req)
    try:
        return enrich(analyze_report(report, kb, age=req.age, sex=req.sex), kb)
    except ValueError as exc:  # invalid demographics that slipped past validation
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# ---------------------------------------------------------------- routes

@app.get("/api/health")
def health():
    kb = load_kb()
    llm = config.llm_settings()
    return {
        "status": "ok",
        "version": __version__,
        "llm_enabled": llm.enabled,
        "llm_provider": llm.provider,
        "kb": {
            "ranges": len(kb.ranges),
            "danger_limits": len(kb.danger),
            "aliases": len(kb.aliases),
            "safety_rules": len(kb.safety_rules),
        },
    }


@app.get("/api/reports")
def list_reports():
    return [
        {"report_id": r.report_id, "patient_name": r.patient_name, "result_count": len(r.results)}
        for r in load_corpus()
    ]


@app.get("/api/kb", response_model=KnowledgeBase)
def knowledge_base():
    return load_kb()


@app.post("/api/analyze", response_model=Analysis)
def analyze(req: AnalyzeRequest):
    return _analyze(req)


@app.post("/api/analyze/demographics", response_model=Analysis)
def analyze_with_demographics(req: DemographicsRequest):
    return _analyze(req)


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest, llm: LLMClient | None = Depends(llm_dependency)):
    kb = load_kb()
    report = _report_for(req)
    try:
        analysis = enrich(analyze_report(report, kb, age=req.age, sex=req.sex), kb)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return answer_question(req.question, report, analysis, kb, llm, _guard())
