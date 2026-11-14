import type { AnalyzedResult, LabReport } from "@/data/types";
import { STATUS_LABEL, explainMeaning } from "./analysis";

/** Build a plain-text summary of the analysis and trigger a browser download. */
export function downloadReportSummary(report: LabReport, results: AnalyzedResult[], questions: string[]) {
  const lines = [
    "LabSense AI — Report explanation (educational only)",
    "This does not diagnose medical conditions or replace a healthcare professional.",
    "All values are FICTIONAL demonstration data.",
    "",
    `Report: ${report.name}`,
    `Patient ID: ${report.patient.id}`,
    `Collected: ${report.collectedOn}`,
    "",
    "RESULTS",
    ...results.flatMap((r) => [
      `- ${r.testName ?? r.reportedAs}: ${r.value} ${r.unit} — ${STATUS_LABEL[r.status]}`,
      `  Range used: ${r.range ? `${r.range.low}–${r.range.high} ${r.range.unit} (${r.range.population})` : "none"}`,
      `  ${explainMeaning(r)}`,
    ]),
    "",
    "QUESTIONS FOR YOUR DOCTOR",
    ...questions.map((q, i) => `${i + 1}. ${q}`),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `labsense-${report.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
