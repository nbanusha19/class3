import { useEffect, useRef, type ReactNode } from "react";
import { stepStyle } from "@/lib/reports/palette";
import { useReports } from "@/lib/report-store";
import { lookupDrillInfo } from "@/lib/api";
import {
  buildSerials,
  f2LotSize,
  isPs30051,
  mergeF2State,
} from "@/lib/reports/f2-logic";
import {
  F5_BOARD_CHAR,
  F5_BOW_MODE,
  F5_CS_FEATURE,
  F5_LASER_CHAR,
  F5_LASER_FEATURE,
  F5_MODE,
  F5_PLATE,
  F5_UOM,
  F5_UOM_CS,
  f5ApplyBoardThickness,
  f5ArrayGroups,
  f5ArrayMode,
  f5AutoPickIds,
  f5BowWarn,
  f5DefaultBoardRow,
  f5DefaultCsRow,
  f5DefaultDrillRow,
  f5DefaultLaserRow,
  f5DrillIsBlank,
  f5GoNogoHint,
  f5GoNogoWarn,
  f5LaserHint,
  f5LaserOut,
  f5LaserReq,
  f5LotNote,
  f5MeasureUnits,
  f5NormalizePicked,
  f5ParseReadings,
  f5PickId,
  f5PickerProdLabel,
  f5RowsFromDrillInfo,
  f5SampleNeed,
  f5SamplingQty,
  f5SelectedArrayCount,
  f5SerialsNote,
  f5SetReading,
  f5UnitHeadingParts,
  type F5Reading,
  type F5Unit,
} from "@/lib/reports/f5-logic";
import type { Report, Section } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { CollapsiblePanel, F5SectionTitle } from "@/components/report/SectionCollapse";

const inputClass =
  "h-7 w-full rounded-md border border-border bg-transparent px-2 text-[12px] text-ink outline-none transition-colors placeholder:text-muted-foreground/55 hover:border-primary/45 focus:border-primary focus:bg-field focus:ring-1 focus:ring-primary/15";

function warnClass(on: boolean) {
  return on ? "border-[#c0392b] bg-[#fdeaea] font-semibold text-[#c0392b]" : undefined;
}

function F5UnitHead({ unit }: { unit: F5Unit }) {
  const { primary, secondary } = f5UnitHeadingParts(unit);
  return (
    <span className="block leading-tight">
      <span className="block">{primary}</span>
      {secondary ? <span className="block font-medium normal-case tracking-normal">({secondary})</span> : null}
    </span>
  );
}

function FieldBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <div className="flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-[13px]">{children}</div>
    </div>
  );
}

