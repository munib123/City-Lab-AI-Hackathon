import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MedicalGlossary } from "@/components/glossary/MedicalGlossary";
import { GLOSSARY } from "@/data/glossary";

interface GlossarySearch {
  q?: string | undefined;
  letter?: string | undefined;
}

export const Route = createFileRoute("/glossary")({
  validateSearch: (search: Record<string, unknown>): GlossarySearch => ({
    q: typeof search["q"] === "string" && search["q"] ? search["q"] : undefined,
    letter: typeof search["letter"] === "string" && /^[A-Z]$/.test(search["letter"]) ? search["letter"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Medical Glossary — LabSense AI" },
      { name: "description", content: "Plain-language explanations of common lab tests like hemoglobin, glucose, creatinine, ALT and TSH." },
      { property: "og:title", content: "Medical Glossary — LabSense AI" },
      { property: "og:description", content: "Plain-language explanations of common lab tests like hemoglobin, glucose, creatinine, ALT and TSH." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GlossaryPage,
});

function GlossaryPage() {
  const { q, letter } = Route.useSearch();
  const navigate = useNavigate({ from: "/glossary" });
  return (
    <div className="mx-auto max-w-[1100px] space-y-8">
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="eyebrow text-primary">Knowledge library</p>
          <h2 className="mt-2 font-display text-4xl font-light sm:text-5xl">
            Medical <span className="font-semibold">Glossary</span>
          </h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Lab terms in everyday words. Entries come from the provided medical glossary document (fictional demo version).
          </p>
        </div>
        <p className="font-display text-sm text-muted-foreground">
          <span className="text-4xl font-light text-foreground num">{GLOSSARY.length}</span> terms
        </p>
      </div>
      <MedicalGlossary
        query={q ?? ""}
        letter={letter}
        onQuery={(value) => navigate({ search: (s) => ({ ...s, q: value || undefined }), replace: true })}
        onLetter={(l) => navigate({ search: (s) => ({ ...s, letter: l }), replace: true })}
      />
    </div>
  );
}
