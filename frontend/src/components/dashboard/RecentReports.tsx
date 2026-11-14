import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  FileText,
  Calendar,
  Sparkles,
} from "lucide-react";
import type { LabReport } from "@/data/types";
import { analyzeReport, countStatuses } from "@/lib/analysis";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

const FLASH_SUMMARIES: Record<string, string> = {
  "Complete Blood Count (CBC)": "Evaluates oxygen transport, immunity cells, and blood clotting markers.",
  "Liver Function Test (Boundary Limit Case)": "Measures metabolic liver enzymes (ALT & SGPT) against sex-specific thresholds.",
  "Fasting Blood Sugar (Corrupted Demographics)": "Screens fasting blood glucose balance; requires age and biological sex verification.",
  "Hematology Panel (Critical Urgent Alert)": "Evaluates critical hemoglobin levels to detect severe oxygen deficiency.",
  "Blood Glucose (Unit Conversion)": "Tests glucose concentration with automatic mmol/L to mg/dL metric conversion.",
  "Iron Studies (Unclassified Marker)": "Evaluates cellular iron storage reserves (Serum Ferritin marker).",
  "Thyroid Profile (TSH)": "Monitors thyroid stimulating hormone regulating overall bodily metabolism.",
  "Routine Urinalysis (Synonyms & Qualitative)": "Checks kidney waste elimination, urine pH, and qualitative protein presence.",
  "Hepatic Panel (Elevated Liver Enzymes)": "Screens elevated hepatic enzyme markers (ALT & AST) indicating cellular stress.",
  "Lipid Evaluation (Boundary Case 200 mg/dL)": "Evaluates circulating cholesterol against the 200 mg/dL clinical threshold.",
};

export function ReportCard({ report }: { report: LabReport }) {
  const results = analyzeReport(report);
  const counts = countStatuses(results);
  const hasUrgent = counts.urgent > 0;
  const isMissingDemo = report.patient.age === null || report.patient.sex === null;
  const hasAbnormal = counts.high > 0 || counts.low > 0;
  const summary = FLASH_SUMMARIES[report.name] || "Clinical diagnostic panel measuring key physiological biomarkers.";

  // Primary analyte for the prominent flash display
  const primaryResult = results[0];

  return (
    <article className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all duration-200 hover:border-primary/40 hover:shadow-md">
      <div className="space-y-3.5">
        {/* Flash Card Header */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          {hasUrgent ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700 border border-red-200">
              <AlertCircle className="h-3 w-3" />
              Urgent Attention
            </span>
          ) : isMissingDemo ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
              <AlertTriangle className="h-3 w-3" />
              Missing Demographics
            </span>
          ) : hasAbnormal ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
              <AlertTriangle className="h-3 w-3" />
              Requires Review
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3 w-3" />
              Within Normal Limits
            </span>
          )}

          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(report.collectedOn)}</span>
          </div>
        </div>

        {/* Panel Title & Patient */}
        <div>
          <h4 className="font-display text-base font-bold text-navy group-hover:text-primary transition-colors leading-snug">
            {report.name}
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Patient: <strong className="text-slate-700 font-semibold">{report.patient.name}</strong> ({report.patient.id})
          </p>
        </div>

        {/* Flash Box: Key Biomarker Display */}
        {primaryResult && (
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-slate-700">{primaryResult.testName ?? primaryResult.reportedAs}</span>
              <span className="text-[10px] text-slate-400 font-medium">
                {primaryResult.range ? `Ref: ${primaryResult.range.min}–${primaryResult.range.max} ${primaryResult.range.unit}` : "Reference pending"}
              </span>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="font-display text-2xl font-bold text-navy num">
                  {primaryResult.value}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {primaryResult.unit}
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  primaryResult.status === "normal"
                    ? "bg-emerald-100 text-emerald-800"
                    : primaryResult.status === "urgent"
                    ? "bg-red-100 text-red-800"
                    : primaryResult.status === "unclassified"
                    ? "bg-slate-200 text-slate-700"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {primaryResult.status === "normal"
                  ? "NORMAL"
                  : primaryResult.status === "urgent"
                  ? "CRITICAL"
                  : primaryResult.status === "unclassified"
                  ? "UNCLASSIFIED"
                  : "ABNORMAL"}
              </span>
            </div>
          </div>
        )}

        {/* 1-Line Flash Summary */}
        <p className="text-xs text-slate-600 leading-relaxed">
          {summary}
        </p>

        {/* Secondary Analytes Pills (if more than 1) */}
        {results.length > 1 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {results.slice(1).map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    r.status === "normal"
                      ? "bg-emerald-500"
                      : r.status === "urgent"
                      ? "bg-red-500"
                      : "bg-amber-500"
                  }`}
                />
                <span className="truncate max-w-[110px]">{r.testName ?? r.reportedAs}:</span>
                <strong className="num text-navy">{r.value}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-4 mt-4 border-t border-slate-100">
        <Button asChild variant="outline" size="sm" className="w-full justify-between rounded-xl hover:bg-navy hover:text-white hover:border-navy transition-all text-xs font-semibold">
          <Link to="/reports/$reportId" params={{ reportId: report.id }}>
            <span>Examine Flash Report</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function RecentReports({ reports }: { reports: LabReport[] }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow text-primary">Patient Portal</span>
          <h3 className="mt-1 font-display text-2xl font-bold sm:text-3xl text-navy">
            Recent Laboratory Reports
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick flash cards explaining your latest medical test results.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-primary hover:bg-primary/10 font-semibold text-xs">
          <Link to="/reports">
            View all reports <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Flash Boxes Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </section>
  );
}

export function ReportList({ reports }: { reports: LabReport[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}
