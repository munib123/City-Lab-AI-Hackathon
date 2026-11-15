import { Link } from "@tanstack/react-router";
import { ArrowRight, FileText, PlayCircle, ShieldCheck, UploadCloud, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-lab-glass.jpg";

/** Abstract molecular connections drawn over the hero image. */
function MolecularOverlay() {
  const nodes = [
    [62, 22], [74, 14], [86, 26], [70, 40], [92, 52], [58, 64], [80, 72],
  ] as const;
  const links = [[0, 1], [1, 2], [0, 3], [2, 4], [3, 5], [4, 6], [3, 6]] as const;
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {links.map(([a, b], i) => (
        <line
          key={i}
          x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]}
          className="animate-dash-flow stroke-primary/40"
          strokeWidth="0.15"
          vectorEffect="non-scaling-stroke"
          style={{ animationDelay: `${i * -1.4}s` }}
        />
      ))}
      {nodes.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="0.5" className="animate-pulse-node fill-primary/60" style={{ animationDelay: `${i * 0.45}s` }} />
      ))}
      <path
        d="M0 78 C 15 70, 25 86, 40 78 S 65 66, 80 76 S 95 82, 100 74"
        fill="none"
        className="animate-dash-flow stroke-normal"
        strokeWidth="0.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function ResultChip({ label, value, status, tone, className }: { label: string; value: string; status: string; tone: "normal" | "abnormal" | "urgent"; className?: string }) {
  return (
    <div className={`surface-glass absolute rounded-2xl px-4 py-3 animate-float-soft ${className ?? ""}`}>
      <p className="eyebrow text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold num">{value}</p>
      <p className={`mt-0.5 flex items-center gap-1.5 text-xs font-semibold ${tone === "normal" ? "text-normal-ink" : tone === "urgent" ? "text-urgent-ink font-bold" : "text-abnormal-ink"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${tone === "normal" ? "bg-normal" : tone === "urgent" ? "bg-urgent" : "bg-abnormal"}`} />
        {status}
      </p>
    </div>
  );
}

export function DashboardHero() {
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-card/80 surface-hero shadow-soft">
      <div className="absolute inset-y-0 right-0 -z-10 w-full md:w-[68%]">
        <img
          src={heroImage}
          alt="Laboratory analysis"
          width={1536}
          height={1024}
          className="h-full w-full object-cover object-[70%_center] mask-fade-left opacity-50 md:opacity-100"
        />
        <MolecularOverlay />
      </div>

      <div className="relative grid min-h-[calc(100vh-9rem)] items-center gap-10 p-6 sm:p-10 lg:grid-cols-[1.05fr_1fr] lg:p-14">
        <div className="flex flex-col justify-center">
          <span className="surface-glass inline-flex w-fit items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold text-primary">
            <span className="h-1.5 w-1.5 rounded-full bg-normal" />
            CityLab Diagnostics · Problem Statement B
          </span>
          <h2 className="mt-6 max-w-xl font-display text-[2.6rem] font-light leading-[1.05] text-navy sm:text-6xl lg:text-[4.1rem]">
            Medical Lab Reports, <span className="font-semibold">explained simply.</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground">
            Empowering patients with 8th-grade explanations, exact reference ranges, boundary rule precision, and targeted doctor questions — strictly grounded in CityLab files with zero diagnostic guessing.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild variant="hero" size="pill">
              <Link to="/upload">
                <UploadCloud className="h-4 w-4 mr-1.5" /> Upload Report <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
            <Button asChild variant="glass" size="pill">
              <Link to="/test-cases">
                <FlaskConical className="h-4 w-4 mr-1.5" /> Official Test Cases (14)
              </Link>
            </Button>
          </div>
          <div className="mt-10 flex items-center gap-3">
            <div className="flex -space-x-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="grid h-8 w-8 place-items-center rounded-full border-2 border-card bg-secondary text-primary">
                  <FileText className="h-3.5 w-3.5" />
                </span>
              ))}
            </div>
            <p className="text-xs leading-snug text-muted-foreground">
              Answers grounded exclusively in <span className="font-semibold text-foreground">CityLab files</span>
              <br />— with strict context-lock privacy.
            </p>
          </div>
        </div>

        <div className="relative hidden min-h-[380px] lg:block" aria-hidden="true">
          <ResultChip label="Hemoglobin" value="13.5 g/dL" status="Normal (12.1–15.1)" tone="normal" className="right-[4%] top-[6%]" />
          <ResultChip label="Fasting Blood Sugar" value="350 mg/dL" status="URGENT (Threshold >300)" tone="urgent" className="bottom-[10%] left-[6%] [animation-delay:-3s]" />
          <div className="surface-glass absolute bottom-[4%] right-[2%] max-w-[240px] rounded-2xl p-4 animate-float-soft [animation-delay:-5s]">
            <p className="text-xs font-semibold text-primary flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Zero-Diagnosis Guardrail
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              “Explains what test numbers mean in simple words, never states a disease diagnosis.”
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
