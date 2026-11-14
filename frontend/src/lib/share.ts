import type { AnalyzedResult } from "@/data/types";

const STATUS_WORDS: Record<AnalyzedResult["status"], string> = {
  normal: "normal",
  low: "low",
  high: "high",
  urgent: "urgent",
  unclassified: "cannot be classified",
};

/**
 * The WhatsApp message: test names, values and a plain status. It never includes the patient's name or record
 * number, and it is short. The person sharing decides who receives it.
 */
export function buildShareText({
  reportCode,
  results,
  link,
}: {
  reportCode: string;
  results: AnalyzedResult[];
  link: string;
}): string {
  const lines = [`MedLens - my lab report explained (Report ${reportCode})`];
  if (results.some((r) => r.status === "urgent")) lines.push("URGENT: please see a doctor today.");
  for (const r of results) {
    const value = `${r.value} ${r.unit}`.trim();
    lines.push(`- ${r.testName ?? r.reportedAs}: ${value} (${STATUS_WORDS[r.status]})`);
  }
  lines.push("Only a doctor can diagnose conditions.");
  if (link) lines.push(`Open: ${link}`);
  return lines.join("\n");
}

/** A WhatsApp share link: opens WhatsApp with the text ready; the person picks who to send it to. */
export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
