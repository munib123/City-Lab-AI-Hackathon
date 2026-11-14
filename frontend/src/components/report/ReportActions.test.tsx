import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ReportActions } from "@/components/report/ReportActions";
import { DEMO_REPORTS } from "@/data/demo-reports";
import { analyzeReport } from "@/lib/analysis";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

const API = "https://medlens-api-delta.vercel.app";

class FakeAudio {
  static instances: FakeAudio[] = [];
  static playError: Error | null = null;
  src = "";
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    FakeAudio.instances.push(this);
  }
  play() {
    if (FakeAudio.playError) return Promise.reject(FakeAudio.playError);
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

type Reply = { status?: number; body: unknown; headers?: Record<string, string> };
let replies: Record<string, Reply>;
let fetchMock: ReturnType<typeof vi.fn>;

const reply = (r: Reply) =>
  new Response(JSON.stringify(r.body), {
    status: r.status ?? 200,
    headers: { "content-type": "application/json", ...(r.headers ?? {}) },
  });

beforeEach(() => {
  FakeAudio.instances = [];
  FakeAudio.playError = null;
  toastError.mockClear();
  replies = {
    "/api/tts": {
      body: {
        audio_url: "https://files.example/a1.mp3",
        cached: false,
        voice: "v",
        characters: 10,
        source: "s",
        expires_in: 3600,
      },
    },
    "/api/email": { body: { sent: true, to: "p**@example.com", report_id: "P004" } },
    "/api/reports/P004/link": {
      body: {
        report_id: "P004",
        url: "https://bahriaislai.vercel.app/reports/P004",
        qr: "/api/reports/P004/qr",
      },
    },
  };
  fetchMock = vi.fn(async (url: string) => {
    const path = new URL(url).pathname;
    const r = replies[path];
    if (!r) return reply({ status: 404, body: { detail: "no such route in the test" } });
    return reply(r);
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Audio", FakeAudio);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const diana = DEMO_REPORTS.find((r) => r.patient.name === "Diana Prince")!;
const alice = DEMO_REPORTS.find((r) => r.patient.name === "Alice Smith")!;
const show = (report = diana) =>
  render(<ReportActions report={report} results={analyzeReport(report)} />);
const bodyOf = (call: number) => JSON.parse(fetchMock.mock.calls[call]![1].body);
const callsTo = (path: string) =>
  fetchMock.mock.calls.filter((c) => new URL(c[0] as string).pathname === path);

describe("everything is visible on the report page", () => {
  it("shows Listen, Email, WhatsApp and QR", () => {
    show();
    expect(screen.getByRole("heading", { name: /share this report/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /listen to summary/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /listen to questions/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /email me this report/i })).toBeVisible();
    expect(screen.getByRole("link", { name: /share on whatsapp/i })).toBeVisible();
    expect(screen.getByRole("button", { name: /show qr code/i })).toBeVisible();
  });

  it("offers the urgent warning only when the report has one", () => {
    show(diana);
    expect(screen.getByRole("button", { name: /listen to urgent warning/i })).toBeVisible();
    cleanup();
    show(alice);
    expect(screen.queryByRole("button", { name: /listen to urgent warning/i })).toBeNull();
  });

  it("renders nothing for a report that is not one of the corpus reports", () => {
    const own = { ...alice, id: "my-own-upload" };
    const { container } = render(<ReportActions report={own} results={analyzeReport(own)} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("WhatsApp", () => {
  it("opens WhatsApp with a short message that has no name or record number", () => {
    show();
    const link = screen.getByRole("link", { name: /share on whatsapp/i }) as HTMLAnchorElement;
    expect(link.href.startsWith("https://wa.me/?text=")).toBe(true);
    expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener");
    const text = decodeURIComponent(link.href.slice("https://wa.me/?text=".length));
    expect(text).toMatch(/Hemoglobin/);
    expect(text).toContain("see a doctor today");
    expect(text).not.toContain("Diana");
    expect(text).not.toContain(diana.patient.id);
  });
});

describe("Listen", () => {
  it("fetches the audio for the right part of the right report, plays it, and stops on a second click", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /listen to summary/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /stop listening to summary/i })).toBeVisible(),
    );
    expect(bodyOf(0)).toEqual({ report_id: "P004", part: "summary" });
    const audio = FakeAudio.instances.at(-1)!;
    expect(audio.src).toBe("https://files.example/a1.mp3");
    expect(audio.paused).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /stop listening to summary/i }));
    expect(audio.paused).toBe(true);
    expect(screen.getByRole("button", { name: /listen to summary/i })).toBeVisible();
  });

  it("asks for the questions and the urgent warning as their own parts", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /listen to questions/i }));
    await waitFor(() => expect(callsTo("/api/tts")).toHaveLength(1));
    expect(bodyOf(0)).toEqual({ report_id: "P004", part: "questions" });
    fireEvent.click(screen.getByRole("button", { name: /listen to urgent warning/i }));
    await waitFor(() => expect(callsTo("/api/tts")).toHaveLength(2));
    expect(bodyOf(1)).toEqual({ report_id: "P004", part: "urgent" });
  });

  it("plays only one audio at a time", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /listen to summary/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /stop listening to summary/i })).toBeVisible(),
    );
    const first = FakeAudio.instances.at(-1)!;
    fireEvent.click(screen.getByRole("button", { name: /listen to questions/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /stop listening to questions/i })).toBeVisible(),
    );
    expect(first.paused).toBe(true);
    expect(screen.getByRole("button", { name: /listen to summary/i })).toBeVisible();
  });

  it("goes back to idle when the audio ends", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /listen to summary/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /stop listening to summary/i })).toBeVisible(),
    );
    FakeAudio.instances.at(-1)!.onended?.();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /listen to summary/i })).toBeVisible(),
    );
  });

  it("lets the user tap to play when the browser blocks autoplay", async () => {
    FakeAudio.playError = Object.assign(new Error("blocked"), { name: "NotAllowedError" });
    show();
    fireEvent.click(screen.getByRole("button", { name: /listen to summary/i }));
    const play = await screen.findByRole("button", { name: /play summary/i });
    FakeAudio.playError = null;
    fireEvent.click(play);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /stop listening to summary/i })).toBeVisible(),
    );
  });

  it.each([
    [503, /isn.t available right now/i],
    [502, /busy|try again/i],
    [404, /can.t be read aloud/i],
  ])("explains a %s from the API in plain words and recovers", async (status, message) => {
    replies["/api/tts"] = { status, body: { detail: "server detail" } };
    show();
    fireEvent.click(screen.getByRole("button", { name: /listen to summary/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]![0])).toMatch(message);
    expect(screen.getByRole("button", { name: /listen to summary/i })).toBeVisible();
  });

  it("explains a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    show();
    fireEvent.click(screen.getByRole("button", { name: /listen to summary/i }));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]![0])).toMatch(/couldn.t reach/i);
  });

  it("passes the age and sex the user supplied", async () => {
    const supplied = {
      ...DEMO_REPORTS.find((r) => r.patient.name === "Charlie Brown")!,
      patient: {
        ...DEMO_REPORTS.find((r) => r.patient.name === "Charlie Brown")!.patient,
        age: 40,
        sex: "male" as const,
      },
    };
    show(supplied);
    fireEvent.click(screen.getByRole("button", { name: /listen to summary/i }));
    await waitFor(() => expect(callsTo("/api/tts")).toHaveLength(1));
    expect(bodyOf(0)).toEqual({ report_id: "P003", part: "summary", age: 40, sex: "Male" });
  });
});

