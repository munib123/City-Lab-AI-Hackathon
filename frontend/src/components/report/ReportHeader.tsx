import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Download, Info, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LabReport } from "@/data/types";
import { formatDate } from "@/lib/format";

export function ReportHeader({ report, onDownload }: { report: LabReport; onDownload: () => void }) {
  const { patient } = report;

  return (
    <header className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link to="/reports">
            <ArrowLeft /> Back to Reports
          </Link>
        </Button>
        <Button variant="hero" size="pill" onClick={onDownload}>
          <Download /> Download Report
        </Button>
      </div>

      <div>
        <p className="eyebrow text-primary">{report.labName}</p>
        <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{report.name}</h2>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Patient ID</dt>
            <dd className="font-semibold num">{patient.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Report date</dt>
            <dd className="font-semibold num">{formatDate(report.collectedOn)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Age · Sex</dt>
            <dd className="font-semibold">
              {patient.age ?? "Not stated"} · {patient.sex ? (patient.sex === "female" ? "Female" : "Male") : "Not stated"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Analysis</dt>
            <dd className="flex items-center gap-1.5 font-semibold text-normal-ink">
              <CheckCircle2 className="h-4 w-4" /> Complete
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
        <p className="flex items-start gap-3 rounded-xl border border-primary/20 bg-secondary px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="font-semibold">Educational explanation only.</span> This tool does not diagnose medical conditions or
            replace a healthcare professional. Values shown are fictional demonstration data, not universal reference ranges.
          </span>
        </p>
        <p className="flex items-start gap-3 rounded-xl border border-normal/50 bg-normal-soft px-4 py-3 text-sm">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-normal-ink" />
          <span>
            <span className="font-semibold">Patient context locked to {patient.id}.</span> Reports belonging to anyone else are never shown here.
          </span>
        </p>
      </div>
    </header>
  );
}
