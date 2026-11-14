import { DEMO_REPORTS } from "@/data/demo-reports";
import { analyzeReport } from "@/lib/analysis";
import { buildDoctorQuestions } from "@/lib/questions";
import capsuleImage from "@/assets/navy-capsule.jpg";

/** Demo statistics derived from the fictional reports — not real patient outcomes. */
function getDemoStats() {
  const analyzed = DEMO_REPORTS.map(analyzeReport);
  return [
    { label: "Reports Analyzed", value: DEMO_REPORTS.length, note: "Fictional reports in this demo workspace" },
    { label: "Results Explained", value: analyzed.reduce((n, r) => n + r.length, 0), note: "Each with its range and source shown" },
    { label: "Questions Prepared", value: analyzed.reduce((n, r) => n + buildDoctorQuestions(r).length, 0), note: "Built only from out-of-range results" },
  ];
}

export function StatsOverview() {
  const stats = getDemoStats();
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] surface-navy p-6 sm:p-10">
      <img
        src={capsuleImage}
        alt=""
        aria-hidden="true"
        loading="lazy"
        width={1536}
        height={864}
        className="absolute inset-y-0 right-0 -z-10 h-full w-full object-cover object-right mask-fade-left-strong opacity-60"
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-navy-muted">Workspace activity</p>
          <h3 className="mt-2 max-w-md font-display text-2xl font-medium sm:text-3xl">Clarity, one result at a time.</h3>
        </div>
        <span className="rounded-full border border-navy-foreground/20 px-3 py-1 text-xs font-semibold text-navy-muted">Demo values</span>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {stats.map((s, i) => (
          <div key={s.label} className="surface-glass-navy relative rounded-2xl p-5">
            <p className="text-sm font-semibold">{s.label}</p>
            <p className="mt-6 font-display text-5xl font-light num">{s.value}</p>
            <p className="mt-2 text-xs text-navy-muted">{s.note}</p>
            <span className="absolute right-5 top-5 font-display text-sm text-navy-muted num">0{i + 1}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
