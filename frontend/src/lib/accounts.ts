/**
 * Demo accounts and "who may see which report".
 *
 * This is the single place that decides report visibility. Every page uses these functions, so the rule is the
 * same everywhere: an account sees the reports whose patient id is EXACTLY its own patient id, and nothing else.
 *
 * Note for reviewers: this is a demo boundary in the browser. The demo accounts are open to everyone (that is the
 * point of a demo), so it shows the privacy model but is not real access control. A real deployment would enforce
 * the same rule on the server, per signed-in user.
 */
import type { LabReport } from "@/data/types";

export type AccountProvider = "google" | "email" | "demo";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  /** The id written on that patient's reports, e.g. CLD-P001-9942. Reports are matched on this, exactly. */
  patientId: string;
  provider: AccountProvider;
  avatar?: string;
  dateOfBirth?: string;
  biologicalSex?: "Male" | "Female";
}

export interface DemoAccount extends AppUser {
  provider: "demo";
  /** Ids of the reports that belong to this patient. */
  reportIds: string[];
}

const PROVIDERS: readonly string[] = ["google", "email", "demo"];

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

/** One demo account per patient, built from the reports themselves so the ids can never drift apart. */
export function buildDemoAccounts(reports: readonly LabReport[]): DemoAccount[] {
  return reports.map((report) => {
    const name = report.patient.name ?? report.id;
    const account: DemoAccount = {
      id: `demo-${report.id.replace(/^report-/i, "")}`,
      name,
      email: `${slug(name)}@demo.citylab`,
      patientId: report.patient.id,
      provider: "demo",
      reportIds: [report.id],
    };
    // Taken from the record. Never guessed from the name; when the report has none, it stays empty.
    if (report.patient.sex === "female") account.biologicalSex = "Female";
    else if (report.patient.sex === "male") account.biologicalSex = "Male";
    return account;
  });
}

/** The short label of an account's report, e.g. "P004". */
export function shortReportId(account: DemoAccount): string {
  return (account.reportIds[0] ?? "").replace(/^report-/i, "");
}

/** True only when the patient id matches exactly. No prefixes, no case folding, no trimming. */
export function canViewReport(
  report: { patient: { id: string } },
  patientId?: string | null,
): boolean {
  return typeof patientId === "string" && patientId !== "" && report.patient.id === patientId;
}

/** The reports an account may see. A signed-out visitor, or an unknown id, sees none. */
export function reportsForPatient<T extends { patient: { id: string } }>(
  reports: readonly T[],
  patientId?: string | null,
): T[] {
  return reports.filter((report) => canViewReport(report, patientId));
}

/** Look a report up by its id. Unlike a loose lookup, it never falls back to some other report. */
export function findReportStrict(reports: readonly LabReport[], id: string): LabReport | undefined {
  let key = id.trim().toLowerCase();
  // The API and the QR codes use the short id (P004); the pages use report-P004. Exactly P + 3 digits, nothing looser.
  if (/^p\d{3}$/.test(key)) key = `report-${key}`;
  if (!key) return undefined;
  return reports.find((report) => report.id.toLowerCase() === key);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Rebuild the signed-in user from what the browser saved.
 * - A saved demo account is replaced by the current one (so old or edited copies cannot keep stale ids).
 * - A custom user is kept, but only with known fields, and never if it claims a demo patient's id.
 * - Anything else is rejected.
 */
export function restoreUser(stored: unknown, accounts: readonly AppUser[]): AppUser | null {
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return null;
  const record = stored as Record<string, unknown>;
  const id = record["id"];
  const name = record["name"];
  const email = record["email"];
  const patientId = record["patientId"];
  const provider = record["provider"];
  const sex = record["biologicalSex"];
  if (!isText(id) || !isText(name) || !isText(email) || !isText(patientId)) return null;
  if (typeof provider !== "string" || !PROVIDERS.includes(provider)) return null;

  const demo = accounts.find((account) => account.id === id);
  if (demo) return demo;
  if (accounts.some((account) => account.patientId === patientId)) return null; // cannot claim a demo patient

  const user: AppUser = { id, name, email, patientId, provider: provider as AccountProvider };
  if (sex === "Male" || sex === "Female") user.biologicalSex = sex;
  return user;
}
