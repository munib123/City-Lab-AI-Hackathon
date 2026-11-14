import { cva } from "class-variance-authority";
import { AlertTriangle, ArrowDown, ArrowUp, Check, HelpCircle } from "lucide-react";
import type { ResultStatus } from "@/data/types";
import { STATUS_LABEL } from "@/lib/analysis";
import { cn } from "@/lib/utils";

const badge = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
  {
    variants: {
      status: {
        normal: "border-normal/60 bg-normal-soft text-normal-ink",
        low: "border-abnormal/70 bg-abnormal-soft text-abnormal-ink",
        high: "border-abnormal/70 bg-abnormal-soft text-abnormal-ink",
        urgent: "border-urgent bg-urgent-soft text-urgent-ink",
        unclassified: "border-unclassified/60 bg-unclassified-soft text-unclassified-ink",
      },
    },
  },
);

const ICON = { normal: Check, low: ArrowDown, high: ArrowUp, urgent: AlertTriangle, unclassified: HelpCircle };

export function StatusBadge({ status, className }: { status: ResultStatus; className?: string }) {
  const Icon = ICON[status];
  return (
    <span className={cn(badge({ status }), className)}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export const STATUS_DOT: Record<ResultStatus, string> = {
  normal: "bg-normal",
  low: "bg-abnormal",
  high: "bg-abnormal",
  urgent: "bg-urgent",
  unclassified: "bg-unclassified",
};
