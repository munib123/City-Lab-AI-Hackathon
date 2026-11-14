import { useState } from "react";
import { Check, Copy, MessageCircleQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function DoctorQuestions({ questions }: { questions: string[] }) {
  const [copied, setCopied] = useState<number | "all" | null>(null);

  const handle = async (key: number | "all", text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(key);
      toast.success(key === "all" ? "All questions copied" : "Question copied");
      window.setTimeout(() => setCopied(null), 1800);
    } else {
      toast.error("Copy isn't available in this browser. Select the text to copy it instead.");
    }
  };

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] surface-navy p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2 text-navy-muted">
            <MessageCircleQuestion className="h-4 w-4" /> For your appointment
          </p>
          <h2 className="mt-2 font-display text-2xl font-medium sm:text-3xl">Questions Worth Asking Your Doctor</h2>
          <p className="mt-2 max-w-lg text-sm text-navy-muted">Based only on the results in this report.</p>
        </div>
        <Button variant="navy-outline" size="pill" onClick={() => handle("all", questions.map((q, i) => `${i + 1}. ${q}`).join("\n"))}>
          {copied === "all" ? <Check /> : <Copy />} Copy all
        </Button>
      </div>
      <ol className="relative mt-6 space-y-2">
        {questions.map((q, i) => (
          <li key={q} className="surface-glass-navy group flex items-start gap-4 rounded-xl p-4">
            <span className="font-display text-sm text-navy-muted num">0{i + 1}</span>
            <p className="flex-1 text-[15px] leading-relaxed">{q}</p>
            <button
              type="button"
              onClick={() => handle(i, q)}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-navy-foreground/15 text-navy-muted transition-colors hover:bg-navy-foreground/10 hover:text-navy-foreground"
              aria-label={`Copy question ${i + 1}`}
            >
              {copied === i ? <Check className="h-4 w-4 text-normal" /> : <Copy className="h-4 w-4" />}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
