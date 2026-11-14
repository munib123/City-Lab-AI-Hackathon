import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Activity,
  FileText,
  Sparkles,
  Info,
  Calendar,
  Layers,
} from "lucide-react";
import type { LabReport } from "@/data/types";
import { analyzeReport, countStatuses } from "@/lib/analysis";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

const PANEL_EXPLANATIONS: Record<string, string> = {
  "Complete Blood Count (CBC)":
    "Evaluates the three essential blood cell types: red cells that carry oxygen, white cells that defend against infections, and platelets that enable clotting.",
  "Liver Function Test (Boundary Limit Case)":
    "Measures cellular liver enzymes (like ALT and SGPT) to verify how effectively your liver processes nutrients, filters toxins, and supports metabolism.",
  "Fasting Blood Sugar (Corrupted Demographics)":
    "Measures fasting glucose levels in your bloodstream to see how well your body manages energy and maintains stable blood sugar balance.",
  "Hematology Panel (Critical Urgent Alert)":
    "Evaluates critical oxygen-carrying hemoglobin levels to detect severe anemia and verify adequate oxygen transport to vital organs.",
  "Blood Glucose (Unit Conversion)":
    "Checks fasting glucose concentration, automatically converting international metric units (mmol/L) to standard clinical units (mg/dL).",
  "Iron Studies (Unclassified Marker)":
    "Analyzes bodily iron storage reserves inside cells to assess stamina, energy production, and nutritional mineral balance.",
  "Thyroid Profile (TSH)":
    "Assesses thyroid-stimulating hormone (TSH) to evaluate how well your thyroid gland regulates overall body metabolism, energy, and temperature.",
  "Routine Urinalysis (Synonyms & Qualitative)":
    "Examines kidney filtration efficiency and urine chemical balance to ensure waste elimination pathways are functioning normally.",
  "Hepatic Panel (Elevated Liver Enzymes)":
    "Screens key hepatic enzymes (ALT and AST) to evaluate liver cellular integrity and verify healthy enzyme filtration.",
  "Lipid Evaluation (Boundary Case 200 mg/dL)":
    "Measures total circulating cholesterol particles to monitor cardiovascular health and lipid balance in your blood vessels.",
};

function getExplanation(report: LabReport): string {
  if (PANEL_EXPLANATIONS[report.name]) {
    return PANEL_EXPLANATIONS[report.name];
  }
  return "Comprehensive laboratory panel measuring key biomarkers to assess organ function, energy regulation, and overall physiological health.";
}

export function ReportCard({ report }: { report: LabReport }) {
  const results = analyzeReport(report);
  const counts = countStatuses(results);
  const hasUrgent = counts.urgent > 0;
  const isMissingDemo = report.patient.age === null || report.patient.sex === null;
  const hasAbnormal = counts.high > 0 || counts.low > 0;
  const explanation = getExplanation(report);

  return (
    <article className="group flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/40 to-white p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-elevated">
      <div className="space-y-4">
        {/* Top Badges Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary border border-blue-100">
            <Activity className="h-3.5 w-3.5" />
            <span>{report.labName}</span>
          </span>

          {hasUrgent ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 border border-red-200 animate-pulse">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Urgent Review</span>
            </span>
          ) : isMissingDemo ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Missing Demographics</span>
            </span>
          ) : hasAbnormal ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Needs Review</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Within Normal Limits</span>
            </span>
          )}
        </div>

        {/* Title & Patient Metadata */}
        <div>
          <h4 className="font-display text-xl font-bold text-foreground group-hover:text-primary transition-colors">
            {report.name}
          </h4>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>Patient: <strong className="text-foreground">{report.patient.name}</strong></span>
            <span>•</span>
            <span className="font-mono">{report.patient.id}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(report.collectedOn)}
            </span>
          </div>
        </div>

        {/* "What This Report Is" Explanation Box (Highlighted in soft blue/slate) */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-xs leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-blue-900">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span>What this test measures:</span>
          </div>
          <p className="text-slate-700 leading-normal">
            {explanation}
          </p>
        </div>

        {/* Analyte Results Preview Pills */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Tested Biomarkers:</span>
            <span>{results.length} total</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {results.slice(0, 4).map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1 rounded-lg border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    r.status === "normal"
                      ? "bg-normal"
                      : r.status === "urgent"
                      ? "bg-urgent"
                      : r.status === "unclassified"
                      ? "bg-unclassified"
                      : "bg-abnormal"
                  }`}
                />
                <span>{r.testName ?? r.reportedAs}:</span>
                <strong className="num">{r.value} {r.unit}</strong>
              </span>
            ))}
            {results.length > 4 && (
              <span className="inline-flex items-center rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground font-medium">
                +{results.length - 4} more
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Action Button */}
      <div className="pt-5 mt-5 border-t border-slate-100">
        <Button asChild variant="hero" size="sm" className="w-full justify-between rounded-xl">
          <Link to="/reports/$reportId" params={{ reportId: report.id }}>
            <span>Explore Plain-Language Report</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

export function RecentReports({ reports }: { reports: LabReport[] }) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow text-primary">Patient Portal</span>
          <h3 className="mt-1 font-display text-2xl font-bold sm:text-3xl text-navy">
            Recent Laboratory Reports
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Clear plain-language explanations of your latest medical test results.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-primary hover:bg-primary/10 font-semibold">
          <Link to="/reports">
            View all reports <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      {/* Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </section>
  );
}

export function ReportList({ reports }: { reports: LabReport[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}
