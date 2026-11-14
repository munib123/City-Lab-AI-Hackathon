import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Mail, MessageCircle, Play, QrCode, Square, Volume2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DEMO_REPORTS } from "@/data/demo-reports";
import type { AnalyzedResult, LabReport } from "@/data/types";
import {
  ApiError,
  apiReportId,
  emailReport,
  qrImageUrl,
  readAloud,
  reportLink,
  type ReadAloudInput,
} from "@/lib/api";
import { buildShareText, whatsappLink } from "@/lib/share";

/* ------------------------------------------------------------------ Listen */

type ListenState = "idle" | "loading" | "playing" | "ready";

/** Only one thing is read aloud at a time: starting another one stops this. */
let stopActive: (() => void) | null = null;

function listenMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "The audio could not be played.";
  if (error.status === 0) return "Couldn't reach the read-aloud service. Check your connection.";
  if (error.status === 503) return "Read-aloud isn't available right now.";
  if (error.status === 502) return "The audio service is busy. Please try again in a moment.";
  if (error.status === 404 || error.status === 422) return "This part can't be read aloud.";
  return error.message;
}

function ListenButton({ what, request }: { what: string; request: ReadAloudInput }) {
  const [state, setState] = useState<ListenState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      audioRef.current?.pause();
    };
  }, []);

  const stop = () => {
    audioRef.current?.pause();
    if (stopActive === stop) stopActive = null;
    if (mounted.current) setState("idle");
  };

  const play = async (audio: HTMLAudioElement) => {
    try {
      await audio.play();
      if (mounted.current) setState("playing");
    } catch (error) {
      // Browsers can refuse autoplay after a slow request; let the person tap Play instead.
      if (error instanceof Error && error.name === "NotAllowedError") {
        if (mounted.current) setState("ready");
        return;
      }
      toast.error(listenMessage(error));
      stop();
    }
  };

  const onClick = async () => {
    if (state === "loading") return;
    if (state === "playing") return stop();

    stopActive?.();
    stopActive = stop;

    if (state === "ready" && audioRef.current) return play(audioRef.current);

    setState("loading");
    // Created inside the click, before the network call, so browsers still treat playback as user-initiated.
    const audio = new Audio();
    audioRef.current = audio;
    audio.onended = () => stop();
    audio.onerror = () => {
      toast.error("The audio could not be played.");
      stop();
    };
    try {
      const { audioUrl } = await readAloud(request);
      if (!mounted.current || stopActive !== stop) return;
      audio.src = audioUrl;
      await play(audio);
    } catch (error) {
      toast.error(listenMessage(error));
      stop();
    }
  };

  const label =
    state === "playing"
      ? `Stop listening to ${what}`
      : state === "ready"
        ? `Play ${what}`
        : state === "loading"
          ? `Preparing audio for ${what}`
          : `Listen to ${what}`;
  const Icon =
    state === "loading"
      ? Loader2
      : state === "playing"
        ? Square
        : state === "ready"
          ? Play
          : Volume2;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full"
      aria-label={label}
      aria-busy={state === "loading"}
      onClick={onClick}
    >
      <Icon className={state === "loading" ? "animate-spin" : undefined} />
      {state === "playing"
        ? "Stop"
        : state === "ready"
          ? "Play"
          : state === "loading"
            ? "Preparing…"
            : `Listen to ${what}`}
    </Button>
  );
}

/* ------------------------------------------------------------------ Email */

const EMAIL_SHAPE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;

function emailMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "The email could not be sent.";
  if (error.status === 0) return "Couldn't reach the email service. Check your connection.";
  if (error.status === 422) return "That email address doesn't look right.";
  if (error.status === 429) return error.message;
  if (error.status === 503) return "Email isn't available right now.";
  if (error.status === 502) return "The mail server couldn't send it. Please try again.";
  return error.message;
}

type Demographics = Pick<ReadAloudInput, "age" | "sex">;

/**
 * Age and sex to send along, but only the ones the person filled in themselves (for example on a report whose
 * age or sex is missing). The API already knows what the report itself records.
 */
function suppliedDemographics(report: LabReport): Demographics {
  const recorded = DEMO_REPORTS.find((r) => r.id === report.id)?.patient;
  const out: Demographics = {};
  if (report.patient.age !== (recorded?.age ?? null)) out.age = report.patient.age;
  if (report.patient.sex !== (recorded?.sex ?? null)) out.sex = report.patient.sex;
  return out;
}

