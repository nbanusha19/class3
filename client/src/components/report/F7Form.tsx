import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Copy, ImagePlus, Link2, Plus, Trash2, Upload} from "lucide-react";
import { ApiError, deleteReportFile, fetchReportFileBlob, uploadReportFile } from "@/lib/api";
import { readAppRoute } from "@/lib/app-route";
import { stepStyle } from "@/lib/reports/palette";
import { useReports } from "@/lib/report-store";
import { readF7Measurements } from "@/lib/reports/f7-ocr";
import {
  F7_RESULTS,
  F7_SIDES,
  f7BlankMeasureLine,
  f7ImageCol,
  f7LineDisplay,
  f7ReportNumber,
  f7RowLines,
  f7UsesSide,
  f7UsesLayer,
  f7UsesYImage,
  f7RequirementLocked,
  f7CharHidden,
  withDerivedF7Rows,
  parseF7Image,
  serializeF7Image,
  serializeF7Lines,
  type F7Image,
  type F7MeasureLine,
} from "@/lib/reports/f7-logic";
import type { Field, Report, Section } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { CollapsiblePanel } from "@/components/report/SectionCollapse";

const inputClass =
  "h-8 w-full rounded-md border border-border bg-transparent px-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-muted-foreground/55 hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/15";

function alphaSuffix(index: number) {
  let suffix = "";
  let value = index;

  do {
    suffix = String.fromCharCode(97 + (value % 26)) + suffix;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return suffix;
}

function normalizePhotoName(value: string) {
  return value
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function savedReportId(): string | null {
  const route = readAppRoute();
  if (route.view !== "editor" || !route.reportId || route.reportId === "new") return null;
  return route.reportId;
}

function LinkedBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/8 px-1.5 py-px text-[8px] font-semibold tracking-normal text-primary ring-1 ring-primary/15">
      <Link2 className="size-2" /> Linked
    </span>
  );
}

function FieldBox({ label, linked, children }: { label: string; linked?: boolean; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
        {linked ? <LinkedBadge /> : null}
      </p>
      {children}
    </div>
  );
}

