import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Ban, FileSearch, Languages, Ruler, Scale, UserRoundX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnalysisSteps } from "@/components/upload/AnalysisSteps";
import { SOURCE_DOCUMENTS, SOURCE_ORDER } from "@/data/sources";
import { CANNOT_CLASSIFY, NOT_IN_FILES } from "@/lib/analysis";
import capsuleImage from "@/assets/navy-capsule.jpg";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — LabSense AI" },
      { name: "description", content: "How LabSense AI reads a lab report, matches reference ranges, flags urgent values and explains results using only provided files." },
      { property: "og:title", content: "How It Works — LabSense AI" },
      { property: "og:description", content: "How LabSense AI reads a lab report, matches reference ranges, flags urgent values and explains results using only provided files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowItWorks,
});

const EDGE_CASES = [
  { icon: Languages, title: "Different names, same test", body: "“Hb”, “Hgb” and “Haemoglobin” are all matched to Hemoglobin using the provided name list." },
  { icon: Ruler, title: "Different units", body: "If the report's unit differs from the sheet and no conversion rule exists, the value is not converted or classified." },
  { icon: UserRoundX, title: "Missing age or sex", body: "When the right range depends on age or sex and it isn't stated, no range is picked." },
  { icon: Scale, title: "Age and sex boundaries", body: "Age limits are applied exactly as written in the sheet — someone who is 65 uses the 65+ row." },
  { icon: FileSearch, title: "Missing reference ranges", body: "Tests absent from the normal-range sheet are shown, explained if possible, and left unclassified." },
  { icon: Ban, title: "No invented thresholds", body: "A result is only ever “urgent” if the dangerous-value guidance contains that exact rule." },
];

function HowItWorks() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-10">
      <section className="relative isolate overflow-hidden rounded-[2rem] surface-navy p-6 sm:p-12">
        <img src={capsuleImage} alt="" aria-hidden="true" width={1536} height={864} className="absolute inset-0 -z-10 h-full w-full object-cover object-right mask-fade-left-strong" />
        <p className="eyebrow text-navy-muted">How It Works</p>
        <h2 className="mt-3 max-w-2xl font-display text-4xl font-light leading-tight sm:text-5xl">
          Explanations grounded in <span className="font-semibold">your files — and nothing else.</span>
        </h2>
        <p className="mt-4 max-w-lg text-navy-muted">
          LabSense AI reads your report, compares each value with the provided reference documents, and explains the result in plain language.
        </p>
        <Button asChild variant="glass" size="pill" className="mt-8">
          <Link to="/upload">
            Try it with a report <ArrowRight />
          </Link>
        </Button>
      </section>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
        <section>
          <h3 className="font-display text-2xl font-semibold">Six steps, every time</h3>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">The same transparent process for every report.</p>
          <AnalysisSteps activeStep={6} />
        </section>
        <section>
          <h3 className="font-display text-2xl font-semibold">The only five sources</h3>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">Every explanation links back to one of these.</p>
          <ol className="divide-y overflow-hidden rounded-2xl border bg-card">
            {SOURCE_ORDER.map((id, i) => (
              <li key={id} className="flex gap-4 px-5 py-4">
                <span className="font-display text-sm text-primary num">0{i + 1}</span>
                <div>
                  <p className="font-semibold">{SOURCE_DOCUMENTS[id].title}</p>
                  <p className="text-sm text-muted-foreground">{SOURCE_DOCUMENTS[id].description}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <p className="rounded-xl border border-dashed border-unclassified bg-unclassified-soft p-4 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wider text-unclassified-ink">When a result can't be classified</span>
              “{CANNOT_CLASSIFY}”
            </p>
            <p className="rounded-xl border border-dashed border-unclassified bg-unclassified-soft p-4 text-sm">
              <span className="block text-xs font-semibold uppercase tracking-wider text-unclassified-ink">When the files don't answer</span>
              “{NOT_IN_FILES}”
            </p>
          </div>
        </section>
      </div>

      <section>
        <h3 className="font-display text-2xl font-semibold">Tricky cases, handled carefully</h3>
        <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {EDGE_CASES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card p-6">
              <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
              <p className="mt-4 font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
