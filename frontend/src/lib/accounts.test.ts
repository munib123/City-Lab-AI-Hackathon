import { describe, expect, it } from "vitest";

import { DEMO_REPORTS } from "@/data/demo-reports";
import {
  buildDemoAccounts,
  canViewReport,
  findReportStrict,
  reportsForPatient,
  restoreUser,
} from "@/lib/accounts";

const ACCOUNTS = buildDemoAccounts(DEMO_REPORTS);

describe("demo accounts", () => {
  it("has one account per patient: 14 in total", () => {
    expect(DEMO_REPORTS).toHaveLength(14);
    expect(ACCOUNTS).toHaveLength(14);
    expect(ACCOUNTS.map((a) => a.name)).toEqual(DEMO_REPORTS.map((r) => r.patient.name));
  });

  it("uses the exact patient id written on the report (the old preset ids did not match for Bob and Charlie)", () => {
    for (const report of DEMO_REPORTS) {
      const account = ACCOUNTS.find((a) => a.name === report.patient.name)!;
      expect(account.patientId).toBe(report.patient.id);
    }
    expect(ACCOUNTS.find((a) => a.name === "Bob Jones")!.patientId).toBe("CLD-P002-9942");
    expect(ACCOUNTS.find((a) => a.name === "Charlie Brown")!.patientId).toBe("CLD-P003-9942");
  });

  it("has unique ids, emails and patient ids", () => {
    for (const key of ["id", "email", "patientId"] as const) {
      expect(new Set(ACCOUNTS.map((a) => a[key])).size).toBe(14);
    }
  });

  it("takes the recorded sex from the report and leaves it empty when the report has none", () => {
    const sexOf = (name: string) => ACCOUNTS.find((a) => a.name === name)!.biologicalSex;
    expect(sexOf("Bob Jones")).toBe("Female"); // recorded sex, not guessed from the name
    expect(sexOf("Ethan Hunt")).toBe("Male");
    expect(sexOf("Charlie Brown")).toBeUndefined();
    expect(sexOf("Laura Croft")).toBeUndefined();
  });

  it("marks them as demo accounts", () => {
    expect(ACCOUNTS.every((a) => a.provider === "demo")).toBe(true);
  });
});

describe("a demo account sees only its own reports", () => {
  it("every account sees its own report and none of the other 13 (all 14 x 14 pairs)", () => {
    for (const account of ACCOUNTS) {
      const seen = reportsForPatient(DEMO_REPORTS, account.patientId);
      expect(seen.length).toBeGreaterThanOrEqual(1);
      for (const report of DEMO_REPORTS) {
        const visible = seen.some((r) => r.id === report.id);
        expect(visible, `${account.name} looking at ${report.patient.name}'s report`).toBe(
          report.patient.id === account.patientId,
        );
        expect(canViewReport(report, account.patientId)).toBe(
          report.patient.id === account.patientId,
        );
      }
    }
  });

  it("shows nothing to a signed-out visitor, an empty id or an unknown id", () => {
    for (const id of [undefined, null, "", "   ", "CLD-NOBODY-0000", "CLD-G123-4567"]) {
      expect(reportsForPatient(DEMO_REPORTS, id)).toEqual([]);
      for (const report of DEMO_REPORTS) expect(canViewReport(report, id)).toBe(false);
    }
  });

  it("matches the patient id exactly: no prefixes, no case tricks, no padding, no wildcards", () => {
    const alice = ACCOUNTS[0]!.patientId; // CLD-P001-9942
    for (const tricky of [
      alice.slice(0, 8),
      alice.toLowerCase(),
      ` ${alice}`,
      `${alice} `,
      `${alice}\n`,
      "CLD-P0",
      "CLD-P0*",
      ".*",
      "%",
      alice.slice(0, -1),
    ]) {
      expect(reportsForPatient(DEMO_REPORTS, tricky), JSON.stringify(tricky)).toEqual([]);
    }
  });

  it("does not hand out the same list object that holds the other patients", () => {
    const seen = reportsForPatient(DEMO_REPORTS, ACCOUNTS[3]!.patientId);
    expect(seen).not.toBe(DEMO_REPORTS);
    expect(seen.map((r) => r.patient.name)).toEqual(["Diana Prince"]);
  });
});

describe("findReportStrict", () => {
  it("finds a report by its id, ignoring case and surrounding spaces", () => {
    expect(findReportStrict(DEMO_REPORTS, "report-P004")?.patient.name).toBe("Diana Prince");
    expect(findReportStrict(DEMO_REPORTS, "  REPORT-p004 ")?.patient.name).toBe("Diana Prince");
  });

  it("also accepts the short id the API and the QR codes use (P004), and nothing looser", () => {
    expect(findReportStrict(DEMO_REPORTS, "P004")?.patient.name).toBe("Diana Prince");
    expect(findReportStrict(DEMO_REPORTS, " p004 ")?.patient.name).toBe("Diana Prince");
    expect(findReportStrict(DEMO_REPORTS, "P014")?.patient.name).toBe("Nancy Drew");
  });

  it("never falls back to another report (the old lookup returned report P001 for anything unknown)", () => {
    for (const id of [
      "",
      "  ",
      "report-P099",
      "P099",
      "report-P01",
      "P04",
      "P0004",
      "P004x",
      "report-P004x",
      "4",
      "12",
      "report-",
      "../report-P001",
      "CLD-P004-9942",
    ]) {
      expect(findReportStrict(DEMO_REPORTS, id), JSON.stringify(id)).toBeUndefined();
    }
  });
});

describe("restoreUser (the saved session in the browser)", () => {
  const bob = ACCOUNTS.find((a) => a.name === "Bob Jones")!;

  it("replaces a stale saved demo account with the current one", () => {
    const stale = { ...bob, patientId: "CLD-P002-8821" }; // what the old code saved
    expect(restoreUser(stale, ACCOUNTS)).toEqual(bob);
  });

  it("keeps a normal custom user, who has no reports", () => {
    const custom = {
      id: "user-123",
      name: "Eleanor Vance",
      email: "e@x.org",
      patientId: "CLD-U123-4567",
      provider: "email",
    };
    expect(restoreUser(custom, ACCOUNTS)).toEqual(custom);
    expect(reportsForPatient(DEMO_REPORTS, custom.patientId)).toEqual([]);
  });

  it("refuses a custom user who claims a demo patient's id (cannot read their reports by editing storage)", () => {
    const forged = {
      id: "user-evil",
      name: "Mallory",
      email: "m@x.org",
      patientId: ACCOUNTS[3]!.patientId,
      provider: "email",
    };
    expect(restoreUser(forged, ACCOUNTS)).toBeNull();
  });

  it("refuses anything that is not a user", () => {
    for (const junk of [
      null,
      undefined,
      "",
      "Alice",
      42,
      [],
      {},
      { id: "x" },
      { id: 1, name: "n", email: "e", patientId: "p", provider: "email" },
      { id: "x", name: "n", email: "e", patientId: "", provider: "email" },
      { id: "x", name: "n", email: "e", patientId: "CLD-U1-1", provider: "admin" },
    ]) {
      expect(restoreUser(junk, ACCOUNTS), JSON.stringify(junk)).toBeNull();
    }
  });
});
