import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { ApiError, deleteReportFile, openReportFile, uploadReportFile } from "@/lib/api";
import { readAppRoute } from "@/lib/app-route";
import { stepStyle } from "@/lib/reports/palette";
import { useReports } from "@/lib/report-store";
import {
  F3_CERT_TEXT,
  F3_RESULT_OPTS,
  f3CertMerge,
  f3ResultLocked,
  f3SolderMaskLocked,
  f3LegendPrintLocked,
  f3ViaFillLocked,
  f3ObservationLocked,
  f3RefersF4Observation,
  f3RefersF5Observation,
  f3RefersF7Observation,
  f3RefersF15Observation,
  f3RefersF16Observation,
  f3ImpedanceControl,
  f3SolderMaskPresent,
  f3ResultIsNa,
  f3SectionInspectorUpdates,
  isClaudeF3Checklist,
  parseF3Attachments,
  serializeF3Attachments,
  type F3Attachment,
  f3RefersF6Observation,
} from "@/lib/reports/f3-logic";
import { acceptedPanelsTotal, f2LotSize, mergeF2State } from "@/lib/reports/f2-logic";
import { cn } from "@/lib/utils";
import { CollapsiblePanel } from "@/components/report/SectionCollapse";

const cellClass =
  "w-full h-7 rounded-md border border-transparent bg-transparent px-1.5 text-[11px] text-ink outline-none transition-colors placeholder:text-muted-foreground/55 hover:border-input focus:border-primary focus:bg-field focus:ring-1 focus:ring-primary/15";

const F3_COL_DEFAULTS = [52, 240, 130, 130, 170, 120, 86, 180, 120, 92, 170];
const F3_COL_MIN = 48;

