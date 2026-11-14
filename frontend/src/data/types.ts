/**
 * Shared data shapes for CityLab Diagnostics / LabSense AI.
 * These mirror what a real analysis API would return, so demo data can later be
 * swapped for live responses without changing the UI components.
 */

export type Sex = "female" | "male";

export type ResultStatus = "normal" | "low" | "high" | "urgent" | "unclassified";

/** The five documents the analysis is allowed to use. Nothing else. */
export type SourceId =
  | "patient-report"
  | "normal-range-sheet"
  | "medical-glossary"
  | "dangerous-values"
  | "safety-rules";

export interface SourceDocument {
  id: SourceId;
  title: string;
  description: string;
  version: string;
}

export interface PatientContext {
  /** Identifier – e.g. CLD-P001-9942 */
  id: string;
  name?: string;
  age: number | null;
  sex: Sex | null;
}

/** One row from the normal-range sheet. Age bounds are inclusive. */
export interface ReferenceRangeOption {
  low: number | string;
  high: number | string;
  sex?: Sex;
  ageMin?: number;
  ageMax?: number;
  /** Line reference inside the normal-range sheet, e.g. "4_ranges_hematology.md". */
  sheetRef: string;
}

export interface ReferenceSheetEntry {
  unit: string;
  options: ReferenceRangeOption[];
}

export interface UrgentRule {
  direction: "above" | "below" | "equals";
  /** Value at or beyond which the result is urgent. */
  threshold: number | string;
  unit: string;
  ruleRef: string;
}

/** A test exactly as printed on the uploaded report. */
export interface RawLabResult {
  reportedAs: string;
  value: number | string;
  unit?: string;
}

export interface LabReport {
  id: string;
  name: string;
  labName: string;
  collectedOn: string; // ISO date
  uploadedOn: string; // ISO date
  patient: PatientContext;
  status: "complete" | "processing";
  results: RawLabResult[];
  notes?: string;
}

export interface AppliedRange {
  low: number | string;
  high: number | string;
  unit: string;
  population: string;
  sheetRef: string;
}

export interface AnalyzedResult {
  id: string;
  reportedAs: string;
  /** Canonical test name, or null if the name was not recognised. */
  testName: string | null;
  glossaryId: string | null;
  value: number | string;
  unit: string;
  originalValue?: number | string;
  originalUnit?: string;
  conversionNote?: string;
  range: AppliedRange | null;
  status: ResultStatus;
  /** Plain-language reason for the classification. */
  reason: string;
  urgentRule: UrgentRule | null;
  sources: SourceId[];
}

export interface GlossaryEntry {
  id: string;
  term: string;
  aka: string[];
  category: string;
  simple: string;
  whyPerformed: string;
}
