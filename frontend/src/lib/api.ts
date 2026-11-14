/**
 * Client for the MedLens API (read-aloud, email, QR). The base address is VITE_API_URL, defaulting to the deployed API.
 * Every function turns failures into an ApiError, so the screens can show a plain-words message.
 */

const DEFAULT_API_BASE = "https://medlens-api-delta.vercel.app";

export function apiBase(): string {
  const configured: unknown = import.meta.env["VITE_API_URL"];
  const base =
    typeof configured === "string" && configured.trim() ? configured.trim() : DEFAULT_API_BASE;
  return base.replace(/\/+$/, "");
}

/** "report-P004" (the page id) -> "P004" (the API id). Null for anything that is not one of the corpus reports. */
export function apiReportId(frontendId: string): string | null {
  const match = /^report-(P\d{3})$/i.exec(frontendId.trim());
  return match ? match[1]!.toUpperCase() : null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly retryAfter: number | undefined;

  constructor(message: string, status: number, retryAfter?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

type SexInput = "female" | "male" | null | undefined;

const apiSex = (sex: SexInput) =>
  sex === "female" ? "Female" : sex === "male" ? "Male" : undefined;

function detailOf(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const detail = (data as Record<string, unknown>)["detail"];
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first: unknown = detail[0];
    if (typeof first === "object" && first !== null) {
      const msg = (first as Record<string, unknown>)["msg"];
      if (typeof msg === "string") return msg;
    }
  }
  return null;
}

async function call(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await globalThis.fetch(`${apiBase()}${path}`, init);
  } catch {
    throw new ApiError("Could not reach the service.", 0);
  }
  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    // no JSON body
  }
  if (!response.ok) {
    const retry = Number(response.headers.get("retry-after"));
    throw new ApiError(
      detailOf(data) ?? `The request failed (${response.status}).`,
      response.status,
      Number.isFinite(retry) && retry > 0 ? retry : undefined,
    );
  }
  return data;
}

const postJson = (path: string, body: Record<string, unknown>) =>
  call(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const need = (reportId: string): string => {
  const id = apiReportId(reportId);
  if (!id) throw new ApiError("This report is not available from the service.", 0);
  return id;
};

const field = (data: unknown, key: string): unknown =>
  typeof data === "object" && data !== null ? (data as Record<string, unknown>)[key] : undefined;

export interface ReadAloudInput {
  reportId: string;
  part: "summary" | "urgent" | "questions" | "result";
  index?: number;
  age?: number | null;
  sex?: SexInput;
}

/** Ask the API to read part of a report aloud; returns a temporary link to the audio. */
export async function readAloud(
  input: ReadAloudInput,
): Promise<{ audioUrl: string; cached: boolean }> {
  const body: Record<string, unknown> = { report_id: need(input.reportId), part: input.part };
  if (input.part === "result" && input.index !== undefined) body["index"] = input.index;
  if (typeof input.age === "number") body["age"] = input.age;
  const sex = apiSex(input.sex);
  if (sex) body["sex"] = sex;

  const data = await postJson("/api/tts", body);
  const audioUrl = field(data, "audio_url");
  if (typeof audioUrl !== "string" || !audioUrl)
    throw new ApiError("The service returned no audio.", 502);
  return { audioUrl, cached: field(data, "cached") === true };
}

export interface EmailInput {
  reportId: string;
  to: string;
  age?: number | null;
  sex?: SexInput;
}

/** Email the explanation of a report. Returns the masked address it was sent to. */
export async function emailReport(input: EmailInput): Promise<{ to: string }> {
  const body: Record<string, unknown> = { report_id: need(input.reportId), to: input.to };
  if (typeof input.age === "number") body["age"] = input.age;
  const sex = apiSex(input.sex);
  if (sex) body["sex"] = sex;

  const data = await postJson("/api/email", body);
  const to = field(data, "to");
  return { to: typeof to === "string" ? to : input.to };
}

/** The address of the report's QR code image, or null if the report has none. */
export function qrImageUrl(reportId: string, format: "png" | "svg" = "png"): string | null {
  const id = apiReportId(reportId);
  return id ? `${apiBase()}/api/reports/${id}/qr?format=${format}` : null;
}

/** The link the QR code opens, or null when it cannot be read (the QR image still works). */
export async function reportLink(reportId: string): Promise<string | null> {
  const id = apiReportId(reportId);
  if (!id) return null;
  try {
    const url = field(await call(`/api/reports/${id}/link`), "url");
    return typeof url === "string" ? url : null;
  } catch {
    return null;
  }
}
