"""Analysis result shapes. These are also the JSON the API returns, so keep them stable."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .models import Source

Status = Literal[
    "NORMAL",
    "LOW",
    "HIGH",
    "ABNORMAL",  # qualitative result that is not the normal word (e.g. Protein: Positive)
    "URGENT_LOW",
    "URGENT_HIGH",
    "UNCLASSIFIED",  # "cannot be classified from the files"
    "NEEDS_INFO",  # age or sex needed to choose the range
]
Overall = Literal["URGENT", "NOT_NORMAL", "INCOMPLETE", "ALL_NORMAL", "NO_RESULTS"]
DemographicSource = Literal["recorded", "user_supplied", "missing"]


class RangeUsed(BaseModel):
    id: str
    sex: str
    age_min: int
    age_max: int
    low: float | None = None
    high: float | None = None
    unit: str = ""
    qualitative: str | None = None
    source: Source


class DangerHit(BaseModel):
    id: str
    condition: Literal["less_than", "greater_than"]
    threshold: float
    unit: str
    source: Source


class Conversion(BaseModel):
    from_value: float
    from_unit: str
    factor: float
    to_value: float
    to_unit: str
    working: str  # e.g. "6.0 mmol/L x 18 = 108 mg/dL"
    origin: Literal["team"] = "team"  # factors are not in the CityLab files
    note: str = ""


class Explanation(BaseModel):
    measures: str  # what the test measures, in simple words
    meaning: str | None = None  # what a low/high result can mean; None when the result is normal
    label: str  # always says this is general information, not from the lab's files
    origin: Literal["team"] = "team"


class UrgentItem(BaseModel):
    test: str
    value: str
    reason: str


class UrgentBanner(BaseModel):
    title: str
    message: str
    items: list[UrgentItem]


class ResultAnalysis(BaseModel):
    raw_name: str
    canonical_name: str | None = None
    name_origin: Literal["files", "team"] | None = None
    value_text: str
    value: float | None = None
    unit: str = ""
    converted_value: float | None = None
    converted_unit: str | None = None
    conversion: Conversion | None = None
    status: Status
    range_used: RangeUsed | None = None
    danger: DangerHit | None = None
    boundary: bool = False  # value sits exactly on a range limit (counts as NORMAL)
    needs: list[Literal["age", "sex"]] = Field(default_factory=list)
    reason: str
    source: Source  # the line of the report this result came from
    explanation: Explanation | None = None  # added by explain.enrich


ChatAnswerType = Literal[
    "answered", "not_in_files", "refused_other_patient", "refused_diagnosis", "needs_info", "unavailable"
]


class ChatSource(BaseModel):
    id: str  # e.g. "R07", "RES1", "RULE:privacy", "EXPL:ALT"
    label: str
    file: str | None = None
    line: int | None = None
    origin: Literal["files", "team", "report"]


class ChatResponse(BaseModel):
    report_id: str | None = None
    answer: str
    answer_type: ChatAnswerType
    sources: list[ChatSource] = Field(default_factory=list)
    llm_used: bool = False  # False when code answered (refusals) or chat is off
    reading_grade: float | None = None  # Flesch-Kincaid grade of the answer, when a model wrote it


class Patient(BaseModel):
    name: str | None = None
    mrn: str | None = None
    age: int | None = None
    sex: Literal["Male", "Female"] | None = None


class Analysis(BaseModel):
    report_id: str | None = None
    patient: Patient
    overall: Overall
    results: list[ResultAnalysis]
    missing_demographics: list[Literal["age", "sex"]] = Field(default_factory=list)
    demographics_source: dict[str, DemographicSource]
    # Filled in by explain.enrich (the engine alone leaves them empty):
    urgent_banner: UrgentBanner | None = None
    doctor_questions: list[str] = Field(default_factory=list)
    demographics_prompt: str | None = None
    disclaimer: str = ""
