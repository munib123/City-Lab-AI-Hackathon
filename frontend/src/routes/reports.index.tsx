import { useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, FlaskConical, Lock, Search, ShieldCheck, UploadCloud, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReportList } from "@/components/dashboard/RecentReports";
import { DEMO_REPORTS } from "@/data/demo-reports";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/reports/")({
  head: () => ({
    meta: [
      { title: "My Reports — CityLab AI" },
      {
        name: "description",
        content: "All of your analyzed laboratory reports, with plain-language explanations for every result.",
      },
      { property: "og:title", content: "My Reports — CityLab AI" },
      {
        property: "og:description",
        content: "All of your analyzed laboratory reports, with plain-language explanations for every result.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyReports,
});

function MyReports() {
  const [q, setQ] = useState("");
  const { user, openAuthModal, switchUser } = useAuth();

  // Strict Multi-User Data Isolation: filter only by authenticated patient ID
  const patientReports = user
    ? DEMO_REPORTS.filter((r) => r.patient.id === user.patientId)
    : [];

  const reports = q.trim()
    ? patientReports.filter((r) => r.name.toLowerCase().includes(q.trim().toLowerCase()))
    : patientReports;

  if (!user) {
    return (
      <div className="mx-auto max-w-md py-16 text-center space-y-4">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-navy">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold text-navy">Authentication Required</h2>
        <p className="text-sm text-slate-500 leading-relaxed">
          Under CityLab Patient Privacy Directives, medical laboratory records are strictly protected. Please sign in to view your reports.
        </p>
        <div className="pt-2">
          <Button onClick={openAuthModal} variant="hero" size="pill">
            Sign In with Google or Email
          </Button>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Authenticated Patient: {user.name} ({user.patientId})</span>
          </div>
          <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl text-navy">
            My Reports
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Personal laboratory panels for {user.name}. Only records verified under your active patient identity are accessible.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search my reports..."
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

      {reports.length > 0 ? (
        <ReportList reports={reports} />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-4">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
            <UploadCloud className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-navy">No Reports Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {q.trim()
              ? `No laboratory panels match "${q}" under ${user.name}'s account.`
              : `There are currently no uploaded reports on file for ${user.name} (${user.patientId}).`}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button asChild variant="hero" size="sm" className="rounded-full">
              <Link to="/upload">Upload First Report</Link>
            </Button>
            <Button onClick={openAuthModal} variant="outline" size="sm" className="rounded-full">
              Switch Demo Persona
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
