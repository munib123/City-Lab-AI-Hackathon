"""Unit spelling and conversion. All factors come from data/unit_factors.json (team file, not CityLab)."""

from __future__ import annotations

import json
from functools import lru_cache

from pydantic import BaseModel, Field

from . import config


def norm_unit(unit: str) -> str:
    """'cells/µL', 'Cells/uL ' and 'cells/ul' all become the same key."""
    return unit.strip().lower().replace("µ", "u").replace(" ", "")


class ConversionRule(BaseModel):
    analyte: str
    from_unit: str = Field(alias="from")
    to_unit: str = Field(alias="to")
    factor: float
    note: str = ""

    model_config = {"populate_by_name": True}


class UnitFactors(BaseModel):
    note: str = ""
    equivalents: list[list[str]] = Field(default_factory=list)
    conversions: list[ConversionRule] = Field(default_factory=list)

    def same_unit(self, a: str, b: str) -> bool:
        na, nb = norm_unit(a), norm_unit(b)
        if na == nb:
            return True
        return any({norm_unit(x), norm_unit(y)} == {na, nb} for x, y in self.equivalents)

    def find(self, analyte: str, from_unit: str, to_unit: str) -> ConversionRule | None:
        nf, nt = norm_unit(from_unit), norm_unit(to_unit)
        for rule in self.conversions:
            if rule.analyte == analyte and norm_unit(rule.from_unit) == nf and norm_unit(rule.to_unit) == nt:
                return rule
        return None


@lru_cache(maxsize=1)
def load_unit_factors() -> UnitFactors:
    return UnitFactors.model_validate(json.loads(config.UNIT_FACTORS_PATH.read_text(encoding="utf-8")))
