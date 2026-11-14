import { ChevronDown } from "lucide-react";
import type { AnalyzedResult, SourceId } from "@/data/types";
import { GLOSSARY_BY_ID } from "@/data/glossary";
import { CANNOT_CLASSIFY, NOT_IN_FILES, STATUS_LABEL, explainMeaning } from "@/lib/analysis";
import { ReferenceRangeBar } from "./ReferenceRangeBar";
import { SourceChip } from "./SourceChip";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

const ACCENT: Record<AnalyzedResult["status"], string> = {
  normal: "before:bg-normal",
  low: "before:bg-abnormal",
  high: "before:bg-abnormal",
  urgent: "before:bg-urgent",
  unclassified: "before:bg-unclassified",
};

function sourceDetail(r: AnalyzedResult, id: SourceId): string | undefined {
  if (id === "patient-report") return `Printed as “${r.reportedAs}”: ${r.value} ${r.unit}`;
  if (id === "normal-range-sheet" && r.range) return `${r.range.sheetRef} · ${r.range.population}`;
  if (id === "dangerous-values" && r.urgentRule) return `${r.urgentRule.ruleRef}`;
  if (id === "medical-glossary" && r.glossaryId) return `Entry: ${GLOSSARY_BY_ID[r.glossaryId]?.term}`;
  return undefined;
}

interface Props {
  result: AnalyzedResult;
  open: boolean;
  onToggle: () => void;
}

export function TestResultItem({ result: r, open, onToggle }: Props) {
  const glossary = r.glossaryId ? GLOSSARY_BY_ID[r.glossaryId] : undefined;
  const name = r.testName ?? r.reportedAs;
  const panelId = `panel-${r.id}`;

  const qa = [
    { q: "What does this test measure?", a: glossary?.simple ?? NOT_IN_FILES },
    { q: "What does your result mean?", a: explainMeaning(r) },
    {
      q: `Why is it marked “${STATUS_LABEL[r.status].toLowerCase()}”?`,
      a: r.status === "unclassified" ? `${CANNOT_CLASSIFY} ${r.reason}` : r.reason,
    },
    {
      q: "Which reference range was used?",
      a: r.range
        ? `${r.range.low}–${r.range.high} ${r.range.unit} for ${r.range.population.toLowerCase()} (normal-range sheet, ${r.range.sheetRef}).`
        : "No range was applied. The analysis does not guess a range when the provided files do not support one.",
    },
  ];

  return (
    <article
      id={`result-${r.id}`}
      className={cn(
        "relative scroll-mt-24 overflow-hidden bg-card transition-colors before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        ACCENT[r.status],
        open && "bg-icy/40",
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-4 text-left transition-colors hover:bg-icy/60 md:grid-cols-[1.6fr_1fr_1.2fr_auto_auto] md:px-6"
      >
        <span className="min-w-0">
          <span className="block font-semibold">{name}</span>
          {r.testName && r.reportedAs.toLowerCase() !== r.testName.toLowerCase() && (
            <span className="block text-xs text-muted-foreground">Reported as “{r.reportedAs}”</span>
          )}
        </span>
        <span className="order-3 col-span-2 flex items-baseline gap-1 md:order-none md:col-span-1">
          <span className="font-display text-xl font-semibold num">{r.value}</span>
          <span className="text-xs text-muted-foreground">{r.unit}</span>
        </span>
        <span className="order-4 col-span-2 text-xs text-muted-foreground num md:order-none md:col-span-1 md:text-sm">
          {r.range ? (
            <>
              <span className="md:hidden">Range </span>
              {r.range.low}–{r.range.high} {r.range.unit}
            </>
          ) : (
            <span className="italic">No applicable range</span>
          )}
        </span>
        <StatusBadge status={r.status} className="justify-self-end" />
        <ChevronDown
          className={cn("hidden h-4 w-4 text-muted-foreground transition-transform duration-300 md:block", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      <div
        id={panelId}
        className={cn("grid transition-[grid-template-rows] duration-400 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
      >
        <div className="overflow-hidden">
          <div className="space-y-6 px-5 pb-6 pt-1 md:px-6">
            {r.range ? (
              <div className="rounded-xl border bg-card p-4 sm:px-6">
                <ReferenceRangeBar result={r} />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-unclassified bg-unclassified-soft p-4 text-sm">
                <p className="font-semibold text-unclassified-ink">{CANNOT_CLASSIFY}</p>
                <p className="mt-1 text-muted-foreground">{r.reason}</p>
              </div>
            )}

            <dl className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {qa.map(({ q, a }, i) => (
                <div key={q}>
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                    <span className="num">0{i + 1}</span> {q}
                  </dt>
                  <dd className={cn("mt-1.5 text-sm leading-relaxed", a === NOT_IN_FILES && "italic text-muted-foreground")}>{a}</dd>
                </div>
              ))}
            </dl>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                <span className="num">05</span> Supporting source documents
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {r.sources.map((s) => (
                  <SourceChip key={s} id={s} detail={sourceDetail(r, s)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
