import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Report } from "@/lib/reports/types";
import { stepStyle } from "@/lib/reports/palette";
import { cn } from "@/lib/utils";

type NodeState = "complete" | "current" | "needs_attention" | "idle" | "locked";

function shortCode(code: string) {
  const parts = code.split("-");
  return parts[parts.length - 1] ?? code;
}

function splitRev(rev: string) {
  const [r, e] = rev.split("·").map((s) => s.trim());
  return { revision: r ?? rev, effective: (e ?? "").replace(/^Eff\.?\s*/i, "") };
}

function statusLabel(state: NodeState) {
  switch (state) {
    case "complete":
      return "Completed";
    case "current":
      return "Current";
    case "needs_attention":
      return "In progress";
    case "locked":
      return "Locked";
    default:
      return "Pending";
  }
}

function NodeIcon({ state, index }: { state: NodeState; index: number }) {
  const { icon: Icon, color } = stepStyle(index);
  const filled = state === "complete" || state === "current" || state === "needs_attention";

  const style: Record<string, string> =
    state === "current"
      ? {
          background: color,
          color: "var(--primary-foreground)",
          boxShadow: `0 8px 18px -6px color-mix(in oklab, ${color} 65%, transparent)`,
        }
      : state === "complete"
        ? { background: color, color: "var(--primary-foreground)" }
        : state === "needs_attention"
          ? {
              background: `color-mix(in oklab, ${color} 16%, var(--surface))`,
              color,
              borderColor: `color-mix(in oklab, ${color} 28%, var(--border))`,
            }
          : state === "locked"
            ? {
                background: "var(--muted)",
                color: "var(--muted-foreground)",
                borderColor: "var(--border)",
                opacity: "0.55",
              }
            : {
                background: "var(--surface)",
                color: "var(--muted-foreground)",
                borderColor: "var(--border)",
              };

  return (
    <span
      style={style}
      className={cn(
        "relative z-20 flex size-7 items-center justify-center rounded-lg border bg-surface transition-transform duration-150",
        "hover:scale-110 active:scale-95",
        filled && "border-transparent",
      )}
    >
      {state === "complete" ? (
        <Check className="size-3.5" strokeWidth={3} />
      ) : state === "locked" ? (
        <Lock className="size-3.5" strokeWidth={2} />
      ) : (
        <Icon className="size-3.5" strokeWidth={2} />
      )}
    </span>
  );
}



