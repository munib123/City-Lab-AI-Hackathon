import { describe, expect, it } from "vitest";
import { analyzeReport, analyzeResult, resolveTestName } from "./analysis";
import { buildDoctorQuestions } from "./questions";
import { DEMO_REPORTS, getDemoReport } from "@/data/demo-reports";

const adultFemale = { age: 35, sex: "female" as const };
const adultMale = { age: 40, sex: "male" as const };

describe("CityLab Deterministic Engine & Invariants", () => {
  it("resolves test aliases correctly per 2_medical_glossary.md", () => {
    expect(resolveTestName("SGPT")).toBe("ALT");
    expect(resolveTestName("SGOT")).toBe("AST");
    expect(resolveTestName("FBS")).toBe("Fasting Blood Sugar");
    expect(resolveTestName("Hb")).toBe("Hemoglobin");
    expect(resolveTestName("PLT")).toBe("Platelet Count");
    expect(resolveTestName("WBC")).toBe("White Blood Cell Count");
    expect(resolveTestName("pH Level")).toBe("Urine pH");
    expect(resolveTestName("Protein")).toBe("Urine Protein");
    expect(resolveTestName("Serum Ferritin")).toBeNull();
  });

  it("handles exact boundary limit edge cases as NORMAL per 4_ranges_hematology.md", () => {
    // P002 Bob Jones: SGPT 45 U/L for Female (Range: 7 - 45 U/L)
    const rALT = analyzeResult({ reportedAs: "SGPT", value: 45, unit: "U/L" }, adultFemale);
    expect(rALT.status).toBe("normal");

    // P010 Julia Child: Cholesterol 200 mg/dL (Range: 125 - 200 mg/dL)
    const rChol = analyzeResult({ reportedAs: "Cholesterol", value: 200, unit: "mg/dL" }, adultFemale);
    expect(rChol.status).toBe("normal");
  });

  it("triggers urgent warnings for critical values per 3_dangerous_urgent_values.md", () => {
    // P004: Hemoglobin 6.5 g/dL (< 7.0 g/dL)
    const rHb = analyzeResult({ reportedAs: "Hemoglobin", value: 6.5, unit: "g/dL" }, adultFemale);
    expect(rHb.status).toBe("urgent");
    expect(rHb.urgentRule).not.toBeNull();

    // P013: Fasting Blood Sugar 350 mg/dL (> 300 mg/dL)
    const rSugar = analyzeResult({ reportedAs: "Fasting Blood Sugar", value: 350, unit: "mg/dL" }, adultMale);
    expect(rSugar.status).toBe("urgent");
  });

  it("performs unit conversion from mmol/L to mg/dL for Fasting Blood Sugar (P005)", () => {
    const rConv = analyzeResult({ reportedAs: "Fasting Blood Sugar", value: 6.0, unit: "mmol/L" }, adultMale);
    expect(rConv.value).toBe(108.1);
    expect(rConv.unit).toBe("mg/dL");
    expect(rConv.status).toBe("high");
    expect(rConv.conversionNote).toContain("Converted from 6 mmol/L");
  });

  it("refuses to guess when demographic information is missing (Rule 3)", () => {
    // P003: Charlie Brown (Age & Sex missing)
    const rMissing = analyzeResult({ reportedAs: "Fasting Blood Sugar", value: 110, unit: "mg/dL" }, { age: null, sex: null });
    expect(rMissing.status).toBe("unclassified");

    // P012: Laura Croft (Sex missing, AST requires sex)
    const rNoSex = analyzeResult({ reportedAs: "AST", value: 44, unit: "U/L" }, { age: 32, sex: null });
    expect(rNoSex.status).toBe("unclassified");
  });

  it("admits what it cannot classify for tests not in files (P006 Serum Ferritin)", () => {
    const rUnknown = analyzeResult({ reportedAs: "Serum Ferritin", value: 25, unit: "ng/mL" }, adultFemale);
    expect(rUnknown.status).toBe("unclassified");
    expect(rUnknown.reason).toContain("not recognised in the provided CityLab reference files");
  });

  it("generates 3 to 5 doctor questions prioritizing urgent findings", () => {
    const urgentReport = getDemoReport("report-P004");
    expect(urgentReport).toBeDefined();
    const analyzed = analyzeReport(urgentReport!);
    const questions = buildDoctorQuestions(analyzed);
    expect(questions.length).toBeGreaterThanOrEqual(3);
    expect(questions.length).toBeLessThanOrEqual(5);
    expect(questions[0]).toContain("urgent threshold");
  });
});
