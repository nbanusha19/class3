import { Fragment, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { stepStyle } from "@/lib/reports/palette";
import { useReports } from "@/lib/report-store";
import { lookupCocByProductionOrder } from "@/lib/api";
import {
  applyPcbDetailsToF2,
  arraysPerPanel,
  boardState,
  buildSerials,
  clearLineMarks,
  countStock,
  countSupplied,
  countRejected,
  defaultF2State,
  dispatchLabel,
  dispositionOptions,
  emptyF2Line,
  f2ReportNumber,
  F2_PANEL_DIGIT_OPTIONS,
  F2_REASON_OPTIONS,
  F2_SUPPLY_FORM_OPTIONS,
  isArrayLikeSupply,
  isArraySupply,
  f2PcbNumber,
  f2PanelLabel,
  isPs30051,
  lineArrays,
  linesNote,
  lineTotal,
  markBoards,
  mergeF2State,
  pad,
  panelRowsLimit,
  pcbRejectCount,
  perPcb,
  serialColHeading,
  serialSummary,
  setLinePanels,
  shipNote,
  shipQty,
  togglePanelReject,
  updateLine,
  visibleSerials,
  assignKey,
  type F2BoardState,
  type F2Line,
  type F2MarkMode,
  type F2SerialView,
  type F2State,
} from "@/lib/reports/f2-logic";
import type { Report, Section } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { CollapsiblePanel } from "@/components/report/SectionCollapse";

const inputClass =
  "w-full rounded-lg border border-input/80 bg-field px-2.5 text-[12px] text-ink outline-none shadow-[var(--glass-highlight)] transition-colors duration-150 placeholder:text-muted-foreground/55 hover:border-primary/45 focus:border-primary focus:bg-[color:var(--glass-bg-strong)] focus:ring-2 focus:ring-primary/12 disabled:cursor-not-allowed disabled:opacity-60";

function chipClass(state: F2BoardState) {
  if (state === "Rejected") {
    return "border-destructive bg-destructive text-destructive-foreground line-through";
  }
  if (state === "Stock") {
    return "border-warning bg-[color-mix(in_oklab,var(--warning)_22%,white)] text-[color-mix(in_oklab,var(--warning)_80%,var(--ink))]";
  }
  if (state === "Supplied") {
    return "border-primary bg-primary text-primary-foreground";
  }
  if (state === "Others") {
  return "border-slate-500 bg-slate-500 text-white";
}
  return "border-border bg-transparent text-muted-foreground";
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="min-w-0">
      <h3 className="font-display text-[13px] font-semibold leading-tight text-ink">{title}</h3>
      {subtitle ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function F2Form({ report }: { report: Report }) {
  const { state, updateF2, getField, setField } = useReports();
  const f2 = mergeF2State(state.f2, state.combinedProductionOrders || []);
  const [pickerLine, setPickerLine] = useState<number | null>(null);
  const [draftF2, setDraftF2] = useState<F2State | null>(null);
  const custSpec = state.shared.specification || "";
  const orderQty = Number(state.shared.quantity) || 0;
  const prodOptions = [
    ...new Set(
      [
        ...(state.combinedProductionOrders || []),
        state.fields["f1.productionOrder"] || "",
        ...f2.lines.map((line) => line.prod),
      ].filter(Boolean),
    ),
  ];
  const per = perPcb(f2);
  const arrayOn = isArraySupply(f2);
  const serials = visibleSerials(f2, custSpec);
  const allSerials = buildSerials(f2, custSpec);
  const accents = [stepStyle(0).color, stepStyle(1).color, stepStyle(2).color, stepStyle(3).color];

  const arrayLike = isArrayLikeSupply(f2.supplyForm);
  const fetchedFor = useRef(new Set<string>());

  function setF2(next: F2State | ((prev: F2State) => F2State)) {
    updateF2(next);
  }

  function patchLine(index: number, patch: Partial<F2Line>) {
    setF2((prev) => updateLine(prev, index, patch));
  }

  function openPanelPicker(lineIndex: number) {
  setDraftF2(f2);
  setPickerLine(lineIndex);
}

function cancelPanelPicker() {
  setPickerLine(null);
  setDraftF2(null);
}

function submitPanelPicker() {
  if (!draftF2) return;
  setF2({ ...draftF2, openLine: -1 });
  cancelPanelPicker();
}

  async function fillFromProductionOrder(order: string, force = false) {
    const trav = order.trim();
    if (!trav) return;
    if (!force && fetchedFor.current.has(trav)) return;
    fetchedFor.current.add(trav);
    try {
      const result = await lookupCocByProductionOrder(trav);
      updateF2((prev) =>
        applyPcbDetailsToF2(prev, {
          productionOrder: trav,
          launchPanel: result.coc.launchPanel ?? "",
        }),
      );
    } catch {
      fetchedFor.current.delete(trav);
    }
  }

  const lineKeys = f2.lines.map((line) => line.prod.trim()).join("|");
  useEffect(() => {
    for (const line of f2.lines) {
      const trav = line.prod.trim();
      if (!trav || fetchedFor.current.has(trav)) continue;
      void fillFromProductionOrder(trav);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineKeys]);

  return (
    <div className="space-y-3">
      <section style={{ ["--section-accent" as string]: accents[0] }} className="panel panel-accent relative overflow-hidden p-3.5 sm:p-4">
        <SectionHead
          title="Supply setup"
          subtitle="Traceability of the supplied boards by serial number across week codes and production orders."
        />
        <div className="mt-3 grid gap-x-3 gap-y-2.5 sm:grid-cols-2 xl:grid-cols-4">
          <label className="min-w-0">
            <span className="label-eyebrow mb-1 flex items-center gap-1.5">
              Report Number
              <span className="rounded bg-primary/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-primary">
                Linked
              </span>
            </span>
            <input
              className={cn(inputClass, "h-[38px]")}
              value={f2ReportNumber(state.shared.cocNumber || "")}
              readOnly
              title="Bound to F1 COC number"
            />
          </label>
          <label className="min-w-0">
            <span className="label-eyebrow mb-1 block">Supply form</span>
            <select
              className={cn(inputClass, "h-[38px] cursor-pointer appearance-none pr-7")}
              value={f2.supplyForm}
              onChange={(e) => {
                const supplyForm = e.target.value;
                setF2((prev) => ({
                  ...prev,
                  supplyForm,
                  perArray: isArrayLikeSupply(supplyForm) ? prev.perArray : "",
                }));
              }}
            >
              {[...new Set([...F2_SUPPLY_FORM_OPTIONS, f2.supplyForm].filter(Boolean))].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="label-eyebrow mb-1 block">PCB / Array</span>
            <input
              className={cn(inputClass, "h-[38px]")}
              type="number"
              min={1}
              disabled={!arrayLike}
              placeholder={arrayLike ? "No. of PCBs per array" : "Single board"}
              value={f2.perArray}
              onChange={(e) => setF2((prev) => ({ ...prev, perArray: e.target.value }))}
            />
          </label>
          <label className="min-w-0">
            <span className="label-eyebrow mb-1 block">PCB / Panel</span>
            <input
              className={cn(inputClass, "h-[38px]")}
              type="number"
              min={1}
              placeholder="Count"
              value={f2.perPanel}
              onChange={(e) => setF2((prev) => ({ ...prev, perPanel: e.target.value }))}
            />
          </label>
          <label className="min-w-0">
            <span className="label-eyebrow mb-1 block">Panel no. digits</span>
            <select
              className={cn(inputClass, "h-[38px] cursor-pointer appearance-none pr-7")}
              value={f2.panelDigits}
              onChange={(e) => setF2((prev) => ({ ...prev, panelDigits: e.target.value }))}
            >
              {F2_PANEL_DIGIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <CollapsiblePanel
        accent={accents[1]}
        title={<SectionHead title="Production orders" subtitle="Each line has its own week code. No. of panels is fetched from Traveler LaunchPanel and can be edited." />}
        headerExtra={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setF2((prev) => {
                  const prod = prodOptions[0] || prev.lines[0]?.prod || "";
                  const source = prev.lines.find((line) => line.prod === prod);
                  const line = emptyF2Line(prod);
                  if (source?.panels) line.panels = source.panels;
                  return { ...prev, lines: [...prev.lines, line] };
                })
              }
              className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
            >
              <Plus className="size-3.5" /> Add production order
            </button>
            <button
              type="button"
              onClick={() => setF2(defaultF2State(prodOptions))}
              className="inline-flex h-7 items-center rounded-md border px-2.5 text-[12px] font-medium text-ink"
            >
              Reset form
            </button>
          </div>
        }
      >
        <div className="scrollbar-slim overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-[12px]">
            <thead>
              <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                <th className="px-2 py-1.5 text-left">Prod. ord. no.</th>
                <th className="px-2 py-1.5 text-left">Week code</th>
                <th className="w-[160px] px-2 py-1.5 text-right">No. of panels</th>
                <th className="w-[90px] px-2 py-1.5 text-right">Arrays</th>
                <th className="w-[110px] px-2 py-1.5 text-right">Total PCBs</th>
                <th className="px-2 py-1.5 text-left">Rejections</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {f2.lines.map((line, i) => {
                const panels = Number(line.panels) || 0;
                const pcbRej = pcbRejectCount(line);
                const open = f2.openLine === i;
                const selectDisabled = !(panels > 0 && per > 0);
                const rejSummary = selectDisabled
                  ? "Set panels first"
                  : line.rejP.length === 0 && pcbRej === 0
                    ? "None rejected"
                    : `${line.rejP.length ? `${line.rejP.length} panel${line.rejP.length === 1 ? "" : "s"}` : ""}${
                        line.rejP.length && pcbRej ? " · " : ""
                      }${pcbRej ? `${pcbRej} PCB${pcbRej === 1 ? "" : "s"}` : ""}`;
                return (
                  <Fragment key={`line-${i}`}>
                    <tr key={`line-${i}`} className="border-t border-border/60">
                      <td className="px-2 py-1.5">
                        <select
                          className={cn(inputClass, "h-8 cursor-pointer appearance-none pr-7")}
                          value={line.prod}
                          onChange={(e) => {
                            const prod = e.target.value;
                            setF2((prev) => setLinePanels(updateLine(prev, i, { prod }), i, ""));
                            void fillFromProductionOrder(prod, true);
                          }}
                        >
                          <option value=""></option>
                          {prodOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={cn(inputClass, "h-8")}
                          value={line.week}
                          placeholder=""
                          onChange={(e) => patchLine(i, { week: e.target.value })}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          className={cn(inputClass, "h-8 text-right")}
                          type="number"
                          min={0}
                          value={line.panels}
                          title="Fetched from Traveler LaunchPanel — you can edit this"
                          onChange={(e) => setF2((prev) => setLinePanels(prev, i, e.target.value))}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-ink">
                        {arraysPerPanel(f2) ? String(lineArrays(f2, line)) : ""}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-ink">
                        {lineTotal(f2, line) ? String(lineTotal(f2, line)) : ""}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={selectDisabled}
                           onClick={() => openPanelPicker(i)}
                            className="h-8 rounded-md border px-2.5 text-[12px] font-medium text-ink disabled:opacity-40"
                          >
                            Select
                          </button>
                          <span className="text-[11px] text-muted-foreground">{rejSummary}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {f2.lines.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setF2((prev) => ({
                                ...prev,
                                lines: prev.lines.filter((_, j) => j !== i),
                                openLine: -1,
                              }))
                            }
                            className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Remove line"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-3.5 py-2.5 text-[12px] text-muted-foreground sm:px-4">{linesNote(f2)}</p>
      </CollapsiblePanel>

      <CollapsiblePanel
        accent={accents[2]}
        title={<SectionHead title="Shipments" subtitle="Partial dispatches against this order." />}
        headerExtra={<p className="max-w-xl text-right text-[12px] text-muted-foreground">{shipNote(f2, orderQty, custSpec)}</p>}
      >
        <div className="scrollbar-slim max-h-[260px] overflow-auto">
          <table className="w-full min-w-[720px] border-collapse text-[12px]">
            <thead>
              <tr className="sticky top-0 bg-muted/40 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                <th className="w-[140px] px-2 py-1.5 text-left">Dispatch no.</th>
                <th className="w-[150px] px-2 py-1.5 text-left">Date</th>
                <th className="w-[110px] px-2 py-1.5 text-right">Qty shipped</th>
                <th className="px-2 py-1.5 text-left">Remarks</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {f2.ships.map((ship, i) => {
                const qty = shipQty(f2, i, custSpec);
                return (
                  <tr key={dispatchLabel(i)} className="border-t border-border/60">
                    <td className="px-2 py-1.5 tabular-nums text-ink">{dispatchLabel(i)}</td>
                    <td className="px-2 py-1.5">
                      <input
                        className={cn(inputClass, "h-8")}
                        type="date"
                        value={ship.date}
                        onChange={(e) =>
                          setF2((prev) => ({
                            ...prev,
                            ships: prev.ships.map((row, j) => (j === i ? { ...row, date: e.target.value } : row)),
                          }))
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-medium text-ink">{qty.value}</td>
                    <td className="px-2 py-1.5">
                      <input
                        className={cn(inputClass, "h-8")}
                        placeholder=""
                        value={ship.note}
                        onChange={(e) =>
                          setF2((prev) => ({
                            ...prev,
                            ships: prev.ships.map((row, j) => (j === i ? { ...row, note: e.target.value } : row)),
                          }))
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      {f2.ships.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setF2((prev) => ({
                              ...prev,
                              ships: prev.ships.filter((_, j) => j !== i),
                            }))
                          }
                          className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Remove shipment"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3.5 py-2.5 sm:px-4">
          <div className="flex gap-2">
            <span className="rounded-lg border px-3 py-1.5 text-[12px] text-ink">
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Supplied</span>
              <span className="tabular-nums">{countSupplied(f2, custSpec)}</span>
            </span>
            <span className="rounded-lg border px-3 py-1.5 text-[12px] text-ink">
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Stock</span>
              <span className="tabular-nums">{countStock(f2, custSpec)}</span>
            </span>
            <span className="rounded-lg border border-destructive/30 px-3 py-1.5 text-[12px] text-ink">
              <span className="mr-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-destructive">Rejected</span>
              <span className="tabular-nums">{countRejected(f2, custSpec)}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setF2((prev) => ({ ...prev, ships: [...prev.ships, { qty: "", date: "", note: "" }] }))}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground hover:brightness-110"
          >
            <Plus className="size-3.5" /> Add shipment
          </button>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        accent={accents[3]}
        title={<SectionHead title={serialColHeading(f2)} subtitle={serialSummary(f2, orderQty, custSpec)} />}
        headerExtra={
          <div className="flex rounded-lg border p-0.5">
            {(["All", "Supplied", "To stock", "Rejected"] as F2SerialView[]).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setF2((prev) => ({ ...prev, serialView: view }))}
                className={cn(
                  "h-7 rounded-md px-2.5 text-[12px] font-medium",
                  f2.serialView === view ? "bg-primary text-primary-foreground" : "text-ink hover:bg-primary/8",
                )}
              >
                {view === "Supplied" ? "Supplied" : view}
              </button>
            ))}
          </div>
        }
      >
        <div className="scrollbar-slim max-h-[460px] overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-[12px]">
            <thead>
              <tr className="sticky top-0 bg-muted/40 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                <th className="w-12 px-2 py-1.5 text-left">S. no.</th>
                <th className="px-2 py-1.5 text-left">PCB serial number</th>
                {arrayOn ? (
                  <>
                    <th className="px-2 py-1.5 text-left">Array no.</th>
                    <th className="px-2 py-1.5 text-left">Panel no.</th>
                  </>
                ) : (
                  <>
                    <th className="px-2 py-1.5 text-left">PCB no.</th>
                    <th className="px-2 py-1.5 text-left">Panel no.</th>
                  </>
                )}
                <th className="px-2 py-1.5 text-left">Week code</th>
                <th className="px-2 py-1.5 text-left">Production order no.</th>
                <th className="w-[140px] px-2 py-1.5 text-left">Disposition</th>
                <th className="w-[200px] px-2 py-1.5 text-left">Rejection reason</th>
              </tr>
            </thead>
            <tbody>
              {serials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-[13px] text-muted-foreground">
                    {allSerials.length === 0
                      ? "Enter PCBs per panel and no. of panels to generate serials."
                      : "No serials in this view."}
                  </td>
                </tr>
              ) : (
                serials.map((row) => (
                  <tr key={`${row.prod}-${row.serial}-${row.ref}`} className="border-t border-border/60">
                    <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{row.ref}</td>
                    <td className="px-2 py-1.5 tabular-nums font-medium text-ink">{row.serial}</td>
                    <td className="px-2 py-1.5 tabular-nums text-ink">{arrayOn ? row.arrayNo : row.pcb}</td>
                    <td className="px-2 py-1.5 tabular-nums text-ink">{row.panel}</td>
                    <td className="px-2 py-1.5 text-ink">{row.week}</td>
                    <td className="px-2 py-1.5 tabular-nums text-ink">{row.prod}</td>
                    <td className="px-2 py-1.5">
                      <select
                        disabled={row.hardRejected}
                        className={cn(
                          inputClass,
                          "h-8 cursor-pointer appearance-none pr-7",
                          row.assigned === "Rejected" && "border-destructive bg-destructive text-destructive-foreground",
                          row.assigned === "Stock" && "border-warning bg-[color-mix(in_oklab,var(--warning)_18%,white)]",
                          row.assigned.startsWith("DN-") && "border-primary bg-primary/12 text-primary",
                        )}
                        value={row.assigned}
                        onChange={(e) => {
                          const value = e.target.value;
                          setF2((prev) => {
                            const assign = { ...prev.assign };
                            if (value === "Unassigned") delete assign[row.id];
                            else assign[row.id] = value;
                            return { ...prev, assign };
                          });
                        }}
                      >
                        {dispositionOptions(f2).map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        disabled={!row.rejected}
                        className={cn(inputClass, "h-8 cursor-pointer appearance-none pr-7")}
                        value={row.reason}
                        onChange={(e) => {
                          const value = e.target.value;
                          setF2((prev) => {
                            const reasons = { ...prev.reasons };
                            if (value === "") delete reasons[row.id];
                            else reasons[row.id] = value;
                            return { ...prev, reasons };
                          });
                        }}
                      >
                        {F2_REASON_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-3.5 py-2.5 text-[12px] text-muted-foreground sm:px-4">
          Supply form, PCB / Array, PCB / Panel and panel digits are common to the report. Each production order line
          carries its own week code and panel count; panel numbers restart at 001 on each line.
        </p>
      </CollapsiblePanel>
      <Dialog
  open={pickerLine !== null}
  onOpenChange={(open) => {
    if (!open) cancelPanelPicker();
  }}
>
  <DialogContent className="flex h-[82vh] max-h-[82vh] w-[96vw] max-w-[1280px] flex-col gap-0 overflow-hidden rounded-lg border p-4 sm:p-5">
    <DialogHeader>
          {draftF2 ? (
      <label className="mt-3 block">
        <span className="label-eyebrow mb-1 block">
          PCB serial start (previous number)
        </span>
        <input
          className={cn(inputClass, "h-8 w-48")}
          type="number"
          min={0}
          step={1}
          placeholder="0"
          value={draftF2.serialStart}
          onChange={(event) =>
            setDraftF2((prev) =>
              prev ? { ...prev, serialStart: event.target.value } : prev,
            )
          }
        />
      </label>
    ) : null}
      <DialogTitle>Select panels and PCBs</DialogTitle>
      <DialogDescription>
        Select a mark, then choose a panel, array, or PCB.
      </DialogDescription>
    </DialogHeader>

    {pickerLine !== null && draftF2?.lines[pickerLine] ? (
      <div className="min-h-0 flex-1 overflow-hidden py-3">
        <PanelPicker
          f2={draftF2}
          line={draftF2.lines[pickerLine]}
          lineIndex={pickerLine}
          custSpec={custSpec}
          onMarkMode={(markMode) =>
            setDraftF2((prev) => (prev ? { ...prev, markMode } : prev))
          }
          onTogglePanel={(panel) =>
            setDraftF2((prev) =>
              prev ? togglePanelReject(prev, pickerLine, panel) : prev,
            )
          }
          onMark={(panel, members) =>
            setDraftF2((prev) =>
              prev ? markBoards(prev, pickerLine, panel, members) : prev,
            )
          }
          onClear={() =>
  setDraftF2((prev) =>
    prev && pickerLine !== null ? clearLineMarks(prev, pickerLine) : prev,
  )
}
onOtherRemark={(panel, pcb, remark) => {
  setDraftF2((prev) => {
    if (!prev || pickerLine === null) return prev;
    const key = assignKey(prev, pickerLine, panel, pcb);
    return {
      ...prev,
      otherRemarks: { ...prev.otherRemarks, [key]: remark },
    };
  });
}}
        />
      </div>
    ) : null}

    <DialogFooter className="border-t pt-3">
      <button
        type="button"
        onClick={cancelPanelPicker}
        className="h-8 rounded-md border px-3 text-[12px] font-medium"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={submitPanelPicker}
        disabled={!draftF2}
        className="h-8 rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        Submit
      </button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {report.sections
        .filter((s): s is Extract<Section, { kind: "signoff" }> => s.kind === "signoff")
        .map((section, i) => (
          <section
            key={`signoff-${i}`}
            style={{ ["--section-accent" as string]: accents[3] }}
            className="panel panel-accent relative overflow-hidden p-3.5 sm:p-4"
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {section.title || "Inspection Sign-off"}
            </p>
            <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
              {(section.fields ?? []).map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {field.label}
                  </span>
                  <input
                    className={cn(inputClass, "h-[38px]")}
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

function PanelPicker({
  f2,
  line,
  lineIndex,
  custSpec,
  onMarkMode,
  onTogglePanel,
  onMark,
  onClear,
}: {
  f2: F2State;
  line: F2Line;
  lineIndex: number;
  custSpec: string;
  onMarkMode: (mode: F2MarkMode) => void;
  onTogglePanel: (panel: number) => void;
  onMark: (panel: number, members: number[]) => void;
  onClear: () => void;
  onOtherRemark: (panel: number, pcb: number, remark: string) => void;
}) {
  const per = perPcb(f2);
  const panels = Number(line.panels) || 0;
  const apc = arraysPerPanel(f2);
  const perArr = Number(f2.perArray) || 0;
  const psFormat = isPs30051(custSpec);
  const modes: { id: F2MarkMode; label: string }[] = [
    { id: "Supplied", label: "Order Qty" },
    { id: "Rejected", label: "Rejected Qty" },
    { id: "Stock", label: "Stock" },
    { id: "FAI", label: "FAI" },
    { id: "Others", label: "Others" },
  ];

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">
          {apc ? "Panels & PCB — panels, arrays or individual PCBs" : "Panels & PCB"} — {line.prod || "unassigned order"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Mark as</span>
          <div className="flex rounded-lg border p-0.5">
            {modes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => onMarkMode(mode.id)}
                className={cn(
                  "h-7 rounded-md px-2.5 text-[12px] font-medium",
                  f2.markMode === mode.id ? "bg-primary text-primary-foreground" : "text-ink hover:bg-primary/8",
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClear} className="h-7 rounded-md px-2.5 text-[12px] font-medium text-ink">
            Clear marks
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-primary" /> Order Qty
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-destructive" /> Rejected Qty
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-warning" /> Stock
        </span>
        <span className="inline-flex items-center gap-1.5">
  <span className="size-3 rounded-sm bg-teal-600" /> FAI
</span>
<span className="inline-flex items-center gap-1.5">
  <span className="size-3 rounded-sm bg-slate-500" /> Others
</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm border border-border" /> Unmarked
        </span>
        <span>
  Order Qty, Rejected Qty, Stock, and Others are exclusive marks. FAI is additional and can only be marked on Order Qty boards or a whole Order Qty array.
</span>
      </div>
      <div className="min-h-0 overflow-y-auto">
        {Array.from({ length: panelRowsLimit(panels) }, (_, idx) => idx + 1).map((k) => {
          const panelOff = line.rejP.includes(k);
          const rc = line.rejC[String(k)] || [];
          const groups = apc || 1;
          const size = apc ? perArr : per;
          return (
            <div key={k} className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-2">
              <button
                type="button"
                onClick={() => onTogglePanel(k)}
                className={cn("h-7 min-w-16 rounded-md border px-2 text-[12px] font-medium", chipClass(panelOff ? "Rejected" : "Open"))}
              >
                {f2PanelLabel(f2, lineIndex, k, custSpec)}
              </button>
              {Array.from({ length: Math.min(groups, 40) }, (_, g) => {
                const members: number[] = [];
                for (let n = 1; n <= size; n++) {
                  const pcbIndex = g * size + n;
                  if (pcbIndex <= per) members.push(pcbIndex);
                }
                const states = members.map((n) => boardState(f2, lineIndex, k, n));
                const groupState = states.length && states.every((st) => st === states[0]) ? states[0] : "Open";
                const arrayFaiMarked =
  members.length > 0 &&
  members.every((n) => Boolean(f2.fai[assignKey(f2, lineIndex, k, n)]));
                return (
                  <span key={g} className="inline-flex flex-wrap items-center gap-1 rounded-md border border-dashed border-border px-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => onMark(k, members)}
                      className={cn("h-7 rounded-md border px-2 text-[12px] font-medium", chipClass(panelOff ? "Rejected" : groupState),
                      arrayFaiMarked && "border-teal-600 bg-teal-600 text-white",
                    )}
                    >
                      {apc ? `Array ${g + 1}` : "PCBs"}
                    </button>
                    {members.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => onMark(k, [n])}
                        className={cn(
                          "h-7 min-w-8 rounded-md border px-2 text-[12px] font-medium tabular-nums",
                          chipClass(panelOff ? "Rejected" : boardState(f2, lineIndex, k, n)),
                          f2.fai[assignKey(f2, lineIndex, k, n)] &&
                          "border-teal-600 bg-teal-600 text-white",
                        )}
                      >
                        {f2PcbNumber(
  f2,
  n,
  (k - 1) * per + n,
  psFormat ? 3 : 2,
)}
                      </button>
                    ))}
                  </span>
                );
              })}
              <span className="text-[11px] text-muted-foreground">
                {panelOff ? "whole panel rejected" : rc.length ? `${rc.length} PCB rejected` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
