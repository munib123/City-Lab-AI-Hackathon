import { CheckCircle2, CircleDashed, FileText } from "lucide-react";
import type { AnalyzedResult } from "@/data/types";
import { SOURCE_DOCUMENTS, SOURCE_ORDER } from "@/data/sources";
import { cn } from "@/lib/utils";

export function SourceDocuments({ results }: { results: AnalyzedResult[] }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">Source Documents</h3>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Only these</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Every explanation comes from these files. If they don't cover something, LabSense says so instead of guessing.
      </p>
      <ul className="mt-4 space-y-1">
        {SOURCE_ORDER.map((id) => {
          const doc = SOURCE_DOCUMENTS[id];
          const used = results.filter((r) => r.sources.includes(id)).length;
          return (
            <li key={id} className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{doc.title}</p>
                <p className="text-xs text-muted-foreground">{doc.version}</p>
              </div>
              <span className={cn("flex items-center gap-1 text-xs font-semibold num", used ? "text-normal-ink" : "text-muted-foreground")}>
                {used ? <CheckCircle2 className="h-3.5 w-3.5" /> : <CircleDashed className="h-3.5 w-3.5" />}
                {used ? `${used} used` : "Not needed"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
