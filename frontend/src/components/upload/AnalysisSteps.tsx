import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const ANALYSIS_STEPS = [
  { title: "Read the report", body: "Text is read from your PDF or image." },
  { title: "Identify tests, values and units", body: "Different names for the same test are matched." },
  { title: "Match reference ranges", body: "Using the provided age- and sex-specific ranges." },
  { title: "Classify with safety rules", body: "Urgent only when the supplied guidance says so." },
  { title: "Explain in simple language", body: "Short, clear, respectful wording." },
  { title: "Prepare doctor questions", body: "Based only on what this report shows." },
];

/** activeStep: -1 = idle list, 0..n-1 = running, n = all done. */
export function AnalysisSteps({ activeStep = -1, className }: { activeStep?: number; className?: string }) {
  return (
    <ol className={cn("relative space-y-1", className)}>
      {ANALYSIS_STEPS.map((s, i) => {
        const done = activeStep > i;
        const running = activeStep === i;
        return (
          <li key={s.title} className="relative flex gap-4 pb-4 last:pb-0">
            {i < ANALYSIS_STEPS.length - 1 && (
              <span className={cn("absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px", done ? "bg-normal" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative grid h-8 w-8 shrink-0 place-items-center rounded-full border text-xs font-bold num transition-all duration-500",
                done && "border-normal bg-normal text-navy",
                running && "border-primary bg-card text-primary shadow-glow",
                !done && !running && "bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
              {running && <span className="absolute inset-0 animate-ping rounded-full border border-primary/40" />}
            </span>
            <div className="pt-1">
              <p className={cn("text-sm font-semibold", running && "text-primary")}>{s.title}</p>
              <p className="text-xs text-muted-foreground">{s.body}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
