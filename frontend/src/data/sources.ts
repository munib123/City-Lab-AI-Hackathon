import type { SourceDocument, SourceId } from "./types";

/** Authoritative CityLab Diagnostics source documents. */
export const SOURCE_DOCUMENTS: Record<SourceId, SourceDocument> = {
  "patient-report": {
    id: "patient-report",
    title: "CityLab Analytical Report (SECTION III)",
    description: "The patient's lab report: analyte names, numerical/qualitative findings, and units.",
    version: "Clinical LIMS Export",
  },
  "normal-range-sheet": {
    id: "normal-range-sheet",
    title: "CityLab Clinical Reference Sheets (Modules 4, 5, 6)",
    description: "Hematology (4), Biochemistry (5), and Thyroid/Urine (6) age- and sex-stratified normal ranges with boundary rules.",
    version: "Modules 4, 5 & 6",
  },
  "medical-glossary": {
    id: "medical-glossary",
    title: "Enterprise Medical Glossary (2_medical_glossary.md)",
    description: "Official nomenclature mappings (SGPT=ALT, FBS=Fasting Blood Sugar, etc.) and plain-language definitions.",
    version: "Nomenclature v2.1",
  },
  "dangerous-values": {
    id: "dangerous-values",
    title: "Critical Limits Directive (3_dangerous_urgent_values.md)",
    description: "Life-threatening panic thresholds that mandate immediate 'see a doctor today' notifications.",
    version: "Critical Alert v3.0",
  },
  "safety-rules": {
    id: "safety-rules",
    title: "Lab Safety & Compliance Directives (1_lab_safety_rules.md)",
    description: "Privacy context-lock, no-diagnosis policy, and refusal to guess missing demographics.",
    version: "CLIA/HIPAA Rules v9.4",
  },
};

export const SOURCE_ORDER: SourceId[] = [
  "patient-report",
  "normal-range-sheet",
  "medical-glossary",
  "dangerous-values",
  "safety-rules",
];
