import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { TemplatePreview } from "@/components/pdf/TemplatePreview";
import type { PdfTemplateId } from "@/lib/pdf/types";
import { cn } from "@/lib/utils";

export function TemplateSelector({
  open,
  busy,
  onClose,
  onExport,
}: {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onExport: (template: PdfTemplateId) => void;
}) {
  const [selected, setSelected] = useState<PdfTemplateId>("current");
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-md" onClick={busy ? undefined : onClose} aria-label="Close template selector" />
      <div className="relative z-10 w-full max-w-6xl overflow-hidden rounded-3xl border border-white/30 bg-white/80 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.7)] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/40 px-6 py-5 sm:px-8">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">PDF presentation</p>
            <h2 className="mt-1 font-display text-[22px] font-semibold text-ink">Choose Report Template</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">Select a presentation style for your Class 3 report.</p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-slate-100 hover:text-ink disabled:opacity-50"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          {(["current", "modern", "executive"] as const).map((id) => (
            <TemplatePreview key={id} id={id} selected={selected === id} onSelect={() => setSelected(id)} onUse={() => onExport(id)} />
          ))}
        </div>
        {busy ? (
          <div className={cn("absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm")}>
            <p className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-[13px] font-medium text-white">
              <Loader2 className="size-4 animate-spin" /> Generating PDF…
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
