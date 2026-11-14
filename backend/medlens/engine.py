"""Classification engine. Pure code: no LLM, no guessing.

For every result, in this order:
  1. map the test name through the glossary (unknown name  -> UNCLASSIFIED)
  2. check the value can be compared (number vs word)
  3. match the unit, converting if a known factor exists (else UNCLASSIFIED)
  4. check the urgent limits first (they do not depend on age or sex)
  5. choose the range by recorded sex and age (missing -> NEEDS_INFO, never a guess)
  6. compare; a value exactly on a limit is NORMAL (rule in the files)
"""

from __future__ import annotations

from .models import KnowledgeBase, ParsedReport, ParsedResult, RangeRow
from .schemas import (
    Analysis,
    Conversion,
    DangerHit,
    Patient,
    RangeUsed,
    ResultAnalysis,
)
from .units import UnitFactors, load_unit_factors, norm_unit

ABNORMAL_WORDS = {"positive", "trace", "present", "reactive", "abnormal"}
URGENT_STATUSES = {"URGENT_LOW", "URGENT_HIGH"}
NOT_NORMAL_STATUSES = {"LOW", "HIGH", "ABNORMAL"}


def _fmt(x: float) -> str:
    return format(round(x, 6), "f").rstrip("0").rstrip(".") or "0"


def _ref(src) -> str:
    return f"{src.file}:{src.line}" if src else "the files"


def _rule_ref(kb: KnowledgeBase, rule_id: str) -> str:
    try:
        return _ref(kb.rule(rule_id).source)
    except KeyError:
        return "the safety rules"


def _range_used(row: RangeRow) -> RangeUsed:
    return RangeUsed(
        id=row.id, sex=row.sex, age_min=row.age_min, age_max=row.age_max,
        low=row.low, high=row.high, unit=row.unit, qualitative=row.qualitative, source=row.source,
    )


def _who(row: RangeRow) -> str:
    sex = "all sexes" if row.sex == "All" else row.sex.lower()
    return f"{sex}, ages {row.age_min}-{row.age_max}"


def _normalize_demographics(age, sex):
    if age is not None:
        if isinstance(age, bool) or not isinstance(age, int) or not 0 <= age <= 130:
            raise ValueError("age must be a whole number between 0 and 130")
    if sex is not None:
        s = str(sex).strip().lower()
        if s in ("male", "m"):
            sex = "Male"
        elif s in ("female", "f"):
            sex = "Female"
        else:
            raise ValueError("sex must be Male or Female")
    return age, sex


def analyze_report(
    report: ParsedReport,
    kb: KnowledgeBase,
    age: int | None = None,
    sex: str | None = None,
    units: UnitFactors | None = None,
) -> Analysis:
    """Classify every result in a report. `age`/`sex` are values the user supplied."""
    units = units or load_unit_factors()
    age, sex = _normalize_demographics(age, sex)

    eff_age = age if age is not None else report.age
    eff_sex = sex if sex is not None else report.sex
    source = {
        "age": "user_supplied" if age is not None else ("recorded" if report.age is not None else "missing"),
        "sex": "user_supplied" if sex is not None else ("recorded" if report.sex is not None else "missing"),
    }
    missing = [k for k, v in (("age", eff_age), ("sex", eff_sex)) if v is None]

    results = [_analyze_result(r, kb, units, eff_age, eff_sex) for r in report.results]
    statuses = {r.status for r in results}
    if not results:
        overall = "NO_RESULTS"
    elif statuses & URGENT_STATUSES:
        overall = "URGENT"
    elif statuses & NOT_NORMAL_STATUSES:
        overall = "NOT_NORMAL"
    elif statuses & {"NEEDS_INFO", "UNCLASSIFIED"}:
        overall = "INCOMPLETE"
    else:
        overall = "ALL_NORMAL"

    return Analysis(
        report_id=report.report_id,
        patient=Patient(name=report.patient_name, mrn=report.mrn, age=eff_age, sex=eff_sex),
        overall=overall,
        results=results,
        missing_demographics=missing,
        demographics_source=source,
    )