function ImageSlot({
  label,
  stage,
  image,
  preview,
  busy,
  disabled,
  onPick,
  onClear,
}: {
  label: string;
  stage: string;
  image: F7Image | null;
  preview: string | null;
  busy: boolean;
  disabled?: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="flex min-h-[220px] flex-col overflow-hidden rounded-lg border border-border bg-muted/20">
      <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className="text-[11px] font-medium text-ink">{stage}</p>
        </div>
        {image ? (
          <button
            type="button"
            disabled={busy || disabled}
            onClick={onClear}
            className="inline-flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-destructive hover:text-destructive disabled:opacity-50"
            title="Remove image"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
        className="relative flex min-h-[180px] flex-1 items-center justify-center bg-black/[0.03] disabled:opacity-60"
      >
        {preview ? (
          <img src={preview} alt={label} className="max-h-[240px] w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-4 text-center text-muted-foreground">
            <ImagePlus className="size-7 opacity-60" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">{busy ? "Uploading…" : "Add microsection photo"}</span>
            <span className="text-[10px]">PNG or JPEG · prints in this box on the PDF</span>
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onPick(file);
        }}
      />
    </div>
  );
}

function MeasureLineTable({
  row,
  onChange,
}: {
  row: Record<string, string>;
  onChange: (lines: F7MeasureLine[]) => void;
}) {
  const ruleSl = row.baseSl || row.sl || "";
  const lines = f7RowLines(row);
  const showSide = f7UsesSide(row.characteristic || "");
  const showLayer = f7UsesLayer(row.characteristic || "", ruleSl);
  const reqLocked = f7RequirementLocked(ruleSl); 
  const compact = "h-7 w-full rounded-md border border-border bg-transparent px-2 text-[12px] text-ink outline-none placeholder:text-muted-foreground/55 hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/15";
  const columns = [showSide && "Side", showLayer && "Layer", "Requirement", "X-direction", "Y-direction"].filter(Boolean).join(" · ");
  function patch(index: number, key: keyof F7MeasureLine, value: string) {
    onChange(lines.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  }
  function patchSplit(index: number, key: "layer" | "requirement", value: string) {
    onChange(
      lines.map((line, i) => {
        if (i !== index) return line;
        const display = f7LineDisplay(line);
        return {
          ...line,
          layer: key === "layer" ? value : display.layer,
          requirement: key === "requirement" ? value : display.requirement,
        };
      }),
    );
  }
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {columns}
        </p>
        {reqLocked ? null : (
        <button
          type="button"
          onClick={() => onChange([...lines, f7BlankMeasureLine(row, lines)])}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground hover:border-primary/40 hover:text-ink"
        >
          <Plus className="size-3" /> Add line
        </button>
        )}
      </div>
      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            {showSide ? <col className="w-[5.75rem]" /> : null}
            {showLayer ? <col className="w-[5.25rem]" /> : null}
            <col />
            <col className="w-[6.5rem]" />
            <col className="w-[6.5rem]" />
            <col className="w-[5.5rem]" />
            <col className="w-[22%]" />
            <col className="w-7" />
          </colgroup>
          <thead>
            <tr className="bg-muted/40 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              {showSide ? <th className="px-1.5 py-1 text-left">Side</th> : null}
              {showLayer ? <th className="px-1.5 py-1 text-left">Layer</th> : null}
              <th className="px-1.5 py-1 text-left">Requirement</th>
              <th className="px-1.5 py-1 text-left">X-direction</th>
              <th className="px-1.5 py-1 text-left">Y-direction</th>
              <th className="px-1.5 py-1 text-left">Result</th>
              <th className="px-1.5 py-1 text-left">Remarks</th>
              <th className="w-7" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => {
              const display = f7LineDisplay(line);
              return (
              <tr key={i} className="border-t border-border/60">
                {showSide ? (
                  <td className="px-1 py-0.5">
                    <select
                      className={cn(compact, "cursor-pointer appearance-none")}
                      value={line.side || ""}
                      onChange={(e) => patch(i, "side", e.target.value)}
                    >
                      <option value=""></option>
                      {F7_SIDES.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                ) : null}
                {showLayer ? (
                <td className="px-1 py-0.5">
                  <input className={compact} value={display.layer} placeholder="L1-L2" onChange={(e) => patchSplit(i, "layer", e.target.value)} />
                </td>
                ) : null}
                <td className="px-1 py-0.5">
                  <input
                    className={cn(compact, reqLocked && "cursor-default bg-muted/30 text-ink")}
                    value={display.requirement}
                    placeholder="Requirement"
                    readOnly={reqLocked}
                    onChange={(e) => {
                      if (!reqLocked) patchSplit(i, "requirement", e.target.value);
                    }}
                  />
                </td>
                <td className="px-1 py-0.5">
                  <input className={compact} value={line.measuredX} placeholder="" onChange={(e) => patch(i, "measuredX", e.target.value)} />
                </td>
                <td className="px-1 py-0.5">
                  <input className={compact} value={line.measuredY} placeholder="" onChange={(e) => patch(i, "measuredY", e.target.value)} />
                </td>
                <td className="px-1 py-0.5">
                  <select className={cn(compact, "cursor-pointer appearance-none")} value={line.result} onChange={(e) => patch(i, "result", e.target.value)}>
                    {F7_RESULTS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1 py-0.5">
                  <input className={compact} value={line.remarks} placeholder="—" onChange={(e) => patch(i, "remarks", e.target.value)} />
                </td>
                <td className="px-0.5 py-0.5 text-center">
                  {reqLocked ? null : (
                  <button
                    type="button"
                    onClick={() => onChange(lines.filter((_, j) => j !== i))}
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remove line"
                  >
                    <Trash2 className="size-3" />
                  </button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function F7Form({ report }: { report: Report }) {
  const { state, getField, setField, getRows, setCell, replaceRows } = useReports();
  const fieldsSection = report.sections.find((s): s is Extract<Section, { kind: "fields" }> => s.kind === "fields");
  const charSection = report.sections.find((s): s is Extract<Section, { kind: "table" }> => s.kind === "table" && s.key === "characteristics");
  const signoff = report.sections.find((s): s is Extract<Section, { kind: "signoff" }> => s.kind === "signoff");
  const storedRows = charSection ? getRows(report.id, charSection.key) : [];
  const specification = state.shared.specification || "";
  const regulatoryRequirement = state.shared.regulatoryRequirement || "";
  const layers = state.shared.layers || getField("f1", { key: "layers", label: "No. of Layers", shared: "layers" });
  const rows = withDerivedF7Rows(storedRows, specification, regulatoryRequirement, layers);
  const viaProtection =
    state.shared.viaProtection ||
    getField("f1", { key: "viaProtection", label: "Via Protection", shared: "viaProtection" });
  const pcbType = getField("f1", { key: "pcbType", label: "PCB Type" }) || state.fields["f1.pcbType"] || "";

  useEffect(() => {
    if (!charSection) return;
    const stored = getRows(report.id, charSection.key);
    const ensured = withDerivedF7Rows(stored, specification, regulatoryRequirement, layers);
    const same =
      stored.length === ensured.length &&
      stored.every(
        (row, i) =>
          row.sl === ensured[i]?.sl &&
          row.characteristic === ensured[i]?.characteristic &&
          row.lines === ensured[i]?.lines &&
          (ensured[i]?.lines ? Boolean(row.lines) : true),
      );
    if (!same) replaceRows(report.id, charSection.key, ensured);
  }, [charSection, getRows, report.id, replaceRows, specification, regulatoryRequirement, layers]);
  const reportId = savedReportId();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const measureLinesRef = useRef<Record<string, F7MeasureLine[]>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const bulkInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const imageIds = useMemo(() => {
    const ids: string[] = [];
    for (const row of rows) {
      const x = parseF7Image(row.imageX);
      const y = parseF7Image(row.imageY);
      if (x?.id) ids.push(x.id);
      if (y?.id) ids.push(y.id);
    }
    return ids;
  }, [rows]);

  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    const missing = imageIds.filter((id) => !previews[id]);
    if (!missing.length) return;
    void Promise.all(
      missing.map(async (id) => {
        try {
          const blob = await fetchReportFileBlob(reportId, id);
          return { id, url: URL.createObjectURL(blob) };
        } catch {
          return null;
        }
      }),
    ).then((items) => {
      if (cancelled) {
        items.forEach((item) => {
          if (item) URL.revokeObjectURL(item.url);
        });
        return;
      }
      setPreviews((prev) => {
        const next = { ...prev };
        for (const item of items) {
          if (item && !next[item.id]) next[item.id] = item.url;
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // previews is read to skip loaded ids; not a fetch trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageIds.join("|"), reportId]);

  async function setImage(index: number, dir: "x" | "y", file: File) {
    if (!reportId) {
      window.alert("Save the report first, then upload microsection photos.");
      return;
    }
    const row = rows[index];
    const sl = row?.sl || String(index + 1);
    const key = `${sl}-${dir}`;
    setBusyKey(key);
    try {
      const result = await uploadReportFile(reportId, file, { form: "f7", rowSl: key });
      const image: F7Image = { id: result.file.id, name: result.file.name, path: result.file.path };
      setCell(report.id, "characteristics", index, f7ImageCol(dir), serializeF7Image(image));
      const url = URL.createObjectURL(file);
      setPreviews((prev) => ({ ...prev, [result.file.id]: url }));
            const rowKey = row?.sl || String(index + 1);
      const currentLines =
        measureLinesRef.current[rowKey] ?? f7RowLines(row);
      const measuredKey = dir === "x" ? "measuredX" : "measuredY";

      try {
        const values = await readF7Measurements(file);
        const filledCount = Math.min(values.length, currentLines.length);
        const updatedLines = currentLines.map((line, lineIndex) =>
          lineIndex < filledCount
            ? { ...line, [measuredKey]: values[lineIndex]! }
            : line,
        );

        measureLinesRef.current[rowKey] = updatedLines;
        setCell(
          report.id,
          "characteristics",
          index,
          "lines",
          serializeF7Lines(updatedLines),
        );
        if (values.length !== currentLines.length) {
          const detail =
            values.length < currentLines.length
              ? `${filledCount} of ${currentLines.length} rows were filled; remaining rows were left unchanged.`
              : `${filledCount} of ${values.length} detected readings were filled; extra readings were not added as rows.`;
          window.alert(`Image uploaded. ${dir.toUpperCase()} OCR: ${detail}`);
        }
      } catch (ocrError) {
        const message =
          ocrError instanceof Error ? ocrError.message : "OCR failed.";
        window.alert(
          `Image uploaded, but the ${dir.toUpperCase()} readings were not filled: ${message}`,
        );
      }
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setBusyKey(null);
    }
  }

  async function bulkUploadFiles(files: FileList | null) {
  if (!files?.length) return;
  if (!reportId) {
    window.alert("Save the report first, then upload microsection photos.");
    return;
  }

  setBulkBusy(true);
  const unmatched: string[] = [];

  try {
    for (const file of Array.from(files)) {
      const name = normalizePhotoName(file.name);
      const candidates = rows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => {
          const characteristic = normalizePhotoName(row.characteristic || "");
          return characteristic && name.includes(characteristic);
        });

      const target =
        candidates.find(
          ({ row }) => row.baseSl && name.includes(normalizePhotoName(row.sl || "")),
        ) ??
        candidates.find(({ row }) => !row.baseSl) ??
        (candidates.length === 1 ? candidates[0] : undefined);

      if (!target) {
        unmatched.push(file.name);
        continue;
      }

      const words = new Set(name.split(" "));
      const hasX = words.has("x") || words.has("ax");
      const hasY = words.has("y") || words.has("ay");
      let dir: "x" | "y";

      if (hasX !== hasY) dir = hasX ? "x" : "y";
      else if (!hasX && !hasY && !f7UsesYImage(target.row.baseSl || target.row.sl || "", layers) )dir = "x";
      else {
        unmatched.push(file.name);
        continue;
      }

      if (dir === "y" && !f7UsesYImage(target.row.baseSl || target.row.sl || "", layers)) {
        unmatched.push(file.name);
        continue;
      }

      const column = dir === "x" ? "imageX" : "imageY";
      if (parseF7Image(target.row[column])) {
        unmatched.push(`${file.name} (slot already has an image)`);
        continue;
      }

      const extension = file.name.match(/\.[^.]+$/)?.[0] || "";
      const savedName = `${target.row.characteristic}_${target.row.sl}_${dir}${extension}`;
      await setImage(
        target.index,
        dir,
        new File([file], savedName, { type: file.type }),
      );
    }
  } finally {
    setBulkBusy(false);
  }

  if (unmatched.length) {
    window.alert(`These files could not be assigned:\n${unmatched.join("\n")}`);
  }
}

async function removeAllImages() {
  if (!window.confirm("Remove all F7 microsection images?")) return;

  setBulkBusy(true);
  try {
    for (let index = 0; index < rows.length; index++) {
      await clearImage(index, "x");
      await clearImage(index, "y");
    }
  } finally {
    setBulkBusy(false);
  }
}

  function duplicateCharacteristic(index: number) {
  if (!charSection) return;

  const source = rows[index];
  if (!source) return;

  const baseSl = source.baseSl || source.sl;
  const copies = rows.filter((row) => row.baseSl === baseSl).length;
  const lines = f7RowLines(source).map((line) => ({
    ...line,
    measuredX: "",
    measuredY: "",
    result: "Pass",
    remarks: "",
  }));

  const duplicate = {
    ...source,
    sl: `${baseSl}${alphaSuffix(copies)}`,
    baseSl,
    imageX: "",
    imageY: "",
    measuredX: "",
    measuredY: "",
    remarks: "",
    lines: serializeF7Lines(lines),
  };

  const nextRows = [...rows];
  let insertAt = index + 1;

  while (
    insertAt < nextRows.length &&
    (nextRows[insertAt]!.baseSl || nextRows[insertAt]!.sl) === baseSl
  ) {
    insertAt++;
  }

  nextRows.splice(insertAt, 0, duplicate);
  replaceRows(report.id, charSection.key, nextRows);
}

  async function clearImage(index: number, dir: "x" | "y") {
    const row = rows[index];
    const image = parseF7Image(dir === "x" ? row?.imageX : row?.imageY);
    if (image?.id && reportId) {
      try {
        await deleteReportFile(reportId, image.id);
      } catch {
        /* still clear the slot */
      }
      setPreviews((prev) => {
        const next = { ...prev };
        const url = next[image.id!];
        if (url) URL.revokeObjectURL(url);
        delete next[image.id!];
        return next;
      });
    }
    setCell(report.id, "characteristics", index, f7ImageCol(dir), "");
  }

  return (
    <div className="space-y-4">
      {fieldsSection ? (
        <section
          style={{ ["--section-accent" as string]: stepStyle(0).color }}
          className="panel panel-accent relative overflow-hidden p-3.5 sm:p-4"
        >
          <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 xl:grid-cols-5">
            {fieldsSection.fields.map((field) => {
              const linked = Boolean(field.shared) || field.key === "reportNumber";
              const readOnly = field.key === "reportNumber";
              const value =
                field.key === "reportNumber"
                  ? f7ReportNumber(getField("f1", { key: "cocNumber", label: "COC Number", shared: "cocNumber" }))
                  : getField(report.id, field);
              return (
                <FieldBox key={field.key} label={field.label} linked={linked}>
                  {readOnly ? (
                    <div className="flex h-8 items-center rounded-md border border-border px-2.5 text-[13px] text-ink">{value}</div>
                  ) : (
                    <input
                      className={inputClass}
                      type={field.type === "date" ? "date" : "text"}
                      value={value}
                      onChange={(e) => setField(report.id, field, e.target.value)}
                    />
                  )}
                </FieldBox>
              );
            })}
          </div>
        </section>
      ) : null}

      <CollapsiblePanel
        accent={stepStyle(1).color}
        title={
          <div>
            <h3 className="font-display text-[13px] font-semibold text-ink">Microsection characteristics</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Characteristics print in this order. Each one is a PDF page with X and Y photos, then measurements.
            </p>
          </div>
        }

        
        headerExtra={
  <div className="flex items-center gap-2">
    <input
      ref={bulkInputRef}
      type="file"
      accept="image/png,image/jpeg"
      multiple
      className="hidden"
      onChange={(event) => {
        void bulkUploadFiles(event.target.files);
        event.target.value = "";
      }}
    />
    <button
      type="button"
      disabled={bulkBusy}
      onClick={() => bulkInputRef.current?.click()}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[10px] font-semibold uppercase"
    >
      <Upload className="size-3" />
      Bulk upload
    </button>
    <button
      type="button"
      disabled={bulkBusy}
      onClick={() => void removeAllImages()}
      className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[10px] font-semibold uppercase"
    >
      <Trash2 className="size-3" />
      Remove all
    </button>
  </div>
}
      >
        <div className="space-y-5 px-3.5 pb-3.5 sm:px-4 sm:pb-4">
          {rows.map((row, index) => {
            if (f7CharHidden(row.baseSl || row.sl || "", layers, viaProtection, pcbType)) return null;
            const imageX = parseF7Image(row.imageX);
            const imageY = parseF7Image(row.imageY);
            const showY = f7UsesYImage(row.baseSl || row.sl || "", layers);
            return (
              <div key={row.sl || index} className="overflow-hidden rounded-xl border border-border">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border bg-muted/30 px-3 py-2">
                  <div>
                    <p className="font-display text-[14px] font-semibold text-ink">
                      <span className="mr-2 tabular-nums text-muted-foreground">{row.sl}.</span>
                      {row.characteristic}
                    </p>
                    {row.requirement ? <p className="mt-0.5 text-[12px] text-muted-foreground">{row.requirement}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
    {row.stage}
  </span>
  <button
    type="button"
    onClick={() => duplicateCharacteristic(index)}
    className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-[10px] font-semibold uppercase text-muted-foreground hover:border-primary/40 hover:text-ink"
  >
    <Copy className="size-3" />
    Duplicate
  </button>
</div>
                </div>
                <div className={cn("grid gap-3 p-3", showY ? "xl:grid-cols-2" : "")}>
                  <ImageSlot
                    label={showY ? "Microsection image — X-direction" : "Microsection image"}
                    stage={row.stage || ""}
                    image={imageX}
                    preview={imageX?.id ? previews[imageX.id] || null : null}
                    busy={busyKey === `${row.sl}-x`}
                    onPick={(file) => void setImage(index, "x", file)}
                    onClear={() => void clearImage(index, "x")}
                  />
                  {showY ? (
                  <ImageSlot
                    label="Microsection image — Y-direction"
                    stage={row.stage || ""}
                    image={imageY}
                    preview={imageY?.id ? previews[imageY.id] || null : null}
                    busy={busyKey === `${row.sl}-y`}
                    onPick={(file) => void setImage(index, "y", file)}
                    onClear={() => void clearImage(index, "y")}
                  />
                  ) : null}
                  <div className={showY ? "xl:col-span-2" : ""}>
                    <MeasureLineTable
                      row={row}
                      onChange={(lines) => {
  measureLinesRef.current[row.sl || String(index + 1)] = lines;
  setCell(
    report.id,
    "characteristics",
    index,
    "lines",
    serializeF7Lines(lines),
  );
}}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsiblePanel>

      {signoff ? (
        <section
          style={{ ["--section-accent" as string]: stepStyle(2).color }}
          className="panel panel-accent relative overflow-hidden p-3.5 sm:p-4"
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{signoff.title || "Sign-off"}</p>
          <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
            {(signoff.fields ?? []).map((field: Field) => (
              <label key={field.key} className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{field.label}</span>
                <input
                  className={inputClass}
                  type={field.type === "date" ? "date" : "text"}
                  value={getField(report.id, field)}
                  onChange={(e) => setField(report.id, field, e.target.value)}
                />
              </label>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
