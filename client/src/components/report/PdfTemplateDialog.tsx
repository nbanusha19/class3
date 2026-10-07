import { Download, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PDF_TEMPLATE_IDS, PDF_TEMPLATES, type PdfTemplateId } from "@/lib/reports/pdf-theme";
import { cn } from "@/lib/utils";

type PdfTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (id: PdfTemplateId) => void;
  busy?: boolean;
  mode: "one" | "all";
};

function Preview({ id }: { id: PdfTemplateId }) {
  if (id === "template2") {
    return (
      <div className="mt-3 space-y-2 rounded-md border border-[#cfe3df] bg-[#f7fbfa] p-2">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-sm bg-[#0f6c6c]" />
          <span className="h-1.5 w-16 rounded-sm bg-[#0f6c6c]/70" />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <div className="h-1 w-8 rounded-sm bg-[#0f6c6c]/40" />
            <div className="h-2 w-14 rounded-sm bg-[#1c3c3c]/70" />
            <div className="h-px w-8 bg-[#0f6c6c]" />
          </div>
          <div className="space-y-1">
            <div className="h-1 w-8 rounded-sm bg-[#0f6c6c]/40" />
            <div className="h-2 w-12 rounded-sm bg-[#1c3c3c]/70" />
            <div className="h-px w-8 bg-[#0f6c6c]" />
          </div>
        </div>
        <div className="h-6 rounded-md bg-[#e8f4f2]" />
      </div>
    );
  }
  if (id === "template3") {
    return (
      <div className="mt-3 rounded-md border-2 border-[#b8860b] bg-[#fcfbf7] p-2">
        <div className="mx-auto mb-2 h-2 w-20 rounded-sm bg-[#1c2430]" />
        <div className="mb-2 flex items-center gap-1">
          <span className="h-px flex-1 bg-[#b8860b]" />
          <span className="h-1.5 w-10 rounded-sm bg-[#1c2430]" />
          <span className="h-px flex-1 bg-[#b8860b]" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-end gap-2">
            <span className="h-1.5 w-8 bg-[#b8860b]/60" />
            <span className="h-px flex-1 bg-[#b8860b]" />
          </div>
          <div className="flex items-end gap-2">
            <span className="h-1.5 w-8 bg-[#b8860b]/60" />
            <span className="h-px flex-1 bg-[#b8860b]" />
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-[#c5d6e8] bg-white">
      <div className="flex items-center justify-between bg-[#e2ecf7] px-2 py-1.5">
        <span className="h-2 w-10 rounded-sm bg-[#2563a8]" />
        <span className="h-2 w-8 rounded-sm bg-[#2563a8]/50" />
      </div>
      <div className="grid grid-cols-2 gap-px bg-[#c5d6e8] p-px">
        <div className="h-4 bg-white" />
        <div className="h-4 bg-white" />
        <div className="h-4 bg-white" />
        <div className="h-4 bg-white" />
      </div>
    </div>
  );
}

export function PdfTemplateDialog({ open, onOpenChange, onPick, busy, mode }: PdfTemplateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!busy) onOpenChange(next);
    }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a PDF template</DialogTitle>
          <DialogDescription>
            {mode === "all"
              ? "Each option is a different layout, not only a different colour. Template 2 and 3 drop the boxed tables."
              : "Each option is a different layout. Template 1 keeps boxed tables; 2 and 3 do not."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          {PDF_TEMPLATE_IDS.map((id) => {
            const theme = PDF_TEMPLATES[id];
            return (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => onPick(id)}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-xl border border-border bg-background text-left shadow-sm transition-all",
                  "hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:pointer-events-none disabled:opacity-60",
                )}
              >
                <div className="h-1.5 w-full" style={{ background: theme.swatch }} />
                <div className="p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {theme.shortLabel}
                  </p>
                  <p className="mt-0.5 font-display text-[15px] font-semibold text-ink">{theme.label}</p>
                  <Preview id={id} />
                  <p className="mt-3 text-[12px] leading-snug text-muted-foreground">{theme.description}</p>
                  <span
                    className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold"
                    style={{ color: theme.swatch }}
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                    Download
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
