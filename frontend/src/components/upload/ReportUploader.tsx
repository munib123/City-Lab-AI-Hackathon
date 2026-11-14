import { useRef, useState, type DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

export const MAX_FILE_MB = 10;
export const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg"];

export function validateReportFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Please choose a PDF, PNG or JPG file.";
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `That file is larger than ${MAX_FILE_MB} MB.`;
  return null;
}

export function ReportUploader({ onFile }: { onFile: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div
      data-dragging={dragging}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload a lab report. Drag and drop or press Enter to browse."
      className="upload-zone group cursor-pointer rounded-[1.75rem] px-6 py-14 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring sm:py-20"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] grid-lab opacity-50 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]" />
      <div className="relative mx-auto grid h-20 w-20 place-items-center">
        <span className="absolute inset-0 rounded-[1.4rem] bg-gradient-to-br from-primary/20 to-normal/30 blur-md transition-all group-hover:blur-lg" />
        <span className="surface-glass relative grid h-20 w-20 place-items-center rounded-[1.4rem] transition-transform duration-500 group-hover:-translate-y-1">
          <UploadCloud className="h-8 w-8 text-primary" strokeWidth={1.5} />
        </span>
      </div>
      <p className="relative mt-6 font-display text-xl font-semibold">{dragging ? "Drop your report here" : "Drag and drop your lab report"}</p>
      <p className="relative mt-1 text-sm text-muted-foreground">or</p>
      <Button
        type="button"
        variant="hero"
        size="pill"
        className="relative mt-3"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        Browse Files
      </Button>
      <div className="relative mt-6 flex flex-wrap justify-center gap-2 text-xs font-semibold">
        {["PDF", "PNG", "JPG"].map((t) => (
          <span key={t} className="rounded-md border bg-card px-2 py-1 text-muted-foreground">{t}</span>
        ))}
        <span className="rounded-md border bg-card px-2 py-1 text-muted-foreground">Max {MAX_FILE_MB} MB</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