function NodeTooltip({
  report,
  state,
  position,
  note,
}: {
  report: Report;
  state: NodeState;
  position: { left: number; top: number } | null;
  note?: string | null;
}) {
  const { revision, effective } = splitRev(report.rev);

  return (
    <AnimatePresence>
      {position && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="pointer-events-none fixed z-[100] w-60 -translate-x-1/2 rounded-xl border border-border/80 bg-surface/95 p-3 shadow-[var(--shadow-card-hover)] backdrop-blur-xl"
          style={{ left: position.left, top: position.top }}
        >
          <p className="text-[11px] font-semibold text-ink">{report.code}</p>
          <p className="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground">
            {report.title}
          </p>
          <div className="mt-2 space-y-0.5">
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-muted-foreground">Status</span>
              <span
                className={cn(
                  "font-semibold",
                  {
                    complete: "text-success",
                    current: "text-primary",
                    needs_attention: "text-warning",
                    idle: "text-muted-foreground",
                    locked: "text-muted-foreground",
                  }[state],
                )}
              >
                {statusLabel(state)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="text-muted-foreground">Revision</span>
              <span className="font-medium text-ink">{revision}</span>
            </div>
            {effective && (
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="text-muted-foreground">Effective</span>
                <span className="font-medium text-ink">{effective}</span>
              </div>
            )}
            {note ? <p className="pt-1 text-[10px] leading-snug text-muted-foreground">{note}</p> : null}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function CertificateNavigator({
  reports,
  activeId,
  onSelect,
  completion,
  disabledIds,
  disabledReason,
}: {
  reports: Report[];
  activeId: string;
  onSelect: (id: string) => void;
  completion: (r: Report) => number;
  disabledIds?: Set<string>;
  disabledReason?: (id: string) => string | null;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const index = reports.findIndex((r) => r.id === activeId);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-node="${activeId}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeId]);

  useEffect(() => {
    if (!hoveredId) {
      setTooltipPos(null);
      return;
    }
    const el = scroller.current?.querySelector<HTMLElement>(`[data-node="${hoveredId}"]`);
    if (!el) {
      setTooltipPos(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setTooltipPos({ left: rect.left + rect.width / 2, top: rect.bottom + 8 });
  }, [hoveredId]);

  const isDisabled = (id: string) => disabledIds?.has(id) ?? false;

  const nearestEnabled = (from: number, delta: number) => {
    for (let i = from + delta; i >= 0 && i < reports.length; i += delta) {
      const next = reports[i];
      if (next && !isDisabled(next.id)) return next;
    }
    return undefined;
  };

  const go = (delta: number) => {
    const next = nearestEnabled(index, delta);
    if (next) onSelect(next.id);
  };

  const activeColor = stepStyle(index < 0 ? 0 : index).color;


  const currentPos = reports.length > 1 ? (index / (reports.length - 1)) * 100 : 100;
  const nextPos =
    reports.length > 1 && index < reports.length - 1
      ? ((index + 1) / (reports.length - 1)) * 100
      : 100;

  let greenPct = currentPos;
  let bluePct = nextPos - currentPos;
  let grayPct = 100 - nextPos;

  if (reports.length === 1) {
    greenPct = 0;
    bluePct = 100;
    grayPct = 0;
  }

  const hoveredReport = reports.find((r) => r.id === hoveredId);
  const hoveredState: NodeState =
    hoveredReport && isDisabled(hoveredReport.id)
      ? "locked"
      : hoveredReport && hoveredId === activeId
        ? "current"
        : hoveredReport
          ? Math.round(completion(hoveredReport) * 100) === 100
            ? "complete"
            : completion(hoveredReport) > 0
              ? "needs_attention"
              : "idle"
          : "idle";

  return (
    <div className="flex w-full items-center gap-2 px-2.5 py-1.5 sm:gap-2.5 sm:px-3">
      <button
        onClick={() => go(-1)}
        disabled={!nearestEnabled(index, -1)}
        aria-label="Previous certificate"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-strong)] text-muted-foreground shadow-[var(--shadow-card)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-35"
      >
        <ChevronLeft className="size-3.5" />
      </button>

      <div ref={scroller} className="relative min-w-0 flex-1">
        <div className="relative isolate flex w-full items-start justify-between gap-0">
          {/* process line — always behind icons */}
          <div className="pointer-events-none absolute left-[14px] right-[14px] top-[14px] z-0 flex h-0.5 overflow-hidden rounded-full">
            <motion.span
              initial={false}
              animate={{ width: `${greenPct}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="h-full"
              style={{ background: activeColor }}
            />
            <motion.span
              initial={false}
              animate={{ width: `${bluePct}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="h-full"
              style={{ background: `color-mix(in oklab, ${activeColor} 40%, transparent)` }}
            />
            <motion.span
              initial={false}
              animate={{ width: `${grayPct}%` }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="h-full bg-border"
            />
          </div>

          {reports.map((r, i) => {
            const locked = isDisabled(r.id);
            const pct = Math.round(completion(r) * 100);
            const active = r.id === activeId;
            const state: NodeState = locked
              ? "locked"
              : active
                ? "current"
                : pct === 100
                  ? "complete"
                  : pct > 0
                    ? "needs_attention"
                    : "idle";

            return (
              <div
                key={r.id}
                data-node={r.id}
                className="group relative z-10 flex min-w-0 flex-1 flex-col items-center py-1"
                onMouseEnter={() => setHoveredId(r.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (!locked) onSelect(r.id);
                  }}
                  disabled={locked}
                  aria-current={active ? "step" : undefined}
                  aria-disabled={locked}
                  title={locked ? disabledReason?.(r.id) || "Not applicable" : undefined}
                  className="relative z-10 flex flex-col items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                >
                  <NodeIcon state={state} index={i} />
                  <span
                    className="text-[10px] font-semibold tracking-tight transition-colors duration-200"
                    style={
                      locked
                        ? { color: "var(--muted-foreground)", opacity: 0.55 }
                        : active || state === "complete"
                          ? { color: stepStyle(i).color }
                          : { color: "var(--muted-foreground)" }
                    }
                  >
                    {r.id === "as-f1" ? "AS-F1" : shortCode(r.code)}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>


      <button
        onClick={() => go(1)}
        disabled={!nearestEnabled(index, 1)}
        aria-label="Next certificate"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-strong)] text-muted-foreground shadow-[var(--shadow-card)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:border-primary/50 hover:text-primary disabled:pointer-events-none disabled:opacity-35"
      >
        <ChevronRight className="size-3.5" />
      </button>

      {mounted &&
        hoveredReport &&
        createPortal(
          <NodeTooltip
            report={hoveredReport}
            state={hoveredState}
            position={tooltipPos}
            note={hoveredState === "locked" ? disabledReason?.(hoveredReport.id) : null}
          />,
          document.body,
        )}
    </div>
  );
}
