import type { AnalyzedResult } from "@/data/types";

/**
 * Build 1–5 doctor questions strictly from the displayed report.
 * Urgent results come first, then high/low, then results that could not be classified.
 */
export function buildDoctorQuestions(results: AnalyzedResult[], max = 5): string[] {
  const name = (r: AnalyzedResult) => r.testName ?? r.reportedAs;
  const urgent = results.filter((r) => r.status === "urgent");
  const high = results.filter((r) => r.status === "high");
  const low = results.filter((r) => r.status === "low");
  const unclassified = results.filter((r) => r.status === "unclassified");
  const outOfRange = [...urgent, ...high, ...low];

  const q: string[] = [];
  for (const r of urgent)
    q.push(`My ${name(r)} result (${r.value} ${r.unit}) matched an urgent threshold in the safety guidance. What should I do next, and how soon?`);
  for (const r of high)
    q.push(`My ${name(r)} result (${r.value} ${r.unit}) is above the reference range. What could explain this?`);
  for (const r of low)
    q.push(`My ${name(r)} result (${r.value} ${r.unit}) is below the reference range. What could explain this, and does it need follow-up?`);
  const [first, second] = outOfRange;
  if (first && second) q.push(`Should my ${name(first)} and ${name(second)} results be reviewed together?`);
  if (outOfRange.length >= 1) q.push("Should any of these tests be repeated, and when?");
  for (const r of unclassified)
    q.push(`My ${name(r)} result could not be classified from the provided files. Which reference range applies to me?`);
  if (q.length === 0)
    q.push("All results in this report fall within the ranges used here. Is there anything you would like me to keep monitoring?");

  return q.slice(0, max);
}
