"""Plain-language 'what this test measures' texts. Team-written, NOT from the CityLab files."""

from __future__ import annotations

import json
from functools import lru_cache

from pydantic import BaseModel, Field

from . import config

LABEL = "General information, not from CityLab's files"


class ExplanationItem(BaseModel):
    measures: str
    low: str | None = None
    high: str | None = None


class Explanations(BaseModel):
    label: str = LABEL
    items: dict[str, ExplanationItem] = Field(default_factory=dict)


@lru_cache(maxsize=1)
def load_explanations() -> Explanations:
    return Explanations.model_validate(json.loads(config.EXPLANATIONS_PATH.read_text(encoding="utf-8")))
