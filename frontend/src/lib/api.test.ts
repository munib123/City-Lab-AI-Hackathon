import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  apiBase,
  apiReportId,
  emailReport,
  qrImageUrl,
  readAloud,
  reportLink,
} from "@/lib/api";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });

afterEach(() => vi.unstubAllGlobals());

describe("apiReportId", () => {
  it("maps the frontend report id to the API id", () => {
    expect(apiReportId("report-P004")).toBe("P004");
    expect(apiReportId(" REPORT-p014 ")).toBe("P014");
  });

  it("returns null for anything that is not a corpus report id", () => {
    for (const id of [
      "",
      "P004",
      "report-P04",
      "report-P0004",
      "report-P004x",
      "../report-P001",
      "CLD-P004-9942",
      "report-",
    ]) {
      expect(apiReportId(id), id).toBeNull();
    }
  });
});

describe("apiBase", () => {
  it("points at the deployed API by default, without a trailing slash", () => {
    expect(apiBase()).toBe("https://medlens-api-delta.vercel.app");
  });
});

describe("readAloud", () => {
  it("posts the right body and returns the audio link", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json({
          audio_url: "https://x/a.mp3",
          cached: true,
          voice: "v",
          characters: 9,
          source: "s",
          expires_in: 3600,
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const out = await readAloud({
      reportId: "report-P004",
      part: "result",
      index: 1,
      age: 40,
      sex: "male",
    });
    expect(out.audioUrl).toBe("https://x/a.mp3");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://medlens-api-delta.vercel.app/api/tts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      report_id: "P004",
      part: "result",
      index: 1,
      age: 40,
      sex: "Male",
    });
  });

  it("leaves out demographics that are not known, and index for parts that have none", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ audio_url: "u" }));
    vi.stubGlobal("fetch", fetchMock);
    await readAloud({ reportId: "report-P003", part: "summary", age: null, sex: null });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      report_id: "P003",
      part: "summary",
    });
  });

  it("refuses a report that is not a corpus report, without calling the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(readAloud({ reportId: "my-own-report", part: "summary" })).rejects.toMatchObject({
      status: 0,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("turns API errors into ApiError with the server's message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(json({ detail: "The audio could not be stored." }, 502)),
    );
    const err = await readAloud({ reportId: "report-P001", part: "summary" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 502, message: "The audio could not be stored." });
  });

  it("turns a network failure into ApiError with status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(readAloud({ reportId: "report-P001", part: "summary" })).rejects.toMatchObject({
      status: 0,
    });
  });
});

describe("emailReport", () => {
  it("posts the report id and the address, nothing else", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(json({ sent: true, to: "p**@example.com", report_id: "P004" }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await emailReport({ reportId: "report-P004", to: "pat@example.com" });
    expect(out).toEqual({ to: "p**@example.com" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://medlens-api-delta.vercel.app/api/email");
    expect(JSON.parse(init.body)).toEqual({ report_id: "P004", to: "pat@example.com" });
  });

  it("includes age and sex only when known", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ sent: true, to: "x" }));
    vi.stubGlobal("fetch", fetchMock);
    await emailReport({ reportId: "report-P003", to: "a@b.co", age: 40, sex: "female" });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      report_id: "P003",
      to: "a@b.co",
      age: 40,
      sex: "Female",
    });
  });

  it("keeps Retry-After from a 429 and reads FastAPI validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(json({ detail: "Too many emails." }, 429, { "retry-after": "3600" })),
    );
    expect(
      await emailReport({ reportId: "report-P004", to: "a@b.co" }).catch((e) => e),
    ).toMatchObject({ status: 429, retryAfter: 3600 });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          json({ detail: [{ msg: "Value error, to must be one email address" }] }, 422),
        ),
    );
    expect(await emailReport({ reportId: "report-P004", to: "bad" }).catch((e) => e)).toMatchObject(
      { status: 422, message: "Value error, to must be one email address" },
    );
  });
});

describe("qr and link", () => {
  it("builds the QR image address from the API id", () => {
    expect(qrImageUrl("report-P004")).toBe(
      "https://medlens-api-delta.vercel.app/api/reports/P004/qr?format=png",
    );
    expect(qrImageUrl("report-P004", "svg")).toBe(
      "https://medlens-api-delta.vercel.app/api/reports/P004/qr?format=svg",
    );
    expect(qrImageUrl("not-a-report")).toBeNull();
  });

  it("asks the API which link the QR opens", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        json({
          report_id: "P004",
          url: "https://app.example/reports/P004",
          qr: "/api/reports/P004/qr",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    expect(await reportLink("report-P004")).toBe("https://app.example/reports/P004");
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://medlens-api-delta.vercel.app/api/reports/P004/link",
    );
  });

  it("gives null instead of throwing when the link cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    expect(await reportLink("report-P004")).toBeNull();
  });
});
