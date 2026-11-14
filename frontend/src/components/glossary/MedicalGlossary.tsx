import { useMemo } from "react";
import { Search } from "lucide-react";
import { GLOSSARY } from "@/data/glossary";
import { NOT_IN_FILES } from "@/lib/analysis";
import { cn } from "@/lib/utils";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface Props {
  query: string;
  letter: string | undefined;
  onQuery: (q: string) => void;
  onLetter: (l: string | undefined) => void;
}

export function MedicalGlossary({ query, letter, onQuery, onLetter }: Props) {
  const available = useMemo(() => new Set(GLOSSARY.map((g) => g.term.charAt(0).toUpperCase())), []);
  const q = query.trim().toLowerCase();
  const entries = GLOSSARY.filter((g) => {
    if (letter && g.term.charAt(0).toUpperCase() !== letter) return false;
    if (!q) return true;
    return [g.term, ...g.aka, g.category].some((s) => s.toLowerCase().includes(q));
  }).sort((a, b) => a.term.localeCompare(b.term));

  return (
    <div className="space-y-6">
      <div className="surface-glass sticky top-20 z-20 space-y-4 rounded-2xl p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search a term or abbreviation — e.g. Hb, SGPT, cholesterol"
            className="h-12 w-full rounded-xl border bg-card pl-11 pr-4 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <div className="flex flex-wrap gap-1" aria-label="Browse alphabetically">
          <button
            type="button"
            onClick={() => onLetter(undefined)}
            className={cn("h-8 rounded-md px-2.5 text-xs font-semibold", !letter ? "bg-navy text-navy-foreground" : "text-muted-foreground hover:bg-muted")}
          >
            All
          </button>
          {LETTERS.map((l) => (
            <button
              key={l}
              type="button"
              disabled={!available.has(l)}
              onClick={() => onLetter(l)}
              className={cn(
                "h-8 w-8 rounded-md text-xs font-semibold transition-colors disabled:cursor-default disabled:opacity-30",
                letter === l ? "bg-navy text-navy-foreground" : "text-foreground hover:bg-muted",
              )}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
          <p className="font-semibold">{NOT_IN_FILES}</p>
          <p className="mt-1 text-sm text-muted-foreground">The medical glossary has no entry matching “{query}”.</p>
        </div>
      ) : (
        <div className="grid gap-px overflow-hidden rounded-2xl border bg-border md:grid-cols-2">
          {entries.map((g) => (
            <article key={g.id} className="group bg-card p-6 transition-colors hover:bg-icy/50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-semibold">{g.term}</h3>
                  {g.aka.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">Also called: {g.aka.join(", ")}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-primary">{g.category}</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed">{g.simple}</p>
              <p className="mt-3 border-t pt-3 text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Why it's tested: </span>
                {g.whyPerformed}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