def _analyze_result(res: ParsedResult, kb: KnowledgeBase, units: UnitFactors, age: int | None, sex: str | None) -> ResultAnalysis:
    unknown_ref = _rule_ref(kb, "unknown_tests")

    def out(status, reason, **extra) -> ResultAnalysis:
        return ResultAnalysis(
            raw_name=res.raw_name, canonical_name=canonical, name_origin=origin,
            value_text=res.value_text, value=res.value, unit=res.unit,
            status=status, reason=reason, source=res.source, **extra,
        )

    # 1. name
    resolved = kb.resolve_name(res.raw_name)
    canonical, origin = resolved.canonical, resolved.origin
    if canonical is None:
        return out("UNCLASSIFIED", f'"{res.raw_name}" cannot be classified from the files: no matching range in the reference sheets ({unknown_ref}).')
    rows = kb.ranges_for(canonical)
    if not rows:
        return out("UNCLASSIFIED", f"{canonical} cannot be classified from the files: the reference sheets give no range for it ({unknown_ref}).")

    qualitative = rows[0].qualitative is not None
    expected_unit = rows[0].unit

    # 2. can the value be compared?
    value = res.value
    if qualitative:
        if value is not None:
            return out("UNCLASSIFIED", f"{canonical} cannot be classified from the files: the files give only a word range ({rows[0].qualitative}), not a number ({unknown_ref}).")
    elif value is None:
        if any(ch.isdigit() for ch in res.value_text):
            return out("UNCLASSIFIED", f'The value "{res.value_text}" is not a plain number, so {canonical} cannot be classified from the files ({unknown_ref}).')
        return out("UNCLASSIFIED", f'{canonical} was reported as the word "{res.value_text}", but the files give a numeric range, so it cannot be classified from the files ({unknown_ref}).')

    # 3. unit
    shown_value, shown_unit, conversion = value, res.unit, None
    converted_value = converted_unit = None
    if not qualitative and expected_unit:
        if not res.unit:
            return out("UNCLASSIFIED", f"The unit is missing; {canonical} is compared in {expected_unit} and a unit is not assumed, so it cannot be classified from the files ({unknown_ref}).")
        if not units.same_unit(res.unit, expected_unit):
            rule = units.find(canonical, res.unit, expected_unit)
            if rule is None:
                return out("UNCLASSIFIED", f"The unit {res.unit} cannot be converted to {expected_unit} for {canonical}, so it cannot be classified from the files ({unknown_ref}).")
            to_value = round(value * rule.factor, 6)
            conversion = Conversion(
                from_value=value, from_unit=res.unit, factor=rule.factor, to_value=to_value, to_unit=expected_unit,
                working=f"{res.value_text} {res.unit} × {_fmt(rule.factor)} = {_fmt(to_value)} {expected_unit}",
                note=rule.note,
            )
            shown_value, shown_unit = to_value, expected_unit
            converted_value, converted_unit = to_value, expected_unit
        else:
            shown_unit = expected_unit
    extra_base = {"converted_value": converted_value, "converted_unit": converted_unit, "conversion": conversion}

    # 4. urgent limits (independent of age and sex, so checked before asking for demographics)
    danger_hit = None
    if not qualitative:
        inclusive = kb.directive("danger_inclusive") is not None
        for d in kb.danger_for(canonical):
            if norm_unit(d.unit) != norm_unit(expected_unit):
                continue
            if d.condition == "less_than":
                hit = shown_value <= d.threshold if inclusive else shown_value < d.threshold
            else:
                hit = shown_value >= d.threshold if inclusive else shown_value > d.threshold
            if hit:
                danger_hit = d
                break

    # 5. choose the range
    needs = []
    if age is None:
        needs.append("age")
    if sex is None and any(r.sex != "All" for r in rows):
        needs.append("sex")

    chosen: RangeRow | None = None
    band_problem = None
    if not needs:
        candidates = [r for r in rows if r.sex in ("All", sex)]
        in_band = [r for r in candidates if r.age_min <= age <= r.age_max]
        if not in_band:
            lo = min(r.age_min for r in candidates) if candidates else rows[0].age_min
            hi = max(r.age_max for r in candidates) if candidates else rows[0].age_max
            band_problem = f"The files only give ranges for ages {lo}-{hi}, and age {age} is outside that, so {canonical} cannot be classified from the files ({unknown_ref})."
        elif len({(r.low, r.high, r.qualitative) for r in in_band}) > 1:
            band_problem = f"The files give more than one range for {canonical} at age {age}, so it cannot be classified from the files ({unknown_ref})."
        else:
            chosen = in_band[0]

    if danger_hit is not None:
        phrase = kb.urgent_phrase or "see a doctor"
        side = "at or below" if danger_hit.condition == "less_than" else "at or above"
        status = "URGENT_LOW" if danger_hit.condition == "less_than" else "URGENT_HIGH"
        reason = (
            f"{_fmt(shown_value)} {shown_unit} is {side} the urgent limit of {_fmt(danger_hit.threshold)} {danger_hit.unit} "
            f"({_ref(danger_hit.source)}). Please {phrase}."
        )
        return out(
            status, reason, needs=needs,
            range_used=_range_used(chosen) if chosen else None,
            danger=DangerHit(id=danger_hit.id, condition=danger_hit.condition, threshold=danger_hit.threshold, unit=danger_hit.unit, source=danger_hit.source),
            **extra_base,
        )

    if needs:
        what = " and ".join(needs)
        return out(
            "NEEDS_INFO",
            f"The right normal range cannot be chosen because {what} is missing. Please provide {what}; "
            f"it is not guessed from the name or other clues ({_rule_ref(kb, 'missing_demographics')}).",
            needs=needs, **extra_base,
        )
    if chosen is None:
        return out("UNCLASSIFIED", band_problem, **extra_base)

    # 6. compare
    used = _range_used(chosen)
    where = _ref(chosen.source)
    if qualitative:
        word = res.value_text.lower()
        if word == chosen.qualitative.lower():
            return out("NORMAL", f"{res.value_text} matches the normal result ({chosen.qualitative}) for {_who(chosen)} ({where}).", range_used=used, **extra_base)
        if word in ABNORMAL_WORDS:
            return out("ABNORMAL", f"{res.value_text} is not the normal result ({chosen.qualitative}) for {_who(chosen)} ({where}).", range_used=used, **extra_base)
        return out("UNCLASSIFIED", f'"{res.value_text}" cannot be classified from the files: the files only describe the normal result ({chosen.qualitative}) ({unknown_ref}).', range_used=used, **extra_base)

    unit_txt = f" {shown_unit}" if shown_unit else ""
    span = f"{_fmt(chosen.low)}-{_fmt(chosen.high)}{unit_txt}"
    value_txt = f"{_fmt(shown_value)}{unit_txt}"
    if shown_value < chosen.low:
        return out("LOW", f"{value_txt} is below the range {span} for {_who(chosen)} ({where}).", range_used=used, **extra_base)
    if shown_value > chosen.high:
        return out("HIGH", f"{value_txt} is above the range {span} for {_who(chosen)} ({where}).", range_used=used, **extra_base)

    on_limit = shown_value in (chosen.low, chosen.high)
    reason = f"{value_txt} is inside the range {span} for {_who(chosen)} ({where})."
    if on_limit:
        edge = kb.directive("boundary_normal")
        side = "lower" if shown_value == chosen.low else "upper"
        reason += f" It sits exactly on the {side} limit, which the files count as NORMAL ({_ref(edge.source) if edge else 'the files'})."
    return out("NORMAL", reason, range_used=used, boundary=on_limit, **extra_base)
