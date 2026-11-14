import type { StatusCounts } from "@/lib/analysis";
import { cn } from "@/lib/utils";

const ITEMS = [
  { key: "normal", label: "Within range", dot: "bg-normal", bar: "bg-normal" },
  { key: "low", label: "Low", dot: "bg-abnormal", bar: "bg-abnormal/70" },
  { key: "high", label: "High", dot: "bg-abnormal", bar: "bg-abnormal" },
  { key: "urgent", label: "Urgent", dot: "bg-urgent", bar: "bg-urgent" },
  { key: "unclassified", label: "Not classified", dot: "bg-unclassified", bar: "bg-unclassified" },
] as const;

/** Counts only — deliberately no health score or diagnosis. */
export function ReportSummary({ counts }: { counts: StatusCounts }) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border bg-card p-6 shadow-soft sm:p-8">
      <div className="pointer-events-none absolute inset-0 grid-lab opacity-60 [mask-image:linear-gradient(180deg,black,transparent_70%)]" />
      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-primary">Summary</p>
          <h2 className="mt-2 font-display text-3xl font-light sm:text-4xl">
            Your Report <span className="font-semibold">at a Glance</span>
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            A count of how each result compares with the provided reference ranges. It is not a health score.
          </p>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-7xl font-light leading-none num">{counts.total}</span>
          <span className="text-sm font-semibold text-muted-foreground">total tests</span>
        </div>
      </div>

      <div className="relative mt-8 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {ITEMS.map((i) =>
          counts[i.key] > 0 ? (
            <span key={i.key} className={cn("h-full transition-all duration-700", i.bar)} style={{ flexGrow: counts[i.key] }} />
          ) : null,
        )}
      </div>

      <dl className="relative mt-6 grid grid-cols-2 gap-y-5 sm:grid-cols-5">
        {ITEMS.map((i) => (
          <div key={i.key} className="border-l pl-4 first:border-l-0 first:pl-0 sm:first:pl-0 [&:nth-child(3)]:border-l-0 [&:nth-child(3)]:pl-0 sm:[&:nth-child(3)]:border-l sm:[&:nth-child(3)]:pl-4 [&:nth-child(5)]:border-l-0 [&:nth-child(5)]:pl-0 sm:[&:nth-child(5)]:border-l sm:[&:nth-child(5)]:pl-4">
            <dt className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", i.dot)} />
              {i.label}
            </dt>
            <dd className={cn("mt-1 font-display text-3xl font-semibold num", i.key === "urgent" && counts.urgent > 0 && "text-urgent-ink")}>
              {counts[i.key]}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
