import { FileImage, FileText, X } from "lucide-react";
import { formatBytes } from "@/lib/format";

export function UploadProgress({ file, progress, onRemove, disabled }: { file: File; progress: number; onRemove: () => void; disabled?: boolean }) {
  const isPdf = file.type === "application/pdf";
  const Icon = isPdf ? FileText : FileImage;
  const done = progress >= 100;
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{file.name}</p>
          <p className="text-xs text-muted-foreground num">
            {isPdf ? "PDF document" : "Image"} · {formatBytes(file.size)} · {done ? "Uploaded" : `Uploading ${Math.round(progress)}%`}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-urgent-soft hover:text-urgent-ink disabled:opacity-40"
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="relative h-full overflow-hidden rounded-full bg-gradient-to-r from-primary to-normal transition-[width] duration-200" style={{ width: `${progress}%` }}>
          {!done && <span className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-card/60 to-transparent" />}
        </div>
      </div>
    </div>
  );
}
