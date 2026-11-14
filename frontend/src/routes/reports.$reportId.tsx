import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { FileQuestion, Info, AlertTriangle, Users, Check } from "lucide-react";
import { DEMO_REPORTS, getDemoReport } from "@/data/demo-reports";
import { analyzeReport, countStatuses, CANNOT_CLASSIFY } from "@/lib/analysis";
import { buildDoctorQuestions } from "@/lib/questions";
import { downloadReportSummary } from "@/lib/report-download";
import { useSettings } from "@/lib/settings";
import { ReportHeader } from "@/components/report/ReportHeader";
import { ReportSummary } from "@/components/report/ReportSummary";
import { UrgentAlert } from "@/components/report/UrgentAlert";
import { TestResultItem } from "@/components/report/TestResultItem";
import { DoctorQuestions } from "@/components/report/DoctorQuestions";
import { SourceDocuments } from "@/components/report/SourceDocuments";
import { CityLabAssistantChat } from "@/components/report/CityLabAssistantChat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnalyzedResult, LabReport, Sex } from "@/data/types";

export const Route = createFileRoute("/reports/$reportId")({
  loader: ({ params }) => {
    const report = getDemoReport(params.reportId);
    if (!report) throw notFound();
    return { report };
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.report.name} — CityLab Explainer` : "Report unavailable — CityLab Explainer";
    const description = "Each lab result explained in plain language, with its reference range, source and questions for your doctor.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
      ],
    };
  },
  notFoundComponent: ReportNotFound,
  component: ReportAnalysis,
});

function ReportNotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <FileQuestion className="mx-auto h-10 w-10 text-primary" strokeWidth={1.5} />
      <h2 className="mt-4 font-display text-2xl font-semibold">Report not found</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This report doesn't exist or is locked under patient privacy directives.
      </p>
      <Link to="/reports" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
        Back to Reports Directory
      </Link>
    </div>
  );
}

const FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "attention", label: "Needs attention", match: (r: AnalyzedResult) => ["urgent", "high", "low"].includes(r.status) },
  { id: "normal", label: "Within range", match: (r: AnalyzedResult) => r.status === "normal" },
  { id: "unclassified", label: "Not classified", match: (r: AnalyzedResult) => r.status === "unclassified" },
] as const;

function ReportAnalysis() {
  const { report: initialReport } = Route.useLoaderData();
  const navigate = useNavigate();
  const { settings } = useSettings();

  // Dynamic state allowing user to fulfill missing demographics
  const [activeReport, setActiveReport] = useState<LabReport>(initialReport);
  const [overrideAge, setOverrideAge] = useState<string>(initialReport.patient.age !== null ? String(initialReport.patient.age) : "");
  const [overrideSex, setOverrideSex] = useState<Sex | "">(initialReport.patient.sex ?? "");

  // Sync if route changes
  useEffect(() => {
    setActiveReport(initialReport);
    setOverrideAge(initialReport.patient.age !== null ? String(initialReport.patient.age) : "");
    setOverrideSex(initialReport.patient.sex ?? "");
  }, [initialReport]);

  const results = useMemo(() => analyzeReport(activeReport), [activeReport]);
  const counts = useMemo(() => countStatuses(results), [results]);
  const questions = useMemo(() => buildDoctorQuestions(results), [results]);
  const urgent = results.filter((r) => r.status === "urgent");

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");

  const isMissingDemographics = activeReport.patient.age === null || activeReport.patient.sex === null;

  const handleApplyDemographics = () => {
    const parsedAge = overrideAge ? parseInt(overrideAge, 10) : null;
    const finalAge = !isNaN(parsedAge as number) ? parsedAge : null;
    const finalSex = overrideSex ? (overrideSex as Sex) : null;

    setActiveReport({
      ...activeReport,
      patient: {
        ...activeReport.patient,
        age: finalAge,
        sex: finalSex,
      },
    });
  };

  useEffect(() => {
    setExpanded(
      settings.expandFlaggedByDefault
        ? new Set(results.filter((r) => ["urgent", "high", "low", "unclassified"].includes(r.status)).map((r) => r.id))
        : new Set(),
    );
  }, [settings.expandFlaggedByDefault, results]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const review = (id: string) => {
    setFilter("all");
    setExpanded((prev) => new Set(prev).add(id));
    window.setTimeout(() => document.getElementById(`result-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const active = FILTERS.find((f) => f.id === filter)!;
  const visible = results.filter(active.match);

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      {/* Quick Patient Switcher Bar for Hackathon Demos */}
      <div className="rounded-2xl border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Select CityLab Case (P001 – P014):
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_REPORTS.map((r, idx) => {
              const isCurrent = r.id === activeReport.id;
              const num = String(idx + 1).padStart(2, "0");
              return (
                <button
                  key={r.id}
                  onClick={() => navigate({ to: "/reports/$reportId", params: { reportId: r.id } })}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                    isCurrent
                      ? "bg-primary text-primary-foreground font-bold shadow-sm"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
                  )}
                  title={`${r.patient.name} (${r.name})`}
                >
                  P{num}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <ReportHeader report={activeReport} onDownload={() => downloadReportSummary(activeReport, results, questions)} />

      {/* Interactive Missing Demographics Resolver */}
      {isMissingDemographics && (
        <div className="rounded-2xl border-2 border-amber-500/40 bg-amber-500/10 p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-400 shrink-0" />
            <h3 className="font-display font-semibold text-amber-950 dark:text-amber-200">
              CityLab Missing Demographics Protocol (Rule 3)
            </h3>
          </div>
          <p className="text-sm text-amber-900/90 dark:text-amber-300">
            This patient's report is missing required demographics (
            {activeReport.patient.age === null && "Age"}
            {activeReport.patient.age === null && activeReport.patient.sex === null && " & "}
            {activeReport.patient.sex === null && "Biological Sex"}
            ). The system refuses to guess. Enter the missing demographics below to dynamically select the correct reference range:
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label htmlFor="input-age" className="text-xs font-semibold text-muted-foreground">Age:</label>
              <input
                id="input-age"
                type="number"
                min="18"
                max="100"
                value={overrideAge}
                onChange={(e) => setOverrideAge(e.target.value)}
                placeholder="e.g. 35"
                className="w-24 rounded-lg border bg-card px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="select-sex" className="text-xs font-semibold text-muted-foreground">Sex:</label>
              <select
                id="select-sex"
                value={overrideSex}
                onChange={(e) => setOverrideSex(e.target.value as Sex | "")}
                className="rounded-lg border bg-card px-3 py-1.5 text-sm"
              >
                <option value="">-- Select Sex --</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
            <Button size="sm" variant="hero" onClick={handleApplyDemographics}>
              <Check className="h-4 w-4 mr-1" /> Apply & Classify
            </Button>
          </div>
        </div>
      )}

      {urgent.map((r) => (
        <UrgentAlert key={r.id} result={r} onReview={() => review(r.id)} />
      ))}

      <ReportSummary counts={counts} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-semibold">Individual results</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Verified against CityLab reference intervals. Click any test to view Grade-8 explanation & range bars.
              </p>
            </div>
            <div className="flex flex-wrap gap-1 rounded-full border bg-card p-1" role="tablist" aria-label="Filter results">
              {FILTERS.map((f) => {
                const n = results.filter(f.match).length;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      filter === f.id ? "bg-navy text-navy-foreground" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {f.label} <span className="num opacity-70">{n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border shadow-soft">
            <div className="hidden grid-cols-[1.6fr_1fr_1.2fr_auto_auto] gap-x-4 border-b bg-muted/70 px-6 py-2.5 text-xs font-semibold text-muted-foreground md:grid">
              <span>Test</span>
              <span>Your value</span>
              <span>Reference range</span>
              <span>Classification</span>
              <span className="w-4" />
            </div>
            <div className="divide-y">
              {visible.map((r) => (
                <TestResultItem key={r.id} result={r} open={expanded.has(r.id)} onToggle={() => toggle(r.id)} />
              ))}
              {visible.length === 0 && (
                <p className="bg-card px-6 py-10 text-center text-sm text-muted-foreground">No results in this group.</p>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <SourceDocuments results={results} />
          <div className="rounded-2xl border border-dashed bg-card/60 p-5 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Info className="h-4 w-4 text-primary" /> CityLab File Grounding
            </p>
            <p className="mt-2">
              Results show <span className="font-semibold text-foreground">“{CANNOT_CLASSIFY}”</span> when an analyte is absent from reference sheets, has an unconvertible unit, or demographics are missing.
            </p>
          </div>
        </aside>
      </div>

      {/* Grounded Interactive Q&A Assistant */}
      <CityLabAssistantChat report={activeReport} results={results} />

      <DoctorQuestions questions={questions} />
    </div>
  );
}