function useColumnWidths(defaults: number[]) {
  const [widths, setWidths] = useState(defaults);
  const drag = useRef<{ index: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const active = drag.current;
      if (!active) return;
      const next = Math.max(F3_COL_MIN, active.startW + (e.clientX - active.startX));
      setWidths((prev) => {
        if (prev[active.index] === next) return prev;
        const copy = prev.slice();
        copy[active.index] = next;
        return copy;
      });
    }
    function onUp() {
      drag.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  function startResize(index: number, e: ReactMouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    drag.current = { index, startX: e.clientX, startW: widths[index] ?? defaults[index] ?? F3_COL_MIN };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return { widths, startResize, tableWidth: widths.reduce((sum, w) => sum + w, 0) };
}

function ResizableTh({
  width,
  onResizeStart,
  children,
  className,
}: {
  width: number;
  onResizeStart: (e: ReactMouseEvent) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      style={{ width, minWidth: width }}
      className={cn(
        "relative border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
        className,
      )}
    >
      {children}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize column"
        title="Drag to resize"
        className="absolute right-0 top-0 z-[3] h-full w-2 cursor-col-resize hover:bg-primary/40"
        onMouseDown={onResizeStart}
      />
    </th>
  );
}

function savedReportId(): string | null {
  const route = readAppRoute();
  if (route.view !== "editor" || !route.reportId || route.reportId === "new") return null;
  return route.reportId;
}

export function F3Checklist() {
  const { getRows, setCell, state } = useReports();
  const rows = getRows("f3", "checklist");
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { widths, startResize, tableWidth } = useColumnWidths(F3_COL_DEFAULTS);
  const f2 = mergeF2State(state.f2, state.combinedProductionOrders || []);
  const spec = state.shared.specification || "";
  const layers = state.shared.layers || "";
  const impedanceControl = state.fields["f1.impedanceControl"] || "";
  const viaProtection = state.shared.viaProtection || "";
  const solderMask = state.shared.solderMask || "";
  const legendPrint = state.shared.legendPrint || "";
  const lot = f2LotSize(f2, spec);
  const panels = acceptedPanelsTotal(f2);
  const reportId = savedReportId();

  async function addFiles(index: number, current: F3Attachment[], list: FileList | null) {
    if (!list?.length) return;
    if (!reportId) {
      window.alert("Save the report first, then upload documents.");
      return;
    }
    const sl = getRows("f3", "checklist")[index]?.sl || "";
    const key = `f3-file-${sl || index}`;
    setBusyKey(key);
    try {
      const added: F3Attachment[] = [];
      for (const file of Array.from(list)) {
        const result = await uploadReportFile(reportId, file, { form: "f3", rowSl: sl });
        added.push({ id: result.file.id, name: result.file.name, path: result.file.path });
      }
      setCell("f3", "checklist", index, "attachments", serializeF3Attachments([...current, ...added]));
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function removeFile(index: number, files: F3Attachment[], fileIndex: number) {
    const target = files[fileIndex];
    if (!target) return;
    if (target.id && reportId) {
      try {
        await deleteReportFile(reportId, target.id);
      } catch {
        /* still drop the chip if the file is already gone */
      }
    }
    setCell(
      "f3",
      "checklist",
      index,
      "attachments",
      serializeF3Attachments(files.filter((_, i) => i !== fileIndex)),
    );
  }

  if (!isClaudeF3Checklist(rows)) return null;

  const sectionLeads = new Set<number>();
  let nextIsLead = true;
  rows.forEach((row, i) => {
    if (row.__group) nextIsLead = true;
    else if (nextIsLead) {
      sectionLeads.add(i);
      nextIsLead = false;
    }
  });

  return (
    <CollapsiblePanel
      accent={stepStyle(1).color}
      title={
        <div>
          <h3 className="font-display text-[13px] font-semibold leading-tight text-ink">Inspection Checklist</h3>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Acceptance testing and frequency — IPC-6012F, table 4-3
          </p>
        </div>
      }
      headerExtra={
        <p className="text-[12px] text-muted-foreground">
          {lot > 0
            ? `C=0 per IPC-6012 table 4-2 · lot ${lot}${panels ? ` · ${panels} accepted panel${panels === 1 ? "" : "s"}` : ""}`
            : "Complete F2 panel entry — C=0 table 4-2"}
        </p>
      }
    >
      <div className="scrollbar-slim max-h-[560px] overflow-auto">
        <table
          className="w-full table-fixed border-collapse text-[12.5px]"
          style={{ width: tableWidth, minWidth: tableWidth }}
        >
          <colgroup>
            {widths.map((width, i) => (
              <col key={i} style={{ width }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-[2] bg-[color:var(--glass-bg-strong,white)]">
            <tr className="bg-muted/40">
              <ResizableTh width={widths[0]!} onResizeStart={(e) => startResize(0, e)}>
                Sl. No.
              </ResizableTh>
              <ResizableTh width={widths[1]!} onResizeStart={(e) => startResize(1, e)}>
                Characteristics
              </ResizableTh>
              <ResizableTh width={widths[2]!} onResizeStart={(e) => startResize(2, e)}>
                Requirement
                <br />
                As per IPC-6012F
              </ResizableTh>
              <ResizableTh width={widths[3]!} onResizeStart={(e) => startResize(3, e)}>
                Sample
              </ResizableTh>
              <ResizableTh width={widths[4]!} onResizeStart={(e) => startResize(4, e)}>
                Inspection / Test Method
              </ResizableTh>
              <ResizableTh width={widths[5]!} onResizeStart={(e) => startResize(5, e)}>
                Sample Size
              </ResizableTh>
              <ResizableTh width={widths[6]!} onResizeStart={(e) => startResize(6, e)}>
                Sample Qty
              </ResizableTh>
              <ResizableTh width={widths[7]!} onResizeStart={(e) => startResize(7, e)}>
                Observations
              </ResizableTh>
              <ResizableTh width={widths[8]!} onResizeStart={(e) => startResize(8, e)}>
                <em>Inspected by</em>
              </ResizableTh>
              <ResizableTh width={widths[9]!} onResizeStart={(e) => startResize(9, e)}>
                Result
              </ResizableTh>
              <ResizableTh width={widths[10]!} onResizeStart={(e) => startResize(10, e)}>
                Remarks
              </ResizableTh>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              if (row.__group) {
                return (
                  <tr key={`g-${index}`}>
                    <td
                      colSpan={11}
                      className="bg-primary/6 px-2 py-1.5 text-center font-display text-[14px] font-semibold uppercase tracking-[0.14em] text-primary"
                    >
                      {row.__group}
                    </td>
                  </tr>
                );
              }

              const upload = row.upload === "1";
              const attach = row.attach === "1" || upload;
              const qtyDerived = row.qtyDerived === "1" || row.__ro_qty === "1";
              const special = row.sampleEditable === "1" || Number(row.sl) >= 40;
              const files = parseF3Attachments(row);
              const inputId = `f3-file-${row.sl || index}`;
              const certMerge = f3CertMerge(rows, index);
              const resultLocked = f3ResultLocked(row.sl || "", layers, impedanceControl, viaProtection, solderMask, legendPrint);
              const obsLocked =
                f3ObservationLocked(row.sl || "") ||
                row.__ro_obs === "1" ||
                (row.sl === "39" && f3SolderMaskPresent(solderMask));
              const resultNa = f3ResultIsNa(row.result);
              const uploadRequired =
                !resultNa &&
                ((row.sl === "40" && f3ImpedanceControl(impedanceControl) === "Yes") ||
                  (row.sl === "39" && f3SolderMaskPresent(solderMask)));
              const uploadDisabled =
                resultNa ||
                row.__ro_upload === "1" ||
                f3SolderMaskLocked(row.sl || "", solderMask) ||
                f3LegendPrintLocked(row.sl || "", legendPrint) ||
                f3ViaFillLocked(row.sl || "", viaProtection);

              return (
                <tr key={row.sl || index} className="border-b border-border/60 last:border-0 hover:bg-primary/4">
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{row.sl}</td>
                  <td className="px-2 py-1.5 text-ink">{row.characteristic}</td>
                  <td className="px-2 py-1.5 tabular-nums text-ink">{row.req}</td>
                  {certMerge.kind === "start" ? (
                    <td
                      colSpan={5}
                      rowSpan={certMerge.rowSpan}
                      className="px-2 py-1.5 text-center align-middle text-ink"
                    >
                      {row.method || F3_CERT_TEXT}
                    </td>
                  ) : certMerge.kind === "cont" ? null : (
                    <>
                      <td className="px-0.5">
                        {special ? (
                          <input
                            className={cellClass}
                            placeholder=""
                            defaultValue={row.specimen}
                            key={`sp-${row.sl}-${row.specimen}`}
                            onBlur={(e) => {
                              if (e.target.value !== row.specimen) setCell("f3", "checklist", index, "specimen", e.target.value);
                            }}
                          />
                        ) : (
                          <div className="px-1.5 py-1.5 text-ink">{row.specimen || ""}</div>
                        )}
                      </td>
                      <td className="px-0.5">
                        <input
                          className={cellClass}
                          placeholder=""
                          defaultValue={row.method}
                          key={`m-${row.sl}-${row.method}`}
                          onBlur={(e) => {
                            if (e.target.value !== row.method) setCell("f3", "checklist", index, "method", e.target.value);
                          }}
                        />
                      </td>
                      <td className="px-0.5">
                        {special ? (
                          <input
                            className={cellClass}
                            placeholder=""
                            defaultValue={row.sample}
                            key={`s-${row.sl}-${row.sample}`}
                            onBlur={(e) => {
                              if (e.target.value !== row.sample) setCell("f3", "checklist", index, "sample", e.target.value);
                            }}
                          />
                        ) : (
                          <div className="px-1.5 py-1.5 text-ink">{row.sample || ""}</div>
                        )}
                      </td>
                      <td className="px-0.5">
                        {qtyDerived ? (
                          <div className="px-1.5 py-1.5 text-right tabular-nums text-ink">{row.qty || ""}</div>
                        ) : (
                          <input
                            className={cn(cellClass, "text-right")}
                            placeholder=""
                            defaultValue={row.qty}
                            key={`q-${row.sl}-${row.qty}`}
                            onBlur={(e) => {
                              if (e.target.value !== row.qty) setCell("f3", "checklist", index, "qty", e.target.value);
                            }}
                          />
                        )}
                      </td>
                      <td className="px-0.5">
                        {obsLocked ? (
                          <div
                            className="px-1.5 py-1.5 text-ink"
                            title={
                              row.sl === "40"
                                ? "From PCB details impedance control"
                                : row.sl === "39"
                                  ? "From PCB details solder mask"
                                  : f3RefersF4Observation(row.sl || "")
                                    ? "Linked to F4 report number (ET- plus COC number)"
                                  : f3RefersF5Observation(row.sl || "")
                                    ? "Linked to F5 report number (MI- plus COC number)"
                                    : f3RefersF6Observation(row.sl || "")
                                    ? "Linked to F6 structural integrity report number (SI- plus production order and date)"
                                    : f3RefersF7Observation(row.sl || "")
                                      ? "Linked to F7 report number (CA- plus COC number)"
                                      : f3RefersF16Observation(row.sl || "")
                                        ? "Linked to F16 report number (AT- plus COC number)"
                                        : f3RefersF15Observation(row.sl || "")
                                          ? "Linked to F15 report number (ST- plus COC number)"
                                          : undefined
                            }
                          >
                            {row.obs || ""}
                          </div>
                        ) : (
                          <input
                            className={cellClass}
                            placeholder=""
                            defaultValue={row.obs}
                            key={`o-${row.sl}-${row.obs}`}
                            onBlur={(e) => {
                              if (e.target.value !== row.obs) setCell("f3", "checklist", index, "obs", e.target.value);
                            }}
                          />
                        )}
                      </td>
                    </>
                  )}
                  <td className="px-0.5">
                    <input
                      className={cellClass}
                      placeholder="Name"
                      title={
                        sectionLeads.has(index)
                          ? "Applies to this section. You can still change any row."
                          : undefined
                      }
                      defaultValue={row.inspector}
                      key={`i-${row.sl}-${row.inspector}`}
                      onBlur={(e) => {
                        for (const update of f3SectionInspectorUpdates(rows, index, e.target.value)) {
                          setCell("f3", "checklist", update.index, "inspector", update.value);
                        }
                      }}
                    />
                  </td>
                  <td className="px-0.5">
                    <select
                      className={cn(cellClass, "cursor-pointer appearance-none pr-6 disabled:cursor-not-allowed disabled:opacity-70")}
                      value={row.result || ""}
                      disabled={resultLocked}
                      onChange={(e) => setCell("f3", "checklist", index, "result", e.target.value)}
                    >
                      <option value=""></option>
                      {F3_RESULT_OPTS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <input
                        className={cn(cellClass, "min-w-0 flex-1")}
                        placeholder=""
                        defaultValue={row.remarks}
                        key={`r-${row.sl}-${row.remarks}`}
                        onBlur={(e) => {
                          if (e.target.value !== row.remarks) setCell("f3", "checklist", index, "remarks", e.target.value);
                        }}
                      />
                      {attach ? (
                        <>
                          <input
                            ref={(el) => {
                              fileRefs.current[inputId] = el;
                            }}
                            id={inputId}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              void addFiles(index, files, e.target.files);
                              e.target.value = "";
                            }}
                          />
                          <button
                            type="button"
                            disabled={busyKey === inputId || uploadDisabled}
                            title={
                              uploadDisabled
                                ? resultNa
                                  ? "Disabled — result is NA"
                                  : row.sl === "4"
                                    ? "Disabled — solder mask is NO MASK, COVERLAY, or blank"
                                    : row.sl === "5"
                                      ? "Disabled — legend print is No"
                                      : row.sl === "6"
                                        ? "Disabled — via protection is not Type V, VI or VII"
                                        : "Upload disabled"
                                : undefined
                            }
                            className={cn(
                              "h-7 shrink-0 rounded-md border px-2 text-[10px] font-semibold uppercase tracking-[0.04em] hover:bg-primary/8 disabled:cursor-not-allowed disabled:opacity-50",
                              uploadRequired && !files.length
                                ? "border-destructive text-destructive"
                                : "border-border text-ink",
                            )}
                            onClick={() => {
                              if (!reportId) {
                                window.alert("Save the report first, then upload documents.");
                                return;
                              }
                              fileRefs.current[inputId]?.click();
                            }}
                          >
                            {busyKey === inputId ? "Uploading…" : upload ? "Upload CoC" : uploadRequired ? "Upload report *" : "Upload report"}
                          </button>
                          {uploadRequired && !files.length ? (
                            <span className="text-[10px] font-semibold uppercase tracking-[0.04em] text-destructive">Required</span>
                          ) : null}
                        </>
                      ) : null}
                      {files.map((file, fileIndex) => (
                        <span
                          key={`${file.id || file.path || file.name}-${fileIndex}`}
                          className="inline-flex max-w-[140px] items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px]"
                        >
                          <a
                            href={file.dataUrl || "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-primary no-underline"
                            onClick={(e) => {
                              if (file.dataUrl) return;
                              e.preventDefault();
                              if (file.id && reportId) {
                                void openReportFile(reportId, file.id).catch((err) => {
                                  window.alert(err instanceof ApiError ? err.message : "Unable to open file.");
                                });
                              }
                            }}
                          >
                            {file.name}
                          </a>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Remove ${file.name}`}
                            onClick={() => void removeFile(index, files, fileIndex)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </CollapsiblePanel>
  );
}
