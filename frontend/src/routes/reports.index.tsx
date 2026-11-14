import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Search, UploadCloud, ShieldCheck, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportList } from "@/components/dashboard/RecentReports";
import { DEMO_REPORTS } from "@/data/demo-reports";

export const Route = createFileRoute("/reports/")({
  head: () => ({
    meta: [
      { title: "CityLab Corpus Directory — Problem Statement B" },
      { name: "description", content: "All 14 verified patient cases from CityLab Diagnostics test corpus." },
    ],
  }),
  component: MyReports,
});

function MyReports() {
  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<"all" | "urgent" | "edge" | "normal">("all");

  const filtered = DEMO_REPORTS.filter((r) => {
    const text = `${r.name} ${r.patient.name ?? ""} ${r.notes ?? ""}`.toLowerCase();
    const matchesQ = text.includes(q.trim().toLowerCase());
    if (!matchesQ) return false;

    if (filterType === "urgent") {
      return r.id === "report-P004" || r.id === "report-P013";
    }
    if (filterType === "edge") {
      return (
        r.id === "report-P002" ||
        r.id === "report-P003" ||
        r.id === "report-P005" ||
        r.id === "report-P006" ||
        r.id === "report-P010" ||
        r.id === "report-P012"
      );
    }
    if (filterType === "normal") {
      return r.id === "report-P001" || r.id === "report-P007" || r.id === "report-P014";
    }
    return true;
  });

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">CityLab Diagnostics Corpus</p>
          <h2 className="mt-2 font-display text-3xl font-light sm:text-4xl">
            Official <span className="font-semibold">Case Directory</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete dataset of 14 patient encounters testing every rulebook edge case.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search patient, marker..."
              className="h-11 w-56 rounded-full border bg-card pl-9 pr-4 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <Button asChild variant="hero" size="pill">
            <Link to="/upload">
              <UploadCloud /> Upload New Report
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterType("all")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            filterType === "all" ? "bg-primary text-primary-foreground" : "bg-card border text-muted-foreground hover:text-foreground"
          }`}
        >
          All Cases (14)
        </button>
        <button
          onClick={() => setFilterType("urgent")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            filterType === "urgent" ? "bg-red-600 text-white" : "bg-card border text-muted-foreground hover:text-foreground"
          }`}
        >
          🚨 Urgent Critical (P004, P013)
        </button>
        <button
          onClick={() => setFilterType("edge")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            filterType === "edge" ? "bg-amber-600 text-white" : "bg-card border text-muted-foreground hover:text-foreground"
          }`}
        >
          ⚡ Tricky Edge Cases (Unit Conv, Missing Demographics, Boundary)
        </button>
        <button
          onClick={() => setFilterType("normal")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
            filterType === "normal" ? "bg-emerald-600 text-white" : "bg-card border text-muted-foreground hover:text-foreground"
          }`}
        >
          ✅ All Normal Cases
        </button>
      </div>

      {filtered.length ? (
        <ReportList reports={filtered} />
      ) : (
        <p className="rounded-2xl border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No reports match this search criteria.
        </p>
      )}
    </div>
  );
}
