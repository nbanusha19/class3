import { useEffect, useRef, type ReactNode } from "react";
import { stepStyle } from "@/lib/reports/palette";
import { useReports } from "@/lib/report-store";
import { lookupCocByProductionOrder } from "@/lib/api";
import { mergeF2State } from "@/lib/reports/f2-logic";
import {
  F6_PANEL_OPTS,
  f6AcceptedPanelLabels,
  f6BackDrillForced,
  f6BackDrillValue,
  f6CapPlatingForced,
  f6CapPlatingValue,
  f6WrapPlatingForced,
  f6WrapPlatingValue,
  f6NaForced,
  f6PanelDisplay,
} from "@/lib/reports/f6-logic";
import type { Report, Section } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { CollapsiblePanel } from "@/components/report/SectionCollapse";

const inputClass =
  "h-7 w-full rounded-md border border-border bg-transparent px-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-muted-foreground/55 hover:border-primary/45 focus:border-primary focus:bg-field focus:ring-1 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-70";

function FieldBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <div className="flex h-8 items-center rounded-md border border-border px-2.5 text-[13px] text-ink">{children || "—"}</div>
    </div>
  );
}

export function F6Form({ report }: { report: Report }) {
  const { state, getRows, setCell, getField, setField, applyCocLookup } = useReports();
  const tableSection = report.sections.find((s): s is Extract<Section, { kind: "table" }> => s.kind === "table");
  const rows = tableSection ? getRows(report.id, tableSection.key) : [];
  const layers = state.shared.layers || "";
  const viaProtection = state.shared.viaProtection || "";
  const backDrilling = state.shared.backDrilling || "";
  const productionOrder = (state.fields["f1.productionOrder"] || state.f2?.lines?.[0]?.prod || "").trim();
  const f2 = mergeF2State(state.f2, state.combinedProductionOrders || []);
  const panelLabels = f6AcceptedPanelLabels(f2);
  const fetchedFor = useRef("");

  useEffect(() => {
    if (!productionOrder) return;
    if ((viaProtection && backDrilling) || fetchedFor.current === productionOrder) {
      fetchedFor.current = productionOrder;
      return;
    }
    fetchedFor.current = productionOrder;
    void lookupCocByProductionOrder(productionOrder)
      .then((result) => {
        applyCocLookup("f1", result.coc);
      })
      .catch(() => {
        fetchedFor.current = "";
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionOrder]);

  if (!tableSection) return null;

  return (
    <div className="space-y-4">
      <section
        style={{ ["--section-accent" as string]: stepStyle(0).color }}
        className="panel panel-accent relative overflow-hidden p-3.5 sm:p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="sm:col-span-2">
            <FieldBox label="Customer">{state.shared.customer}</FieldBox>
          </div>
          <FieldBox label="P.O. Number">{state.shared.poNumber}</FieldBox>
          <FieldBox label="Total Accepted Panels">{panelLabels.length ? String(panelLabels.length) : ""}</FieldBox>
        </div>
      </section>
      <CollapsiblePanel
        accent={stepStyle(0).color}
        title={
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {tableSection.title || "Microsection Evaluation"}
          </p>
        }
      >
        <div className="border-b border-border px-3.5 py-2.5 sm:px-4">
          <p className="text-[12px] text-muted-foreground">
            {panelLabels.length
              ? `Select one result per requirement. Export copies it across all ${panelLabels.length} accepted panel${panelLabels.length === 1 ? "" : "s"} from F2 (${panelLabels.join(", ")}).`
              : "Select one result per requirement. Export copies it across every accepted panel from F2 once panel counts are entered."}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            On the PDF: ✓ means accepted. ✗ means not accepted. NA means not applicable.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr className="bg-muted/40">
                <th className="w-[44px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Sl. No.
                </th>
                <th className="min-w-[220px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Inspection requirement
                </th>
                <th className="w-[130px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  IPC-6012 ref.
                </th>
                <th className="w-[140px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Panel
                </th>
                <th className="min-w-[150px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                  Remarks
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const sl = row.sl || String(index + 1);
                const wrapLocked = f6WrapPlatingForced(sl, viaProtection);
                const capLocked = f6CapPlatingForced(sl);
                const backLocked = f6BackDrillForced(sl, layers);
                const naLocked = f6NaForced(sl, layers);
                const locked = wrapLocked || capLocked || backLocked || naLocked;
                const panel = wrapLocked
                  ? f6WrapPlatingValue(viaProtection)
                  : capLocked
                    ? f6CapPlatingValue(viaProtection)
                    : backLocked
                      ? f6BackDrillValue(backDrilling)
                      : naLocked
                        ? "NA"
                        : f6PanelDisplay(row.panel1 || "");
                return (
                  <tr key={sl} className="border-b border-border/60 last:border-0 hover:bg-primary/4">
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{sl}</td>
                    <td className="px-2 py-1.5 text-ink">{row.inspection}</td>
                    <td className="px-2 py-1.5 tabular-nums text-ink">{row.req}</td>
                    <td className="px-0.5 py-1">
                      <select
                        className={cn(inputClass, "cursor-pointer appearance-none pr-7")}
                        value={panel}
                        disabled={locked}
                        title={
                          wrapLocked
                            ? f6WrapPlatingValue(viaProtection) === "Accepted"
                              ? "Locked — Via Protect is Type VII"
                              : "Locked — Via Protect is No"
                            : undefined
                        }
                        onChange={(e) => setCell(report.id, tableSection.key, index, "panel1", e.target.value === "—" ? "" : e.target.value)}
                      >
                        {F6_PANEL_OPTS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-0.5 py-1">
                      <input
                        className={inputClass}
                        placeholder=""
                        value={row.remarks || ""}
                        onChange={(e) => setCell(report.id, tableSection!.key, index, "remarks", e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>

      {report.sections
        .filter((s): s is Extract<Section, { kind: "signoff" }> => s.kind === "signoff")
        .map((section, i) => (
          <section
            key={`signoff-${i}`}
            style={{ ["--section-accent" as string]: stepStyle(1).color }}
            className="panel panel-accent relative overflow-hidden p-3.5 sm:p-4"
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {section.title || "Sign-off"}
            </p>
            <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
              {(section.fields ?? []).map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {field.label}
                  </span>
                  <input
                    className={inputClass}
                    type={field.type === "date" ? "date" : "text"}
                    placeholder=""
                    value={getField(report.id, field)}
                    onChange={(e) => setField(report.id, field, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
