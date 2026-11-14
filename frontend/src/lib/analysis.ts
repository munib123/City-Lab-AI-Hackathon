import {
  REFERENCE_SHEET,
  TEST_ALIASES,
  TEST_GLOSSARY_IDS,
  URGENT_RULES,
} from "@/data/reference-sheet";
import type {
  AnalyzedResult,
  AppliedRange,
  LabReport,
  PatientContext,
  RawLabResult,
  ReferenceSheetEntry,
  ResultStatus,
  SourceId,
  UrgentRule,
} from "@/data/types";

/**
 * CityLab Diagnostics Deterministic Analysis Engine
 * Follows 1_lab_safety_rules.md, 3_dangerous_urgent_values.md, and range modules.
 * Invariant: Never guesses numbers, ranges, or diagnoses.
 */

export const CANNOT_CLASSIFY = "Cannot be classified from the provided files.";
export const NOT_IN_FILES = "This information is not present in the provided files.";

const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Map a printed test name to its canonical name. */
export function resolveTestName(reportedAs: string): string | null {
  return TEST_ALIASES[normalise(reportedAs)] ?? null;
}

type RangeSelection = { range: AppliedRange } | { range: null; reason: string };

/** Pick the age- and sex-specific row from the normal-range sheet. Edge case: age bounds inclusive. */
export function selectReferenceRange(
  entry: ReferenceSheetEntry,
  patient: Pick<PatientContext, "age" | "sex">,
): RangeSelection {
  const needsSex = entry.options.some((o) => o.sex !== undefined);
  const needsAge = entry.options.some((o) => o.ageMin !== undefined || o.ageMax !== undefined);

  if (needsSex && !patient.sex) {
    return {
      range: null,
      reason:
        "The patient's biological sex is missing from the report. The reference sheet specifies different normal ranges for females and males. Per CityLab Safety Rule 3, the assistant cannot guess.",
    };
  }
  if (needsAge && patient.age === null) {
    return {
      range: null,
      reason:
        "The patient's age is missing or corrupted. The reference sheet ranges depend on patient age. Per CityLab Safety Rule 3, the assistant cannot guess.",
    };
  }

  const match = entry.options.find((o) => {
    if (o.sex && o.sex !== patient.sex) return false;
    if (patient.age !== null) {
      if (o.ageMin !== undefined && patient.age < o.ageMin) return false;
      if (o.ageMax !== undefined && patient.age > o.ageMax) return false;
    }
    return true;
  });

  if (!match) {
    return {
      range: null,
      reason: "The reference sheets contain no valid normal range for this patient's age and sex demographic.",
    };
  }

  const parts: string[] = [];
  if (match.sex) parts.push(match.sex === "female" ? "Females" : "Males");
  else parts.push("All biological sexes");
  if (match.ageMin !== undefined && match.ageMax !== undefined)
    parts.push(`${match.ageMin}–${match.ageMax} yrs`);
  else if (match.ageMin !== undefined) parts.push(`${match.ageMin}+ yrs`);

  return {
    range: {
      low: match.low,
      high: match.high,
      unit: entry.unit,
      population: parts.join(", "),
      sheetRef: match.sheetRef,
    },
  };
}

/** Check unit compatibility and perform mathematical conversions when defined. */
function handleUnitConversion(
  testName: string,
  rawVal: number | string,
  rawUnit: string,
  targetUnit: string,
): { value: number | string; unit: string; conversionNote?: string; error?: string } {
  const normRaw = normalise(rawUnit);
  const normTarget = normalise(targetUnit);

  // Exact match
  if (normRaw === normTarget) {
    return { value: rawVal, unit: targetUnit };
  }

  // Fasting Blood Sugar: mmol/L to mg/dL (Factor: 18.0182)
  if (testName === "Fasting Blood Sugar" && (normRaw === "mmol/l" || normRaw === "mmol/litre")) {
    if (typeof rawVal === "number") {
      const converted = Math.round(rawVal * 18.0182 * 10) / 10;
      return {
        value: converted,
        unit: targetUnit,
        conversionNote: `Converted from ${rawVal} ${rawUnit} to ${converted} ${targetUnit} (Standard clinical factor: 18.0182).`,
      };
    }
  }

  // Units like cells/mcL vs /mcL
  if (normRaw.replace(/\s+/g, "") === normTarget.replace(/\s+/g, "")) {
    return { value: rawVal, unit: targetUnit };
  }

  return {
    value: rawVal,
    unit: rawUnit,
    error: `The report lists unit '${rawUnit}', but reference sheet uses '${targetUnit}'. No approved conversion rule exists in the lab files.`,
  };
}

/** Return the urgent rule a value matches, if any. */
export function findUrgentRule(testName: string, value: number, unit: string): UrgentRule | null {
  const rules = URGENT_RULES[testName] ?? [];
  return (
    rules.find((r) => {
      if (normalise(r.unit) !== normalise(unit)) return false;
      const numThreshold = typeof r.threshold === "number" ? r.threshold : parseFloat(String(r.threshold));
      if (isNaN(numThreshold)) return false;
      return r.direction === "above" ? value > numThreshold : value < numThreshold;
    }) ?? null
  );
}

