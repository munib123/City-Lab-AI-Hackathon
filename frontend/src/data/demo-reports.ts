import type { LabReport } from "./types";

/**
 * CityLab Diagnostics Official Patient Report Corpus (P001 - P014)
 * Cloned directly from the City-Lab-AI-Hackathon test dataset.
 * Sourced from /lab_reports/report_P*.md
 */

export const DEMO_REPORTS: LabReport[] = [
  {
    id: "report-P001",
    name: "Complete Blood Count (CBC)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P001-9942", name: "Alice Smith", age: 28, sex: "female" },
    status: "complete",
    notes: "Normal baseline Complete Blood Count.",
    results: [
      { reportedAs: "Hemoglobin", value: 13.5, unit: "g/dL" },
      { reportedAs: "WBC", value: 6000, unit: "cells/mcL" },
    ],
  },
  {
    id: "report-P002",
    name: "Liver Function Test (Boundary Limit Case)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P002-9942", name: "Bob Jones", age: 35, sex: "female" },
    status: "complete",
    notes: "Edge case: SGPT alias for ALT; value 45 U/L sits exactly on female upper range limit (Normal).",
    results: [
      { reportedAs: "SGPT", value: 45, unit: "U/L" },
    ],
  },
  {
    id: "report-P003",
    name: "Fasting Blood Sugar (Corrupted Demographics)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P003-9942", name: "Charlie Brown", age: null, sex: null },
    status: "complete",
    notes: "Edge case: Age & Sex corrupted. System must refuse to guess and prompt user.",
    results: [
      { reportedAs: "Fasting Blood Sugar", value: 110, unit: "mg/dL" },
    ],
  },
  {
    id: "report-P004",
    name: "Hematology Panel (Critical Urgent Alert)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P004-9942", name: "Diana Prince", age: 42, sex: "female" },
    status: "complete",
    notes: "Edge case: Hemoglobin 6.5 g/dL is critical (< 7.0 g/dL), triggering immediate urgent care warning.",
    results: [
      { reportedAs: "Hemoglobin", value: 6.5, unit: "g/dL" },
      { reportedAs: "Platelet Count", value: 120000, unit: "cells/mcL" },
    ],
  },
  {
    id: "report-P005",
    name: "Blood Glucose (Unit Conversion)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P005-9942", name: "Ethan Hunt", age: 50, sex: "male" },
    status: "complete",
    notes: "Edge case: Fasting Blood Sugar reported in mmol/L. Requires conversion to mg/dL (factor 18.0182).",
    results: [
      { reportedAs: "Fasting Blood Sugar", value: 6.0, unit: "mmol/L" },
    ],
  },
  {
    id: "report-P006",
    name: "Iron Studies (Unclassified Marker)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P006-9942", name: "Fiona Gallagher", age: 22, sex: "female" },
    status: "complete",
    notes: "Edge case: Serum Ferritin is absent from range sheets. Must report 'Cannot be classified from files'.",
    results: [
      { reportedAs: "Serum Ferritin", value: 25, unit: "ng/mL" },
    ],
  },
  {
    id: "report-P007",
    name: "Thyroid Profile (TSH)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P007-9942", name: "George Costanza", age: 65, sex: "male" },
    status: "complete",
    notes: "TSH normal range evaluation from 6_ranges_thyroid_urine.md.",
    results: [
      { reportedAs: "TSH", value: 2.5, unit: "mIU/L" },
    ],
  },
  {
    id: "report-P008",
    name: "Routine Urinalysis (Synonyms & Qualitative)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P008-9942", name: "Haley Dunphy", age: 19, sex: "female" },
    status: "complete",
    notes: "Edge case: pH Level -> Urine pH; Protein -> Urine Protein qualitative match.",
    results: [
      { reportedAs: "pH Level", value: 5.5, unit: "pH" },
      { reportedAs: "Protein", value: "Negative", unit: "qualitative" },
    ],
  },
  {
    id: "report-P009",
    name: "Hepatic Panel (Elevated Liver Enzymes)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P009-9942", name: "Ian Malcolm", age: 48, sex: "male" },
    status: "complete",
    notes: "Both ALT (85 U/L) and AST (60 U/L) elevated above male normal limits.",
    results: [
      { reportedAs: "ALT", value: 85, unit: "U/L" },
      { reportedAs: "AST", value: 60, unit: "U/L" },
    ],
  },
  {
    id: "report-P010",
    name: "Lipid Evaluation (Boundary Case 200 mg/dL)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P010-9942", name: "Julia Child", age: 55, sex: "female" },
    status: "complete",
    notes: "Edge case: Cholesterol is exactly 200 mg/dL (upper limit). Must classify as NORMAL.",
    results: [
      { reportedAs: "Cholesterol", value: 200, unit: "mg/dL" },
    ],
  },
  {
    id: "report-P011",
    name: "Hemogram with Mixed Findings",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P011-9942", name: "Kevin Hart", age: 40, sex: "male" },
    status: "complete",
    notes: "Elevated WBC (12,000 cells/mcL) and Low PLT (140,000 cells/mcL).",
    results: [
      { reportedAs: "WBC", value: 12000, unit: "cells/mcL" },
      { reportedAs: "PLT", value: 140000, unit: "cells/mcL" },
    ],
  },
  {
    id: "report-P012",
    name: "Liver Enzyme (Missing Sex Ambiguity)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P012-9942", name: "Laura Croft", age: 32, sex: null },
    status: "complete",
    notes: "Edge case: AST 44 U/L is Normal for males (8-48) but High for females (8-43). Sex missing -> must ask!",
    results: [
      { reportedAs: "AST", value: 44, unit: "U/L" },
    ],
  },
  {
    id: "report-P013",
    name: "Emergency Metabolic Panel (Urgent Hyperglycemia)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P013-9942", name: "Michael Scott", age: 45, sex: "male" },
    status: "complete",
    notes: "Edge case: FBS 350 mg/dL (> 300 mg/dL critical trigger). Immediate emergency banner.",
    results: [
      { reportedAs: "Fasting Blood Sugar", value: 350, unit: "mg/dL" },
    ],
  },
  {
    id: "report-P014",
    name: "Executive Health Check (Multiple Aliases)",
    labName: "CityLab Diagnostics",
    collectedOn: "2026-11-13",
    uploadedOn: "2026-11-14",
    patient: { id: "CLD-P014-9942", name: "Nancy Drew", age: 29, sex: "female" },
    status: "complete",
    notes: "Maps FBS -> Fasting Blood Sugar and SGOT -> AST. Both within normal limits.",
    results: [
      { reportedAs: "FBS", value: 85, unit: "mg/dL" },
      { reportedAs: "SGOT", value: 22, unit: "U/L" },
    ],
  },
];

/** Currently active patient for context-lock demonstrations. */
export const DEMO_PATIENT_ID = "CLD-P001-9942";
export let ACTIVE_PATIENT_ID = "CLD-P001-9942";

export function setActivePatientId(id: string) {
  ACTIVE_PATIENT_ID = id;
}

export function getDemoReport(id: string): LabReport | undefined {
  return DEMO_REPORTS.find((r) => r.id === id);
}

export const SAMPLE_REPORT_ID = "report-P001";
