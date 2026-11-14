import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileQuestion,
  FlaskConical,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DEMO_REPORTS } from "@/data/demo-reports";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/test-cases")({
  head: () => ({
    meta: [
      { title: "CityLab Benchmark Test Cases — Tech Fusion ’26" },
      {
        name: "description",
        content: "All 14 official CityLab patient test cases evaluating deterministic rule adherence.",
      },
    ],
  }),
  component: TestCasesDirectory,
});

interface TestCaseMeta {
  id: string;
  category: "urgent" | "boundary" | "missing_demo" | "conversion" | "unclassified" | "normal";
  categoryLabel: string;
  badgeTone: "urgent" | "warning" | "purple" | "blue" | "emerald";
  testedRule: string;
  expectedOutcome: string;
}

const TEST_CASES_META: Record<string, TestCaseMeta> = {
  "report-P001": {
    id: "report-P001",
    category: "normal",
    categoryLabel: "Baseline Normal",
    badgeTone: "emerald",
    testedRule: "Standard Adult Female CBC Reference Sheet",
    expectedOutcome: "All hematology parameters fall safely within biological intervals (Normal).",
  },
  "report-P002": {
    id: "report-P002",
    category: "boundary",
    categoryLabel: "Exact Boundary Limit",
    badgeTone: "blue",
    testedRule: "Inclusive Upper Bound Rule (ALT = 45 U/L for Female 35y)",
    expectedOutcome: "Value 45 sits exactly on the 45 limit. Inclusive rule classifies as Normal.",
  },
  "report-P003": {
    id: "report-P003",
    category: "missing_demo",
    categoryLabel: "Missing Demographics",
    badgeTone: "warning",
    testedRule: "CityLab Rule 3: Missing Age & Biological Sex",
    expectedOutcome: "Refuses to guess demographics; marks 'cannot be classified' until resolved.",
  },
  "report-P004": {
    id: "report-P004",
    category: "urgent",
    categoryLabel: "Critical Urgent Low",
    badgeTone: "urgent",
    testedRule: "Dangerous Life-Safety Threshold: Hemoglobin < 7.0 g/dL",
    expectedOutcome: "Triggers red urgent alert banner with 'see a doctor today' advisory.",
  },
  "report-P005": {
    id: "report-P005",
    category: "conversion",
    categoryLabel: "Metric Unit Conversion",
    badgeTone: "blue",
    testedRule: "Unit Matching: Glucose in mmol/L -> mg/dL (* 18.0182)",
    expectedOutcome: "Converts 6.0 mmol/L to 108.1 mg/dL; classifies as High with math note.",
  },
  "report-P006": {
    id: "report-P006",
    category: "unclassified",
    categoryLabel: "Out-of-Scope Biomarker",
    badgeTone: "purple",
    testedRule: "Closed-Corpus Restriction: S_Ferritin not in files",
    expectedOutcome: "Admits lack of data: 'cannot be classified from the files' with zero guessing.",
  },
  "report-P007": {
    id: "report-P007",
    category: "normal",
    categoryLabel: "Endocrine Thyroid",
    badgeTone: "emerald",
    testedRule: "Thyroid Panel (TSH 2.8 mIU/L, Free T4 1.2 ng/dL)",
    expectedOutcome: "Evaluated against thyroid sheet; both tests within normal physiological range.",
  },
  "report-P008": {
    id: "report-P008",
    category: "normal",
    categoryLabel: "Qualitative Non-Numeric",
    badgeTone: "emerald",
    testedRule: "Urinalysis: Urine Protein = 'Negative'",
    expectedOutcome: "Correctly evaluates qualitative string test as Normal without parser crash.",
  },
  "report-P009": {
    id: "report-P009",
    category: "boundary",
    categoryLabel: "Elevated Enzyme",
    badgeTone: "warning",
    testedRule: "Hepatic Cytolysis: ALT = 120 U/L (> 45)",
    expectedOutcome: "Classifies as High; provides Grade-8 liver explanation without disease diagnosis.",
  },
  "report-P010": {
    id: "report-P010",
    category: "boundary",
    categoryLabel: "Exact Boundary Limit",
    badgeTone: "blue",
    testedRule: "Lipid Desirable Limit: Total Cholesterol = 200 mg/dL",
    expectedOutcome: "Border value 200 mg/dL classified as Normal (Desirable is <= 200).",
  },
  "report-P011": {
    id: "report-P011",
    category: "normal",
    categoryLabel: "Comprehensive CBC",
    badgeTone: "emerald",
    testedRule: "Multi-parameter Hematology (RBC, HCT, Platelets)",
    expectedOutcome: "Calculates individual ranges across multiple blood counts accurately.",
  },
  "report-P012": {
    id: "report-P012",
    category: "missing_demo",
    categoryLabel: "Missing Biological Sex",
    badgeTone: "warning",
    testedRule: "Gender-Dependent Enzyme (AST) without Sex",
    expectedOutcome: "Halts classification for sex-dependent biomarker; prompts user for sex.",
  },
  "report-P013": {
    id: "report-P013",
    category: "urgent",
    categoryLabel: "Critical Urgent High",
    badgeTone: "urgent",
    testedRule: "Dangerous Life-Safety Threshold: Glucose > 300 mg/dL",
    expectedOutcome: "Triggers red urgent alert banner (340 mg/dL > 300) with emergency warning.",
  },
  "report-P014": {
    id: "report-P014",
    category: "conversion",
    categoryLabel: "Multiple Clinical Synonyms",
    badgeTone: "blue",
    testedRule: "Dual Aliases in Single Panel: FBS -> Glucose, SGOT -> AST",
    expectedOutcome: "Canonicalizes both abbreviations seamlessly and classifies both as Normal.",
  },
};

