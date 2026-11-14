import { AlertTriangle, ArrowDownRight } from "lucide-react";
import type { AnalyzedResult } from "@/data/types";
import { SOURCE_DOCUMENTS } from "@/data/sources";

/** Shown only when a result matches a threshold in the dangerous-value guidance. */
export function UrgentAlert({ result, onReview }: { result: AnalyzedResult; onReview: () => void }) {
  const rule = result.urgentRule;
  if (!rule) return null;
  return (
    <section role="alert" className="relative overflow-hidden rounded-2xl border border-urgent bg-urgent-soft">
      <div className="absolute inset-y-0 left-0 w-1 bg-urgent" />
      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
        <div className="flex gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-urgent text-navy">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-urgent-ink">Urgent value identified</h3>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-foreground">
              This result matches an urgent threshold in the provided safety guidance. Please seek medical attention promptly.
            </p>
            <button
              type="button"
              onClick={onReview}
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-urgent-ink underline-offset-4 hover:underline"
            >
              Review this result <ArrowDownRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-urgent/50 bg-urgent/30 text-sm">
          {[
            ["Test", result.testName ?? result.reportedAs],
            ["Observed value", `${result.value} ${result.unit}`],
            ["Urgent threshold", `${rule.direction === "above" ? "≥" : "≤"} ${rule.threshold} ${rule.unit}`],
            ["Safety rule source", `${SOURCE_DOCUMENTS["dangerous-values"].title}, ${rule.ruleRef}`],
          ].map(([k, v]) => (
            <div key={k} className="bg-card/90 px-4 py-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="mt-0.5 font-semibold num">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
