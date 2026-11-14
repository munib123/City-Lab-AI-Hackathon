import { FileCheck2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SOURCE_DOCUMENTS } from "@/data/sources";
import type { SourceId } from "@/data/types";

export function SourceChip({ id, detail }: { id: SourceId; detail?: string | undefined }) {
  const doc = SOURCE_DOCUMENTS[id];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <FileCheck2 className="h-3.5 w-3.5 text-primary" />
          {doc.title}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-xl text-sm">
        <p className="font-semibold">{doc.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{doc.description}</p>
        {detail && <p className="mt-3 rounded-md bg-muted px-2 py-1.5 text-xs font-medium num">{detail}</p>}
        <p className="mt-3 text-[11px] text-muted-foreground">{doc.version} · fictional demo document</p>
      </PopoverContent>
    </Popover>
  );
}