export function F5Form({ report }: { report: Report }) {
  const { state, getField, setField, getRows, setCell, addRow, removeRow, replaceRows } = useReports();
  const spec = state.shared.specification || "";
  const f2 = mergeF2State(state.f2, state.combinedProductionOrders || []);
  const lot = f2LotSize(f2, spec);
  const sampleQty = getField("f5", { key: "sampleSize", label: "Sample qty" }) || f5SamplingQty(lot);
  const arrayMode = f5ArrayMode(f2);
  const serials = buildSerials(f2, spec);
  const good = serials.filter((row) => !row.rejected);
  const picked = f5NormalizePicked(getField("f5", { key: "sampledSerials", label: "Sampled" }), good);
  const need = f5SampleNeed(sampleQty, lot);
  const have = arrayMode ? f5SelectedArrayCount(f2, spec, picked) : picked.length;
  const units = f5MeasureUnits(f2, spec, picked);
  const pickField = { key: "sampledSerials", label: "Sampled board serial numbers" };
  const drawingField = { key: "drawingNo", label: "Drawing No" };
  const drawingNo = getField("f5", drawingField) || state.shared.camNumber || "";
  const psFormat = isPs30051(spec);
  const fetchedDrillFor = useRef("");
  const productionOrder = (state.fields["f1.productionOrder"] || f2.lines[0]?.prod || "").trim();

  const drillSection = report.sections.find((s) => s.kind === "table" && s.key === "drill");
  const csSection = report.sections.find((s) => s.kind === "table" && s.key === "countersink");
  const laserSection = report.sections.find((s) => s.kind === "table" && s.key === "laser");
  const boardSection = report.sections.find((s) => s.kind === "table" && s.key === "board");
  const boardRows = getRows("f5", "board");
  const boardRowsIndexed = boardRows.map((row, index) => ({ row, index }));
  const boardDimensionalEntries = boardRowsIndexed.filter(
  ({ row }) => row.characteristic !== "Bow & Twist",
  );
  const bowTwistEntries = boardRowsIndexed.filter(
  ({ row }) => row.characteristic === "Bow & Twist",
  ); 
  const boardDimensionalIndexes = boardDimensionalEntries.map(({ index }) => index);
  const bowTwistIndexes = bowTwistEntries.map(({ index }) => index);
  const bowTwistStorage = bowTwistEntries[0];
  const drillRows = getRows("f5", "drill");
  const drillTypes = [...new Set([...F5_PLATE, ...drillRows.map((row) => row.type).filter(Boolean)])];

  useEffect(() => {
    if (!productionOrder) return;
    if (fetchedDrillFor.current === productionOrder) return;
    fetchedDrillFor.current = productionOrder;
    void lookupDrillInfo(productionOrder)
      .then((result) => {
        const mapped = f5RowsFromDrillInfo(result.drills || []);
        const source = getField("f5", { key: "drillSource", label: "Drill source" });
        if (mapped.length && (f5DrillIsBlank(getRows("f5", "drill")) || (source && source !== productionOrder))) {
          replaceRows("f5", "drill", mapped);
          setField("f5", { key: "drillSource", label: "Drill source" }, productionOrder);
        }
        const thickness = result.pcbThickness || "";
        if (thickness) {
          replaceRows("f5", "board", f5ApplyBoardThickness(getRows("f5", "board"), thickness));
          setField("f5", { key: "thicknessSource", label: "Thickness source" }, productionOrder);
        }
      })
      .catch(() => {
        fetchedDrillFor.current = "";
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionOrder]);

  function setPicked(next: string[]) {
    setField("f5", pickField, next.join(", "));
  }

  function toggleId(id: string) {
    if (picked.includes(id)) {
      setPicked(picked.filter((x) => x !== id));
      return;
    }
    if (need && have >= need) return;
    setPicked([...picked, id]);
  }

  function toggleArray(ids: string[]) {
    const on = ids.length > 0 && ids.every((id) => picked.includes(id));
    if (on) {
      setPicked(picked.filter((id) => !ids.includes(id)));
      return;
    }
    if (need && have >= need) return;
    setPicked([...picked, ...ids.filter((id) => !picked.includes(id))]);
  }

  function patchRow(tableKey: string, index: number, patch: Record<string, string>) {
    const row = getRows("f5", tableKey)[index];
    if (!row) return;
    for (const [col, value] of Object.entries(patch)) setCell("f5", tableKey, index, col, value);
  }

  function setReading(tableKey: string, index: number, unitId: string, patch: F5Reading) {
    const row = getRows("f5", tableKey)[index];
    if (!row) return;
    setCell("f5", tableKey, index, "readings", f5SetReading(row.readings, unitId, patch));
  }

  function setBowTwistReading(unitId: string, patch: F5Reading) {
    const rows = getRows("f5", "board");
    const rowIndex = rows.findIndex((row) => row.characteristic === "Bow & Twist");
    const nextRows = rows.slice();

    if (rowIndex < 0) {
      const row = {
        ...f5DefaultBoardRow(String(rows.length + 1)),
        characteristic: "Bow & Twist",
      };
      nextRows.push({
        ...row,
        readings: f5SetReading(row.readings, unitId, patch),
      });
    } else {
      const row = nextRows[rowIndex]!;
      nextRows[rowIndex] = {
        ...row,
        readings: f5SetReading(row.readings, unitId, patch),
      };
    }

    replaceRows("f5", "board", nextRows);
  }

  function deleteSelected(tableKey: string, makeBlank: (sl: string) => Record<string, string>) {
    const rows = getRows("f5", tableKey);
    const selected = rows.map((row, i) => (row.selected === "1" ? i : -1)).filter((i) => i >= 0);
    if (selected.length) {
      [...selected].reverse().forEach((i) => removeRow("f5", tableKey, i));
      const left = getRows("f5", tableKey);
      if (!left.length && drillSection) {
        /* rows refresh after state; addRow handled below via remaining */
      }
      return;
    }
    if (rows.length > 1) removeRow("f5", tableKey, rows.length - 1);
  }

  function deleteBoardRows(indices: number[]) {
  const rows = getRows("f5", "board");
  const selected = indices.filter((index) => rows[index]?.selected === "1");
  const toRemove = selected.length
    ? selected
    : rows.length > 1 && indices.length
      ? [indices[indices.length - 1]!]
      : [];

  [...toRemove]
    .sort((a, b) => b - a)
    .forEach((index) => removeRow("f5", "board", index));
}

function addBowTwistRow() {
  const rows = getRows("f5", "board");
  replaceRows("f5", "board", [
    ...rows,
    {
      ...f5DefaultBoardRow(String(rows.length + 1)),
      characteristic: "Bow & Twist",
    },
  ]);
}

  return (
    <div className="space-y-4">
      <section style={{ ["--section-accent" as string]: stepStyle(0).color }} className="panel panel-accent p-3.5 sm:p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FieldBox label="Total production qty">
            <span className="tabular-nums">{lot > 0 ? lot : ""}</span>
            <span className="text-[11px] text-muted-foreground">{arrayMode ? "good arrays" : "good single PCBs"}</span>
          </FieldBox>
          <FieldBox label="Sample size">AQL 4.0</FieldBox>
          <FieldBox label="Sample qty">
            <span className="tabular-nums">{sampleQty || ""}</span>
            <span className="text-[11px] text-muted-foreground">{arrayMode ? "array" : "boards"}</span>
          </FieldBox>
          <FieldBox label="Drawing No">
            <input
              className="h-7 min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted-foreground/55"
              value={drawingNo}
              onChange={(e) => setField("f5", drawingField, e.target.value)}
              placeholder="CAM / drawing number"
            />
          </FieldBox>
        </div>
      </section>

      <CollapsiblePanel
        accent={stepStyle(1).color}
        title={<p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">Sampled board serial numbers</p>}
        headerExtra={
          <div className="flex flex-wrap items-center gap-2">
            {need ? (
              <span className="text-[12px] text-muted-foreground">
                {have} of {need} selected{have === need ? " ✓" : ""}
              </span>
            ) : null}
            <button
              type="button"
              className="h-7 rounded-md px-2.5 text-[12px] font-medium text-ink hover:bg-primary/8"
              onClick={() => setPicked(f5AutoPickIds(f2, spec, need))}
            >
              Auto-select
            </button>
            <button type="button" className="h-7 rounded-md px-2.5 text-[12px] font-medium text-ink hover:bg-primary/8" onClick={() => setPicked([])}>
              Clear
            </button>
          </div>
        }
      >
        <div className="max-h-[170px] space-y-2 overflow-auto px-3.5 py-3 sm:px-4">
          {good.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Generate serials in F2 to select sample boards.</p>
          ) : arrayMode ? (
            f5ArrayGroups(f2, spec).map((group) => {
              const arrays = group.arrays
                .map((chunk, idx) => {
                  const goodChunk = chunk.filter((row) => !row.rejected);
                  const ids = goodChunk.map(f5PickId);
                  if (!ids.length) return null;
                  const on = ids.every((id) => picked.includes(id));
                  const range =
                    goodChunk.length === 1
                      ? `(${goodChunk[0]!.pcb}-${goodChunk[0]!.panel})`
                      : `(${goodChunk[0]!.pcb}-${goodChunk[goodChunk.length - 1]!.pcb}-${goodChunk[0]!.panel})`;
                  return (
                    <span key={`${group.prod}-${group.panel}-${idx}`} className="inline-flex items-center gap-1 rounded border border-dashed border-border px-1 py-0.5">
                      <button
                        type="button"
                        onClick={() => toggleArray(ids)}
                        className={cn(
                          "h-7 min-w-[84px] rounded-md border px-2 text-[12px]",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-border text-ink hover:bg-primary/8",
                        )}
                      >
                        Array {idx + 1} {range}
                      </button>
                      <span className="text-[9px] text-muted-foreground">{goodChunk.map((row) => row.serial).join(", ")}</span>
                    </span>
                  );
                })
                .filter(Boolean);
              if (!arrays.length) return null;
              const heading = f5PickerProdLabel(group.prod, group.panel, spec, true);
              return (
                <div key={`${group.prod}-${group.panel}`} className="space-y-1">
                  {heading ? <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{heading}</p> : null}
                  <div className="flex flex-wrap gap-2">{arrays}</div>
                </div>
              );
            })
          ) : (
            (() => {
              const groups = new Map<string, typeof good>();
              const order: string[] = [];
              for (const row of good) {
                const key = psFormat ? "" : row.prod;
                if (!groups.has(key)) {
                  groups.set(key, []);
                  order.push(key);
                }
                groups.get(key)!.push(row);
              }
              return order.map((prod) => (
                <div key={prod || "all"} className="space-y-1">
                  {prod ? <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{prod}</p> : null}
                  <div className="flex flex-wrap gap-1.5">
                    {groups.get(prod)!.map((row) => {
                      const id = f5PickId(row);
                      const on = picked.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => toggleId(id)}
                          className={cn(
                            "h-7 min-w-[66px] rounded-md border px-2 text-[12px]",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-border text-ink hover:bg-primary/8",
                          )}
                        >
                          {row.serial}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ));
            })()
          )}
        </div>
      </CollapsiblePanel>

      {drillSection?.kind === "table" ? (
        <DrillLikeTable
          title="Mechanical Drill Measurements"
          units={units}
          uomOpts={F5_UOM}
          holesLabel="No. of Holes"
          dimColumn={false}
          note={f5LotNote(lot, sampleQty, arrayMode)}
          rows={drillRows}
          typeOpts={drillTypes}
          onPatch={(i, patch) => patchRow("drill", i, patch)}
          onReading={(i, id, patch) => setReading("drill", i, id, patch)}
          onAdd={() => addRow("f5", drillSection)}
          onDelete={() => deleteSelected("drill", f5DefaultDrillRow)}
        />
      ) : null}

      {csSection?.kind === "table" ? (
        <DrillLikeTable
          title="Counter Sink, Cutout, Slot measurements"
          units={units}
          uomOpts={F5_UOM_CS}
          holesLabel="No. of Holes/Slots"
          dimColumn
          featureColumn
          note="Counter sink readings use the sample boards selected above."
          rows={getRows("f5", "countersink")}
          onPatch={(i, patch) => patchRow("countersink", i, patch)}
          onReading={(i, id, patch) => setReading("countersink", i, id, patch)}
          onAdd={() => addRow("f5", csSection)}
          onDelete={() => deleteSelected("countersink", f5DefaultCsRow)}
        />
      ) : null}

      {laserSection?.kind === "table" ? (
        <LaserTable
          units={units}
          serialsNote={f5SerialsNote(picked)}
          rows={getRows("f5", "laser")}
          onPatch={(i, patch) => patchRow("laser", i, patch)}
          onReading={(i, id, patch) => setReading("laser", i, id, patch)}
          onAdd={() => addRow("f5", laserSection)}
          onDelete={() => deleteSelected("laser", f5DefaultLaserRow)}
        />
      ) : null}

      {boardSection?.kind === "table" ? (
  psFormat ? (
    <>
      <BoardTable
        title="Board Dimensional"
        units={units}
        serialsNote={f5SerialsNote(picked)}
        rows={boardDimensionalEntries.map(({ row }) => row)}
        rowIndices={boardDimensionalIndexes}
        characteristicOptions={F5_BOARD_CHAR.filter((option) => option !== "Bow & Twist")}
        onPatch={(i, patch) => patchRow("board", i, patch)}
        onReading={(i, id, patch) => setReading("board", i, id, patch)}
        onAdd={() => addRow("f5", boardSection)}
        onDelete={() => deleteBoardRows(boardDimensionalIndexes)}
      />
     <BowTwistTable
       units={units}
       storageRow={bowTwistStorage?.row}
       onReading={setBowTwistReading}
       onAdd={addBowTwistRow}
     />
    </>
  ) : (
    <BoardTable
      title="Board Dimensional"
      units={units}
      serialsNote={f5SerialsNote(picked)}
      rows={boardRows}
      rowIndices={boardRows.map((_, index) => index)}
      characteristicOptions={F5_BOARD_CHAR}
      onPatch={(i, patch) => patchRow("board", i, patch)}
      onReading={(i, id, patch) => setReading("board", i, id, patch)}
      onAdd={() => addRow("f5", boardSection)}
      onDelete={() => deleteSelected("board", f5DefaultBoardRow)}
    />
  )
) : null}

      {report.sections
        .filter((s): s is Extract<Section, { kind: "signoff" }> => s.kind === "signoff")
        .map((section, i) => (
          <section
            key={`signoff-${i}`}
            style={{ ["--section-accent" as string]: stepStyle(5).color }}
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

function BowTwistTable({
  units,
  storageRow,
  onReading,
  onAdd,
}: {
  units: F5Unit[];
  storageRow?: Record<string, string>;
  onReading: (unitId: string, patch: F5Reading) => void;
  onAdd: () => void;
}) {
  const readings = f5ParseReadings(storageRow?.readings);

  return (
    <CollapsiblePanel
      title={<F5SectionTitle>Bow &amp; Twist</F5SectionTitle>}
      accent={stepStyle(4).color}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
          <thead>
            <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <th className="w-[52px] px-2 py-1.5 text-left">Sl No.</th>
              <th className="min-w-[220px] px-2 py-1.5 text-left">Board Serial</th>
              <th className="w-[240px] px-2 py-1.5 text-left">Requirement</th>
              <th className="w-[120px] px-2 py-1.5 text-left">Actual %</th>
              <th className="min-w-[220px] px-2 py-1.5 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit, index) => {
              const reading = readings[unit.id] || {};
              const bowMode = reading.bowMode || storageRow?.bowMode || "Custom";
              const bowLimit = reading.bowLimit ?? storageRow?.dim ?? "";
              const warn = f5BowWarn(reading.actual || "", bowMode, bowLimit);

              return (
                <tr key={unit.id} className="border-b border-border/60">
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="px-2 py-1.5 font-medium text-ink">
                    <F5UnitHead unit={unit} />
                  </td>
                  <td className="space-y-1 px-2 py-1.5">
                    <select
                      className={cn(inputClass, "cursor-pointer appearance-none")}
                      value={bowMode}
                      onChange={(event) =>
                        onReading(unit.id, { bowMode: event.target.value })
                      }
                    >
                      {F5_BOW_MODE.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                    {bowMode === "Custom" ? (
                      <input
                        className={cn(inputClass, "text-right")}
                        placeholder="Custom limit (%)"
                        value={bowLimit}
                        onChange={(event) =>
                          onReading(unit.id, { bowLimit: event.target.value })
                        }
                      />
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <input
                        className={cn(inputClass, "text-right", warnClass(!!warn))}
                        type="number"
                        step="0.01"
                        placeholder="Actual"
                        value={reading.actual || ""}
                        onChange={(event) =>
                          onReading(unit.id, { actual: event.target.value })
                        }
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={inputClass}
                      placeholder="Remarks"
                      value={reading.bowRemark ?? storageRow?.remarks ?? ""}
                      onChange={(event) =>
                        onReading(unit.id, { bowRemark: event.target.value })
                      }
                    />
                  </td>
                </tr>
              );
            })}
            {!units.length ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                  Select sample board serials in F5 to populate Bow &amp; Twist.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {!storageRow ? (
        <div className="flex justify-end px-3.5 py-2.5">
          <button
            type="button"
            className="h-8 rounded-md border border-border px-3 text-[12px] font-medium hover:bg-primary/8"
            onClick={onAdd}
          >
            Add row
          </button>
        </div>
      ) : null}
    </CollapsiblePanel>
  );
}

function DrillLikeTable({
  title,
  units,
  uomOpts,
  holesLabel,
  dimColumn,
  featureColumn,
  note,
  rows,
  typeOpts = F5_PLATE,
  onPatch,
  onReading,
  onAdd,
  onDelete,
}: {
  title: string;
  units: F5Unit[];
  uomOpts: readonly string[];
  holesLabel: string;
  dimColumn: boolean;
  featureColumn?: boolean;
  note: string;
  rows: Record<string, string>[];
  typeOpts?: readonly string[];
  onPatch: (index: number, patch: Record<string, string>) => void;
  onReading: (index: number, unitId: string, patch: F5Reading) => void;
  onAdd: () => void;
  onDelete: () => void;
}) {
  const leadCols = 5 + (dimColumn ? 1 : 0) + (featureColumn ? 1 : 0);
  return (
    <CollapsiblePanel title={<F5SectionTitle>{title}</F5SectionTitle>} accent={stepStyle(2).color}>
      <div className="scrollbar-slim max-h-[520px] overflow-auto">
        <table className="w-full min-w-[1280px] border-collapse text-[12.5px]">
          <thead className="sticky top-0 z-[2] bg-[color:var(--glass-bg-strong,white)]">
            <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <th className="w-8 border-b border-border" />
              <th className="w-[52px] border-b border-border px-1 py-1.5 text-left">Sl No.</th>
              <th className="w-[130px] border-b border-border px-1 py-1.5 text-left">Characteristics</th>
              {dimColumn ? <th className="w-[90px] border-b border-border px-1 py-1.5 text-left">Dim.</th> : null}
              {featureColumn ? <th className="w-[150px] border-b border-border px-1 py-1.5 text-left">Feature</th> : null}
              <th className="w-[130px] border-b border-border px-1 py-1.5 text-left">Requirement</th>
              <th className="w-[120px] border-b border-border px-1 py-1.5 text-left">{holesLabel}</th>
              <th className="w-[90px] border-b border-border px-1 py-1.5 text-right">Tolerance+</th>
              <th className="w-[90px] border-b border-border px-1 py-1.5 text-right">Tolerance-</th>
              <th className="w-[96px] border-b border-border px-1 py-1.5 text-left">UoM</th>
              {units.length ? (
                units.map((unit) => (
                  <th key={unit.id} colSpan={2} className="border-b border-border px-1 py-1.5 text-center">
                    <F5UnitHead unit={unit} />
                  </th>
                ))
              ) : (
                <th className="min-w-[160px] border-b border-border" />
              )}
              <th className="min-w-[130px] border-b border-border px-1 py-1.5 text-left">Remarks</th>
              <th className="w-[70px] border-b border-border" />
            </tr>
            <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <th className="border-b border-border" colSpan={leadCols} />
              <th className="border-b border-border" />
              <th className="border-b border-border" />
              <th className="border-b border-border" />
              {units.length ? (
                units.map((unit) => (
                  <FragmentPair key={unit.id} />
                ))
              ) : (
                <th className="border-b border-border" />
              )}
              <th className="border-b border-border" />
              <th className="border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const lw = dimColumn && row.mode === "L x W";
              const readings = f5ParseReadings(row.readings);
              return (
                <tr key={index} className="border-b border-border/60 align-top">
                  <td className="px-1 pt-2 text-center">
                    <input type="checkbox" checked={row.selected === "1"} onChange={(e) => onPatch(index, { selected: e.target.checked ? "1" : "" })} />
                  </td>
                  <td className="px-1 pt-2 tabular-nums text-muted-foreground">{row.sl || index + 1}</td>
                  <td className="px-0.5 pt-1.5">
                    <select className={cn(inputClass, "cursor-pointer appearance-none")} value={row.type || typeOpts[0] || ""} onChange={(e) => onPatch(index, { type: e.target.value })}>
                      {typeOpts.map((opt) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {dimColumn ? (
                    <td className="px-0.5 pt-1.5">
                      <select className={cn(inputClass, "cursor-pointer appearance-none")} value={row.mode || "Single"} onChange={(e) => onPatch(index, { mode: e.target.value })}>
                        {F5_MODE.map((opt) => (
                          <option key={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>
                  ) : null}
                  {featureColumn ? (
                    <td className="px-0.5 pt-1.5">
                      <select className={cn(inputClass, "cursor-pointer appearance-none")} value={row.feature || F5_CS_FEATURE[0]} onChange={(e) => onPatch(index, { feature: e.target.value })}>
                        {F5_CS_FEATURE.map((opt) => (
                          <option key={opt}>{opt}</option>
                        ))}
                      </select>
                    </td>
                  ) : null}
                  <td className="px-0.5 pt-1.5">
                    {lw ? (
                      <div className="flex flex-col gap-0.5">
                        <input className={inputClass} placeholder="L e.g. 2.05" value={row.dimL || ""} onChange={(e) => onPatch(index, { dimL: e.target.value })} />
                        <input className={inputClass} placeholder="W e.g. 1.01" value={row.dimW || ""} onChange={(e) => onPatch(index, { dimW: e.target.value })} />
                      </div>
                    ) : (
                      <input className={cn(inputClass, "text-right")} placeholder="" value={row.dim || ""} onChange={(e) => onPatch(index, { dim: e.target.value })} />
                    )}
                  </td>
                  <td className="px-0.5 pt-1.5">
                    <input className={cn(inputClass, "text-right")} type="number" min={0} placeholder="" value={row.holes || ""} onChange={(e) => onPatch(index, { holes: e.target.value })} />
                  </td>
                  <td className="px-0.5 pt-1.5">
                    {lw ? (
                      <div className="flex flex-col gap-0.5">
                        <input className={inputClass} placeholder="L+ 0.05" value={row.tolPlusL || ""} onChange={(e) => onPatch(index, { tolPlusL: e.target.value })} />
                        <input className={inputClass} placeholder="W+ 0.05" value={row.tolPlusW || ""} onChange={(e) => onPatch(index, { tolPlusW: e.target.value })} />
                      </div>
                    ) : (
                      <input className={cn(inputClass, "text-right")} placeholder="0.05" value={row.tolPlus || ""} onChange={(e) => onPatch(index, { tolPlus: e.target.value })} />
                    )}
                  </td>
                  <td className="px-0.5 pt-1.5">
                    {lw ? (
                      <div className="flex flex-col gap-0.5">
                        <input className={inputClass} placeholder="L- 0.05" value={row.tolMinusL || ""} onChange={(e) => onPatch(index, { tolMinusL: e.target.value })} />
                        <input className={inputClass} placeholder="W- 0" value={row.tolMinusW || ""} onChange={(e) => onPatch(index, { tolMinusW: e.target.value })} />
                      </div>
                    ) : (
                      <input className={cn(inputClass, "text-right")} placeholder="0.05" value={row.tolMinus || ""} onChange={(e) => onPatch(index, { tolMinus: e.target.value })} />
                    )}
                  </td>
                  <td className="px-0.5 pt-1.5">
                    <select className={cn(inputClass, "cursor-pointer appearance-none")} value={row.uom || "mm"} onChange={(e) => onPatch(index, { uom: e.target.value })}>
                      {uomOpts.map((opt) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  {units.length ? (
                    units.map((unit) => {
                      const cell = readings[unit.id] || {};
                      return lw ? (
                        <LwPair
                          key={unit.id}
                          goL={cell.goL || ""}
                          goW={cell.goW || ""}
                          nogoL={cell.nogoL || ""}
                          nogoW={cell.nogoW || ""}
                          dimL={row.dimL || ""}
                          dimW={row.dimW || ""}
                          plusL={row.tolPlusL || ""}
                          plusW={row.tolPlusW || ""}
                          minusL={row.tolMinusL || ""}
                          minusW={row.tolMinusW || ""}
                          onGoL={(v) => onReading(index, unit.id, { goL: v })}
                          onGoW={(v) => onReading(index, unit.id, { goW: v })}
                          onNoGoL={(v) => onReading(index, unit.id, { nogoL: v })}
                          onNoGoW={(v) => onReading(index, unit.id, { nogoW: v })}
                        />
                      ) : (
                        <GoNoGoPair
                          key={unit.id}
                          go={cell.go || ""}
                          nogo={cell.nogo || ""}
                          dim={row.dim || ""}
                          plus={row.tolPlus || ""}
                          minus={row.tolMinus || ""}
                          onGo={(v) => onReading(index, unit.id, { go: v })}
                          onNoGo={(v) => onReading(index, unit.id, { nogo: v })}
                        />
                      );
                    })
                  ) : (
                    <td className="px-2 pt-2 text-[11px] text-muted-foreground">Select sample boards</td>
                  )}
                  <td className="px-0.5 pt-1.5">
                    <input className={inputClass} placeholder="" value={row.remarks || ""} onChange={(e) => onPatch(index, { remarks: e.target.value })} />
                  </td>
                  <td className="px-0.5 pt-1.5">
                    <button type="button" className="text-[11px] text-muted-foreground hover:text-ink" onClick={() => onPatch(index, { dim: "", dimL: "", dimW: "", holes: "", tolPlus: "", tolMinus: "", tolPlusL: "", tolMinusL: "", tolPlusW: "", tolMinusW: "", remarks: "", readings: "{}" })}>
                      Clear
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
        <p className="text-[12px] text-muted-foreground">{note}</p>
        <div className="flex gap-2">
          <button type="button" className="h-8 rounded-md border border-border px-3 text-[12px] font-medium hover:bg-primary/8" onClick={onAdd}>
            Add row
          </button>
          <button type="button" className="h-8 rounded-md border border-border px-3 text-[12px] font-medium hover:bg-primary/8" onClick={onDelete}>
            Delete row
          </button>
        </div>
      </div>
    </CollapsiblePanel>
  );
}

function FragmentPair() {
  return (
    <>
      <th className="min-w-[112px] w-[112px] border-b border-border px-1 py-1 text-center">Min</th>
      <th className="min-w-[112px] w-[112px] border-b border-border px-1 py-1 text-center">Max</th>
    </>
  );
}

function GoNoGoPair({
  go,
  nogo,
  dim,
  plus,
  minus,
  onGo,
  onNoGo,
}: {
  go: string;
  nogo: string;
  dim: string;
  plus: string;
  minus: string;
  onGo: (v: string) => void;
  onNoGo: (v: string) => void;
}) {
  const goWarn = f5GoNogoWarn("go", go, dim, plus, minus);
  const noWarn = f5GoNogoWarn("nogo", nogo, dim, plus, minus);
  return (
    <>
      <td className="min-w-[112px] px-0.5 pt-1.5">
        <input className={cn(inputClass, "min-w-[104px] text-right", warnClass(!!goWarn))} title={f5GoNogoHint("go", dim, plus, minus)} placeholder="" value={go} onChange={(e) => onGo(e.target.value)} />
      </td>
      <td className="min-w-[112px] px-0.5 pt-1.5">
        <input className={cn(inputClass, "min-w-[104px] text-right", warnClass(!!noWarn))} title={f5GoNogoHint("nogo", dim, plus, minus)} placeholder="" value={nogo} onChange={(e) => onNoGo(e.target.value)} />
      </td>
    </>
  );
}

function LwPair({
  goL,
  goW,
  nogoL,
  nogoW,
  dimL,
  dimW,
  plusL,
  plusW,
  minusL,
  minusW,
  onGoL,
  onGoW,
  onNoGoL,
  onNoGoW,
}: {
  goL: string;
  goW: string;
  nogoL: string;
  nogoW: string;
  dimL: string;
  dimW: string;
  plusL: string;
  plusW: string;
  minusL: string;
  minusW: string;
  onGoL: (v: string) => void;
  onGoW: (v: string) => void;
  onNoGoL: (v: string) => void;
  onNoGoW: (v: string) => void;
}) {
  return (
    <>
      <td className="min-w-[112px] px-0.5 pt-1">
        <div className="flex flex-col gap-0.5">
          <input className={cn(inputClass, "min-w-[104px]", warnClass(!!f5GoNogoWarn("go", goL, dimL, plusL, minusL)))} title={f5GoNogoHint("go", dimL, plusL, minusL)} placeholder="L" value={goL} onChange={(e) => onGoL(e.target.value)} />
          <input className={cn(inputClass, "min-w-[104px]", warnClass(!!f5GoNogoWarn("go", goW, dimW, plusW, minusW)))} title={f5GoNogoHint("go", dimW, plusW, minusW)} placeholder="W" value={goW} onChange={(e) => onGoW(e.target.value)} />
        </div>
      </td>
      <td className="min-w-[112px] px-0.5 pt-1">
        <div className="flex flex-col gap-0.5">
          <input className={cn(inputClass, "min-w-[104px]", warnClass(!!f5GoNogoWarn("nogo", nogoL, dimL, plusL, minusL)))} title={f5GoNogoHint("nogo", dimL, plusL, minusL)} placeholder="L" value={nogoL} onChange={(e) => onNoGoL(e.target.value)} />
          <input className={cn(inputClass, "min-w-[104px]", warnClass(!!f5GoNogoWarn("nogo", nogoW, dimW, plusW, minusW)))} title={f5GoNogoHint("nogo", dimW, plusW, minusW)} placeholder="W" value={nogoW} onChange={(e) => onNoGoW(e.target.value)} />
        </div>
      </td>
    </>
  );
}

function LaserTable({
  units,
  serialsNote,
  rows,
  onPatch,
  onReading,
  onAdd,
  onDelete,
}: {
  units: F5Unit[];
  serialsNote: string;
  rows: Record<string, string>[];
  onPatch: (index: number, patch: Record<string, string>) => void;
  onReading: (index: number, unitId: string, patch: F5Reading) => void;
  onAdd: () => void;
  onDelete: () => void;
}) {
  return (
    <CollapsiblePanel title={<F5SectionTitle>Dimple & Bump Measurements</F5SectionTitle>} accent={stepStyle(3).color}>
      <div className="scrollbar-slim max-h-[520px] overflow-auto">
        <table className="w-full min-w-[900px] border-collapse text-[12.5px]">
          <thead className="sticky top-0 z-[2] bg-[color:var(--glass-bg-strong,white)]">
            <tr>
              <th colSpan={Math.max(units.length, 1) + 9} className="bg-[color:var(--glass-bg-strong,white)] px-3 py-1 text-left text-[11px] font-normal tracking-[0.04em] text-muted-foreground">
                {serialsNote}
              </th>
            </tr>
            <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <th className="w-8 border-b border-border" />
              <th className="w-[52px] border-b border-border px-1 py-1.5 text-left">Sl No.</th>
              <th className="w-[110px] border-b border-border px-1 py-1.5 text-left">Feature</th>
              <th className="w-[110px] border-b border-border px-1 py-1.5 text-left">Characteristics</th>
              <th className="w-[100px] border-b border-border px-1 py-1.5 text-left">Drill Size</th>
              <th className="w-[130px] border-b border-border px-1 py-1.5 text-left">Requirement</th>
              <th className="w-[120px] border-b border-border px-1 py-1.5 text-left">No. of Holes/Slots</th>
              {units.length ? (
                units.map((unit) => (
                  <th key={unit.id} className="w-[110px] border-b border-border px-1 py-1.5 text-center">
                    <F5UnitHead unit={unit} />
                  </th>
                ))
              ) : (
                <th className="min-w-[160px] border-b border-border" />
              )}
              <th className="min-w-[130px] border-b border-border px-1 py-1.5 text-left">Remarks</th>
              <th className="w-[70px] border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const feature = row.feature || "Via Hole";
              const readings = f5ParseReadings(row.readings);
              const char = row.characteristic || "Dimple";
              const maxHint = f5LaserHint(row.size || "", char);
              return (
                <tr key={index} className="border-b border-border/60 align-top">
                  <td className="px-1 pt-2 text-center">
                    <input type="checkbox" checked={row.selected === "1"} onChange={(e) => onPatch(index, { selected: e.target.checked ? "1" : "" })} />
                  </td>
                  <td className="px-1 pt-2 tabular-nums text-muted-foreground">{row.sl || index + 1}</td>
                  <td className="px-0.5 pt-1.5">
  <select
    className={cn(inputClass, "cursor-pointer appearance-none")}
    value={feature}
    onChange={(e) => onPatch(index, { feature: e.target.value })}
  >
    {F5_LASER_FEATURE.map((option) => (
      <option key={option} value={option}>
        {option}
      </option>
    ))}
  </select>
</td>
                  <td className="px-0.5 pt-1.5">
                    <select className={cn(inputClass, "cursor-pointer appearance-none")} value={char} onChange={(e) => onPatch(index, { characteristic: e.target.value })}>
                      {F5_LASER_CHAR.map((opt) => (
                        <option key={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-0.5 pt-1.5">
                    <input className={cn(inputClass, "text-right")} type="number" step="0.01" min={0} placeholder="mm" value={row.size || ""} onChange={(e) => onPatch(index, { size: e.target.value })} />
                  </td>
                  <td className="px-2 pt-2 text-[11.5px]">{f5LaserReq(row.size || "", char)}</td>
                  <td className="px-0.5 pt-1.5">
                    <input className={cn(inputClass, "text-right")} type="number" min={0} placeholder="" value={row.holes || ""} onChange={(e) => onPatch(index, { holes: e.target.value })} />
                  </td>
                  {units.length ? (
                    units.map((unit) => {
                      const val = readings[unit.id]?.actual || "";
                      const over = f5LaserOut(val, row.size || "", char);
                      return (
                        <td key={unit.id} className="px-0.5 pt-1.5">
                          <input
                            className={cn(inputClass, "text-right", warnClass(over))}
                            type="number"
                            step="0.1"
                            placeholder="µm"
                            title={maxHint}
                            value={val}
                            onChange={(e) => onReading(index, unit.id, { actual: e.target.value })}
                          />
                        </td>
                      );
                    })
                  ) : (
                    <td className="px-2 pt-2 text-[11px] text-muted-foreground">Select sample boards</td>
                  )}
                  <td className="px-0.5 pt-1.5">
                    <input className={inputClass} placeholder="" value={row.remarks || ""} onChange={(e) => onPatch(index, { remarks: e.target.value })} />
                  </td>
                  <td className="px-0.5 pt-1.5">
                    <button type="button" className="text-[11px] text-muted-foreground hover:text-ink" onClick={() => onPatch(index, { size: "", holes: "", remarks: "", readings: "{}" })}>
                      Clear
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 px-3.5 py-2.5">
        <button type="button" className="h-8 rounded-md border border-border px-3 text-[12px] font-medium hover:bg-primary/8" onClick={onAdd}>
          Add row
        </button>
        <button type="button" className="h-8 rounded-md border border-border px-3 text-[12px] font-medium hover:bg-primary/8" onClick={onDelete}>
          Delete row
        </button>
      </div>
    </CollapsiblePanel>
  );
}

function BoardTable({
  title,
  units,
  serialsNote,
  rows,
  rowIndices,
  characteristicOptions,
  fixedCharacteristic,
  onPatch,
  onReading,
  onAdd,
  onDelete,
}: {
  title: string;
  units: F5Unit[];
  serialsNote: string;
  rows: Record<string, string>[];
  rowIndices: number[];
  characteristicOptions: readonly string[];
  fixedCharacteristic?: string;
  onPatch: (index: number, patch: Record<string, string>) => void;
  onReading: (index: number, unitId: string, patch: F5Reading) => void;
  onAdd: () => void;
  onDelete: () => void;
}) {
  return (
    <CollapsiblePanel title={<F5SectionTitle>{title}</F5SectionTitle>} accent={stepStyle(4).color}>
      <div className="scrollbar-slim max-h-[420px] overflow-auto">
        <table className="w-full min-w-[800px] border-collapse text-[12.5px]">
          <thead className="sticky top-0 z-[2] bg-[color:var(--glass-bg-strong,white)]">
            <tr>
              <th colSpan={16} className="bg-[color:var(--glass-bg-strong,white)] px-3 py-1 text-left text-[11px] font-normal tracking-[0.04em] text-muted-foreground">
                {serialsNote}
              </th>
            </tr>
            <tr className="bg-muted/40 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <th className="w-8 border-b border-border" />
              <th className="w-[52px] border-b border-border px-1 py-1.5 text-left">Sl No.</th>
              <th className="w-[190px] border-b border-border px-1 py-1.5 text-left">Characteristic</th>
              <th className="w-[150px] border-b border-border px-1 py-1.5 text-left">Requirement</th>
              <th className="w-[90px] border-b border-border px-1 py-1.5 text-right">Tolerance+</th>
              <th className="w-[90px] border-b border-border px-1 py-1.5 text-right">Tolerance-</th>
              <th className="w-[96px] border-b border-border px-1 py-1.5 text-left">UoM</th>
              {units.length ? (
                units.map((unit) => (
                  <th key={unit.id} className="w-[110px] border-b border-border px-1 py-1.5 text-center">
                    <F5UnitHead unit={unit} />
                  </th>
                ))
              ) : (
                <th className="min-w-[160px] border-b border-border" />
              )}
              <th className="min-w-[130px] border-b border-border px-1 py-1.5 text-left">Remarks</th>
              <th className="w-[70px] border-b border-border" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const rowIndex = rowIndices[index] ?? index;
              const char = fixedCharacteristic || row.characteristic || "Board thickness";
              const bow = char === "Bow & Twist";
              const readings = f5ParseReadings(row.readings);
              const bowMode = row.bowMode || "Custom";
              return (
                <tr key={index} className="border-b border-border/60">
                  <td className="px-1 text-center">
                    <input type="checkbox" checked={row.selected === "1"} onChange={(e) => onPatch(index, { selected: e.target.checked ? "1" : "" })} />
                  </td>
                  <td className="px-1 tabular-nums text-muted-foreground">{row.sl || rowIndex + 1}</td>
                  <td className="px-0.5 py-1">
  {fixedCharacteristic ? (
    <span className="px-2 text-[12px] text-ink">{fixedCharacteristic}</span>
  ) : (
    <select
      className={cn(inputClass, "cursor-pointer appearance-none")}
      value={char}
      onChange={(e) => onPatch(rowIndex, { characteristic: e.target.value })}
    >
      {characteristicOptions.map((option) => (
        <option key={option}>{option}</option>
      ))}
    </select>
  )}
</td>
                  <td className="px-0.5 py-1">
                    {bow ? (
                      <div>
                        <select className={cn(inputClass, "cursor-pointer appearance-none")} value={bowMode} onChange={(e) => onPatch(index, { bowMode: e.target.value })}>
                          {F5_BOW_MODE.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </select>
                        {bowMode === "Custom" ? (
                          <input className={cn(inputClass, "mt-1 text-right")} placeholder="" value={row.dim || ""} onChange={(e) => onPatch(index, { dim: e.target.value })} />
                        ) : null}
                      </div>
                    ) : (
                      <input className={cn(inputClass, "text-right")} placeholder="" value={row.dim || ""} onChange={(e) => onPatch(index, { dim: e.target.value })} />
                    )}
                  </td>
                  {bow ? (
                    <>
                      <td className="px-2 text-muted-foreground">N/A</td>
                      <td className="px-2 text-muted-foreground">N/A</td>
                      <td className="px-2">%</td>
                    </>
                  ) : (
                    <>
                      <td className="px-0.5 py-1">
                        <input className={cn(inputClass, "text-right")} placeholder="0.05" value={row.tolPlus || ""} onChange={(e) => onPatch(index, { tolPlus: e.target.value })} />
                      </td>
                      <td className="px-0.5 py-1">
                        <input className={cn(inputClass, "text-right")} placeholder="0.05" value={row.tolMinus || ""} onChange={(e) => onPatch(index, { tolMinus: e.target.value })} />
                      </td>
                      <td className="px-0.5 py-1">
                        <select className={cn(inputClass, "cursor-pointer appearance-none")} value={row.uom || "mm"} onChange={(e) => onPatch(index, { uom: e.target.value })}>
                          {F5_UOM.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                    </>
                  )}
                  {units.length ? (
                    units.map((unit) => {
                      const val = readings[unit.id]?.actual || "";
                      const warn = bow ? f5BowWarn(val, bowMode, row.dim || "") : f5GoNogoWarn("actual", val, row.dim || "", row.tolPlus || "", row.tolMinus || "");
                      return (
                        <td key={unit.id} className="px-0.5 py-1">
                          <input
                            className={cn(inputClass, "text-right", warnClass(!!warn))}
                            title={bow ? warn || `Bow & Twist — must be ${bowMode === "Custom" ? "≤ custom %" : bowMode}` : f5GoNogoHint("actual", row.dim || "", row.tolPlus || "", row.tolMinus || "")}
                            placeholder="Actual"
                            value={val}
                            onChange={(e) => onReading(rowIndex, unit.id, { actual: e.target.value })}
                          />
                        </td>
                      );
                    })
                  ) : (
                    <td className="px-2 text-[11px] text-muted-foreground">Select sample boards</td>
                  )}
                  <td className="px-0.5 py-1">
                    <input className={inputClass} placeholder="" value={row.remarks || ""} onChange={(e) => onPatch(index, { remarks: e.target.value })} />
                  </td>
                  <td className="px-0.5 py-1">
                    <button type="button" className="text-[11px] text-muted-foreground hover:text-ink" onClick={() => onPatch(index, { dim: "", tolPlus: "", tolMinus: "", remarks: "", readings: "{}" })}>
                      Clear
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2 px-3.5 py-2.5">
        <button type="button" className="h-8 rounded-md border border-border px-3 text-[12px] font-medium hover:bg-primary/8" onClick={onAdd}>
          Add row
        </button>
        <button type="button" className="h-8 rounded-md border border-border px-3 text-[12px] font-medium hover:bg-primary/8" onClick={onDelete}>
          Delete row
        </button>
      </div>
    </CollapsiblePanel>
  );
}