export function analyzeResult(
  raw: RawLabResult,
  patient: Pick<PatientContext, "age" | "sex">,
  index = 0,
): AnalyzedResult {
  const id = `${index}-${normalise(raw.reportedAs).replace(/[^a-z0-9]+/g, "-")}`;
  const testName = resolveTestName(raw.reportedAs);
  const rawUnit = raw.unit ?? "";

  const base = {
    id,
    reportedAs: raw.reportedAs,
    testName,
    glossaryId: testName ? (TEST_GLOSSARY_IDS[testName] ?? null) : null,
    value: raw.value,
    unit: rawUnit,
    originalValue: raw.value,
    originalUnit: rawUnit,
  };
  const sources: SourceId[] = ["patient-report"];

  const unclassified = (reason: string, range: AppliedRange | null = null): AnalyzedResult => ({
    ...base,
    range,
    status: "unclassified",
    reason,
    urgentRule: null,
    sources: [...sources, "safety-rules"],
  });

  if (!testName) {
    return unclassified("This test name is not recognised in the provided CityLab reference files.");
  }
  if (base.glossaryId) sources.push("medical-glossary");

  const entry = REFERENCE_SHEET[testName];
  if (!entry) {
    return unclassified("The normal-range sheets do not include a reference range for this test.");
  }
  sources.push("normal-range-sheet");

  // Handle unit verification and conversion
  const conv = handleUnitConversion(testName, raw.value, rawUnit, entry.unit);
  if (conv.error) {
    return unclassified(conv.error);
  }

  const effectiveValue = conv.value;
  const effectiveUnit = conv.unit;
  const conversionNote = conv.conversionNote;

  const selection = selectReferenceRange(entry, patient);
  if (!selection.range) return unclassified(selection.reason);
  const range = selection.range;

  // Qualitative test handling (e.g. Urine Protein: "Negative")
  if (typeof effectiveValue === "string" || typeof range.low === "string") {
    const valStr = String(effectiveValue).trim().toLowerCase();
    const expStr = String(range.low).trim().toLowerCase();
    const isNormal = valStr === expStr;
    return {
      ...base,
      value: effectiveValue,
      unit: effectiveUnit,
      conversionNote,
      range,
      status: isNormal ? "normal" : "high",
      reason: isNormal
        ? `Result '${effectiveValue}' matches expected normal limit '${range.low}' (${range.sheetRef}).`
        : `Result '${effectiveValue}' does not match expected normal limit '${range.low}' (${range.sheetRef}).`,
      urgentRule: null,
      sources,
    };
  }

  // Numeric test handling
  const numVal = typeof effectiveValue === "number" ? effectiveValue : parseFloat(String(effectiveValue));
  const numLow = typeof range.low === "number" ? range.low : parseFloat(String(range.low));
  const numHigh = typeof range.high === "number" ? range.high : parseFloat(String(range.high));

  // Check urgent dangerous value triggers
  const urgentRule = findUrgentRule(testName, numVal, effectiveUnit);
  let status: ResultStatus;
  let reason: string;

  if (urgentRule) {
    sources.push("dangerous-values");
    status = "urgent";
    reason = `🚨 CRITICAL URGENT VALUE: ${numVal} ${effectiveUnit} has passed the urgent threshold (${urgentRule.ruleRef}). Requires prompt medical attention ("see a doctor today").`;
  } else if (numVal < numLow) {
    status = "low";
    reason = `${numVal} ${effectiveUnit} is below the lower reference limit of ${numLow} ${effectiveUnit}.`;
  } else if (numVal > numHigh) {
    status = "high";
    reason = `${numVal} ${effectiveUnit} is above the upper reference limit of ${numHigh} ${effectiveUnit}.`;
  } else {
    // Exact edge limit values (numVal == numLow or numVal == numHigh) are classified as NORMAL
    status = "normal";
    const atEdge = numVal === numLow || numVal === numHigh;
    reason = atEdge
      ? `${numVal} ${effectiveUnit} sits exactly on the range boundary (${numLow}–${numHigh} ${effectiveUnit}) and is classified as NORMAL per CityLab edge case rules.`
      : `${numVal} ${effectiveUnit} is within the normal reference interval of ${numLow}–${numHigh} ${effectiveUnit}.`;
  }

  return {
    ...base,
    value: effectiveValue,
    unit: effectiveUnit,
    conversionNote,
    range,
    status,
    reason,
    urgentRule,
    sources,
  };
}

export function analyzeReport(report: LabReport): AnalyzedResult[] {
  return report.results.map((r, i) => analyzeResult(r, report.patient, i));
}

export type StatusCounts = Record<ResultStatus, number> & { total: number };

export function countStatuses(results: AnalyzedResult[]): StatusCounts {
  const counts: StatusCounts = { total: results.length, normal: 0, low: 0, high: 0, urgent: 0, unclassified: 0 };
  for (const r of results) counts[r.status] += 1;
  return counts;
}

export const STATUS_LABEL: Record<ResultStatus, string> = {
  normal: "Within range",
  low: "Low",
  high: "High",
  urgent: "Urgent",
  unclassified: "Not classified",
};

/** Plain-language 8th-grade explanation. Guaranteed never to diagnose diseases. */
export function explainMeaning(r: AnalyzedResult): string {
  const name = r.testName ?? r.reportedAs;
  const v = `${r.value} ${r.unit}`;
  switch (r.status) {
    case "normal":
      return `Your ${name} result of ${v} is inside the expected reference range. For this marker, your numbers are where doctors expect them to be.`;
    case "high":
      return `Your ${name} result of ${v} is higher than the typical reference range. This does NOT mean you have a specific illness or condition; higher numbers can happen for many harmless reasons like hydration, diet, or recent activity. Only your doctor can interpret this.`;
    case "low":
      return `Your ${name} result of ${v} is lower than the typical reference range. This is purely an educational comparison and is NOT a medical diagnosis. Your doctor can explain what this means for your individual health.`;
    case "urgent":
      return `🚨 URGENT NOTICE: Your ${name} result of ${v} meets a critical threshold in the CityLab safety guidance. Please see a doctor today for an in-person evaluation.`;
    case "unclassified":
      return `${CANNOT_CLASSIFY} ${r.reason}`;
  }
}