describe("Email", () => {
  const open = () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /email me this report/i }));
    return screen.getByLabelText(/email address/i) as HTMLInputElement;
  };
  const submit = (value: string) => {
    const input = open();
    fireEvent.change(input, { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: /^send$/i }));
  };

  it("opens a form asking for an address", () => {
    const input = open();
    expect(input).toBeVisible();
    expect(screen.getByRole("button", { name: /^send$/i })).toBeVisible();
  });

  it.each(["", "nope", "a@b", "a b@c.com", "a@b.com, c@d.com"])(
    "rejects %j without calling the API",
    async (value) => {
      submit(value);
      expect(await screen.findByRole("alert")).toHaveTextContent(/valid email/i);
      expect(callsTo("/api/email")).toHaveLength(0);
    },
  );

  it("sends the report and says where it went", async () => {
    submit("pat@example.com");
    expect(await screen.findByText(/sent to p\*\*@example\.com/i)).toBeVisible();
    expect(screen.getByText(/spam/i)).toBeVisible();
    expect(bodyOf(0)).toEqual({ report_id: "P004", to: "pat@example.com" });
  });

  it("shows the limit message when the API says to slow down", async () => {
    replies["/api/email"] = {
      status: 429,
      body: {
        detail: "This recipient has received too many emails recently. Please try again later.",
      },
      headers: { "retry-after": "3600" },
    };
    submit("pat@example.com");
    expect(await screen.findByRole("alert")).toHaveTextContent(/too many emails/i);
  });

  it.each([
    [503, /isn.t available right now/i],
    [502, /couldn.t send/i],
    [422, /doesn.t look right/i],
  ])("explains a %s", async (status, message) => {
    replies["/api/email"] = { status, body: { detail: "x" } };
    submit("pat@example.com");
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("does not let the same form send twice while a request is running", async () => {
    let release: () => void = () => {};
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>(
          (resolve) => (release = () => resolve(reply(replies["/api/email"]!))),
        ),
    );
    submit("pat@example.com");
    const button = await screen.findByRole("button", { name: /sending/i });
    expect(button).toBeDisabled();
    release();
    await screen.findByText(/sent to/i);
    expect(callsTo("/api/email")).toHaveLength(1);
  });
});

describe("QR code", () => {
  it("shows the report's QR code and the link it opens", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /show qr code/i }));
    const img = (await screen.findByAltText(/qr code that opens this report/i)) as HTMLImageElement;
    expect(img.src).toBe(`${API}/api/reports/P004/qr?format=png`);
    expect(await screen.findByText("https://bahriaislai.vercel.app/reports/P004")).toBeVisible();
  });

  it("still shows the QR code when the link cannot be read", async () => {
    replies["/api/reports/P004/link"] = { status: 500, body: { detail: "x" } };
    show();
    fireEvent.click(screen.getByRole("button", { name: /show qr code/i }));
    expect(await screen.findByAltText(/qr code that opens this report/i)).toBeVisible();
  });
});
