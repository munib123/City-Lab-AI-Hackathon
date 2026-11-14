import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, FileText, AlertCircle, AlertTriangle } from "lucide-react";
import type { LabReport } from "@/data/types";
import { analyzeReport, countStatuses } from "@/lib/analysis";
import { formatDate } from "@/lib/format";
import { STATUS_DOT } from "@/components/report/StatusBadge";

export function ReportRow({ report }: { report: LabReport }) {
  const counts = countStatuses(analyzeReport(report));
  const hasUrgent = counts.urgent > 0;
  const isMissingDemo = report.patient.age === null || report.patient.sex === null;

  return (
    <Link
      to="/reports/$reportId"
      params={{ reportId: report.id }}
      className="group grid grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 transition-colors hover:bg-icy sm:grid-cols-[auto_2.2fr_1fr_1fr_1.3fr_auto] sm:px-6"
    >
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${hasUrgent ? "bg-red-500/10 text-red-600" : isMissingDemo ? "bg-amber-500/10 text-amber-600" : "bg-secondary text-primary"}`}>
        {hasUrgent ? (
          <AlertCircle className="h-[18px] w-[18px]" strokeWidth={2} />
        ) : isMissingDemo ? (
          <AlertTriangle className="h-[18px] w-[18px]" strokeWidth={2} />
        ) : (
          <FileText className="h-[18px] w-[18px]" strokeWidth={1.75} />
        )}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-semibold text-foreground truncate">{report.patient.name ?? report.patient.id}</span>
          <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-mono">{report.id.replace("report-", "")}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground mt-0.5">{report.name}</span>
        {report.notes && (
          <span className="block truncate text-[11px] text-primary/80 mt-0.5 italic">{report.notes}</span>
        )}
      </span>
      <span className="hidden text-sm text-muted-foreground num sm:block">{formatDate(report.collectedOn)}</span>
      <span className="hidden text-sm num sm:block font-medium">
        {counts.total} {counts.total === 1 ? "test" : "tests"}
      </span>
      <span className="hidden items-center gap-2 text-sm sm:flex">
        {hasUrgent ? (
          <span className="text-xs font-bold text-red-600 bg-red-500/10 px-2 py-1 rounded-md flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> URGENT
          </span>
        ) : isMissingDemo ? (
          <span className="text-xs font-semibold text-amber-600 bg-amber-500/10 px-2 py-1 rounded-md flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Missing Demo
          </span>
        ) : (
          <span className="text-xs font-semibold text-normal-ink flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
          </span>
        )}
        <span className="flex gap-0.5" aria-label={`${counts.urgent + counts.high + counts.low} abnormal`}>
          {analyzeReport(report).map((r) => (
            <span key={r.id} className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[r.status]}`} />
          ))}
        </span>
      </span>
      <span className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold text-primary transition-all group-hover:border-primary/40 group-hover:shadow-soft">
        Examine <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}

export function ReportList({ reports }: { reports: LabReport[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className="hidden grid-cols-[auto_2.2fr_1fr_1fr_1.3fr_auto] gap-4 border-b bg-muted/60 px-6 py-2.5 text-xs font-semibold text-muted-foreground sm:grid">
        <span className="w-10" />
        <span>Patient & Scenario</span>
        <span>Date</span>
        <span>Analytes</span>
        <span>Classification</span>
        <span className="w-[104px]" />
      </div>
      <div className="divide-y">
        {reports.map((r) => (
          <ReportRow key={r.id} report={r} />
        ))}
      </div>
    </div>
  );
}

export function RecentReports({ reports }: { reports: LabReport[] }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-semibold">CityLab Official Test Cases (P001 – P014)</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete dataset demonstrating all edge cases: boundary checks, missing demographics, unit conversions, and urgent care triggers.
          </p>
        </div>
        <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
          14 Verified Cases Loaded
        </span>
      </div>
      <ReportList reports={reports} />
    </section>
  );
}