function EmailDialog({
  report,
  demographics,
  open,
  onOpenChange,
}: {
  report: LabReport;
  demographics: Demographics;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [address, setAddress] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setMessage("");
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (status === "sending") return;
    const to = address.trim();
    if (!EMAIL_SHAPE.test(to)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const sent = await emailReport({ reportId: report.id, to, ...demographics });
      setStatus("sent");
      setMessage(`Sent to ${sent.to}. Check your inbox (and your spam folder).`);
    } catch (error) {
      setStatus("error");
      setMessage(emailMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email me this report</DialogTitle>
          <DialogDescription>
            We email the plain-language explanation: each result, what it measures, and questions
            for your doctor. It has no name or record number.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="report-email" className="text-sm font-semibold">
              Email address
            </label>
            <Input
              id="report-email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          {status === "error" && (
            <p
              role="alert"
              className="rounded-lg border border-urgent bg-urgent-soft px-3 py-2 text-sm text-urgent-ink"
            >
              {message}
            </p>
          )}
          {status === "sent" && (
            <p
              role="status"
              className="rounded-lg border border-normal/50 bg-normal-soft px-3 py-2 text-sm text-normal-ink"
            >
              {message}
            </p>
          )}
          <Button
            type="submit"
            variant="hero"
            size="pill"
            className="w-full"
            disabled={status === "sending"}
          >
            {status === "sending" ? "Sending…" : "Send"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ QR */

function QrDialog({
  report,
  open,
  onOpenChange,
}: {
  report: LabReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [link, setLink] = useState<string | null>(null);
  const src = qrImageUrl(report.id);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void reportLink(report.id).then((url) => live && setLink(url));
    return () => {
      live = false;
    };
  }, [open, report.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>QR code for this report</DialogTitle>
          <DialogDescription>
            Scan it with a phone camera to open this report. Only the matching demo account can view
            it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          {src && (
            <img
              src={src}
              alt="QR code that opens this report"
              width={224}
              height={224}
              className="h-56 w-56 rounded-lg border bg-white p-2"
            />
          )}
          {link && (
            <p className="max-w-full break-all text-center text-xs text-muted-foreground">{link}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ the panel */

/** "Share this report": Listen, Email, WhatsApp and QR, all in one visible place on the report page. */
export function ReportActions({
  report,
  results,
}: {
  report: LabReport;
  results: AnalyzedResult[];
}) {
  const code = apiReportId(report.id);
  const [origin, setOrigin] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  // Known only in the browser; set after the first render so the server and browser HTML match.
  useEffect(() => setOrigin(window.location.origin), []);

  if (!code) return null;

  const demographics = suppliedDemographics(report);
  const hasUrgent = results.some((r) => r.status === "urgent");
  const shareText = buildShareText({
    reportCode: code,
    results,
    link: origin ? `${origin}/reports/${code}` : "",
  });

  return (
    <section
      aria-labelledby="share-report-title"
      className="rounded-2xl border bg-card p-5 shadow-soft sm:p-6"
    >
      <h3 id="share-report-title" className="font-display text-lg font-semibold">
        Share this report
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Listen to the explanation, email it to yourself, send a short summary on WhatsApp, or open
        it on your phone with a QR code.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <ListenButton
          what="summary"
          request={{ reportId: report.id, part: "summary", ...demographics }}
        />
        {hasUrgent && (
          <ListenButton
            what="urgent warning"
            request={{ reportId: report.id, part: "urgent", ...demographics }}
          />
        )}
        <ListenButton
          what="questions"
          request={{ reportId: report.id, part: "questions", ...demographics }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setEmailOpen(true)}
        >
          <Mail /> Email me this report
        </Button>
        <Button asChild variant="outline" size="sm" className="rounded-full">
          <a
            href={whatsappLink(shareText)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Share on WhatsApp"
          >
            <MessageCircle /> Share on WhatsApp
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setQrOpen(true)}
        >
          <QrCode /> Show QR code
        </Button>
      </div>
      <EmailDialog
        report={report}
        demographics={demographics}
        open={emailOpen}
        onOpenChange={setEmailOpen}
      />
      <QrDialog report={report} open={qrOpen} onOpenChange={setQrOpen} />
    </section>
  );
}
