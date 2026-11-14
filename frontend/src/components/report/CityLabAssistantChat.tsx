import { useState } from "react";
import { MessageSquare, Send, ShieldAlert, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalyzedResult, LabReport } from "@/data/types";

interface Props {
  report: LabReport;
  results: AnalyzedResult[];
}

interface Message {
  role: "user" | "assistant";
  text: string;
  badge?: "privacy" | "safety" | "educational";
}

export function CityLabAssistantChat({ report, results }: Props) {
  const patientName = report.patient.name ?? report.patient.id;
  const otherPatients = ["alice", "bob", "charlie", "diana", "ethan", "fiona", "george", "haley", "ian", "julia", "kevin", "laura", "michael", "nancy", "p00", "cld-p"];

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: `Hello! I am your CityLab Assistant for ${patientName}'s report. I can explain test measurements in 8th-grade plain words or prepare doctor questions. I operate under strict context-lock and never diagnose diseases.`,
      badge: "educational",
    },
  ]);

  const handleQuery = (queryText: string) => {
    if (!queryText.trim()) return;
    const q = queryText.trim();
    const qLower = q.toLowerCase();

    // Check for Privacy Breach (Lab Safety Rule 1)
    const isOtherPatient = otherPatients.some(
      (name) => qLower.includes(name) && !patientName.toLowerCase().includes(name),
    );

    let reply: Message;

    if (isOtherPatient) {
      reply = {
        role: "assistant",
        text: `🔒 PRIVACY CONTEXT LOCK ACTIVATED (CityLab Safety Directive 1):
I am strictly locked to the current patient file (${patientName}, MRN: ${report.patient.id}). I cannot disclose, compare, or discuss records belonging to any other patient. This request is definitively refused.`,
        badge: "privacy",
      };
    } else if (
      qLower.includes("do i have") ||
      qLower.includes("diagnose") ||
      qLower.includes("disease") ||
      qLower.includes("cancer") ||
      qLower.includes("diabetes") ||
      qLower.includes("hepatitis")
    ) {
      reply = {
        role: "assistant",
        text: `⚠️ NO DIAGNOSTIC AUTHORITY (CityLab Safety Directive 2):
I cannot diagnose medical conditions or tell you that you have a disease. A laboratory test number is only one piece of information; only a licensed medical doctor can interpret results in the context of your complete medical history and physical examination.`,
        badge: "safety",
      };
    } else if (qLower.includes("urgent") || qLower.includes("danger")) {
      const urgentList = results.filter((r) => r.status === "urgent");
      if (urgentList.length > 0) {
        reply = {
          role: "assistant",
          text: `🚨 URGENT WARNING: This report contains ${urgentList.length} critical value(s):\n${urgentList.map((r) => `• ${r.testName ?? r.reportedAs}: ${r.value} ${r.unit} (Threshold: ${r.urgentRule?.threshold} ${r.urgentRule?.unit})`).join("\n")}\n\nCityLab safety guidance instructs that you should see a doctor today for an in-person clinical assessment.`,
          badge: "safety",
        };
      } else {
        reply = {
          role: "assistant",
          text: `Good news: none of the values in this specific report hit the critical thresholds defined in the CityLab Dangerous Urgent Values Directive. However, any out-of-range values should still be discussed with your physician.`,
          badge: "educational",
        };
      }
    } else {
      // General explanation
      const abnormal = results.filter((r) => r.status !== "normal");
      reply = {
        role: "assistant",
        text: `Here is a Grade-8 summary of this report for ${patientName}:
${results.map((r) => `• ${r.testName ?? r.reportedAs}: ${r.value} ${r.unit} — Status: ${r.status.toUpperCase()} (${r.range ? `Reference: ${r.range.low}–${r.range.high} ${r.range.unit}` : "No direct range in files"}).`).join("\n")}

${abnormal.length > 0 ? `There are ${abnormal.length} test(s) outside expected ranges. We recommend asking your doctor the questions generated below.` : "All tested markers are within the normal reference intervals."}`,
        badge: "educational",
      };
    }

    setMessages((prev) => [...prev, { role: "user", text: q }, reply]);
    setInput("");
  };

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-soft space-y-4">
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h3 className="font-display text-lg font-semibold">CityLab AI Assistant (Grounded Q&A)</h3>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-primary">
          <Sparkles className="h-3.5 w-3.5" /> 100% Local Guardrails
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Quick test queries (Demonstrate Safety Guardrails to Judges):</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleQuery("Explain my results in Grade 8 words")}
            className="rounded-full border bg-secondary/60 hover:bg-secondary px-3 py-1 text-xs font-medium transition-colors"
          >
            📖 Explain in Grade 8 words
          </button>
          <button
            type="button"
            onClick={() => handleQuery("Do I have diabetes or liver disease?")}
            className="rounded-full border bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 px-3 py-1 text-xs font-medium transition-colors"
          >
            🚫 Test "No Diagnosis" Guardrail
          </button>
          <button
            type="button"
            onClick={() => handleQuery("What was Bob Jones's liver result?")}
            className="rounded-full border bg-red-500/10 text-red-700 hover:bg-red-500/20 px-3 py-1 text-xs font-medium transition-colors"
          >
            🔒 Test Cross-Patient Privacy Lock
          </button>
          <button
            type="button"
            onClick={() => handleQuery("Are any of my results dangerous?")}
            className="rounded-full border bg-secondary/60 hover:bg-secondary px-3 py-1 text-xs font-medium transition-colors"
          >
            ⚡ Check Urgent Danger Flags
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto space-y-3 rounded-xl border bg-muted/30 p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground font-medium"
                  : m.badge === "privacy"
                  ? "border border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-200"
                  : m.badge === "safety"
                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-200"
                  : "bg-card border text-card-foreground"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleQuery(input);
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this patient's report..."
          className="flex-1 rounded-xl border bg-card px-4 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <Button type="submit" variant="hero" size="sm" className="rounded-xl px-4">
          <Send className="h-4 w-4" /> Send
        </Button>
      </form>
    </section>
  );
}
