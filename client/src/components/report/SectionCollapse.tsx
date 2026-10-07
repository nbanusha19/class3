import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionCollapseButton({
  open,
  onToggle,
  label,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={open ? `Collapse ${label || "section"}` : `Expand ${label || "section"}`}
      title={open ? "Collapse" : "Expand"}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border/80 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/8 hover:text-ink",
        className,
      )}
    >
      <ChevronDown className={cn("size-4 transition-transform duration-200", open ? "rotate-180" : "")} />
    </button>
  );
}

export function CollapsiblePanel({
  title,
  accent,
  defaultOpen = true,
  headerExtra,
  children,
  className,
  headerClassName,
}: {
  title: ReactNode;
  accent?: string;
  defaultOpen?: boolean;
  headerExtra?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      style={accent ? ({ ["--section-accent"]: accent } as CSSProperties) : undefined}
      className={cn("panel panel-accent relative overflow-hidden", className)}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3.5 py-2 sm:px-4",
          open && "border-b border-border",
          headerClassName,
        )}
      >
        <div className="min-w-0 flex-1">{title}</div>
        <div className="flex shrink-0 items-center gap-2">
          {open ? headerExtra : null}
          <SectionCollapseButton open={open} onToggle={() => setOpen((value) => !value)} />
        </div>
      </div>
      {open ? children : null}
    </section>
  );
}

export function F5SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="font-display text-[15px] font-semibold uppercase tracking-[0.1em] text-primary">{children}</h3>
  );
}
