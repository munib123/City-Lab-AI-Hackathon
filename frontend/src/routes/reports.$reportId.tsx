import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { FileQuestion, Info, AlertTriangle, Check, MessageSquare, X } from "lucide-react";
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
import { ClinicalHighlightsBoard } from "@/components/report/ClinicalHighlightsBoard";
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
    const title = loaderData ? `${loaderData.report.name} — LabSense AI` : "Report unavailable — LabSense AI";
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
      <h2 className="mt-4 font-display text-2xl font-semibold">Report not available</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This report doesn't exist or is locked under patient privacy directives.
      </p>
      <Link to="/reports" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
        Back to My Reports
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
  const [chatOpen, setChatOpen] = useState(false);

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
      {/* Patient Header */}
      <ReportHeader report={activeReport} onDownload={() => downloadReportSummary(activeReport, results, questions)} />

      {/* Interactive Missing Demographics Resolver (Sleek Alert) */}
      {isMissingDemographics && (
        <div className="rounded-2xl border border-abnormal bg-abnormal-soft p-5 text-sm space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-abnormal-ink shrink-0" />
            <h3 className="font-semibold text-foreground">
              Missing Patient Demographics (Age / Biological Sex Required)
            </h3>
          </div>
          <p className="text-muted-foreground">
            In accordance with CityLab reference range rules, the engine will not guess. Enter the patient's demographics below to apply the correct reference intervals:
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

      {/* Urgent Alerts */}
      {urgent.map((r) => (
        <UrgentAlert key={r.id} result={r} onReview={() => review(r.id)} />
      ))}

      {/* Summary Cards */}
      <ReportSummary counts={counts} />

      {/* Main Results Table & Right Sidebar */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="font-display text-xl font-semibold">Individual results</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Verified against CityLab reference intervals. Select a test to see its explanation.
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
              <Info className="h-4 w-4 text-primary" /> When files don't cover it
            </p>
            <p className="mt-2">
              Results show <span className="font-semibold text-foreground">“{CANNOT_CLASSIFY}”</span> when an analyte is absent from reference sheets, has an unconvertible unit, or demographics are missing.
            </p>
          </div>
        </aside>
      </div>

      {/* Clinical Highlights Board (Inspired by presentation design: Medallions + Journey Roadmap) */}
      <ClinicalHighlightsBoard report={activeReport} results={results} />

      {/* Doctor Questions */}
      <DoctorQuestions questions={questions} />

      {/* Floating Ask CityLab AI Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!chatOpen ? (
          <Button
            size="lg"
            variant="hero"
            onClick={() => setChatOpen(true)}
            className="rounded-full shadow-elevated flex items-center gap-2 px-5 py-6 text-sm font-semibold"
          >
            <MessageSquare className="h-5 w-5" />
            <span>Ask CityLab Assistant</span>
          </Button>
        ) : (
          <div className="w-[380px] sm:w-[440px] max-h-[85vh] overflow-hidden rounded-2xl border bg-card shadow-elevated flex flex-col">
            <div className="flex items-center justify-between p-3.5 border-b bg-muted/50">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-normal animate-pulse" />
                <span className="text-xs font-semibold text-foreground">CityLab Grounded Assistant</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3 overflow-y-auto max-h-[70vh]">
              <CityLabAssistantChat report={activeReport} results={results} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
