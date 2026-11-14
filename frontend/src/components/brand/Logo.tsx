import { cn } from "@/lib/utils";

/** CityLab mark: a biomarker waveform passing through connected molecular nodes. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-navy" />
      <path
        d="M5 18.5h4.2l2.3-6 3.6 11 3-8.2 1.9 3.2H27"
        fill="none"
        className="stroke-normal"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1="11.5" y1="12.5" x2="21" y2="8" className="stroke-primary-glow" strokeWidth="1" />
      <circle cx="11.5" cy="12.5" r="1.9" className="fill-primary-glow" />
      <circle cx="21" cy="8" r="1.6" className="fill-navy-foreground" />
      <circle cx="18.1" cy="15.3" r="1.6" className="fill-normal" />
    </svg>
  );
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("font-display text-[17px] font-semibold tracking-tight", inverted ? "text-navy-foreground" : "text-navy")}>
        CityLab<span className="text-primary"> AI</span>
      </span>
    </span>
  );
}
