import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportUploader, validateReportFile } from "@/components/upload/ReportUploader";
import { UploadProgress } from "@/components/upload/UploadProgress";
import { ANALYSIS_STEPS, AnalysisSteps } from "@/components/upload/AnalysisSteps";
import { DEMO_REPORTS } from "@/data/demo-reports";
import { reportsForPatient } from "@/lib/accounts";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload a Lab Report — LabSense AI" },
      { name: "description", content: "Upload a PDF or photo of your lab report and get each result explained in simple language." },
      { property: "og:title", content: "Upload a Lab Report — LabSense AI" },
      { property: "og:description", content: "Upload a PDF or photo of your lab report and get each result explained in simple language." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(-1); // -1 idle, 0..5 running, 6 done
  const timers = useRef<number[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearInterval(t));
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const selectFile = (f: File) => {
    const err = validateReportFile(f);
    setError(err);
    if (err) return;
    clearTimers();
    setFile(f);
    setStep(-1);
    setProgress(0);
    // Simulated upload — the file never leaves the browser in this demo.
    const id = window.setInterval(() => {
      setProgress((p) => {
        const next = Math.min(100, p + 7 + Math.random() * 12);
        if (next >= 100) window.clearInterval(id);
        return next;
      });
    }, 120);
    timers.current.push(id);
  };

  const remove = () => {
    clearTimers();
    setFile(null);
    setProgress(0);
    setStep(-1);
  };

  const analyze = () => {
    setStep(0);
    const id = window.setInterval(() => {
      setStep((s) => {
        if (s >= ANALYSIS_STEPS.length - 1) {
          window.clearInterval(id);
          // Open this account's own report; an account with no report goes to its (empty) list.
          const own = reportsForPatient(DEMO_REPORTS, user?.patientId)[0];
          window.setTimeout(() => {
            if (own) navigate({ to: "/reports/$reportId", params: { reportId: own.id } });
            else navigate({ to: "/reports" });
          }, 500);
          return ANALYSIS_STEPS.length;
        }
        return s + 1;
      });
    }, 650);
    timers.current.push(id);
  };

  const analyzing = step >= 0;

  return (
    <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <p className="eyebrow text-primary">Upload Report</p>
        <h2 className="mt-2 font-display text-4xl font-light leading-tight sm:text-5xl">
          Let's understand <span className="font-semibold">your lab report.</span>
        </h2>
        <p className="mt-3 max-w-xl text-base text-muted-foreground">
          Upload your laboratory report and let LabSense AI explain the results using the available reference documents.
        </p>

        <div className="mt-8 space-y-4">
          {!file ? <ReportUploader onFile={selectFile} /> : <UploadProgress file={file} progress={progress} onRemove={remove} disabled={analyzing} />}
          {error && (
            <p role="alert" className="rounded-xl border border-urgent bg-urgent-soft px-4 py-3 text-sm font-medium text-urgent-ink">
              {error}
            </p>
          )}

          {file && (
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="hero" size="pill" disabled={progress < 100 || analyzing} onClick={analyze}>
                {analyzing ? "Analyzing…" : "Analyze Report"} <ArrowRight />
              </Button>
              <Button variant="ghost" size="pill" disabled={analyzing} onClick={remove}>
                <Trash2 /> Choose another file
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                Demo mode: your file stays in this browser. The analysis shown afterwards is the fictional sample report.
              </p>
            </div>
          )}

          <div className="grid gap-3 pt-4 sm:grid-cols-2">
            <div className="flex gap-3 rounded-2xl border bg-card p-4">
              <Lock className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-semibold">Private by design</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Files are used only to explain this report for the current patient and are not shared.</p>
              </div>
            </div>
            <div className="flex gap-3 rounded-2xl border bg-card p-4">
              <ShieldCheck className="h-5 w-5 shrink-0 text-normal-ink" strokeWidth={1.75} />
              <div>
                <p className="text-sm font-semibold">No diagnosis</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">LabSense explains results. It does not diagnose conditions or replace your doctor.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <aside className={`h-fit rounded-[1.75rem] border p-6 transition-all duration-500 ${analyzing ? "bg-card shadow-glow" : "surface-glass"}`}>
        <h3 className="font-display text-lg font-semibold">How your report is analyzed</h3>
        <p className="mb-6 mt-1 text-xs text-muted-foreground">
          {analyzing ? (step >= ANALYSIS_STEPS.length ? "Done — opening your explanation…" : "Working through each step…") : "Six steps, using only the provided documents."}
        </p>
        <AnalysisSteps activeStep={step} />
      </aside>
    </div>
  );
}
