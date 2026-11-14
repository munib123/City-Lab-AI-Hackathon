import type { ReferenceSheetEntry, UrgentRule } from "./types";

/**
 * CityLab Diagnostics Authoritative Reference Ranges, Glossary Mappings & Urgent Rules
 * Sourced directly from:
 * - 2_medical_glossary.md
 * - 3_dangerous_urgent_values.md
 * - 4_ranges_hematology.md
 * - 5_ranges_biochemistry.md
 * - 6_ranges_thyroid_urine.md
 */

/** Different names a lab may print for the same test → canonical test name. */
export const TEST_ALIASES: Record<string, string> = {
  // Hematology
  hemoglobin: "Hemoglobin",
  haemoglobin: "Hemoglobin",
  hb: "Hemoglobin",
  hgb: "Hemoglobin",
  wbc: "White Blood Cell Count",
  "white blood cell count": "White Blood Cell Count",
  "white blood cells": "White Blood Cell Count",
  "total leukocyte count": "White Blood Cell Count",
  plt: "Platelet Count",
  "platelet count": "Platelet Count",
  platelets: "Platelet Count",
  rbc: "Red Blood Cell Count",
  "red blood cell count": "Red Blood Cell Count",

  // Biochemistry
  "fasting blood sugar": "Fasting Blood Sugar",
  fbs: "Fasting Blood Sugar",
  glucose: "Fasting Blood Sugar",
  "blood glucose": "Fasting Blood Sugar",
  "blood glucose (fasting)": "Fasting Blood Sugar",
  alt: "ALT",
  sgpt: "ALT",
  "alt (sgpt)": "ALT",
  "alanine aminotransferase": "ALT",
  ast: "AST",
  sgot: "AST",
  "ast (sgot)": "AST",
  "aspartate aminotransferase": "AST",
  cholesterol: "Cholesterol",
  "total cholesterol": "Cholesterol",

  // Endocrinology & Urine
  tsh: "TSH",
  "thyroid-stimulating hormone": "TSH",
  "urine ph": "Urine pH",
  "ph level": "Urine pH",
  ph: "Urine pH",
  "urine protein": "Urine Protein",
  protein: "Urine Protein",
};

/** Canonical test name → glossary entry id. */
export const TEST_GLOSSARY_IDS: Record<string, string> = {
  Hemoglobin: "hemoglobin",
  "White Blood Cell Count": "wbc",
  "Platelet Count": "platelets",
  "Red Blood Cell Count": "rbc",
  "Fasting Blood Sugar": "glucose",
  ALT: "alt",
  AST: "ast",
  Cholesterol: "cholesterol",
  TSH: "tsh",
  "Urine pH": "urine-ph",
  "Urine Protein": "urine-protein",
};

/**
 * CityLab Normal-range sheet. Tests absent here cannot be classified.
 * Edge case rule (from 4_ranges_hematology.md):
 * "If a patient's analytical value sits exactly on a lower or upper range limit,
 * the algorithmic classification MUST mark it as NORMAL. Age boundaries are inclusive of the upper bound."
 */
export const REFERENCE_SHEET: Record<string, ReferenceSheetEntry> = {
  Hemoglobin: {
    unit: "g/dL",
    options: [
      { sex: "female", ageMin: 18, ageMax: 100, low: 12.1, high: 15.1, sheetRef: "4_ranges_hematology.md" },
      { sex: "male", ageMin: 18, ageMax: 100, low: 13.8, high: 17.2, sheetRef: "4_ranges_hematology.md" },
    ],
  },
  "White Blood Cell Count": {
    unit: "cells/mcL",
    options: [
      { ageMin: 18, ageMax: 100, low: 4500, high: 11000, sheetRef: "4_ranges_hematology.md" },
    ],
  },
  "Platelet Count": {
    unit: "cells/mcL",
    options: [
      { ageMin: 18, ageMax: 100, low: 150000, high: 450000, sheetRef: "4_ranges_hematology.md" },
    ],
  },
  "Fasting Blood Sugar": {
    unit: "mg/dL",
    options: [
      { ageMin: 18, ageMax: 100, low: 70, high: 99, sheetRef: "5_ranges_biochemistry.md" },
    ],
  },
  ALT: {
    unit: "U/L",
    options: [
      { sex: "female", ageMin: 18, ageMax: 100, low: 7, high: 45, sheetRef: "5_ranges_biochemistry.md" },
      { sex: "male", ageMin: 18, ageMax: 100, low: 7, high: 55, sheetRef: "5_ranges_biochemistry.md" },
    ],
  },
  AST: {
    unit: "U/L",
    options: [
      { sex: "female", ageMin: 18, ageMax: 100, low: 8, high: 43, sheetRef: "5_ranges_biochemistry.md" },
      { sex: "male", ageMin: 18, ageMax: 100, low: 8, high: 48, sheetRef: "5_ranges_biochemistry.md" },
    ],
  },
  Cholesterol: {
    unit: "mg/dL",
    options: [
      { ageMin: 18, ageMax: 100, low: 125, high: 200, sheetRef: "5_ranges_biochemistry.md" },
    ],
  },
  TSH: {
    unit: "mIU/L",
    options: [
      { ageMin: 18, ageMax: 100, low: 0.4, high: 4.0, sheetRef: "6_ranges_thyroid_urine.md" },
    ],
  },
  "Urine pH": {
    unit: "pH",
    options: [
      { ageMin: 18, ageMax: 100, low: 4.5, high: 8.0, sheetRef: "6_ranges_thyroid_urine.md" },
    ],
  },
  "Urine Protein": {
    unit: "qualitative",
    options: [
      { ageMin: 18, ageMax: 100, low: "Negative", high: "Negative", sheetRef: "6_ranges_thyroid_urine.md" },
    ],
  },
};

/**
 * CityLab Dangerous Urgent Values (from 3_dangerous_urgent_values.md)
 * Trigger severe warning: "see a doctor today" and prioritize questions for physician.
 */
export const URGENT_RULES: Record<string, UrgentRule[]> = {
  Hemoglobin: [
    { direction: "below", threshold: 7.0, unit: "g/dL", ruleRef: "3_dangerous_urgent_values.md (Hb < 7.0 g/dL)" },
  ],
  "Fasting Blood Sugar": [
    { direction: "above", threshold: 300, unit: "mg/dL", ruleRef: "3_dangerous_urgent_values.md (FBS > 300 mg/dL)" },
  ],
  "Platelet Count": [
    { direction: "below", threshold: 50000, unit: "cells/mcL", ruleRef: "3_dangerous_urgent_values.md (PLT < 50,000 cells/mcL)" },
  ],
  ALT: [
    { direction: "above", threshold: 1000, unit: "U/L", ruleRef: "3_dangerous_urgent_values.md (ALT > 1000 U/L)" },
  ],
};
