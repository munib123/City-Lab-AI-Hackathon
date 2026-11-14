import { describe, expect, it } from "vitest";

import { DEMO_REPORTS } from "@/data/demo-reports";
import { analyzeReport } from "@/lib/analysis";
import { buildShareText, whatsappLink } from "@/lib/share";

const resultsFor = (name: string) => {
  const report = DEMO_REPORTS.find((r) => r.patient.name === name)!;
  return { report, results: analyzeReport(report) };
};

describe("buildShareText (the WhatsApp message)", () => {
  it("summarises each result and warns when something is urgent", () => {
    const { report, results } = resultsFor("Diana Prince");
    const text = buildShareText({
      reportCode: "P004",
      results,
      link: "https://app.example/reports/P004",
    });
    expect(text).toContain("Report P004");
    expect(text).toContain("see a doctor today");
    expect(text).toMatch(/Hemoglobin.*6\.5.*urgent/i);
    expect(text).toMatch(/Platelet.*low/i);
    expect(text).toContain("https://app.example/reports/P004");
    expect(text).toContain("Only a doctor can diagnose");
    expect(report.patient.name).toBe("Diana Prince");
  });

  it("has no urgent line when nothing is urgent", () => {
    const { results } = resultsFor("Alice Smith");
    const text = buildShareText({
      reportCode: "P001",
      results,
      link: "https://app.example/reports/P001",
    });
    expect(text).not.toMatch(/urgent|see a doctor today/i);
    expect(text).toMatch(/normal/i);
  });

  it("never contains the patient's name or record number, for any of the 14 reports", () => {
    for (const report of DEMO_REPORTS) {
      const results = analyzeReport(report);
      const text = buildShareText({
        reportCode: "X",
        results,
        link: "https://app.example/reports/X",
      });
      expect(text, report.patient.name).not.toContain(report.patient.name ?? "\u0000");
      expect(text).not.toContain((report.patient.name ?? "\u0000").split(" ")[0]!);
      expect(text).not.toContain(report.patient.id);
    }
  });

  it("stays short enough for a chat message", () => {
    for (const report of DEMO_REPORTS) {
      const text = buildShareText({
        reportCode: "P0",
        results: analyzeReport(report),
        link: "https://app.example/reports/P0",
      });
      expect(text.length, report.id).toBeLessThan(900);
    }
  });
});

describe("whatsappLink", () => {
  it("builds a wa.me share link with the text encoded, and nothing else in it", () => {
    const link = whatsappLink("Hello & welcome\nsecond line #1");
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(link.slice("https://wa.me/?text=".length))).toBe(
      "Hello & welcome\nsecond line #1",
    );
    expect(link).not.toContain(" ");
    expect(link).not.toContain("\n");
  });
});
