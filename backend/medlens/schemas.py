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
