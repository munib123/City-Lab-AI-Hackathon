import { Check, ShieldCheck, Stethoscope, ChevronRight, Sparkles, FileText, ArrowRight } from "lucide-react";
import type { LabReport, AnalyzedResult } from "@/data/types";

interface Props {
  report: LabReport;
  results: AnalyzedResult[];
}

export function ClinicalHighlightsBoard({ report, results }: Props) {
  const normalCount = results.filter((r) => r.status === "normal").length;
  const abnormalCount = results.filter((r) => ["high", "low", "urgent"].includes(r.status)).length;
  const totalCount = results.length;
  const percentNormal = totalCount > 0 ? Math.round((normalCount / totalCount) * 100) : 100;

  return (
    <section className="space-y-6">
      {/* 1. Clinical Pill Alert / Highlight Banner (Inspired by Slide 2 & 5) */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-blue-50/90 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
              <ChevronRight className="h-4 w-4" />
            </span>
            <span className="text-xs sm:text-sm font-semibold tracking-wide text-blue-950">
              CityLab Quality Protocol: Deterministic range verification active for{" "}
              <span className="font-bold underline decoration-blue-400 decoration-2 underline-offset-2">
                {report.patient.name}
              </span>{" "}
              ({report.patient.id})
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm border border-blue-200">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
            CLIA Verified
          </span>
        </div>
      </div>

      {/* 2. Three Circular Feature Medallions (Inspired directly by Slide 5 "ПРЕДЛОЖЕНИЕ...") */}
      <div className="rounded-[2rem] border border-blue-100 bg-gradient-to-b from-white via-blue-50/30 to-white p-6 sm:p-8 shadow-sm">
        <div className="text-center max-w-xl mx-auto mb-8">
          <span className="inline-block rounded-full bg-blue-100 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-blue-800">
            Clinical Summary Highlights
          </span>
          <h3 className="mt-2.5 font-display text-2xl font-bold text-navy sm:text-3xl">
            Key Takeaways at a Glance
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Essential analysis points distilled into plain words for patient clarity and physician discussion.
          </p>
        </div>

        {/* 3 Circular Frosted Medallions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {/* Circle 1 */}
          <div className="flex flex-col items-center text-center group">
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-4 border-blue-200/80 bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md transition-transform duration-300 group-hover:scale-105">
              <div className="absolute inset-1.5 rounded-full border border-white/30" />
              <div className="z-10 p-3">
                <span className="block text-2xl font-extrabold tracking-tight font-display">{percentNormal}%</span>
                <span className="block text-[11px] font-medium uppercase tracking-wider opacity-90">In Normal Limit</span>
                <span className="block text-[10px] opacity-75 mt-0.5">{normalCount} of {totalCount} tests</span>
              </div>
            </div>
            <h4 className="mt-4 font-semibold text-sm text-foreground">Standard Biological Range</h4>
            <p className="mt-1 text-xs text-muted-foreground max-w-[210px] leading-relaxed">
              Biomarkers align with CityLab healthy reference intervals for this age & sex group.
            </p>
          </div>

          {/* Circle 2 */}
          <div className="flex flex-col items-center text-center group">
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-4 border-sky-200/80 bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-md transition-transform duration-300 group-hover:scale-105">
              <div className="absolute inset-1.5 rounded-full border border-white/30" />
              <div className="z-10 p-3">
                <ShieldCheck className="h-6 w-6 mx-auto mb-1 text-white opacity-95" />
                <span className="block text-xs font-bold uppercase tracking-wider">Zero Guesswork</span>
                <span className="block text-[10px] opacity-80 mt-0.5">Closed-Corpus Files</span>
              </div>
            </div>
            <h4 className="mt-4 font-semibold text-sm text-foreground">100% Deterministic</h4>
            <p className="mt-1 text-xs text-muted-foreground max-w-[210px] leading-relaxed">
              Every range, alias, and unit conversion is mathematically derived without AI hallucination.
            </p>
          </div>

          {/* Circle 3 */}
          <div className="flex flex-col items-center text-center group">
            <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-4 border-indigo-200/80 bg-gradient-to-br from-indigo-500 to-blue-700 text-white shadow-md transition-transform duration-300 group-hover:scale-105">
              <div className="absolute inset-1.5 rounded-full border border-white/30" />
              <div className="z-10 p-3">
                <Stethoscope className="h-6 w-6 mx-auto mb-1 text-white opacity-95" />
                <span className="block text-xs font-bold uppercase tracking-wider">Doctor Prep</span>
                <span className="block text-[10px] opacity-80 mt-0.5">3–5 Questions Ready</span>
              </div>
            </div>
            <h4 className="mt-4 font-semibold text-sm text-foreground">Actionable Next Steps</h4>
            <p className="mt-1 text-xs text-muted-foreground max-w-[210px] leading-relaxed">
              Tailored questions prepare you to have an informed, confident conversation with your doctor.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Patient Journey Pathway: "Your Next Step" (Inspired directly by Slide 7 "ВАШ СЛЕДУЮЩИЙ ШАГ") */}
      <div className="rounded-[2rem] border border-blue-100 bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <span className="inline-block rounded-full bg-blue-600 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
              Recommended Action Plan
            </span>
            <h3 className="mt-2 font-display text-xl font-bold text-navy sm:text-2xl">
              Your Diagnostic Journey Roadmap
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">Follow these 4 simple steps</span>
        </div>

        {/* 4-Step Flow Line */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
          {/* Step 1 */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-blue-300 hover:shadow-soft">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                <Check className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Completed</span>
            </div>
            <h4 className="mt-3 font-semibold text-sm text-foreground">1. Specimen Analysis</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Sample collected on {report.collectedOn} and processed with CLIA quality controls.
            </p>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-blue-300 hover:shadow-soft">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                <Check className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Completed</span>
            </div>
            <h4 className="mt-3 font-semibold text-sm text-foreground">2. Range Verification</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Biomarkers checked against demographic intervals with inclusive boundary rules.
            </p>
          </div>

          {/* Step 3 */}
          <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm transition-all hover:border-blue-400">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                3
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Active</span>
            </div>
            <h4 className="mt-3 font-semibold text-sm text-foreground">3. Plain-Language Review</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Read simple Grade-8 explanations below to understand what each test measures.
            </p>
          </div>

          {/* Step 4 */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm transition-all hover:border-indigo-400">
            <div className="flex items-center justify-between">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
                4
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Next Step</span>
            </div>
            <h4 className="mt-3 font-semibold text-sm text-foreground">4. Physician Consultation</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Discuss prepared questions at the bottom of this page with your healthcare provider.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