const CATEGORIES = [
  { id: "all", label: "All 14 Cases", count: 14 },
  { id: "urgent", label: "🚨 Urgent Alerts", count: 2 },
  { id: "boundary", label: "⚖️ Boundary Limits", count: 3 },
  { id: "missing_demo", label: "❓ Missing Demographics", count: 2 },
  { id: "conversion", label: "🔄 Units & Aliases", count: 2 },
  { id: "unclassified", label: "🛡️ Unclassified", count: 1 },
  { id: "normal", label: "✅ Standard Normal", count: 4 },
] as const;

function TestCasesDirectory() {
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const filtered = DEMO_REPORTS.filter((r) => {
    const meta = TEST_CASES_META[r.id];
    if (!meta) return true;

    if (selectedCat !== "all" && meta.category !== selectedCat) {
      return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchText = `${r.patient.name} ${r.id} ${r.name} ${meta.testedRule} ${meta.expectedOutcome}`.toLowerCase();
      return matchText.includes(q);
    }

    return true;
  });

  return (
    <div className="mx-auto max-w-[1280px] space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <FlaskConical className="h-4 w-4" />
            <span>Tech Fusion ’26 · Hackathon Evaluation Suite</span>
          </div>
          <h1 className="mt-2 font-display text-3xl font-bold sm:text-4xl text-navy">
            Official CityLab <span className="text-primary">Benchmark Test Cases</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl leading-relaxed">
            All 14 clinical encounters from the official CityLab corpus (`report_P001` through `report_P014`), specifically designed to evaluate deterministic rule adherence, unit conversions, boundary conditions, and privacy guardrails.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test case or rule..."
            className="h-11 w-64 rounded-full border bg-card pl-9 pr-4 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 shadow-sm"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex flex-wrap gap-2 rounded-2xl border bg-card p-2 shadow-soft">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id)}
            className={cn(
              "rounded-xl px-3.5 py-2 text-xs font-semibold transition-all",
              selectedCat === cat.id
                ? "bg-navy text-navy-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {cat.label} <span className="opacity-70 ml-1">({cat.count})</span>
          </button>
        ))}
      </div>

      {/* Test Cases Grid */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((report) => {
          const meta = TEST_CASES_META[report.id];
          const caseNum = report.id.replace("report-", "");

          let badgeStyle = "bg-blue-100 text-blue-800 border-blue-200";
          if (meta?.badgeTone === "urgent") badgeStyle = "bg-red-100 text-red-800 border-red-200 font-bold animate-pulse";
          if (meta?.badgeTone === "warning") badgeStyle = "bg-amber-100 text-amber-800 border-amber-200";
          if (meta?.badgeTone === "purple") badgeStyle = "bg-purple-100 text-purple-800 border-purple-200";
          if (meta?.badgeTone === "emerald") badgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-200";

          return (
            <div
              key={report.id}
              className="group flex flex-col justify-between rounded-2xl border bg-card p-5 shadow-soft transition-all hover:border-primary/40 hover:shadow-elevated"
            >
              <div className="space-y-3">
                {/* Header line */}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-secondary text-primary">
                    {caseNum}
                  </span>
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", badgeStyle)}>
                    {meta?.categoryLabel ?? "Benchmark"}
                  </span>
                </div>

                {/* Patient & Panel Title */}
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                    {report.patient.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{report.name}</p>
                </div>

                {/* Rule Tested */}
                <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Rule Tested:</div>
                  <div className="font-medium text-foreground leading-snug">{meta?.testedRule}</div>
                </div>

                {/* Expected Outcome */}
                <div className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Expected: </strong>
                  {meta?.expectedOutcome}
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-5 mt-4 border-t">
                <Button asChild variant="hero" size="sm" className="w-full justify-between">
                  <Link to="/reports/$reportId" params={{ reportId: report.id }}>
                    <span>Launch & Inspect Report</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
