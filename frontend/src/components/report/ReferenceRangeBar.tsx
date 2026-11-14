import { useEffect, useState } from "react";
import type { AnalyzedResult } from "@/data/types";
import { STATUS_DOT } from "./StatusBadge";
import { cn } from "@/lib/utils";

/** Compute the displayed scale so the range, the value and any urgent threshold are visible. */
export function rangeScale(low: number, high: number, value: number, threshold?: number) {
  const span = high - low || Math.abs(high) * 0.5 || 1;
  let min = Math.max(0, low - span * 0.6);
  let max = high + span * 0.6;
  const pts = [value, ...(threshold !== undefined ? [threshold] : [])];
  for (const p of pts) {
    if (p < min) min = Math.max(0, p - span * 0.2);
    if (p > max) max = p + span * 0.2;
  }
  const pct = (x: number) => Math.min(100, Math.max(0, ((x - min) / (max - min)) * 100));
  return { min, max, pct };
}

export function ReferenceRangeBar({ result }: { result: AnalyzedResult }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  if (!result.range) return null;
  const { low, high, unit } = result.range;
  const threshold = result.urgentRule?.threshold;
  const { pct } = rangeScale(low, high, result.value, threshold);
  const pLow = pct(low);
  const pHigh = pct(high);
  const pVal = pct(result.value);

  return (
    <figure
      className="w-full"
      aria-label={`${result.testName}: ${result.value} ${result.unit}. Reference range ${low} to ${high} ${unit}.`}
    >
      <div className="relative pt-9 pb-8">
        {/* value marker */}
        <div
          className="absolute top-0 z-10 flex -translate-x-1/2 flex-col items-center transition-[left] duration-1000 ease-out"
          style={{ left: `${mounted ? pVal : 0}%` }}
        >
          <span className="whitespace-nowrap rounded-md bg-navy px-2 py-0.5 text-xs font-semibold text-navy-foreground num">
            {result.value} {result.unit}
          </span>
          <span className="h-[30px] w-px bg-navy" />
          <span className={cn("-mt-[11px] h-3.5 w-3.5 rounded-full border-2 border-card shadow-soft", STATUS_DOT[result.status])} />
        </div>

        {/* track */}
        <div className="relative h-2.5 overflow-hidden rounded-full bg-abnormal-soft ring-1 ring-inset ring-border">
          <div className="absolute inset-y-0 bg-normal/70" style={{ left: `${pLow}%`, width: `${pHigh - pLow}%` }} />
          {threshold !== undefined && (
            <div className="absolute inset-y-0 bg-urgent/70" style={result.urgentRule?.direction === "above" ? { left: `${pct(threshold)}%`, right: 0 } : { left: 0, width: `${pct(threshold)}%` }} />
          )}
        </div>

        {/* region labels */}
        <div className="pointer-events-none absolute inset-x-0 top-[50px] text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="absolute -translate-x-1/2" style={{ left: `${pLow / 2}%` }}>Low</span>
          <span className="absolute -translate-x-1/2 text-normal-ink" style={{ left: `${(pLow + pHigh) / 2}%` }}>Normal</span>
          <span className="absolute -translate-x-1/2" style={{ left: `${(pHigh + 100) / 2}%` }}>High</span>
        </div>

        {/* boundary ticks with real numbers */}
        {[
          { at: pLow, label: `${low}` },
          { at: pHigh, label: `${high}` },
        ].map((t) => (
          <div key={t.label} className="absolute top-[34px] -translate-x-1/2" style={{ left: `${t.at}%` }}>
            <span className="block h-[18px] w-px bg-foreground/30" />
          </div>
        ))}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Reference range used: <span className="font-semibold text-foreground num">{low}–{high} {unit}</span>
        </span>
        {threshold !== undefined && result.urgentRule && (
          <span className="font-semibold text-urgent-ink num">
            Urgent if {result.urgentRule.direction === "above" ? "≥" : "≤"} {threshold} {result.urgentRule.unit}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
