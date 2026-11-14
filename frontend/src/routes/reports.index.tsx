import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Search, UploadCloud, FlaskConical, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportList } from "@/components/dashboard/RecentReports";
import { DEMO_PATIENT_ID, DEMO_REPORTS } from "@/data/demo-reports";

export const Route = createFileRoute("/reports/")({
  head: () => ({
    meta: [
      { title: "My Reports — LabSense AI" },
      {
        name: "description",
        content: "All of your analyzed laboratory reports, with plain-language explanations for every result.",
      },
      { property: "og:title", content: "My Reports — LabSense AI" },
      { property: "og:description", content: "All of your analyzed laboratory reports, with plain-language explanations for every result." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyReports,
});

function MyReports() {
  const [q, setQ] = useState("");
  const patientReports = DEMO_REPORTS.filter((r) => r.patient.id === DEMO_PATIENT_ID);
  const reports = q.trim()
    ? DEMO_REPORTS.filter((r) =>
        r.name.toLowerCase().includes(q.trim().toLowerCase()) ||
        r.patient.name.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : patientReports;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      {/* Top Banner linking to dedicated Benchmark Suite */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm text-xs sm:text-sm">
        <div className="flex items-center gap-2.5">
          <FlaskConical className="h-5 w-5 text-primary shrink-0" />
          <span className="text-slate-800 font-medium">
            Evaluating Tech Fusion ’26? All 14 CityLab edge-case encounters are organized in the separate Benchmark Suite.
          </span>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-full bg-white hover:bg-blue-100 text-xs font-semibold">
          <Link to="/test-cases">
            View Official Test Cases (P001–P014) <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">Patient {DEMO_PATIENT_ID}</p>
          <h2 className="mt-2 font-display text-3xl font-light sm:text-4xl text-navy">
            My <span className="font-semibold">Reports</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Personal laboratory panels for Alice Smith. Only records for this active patient context are listed.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search reports..."
              className="h-11 w-56 rounded-full border bg-card pl-9 pr-4 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <Button asChild variant="hero" size="pill">
            <Link to="/upload">
              <UploadCloud /> Upload Report
            </Link>
          </Button>
        </div>
      </div>

      {reports.length ? (
        <ReportList reports={reports} />
      ) : (
        <p className="rounded-2xl border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No reports match “{q}”.
        </p>
      )}
    </div>
  );
}
