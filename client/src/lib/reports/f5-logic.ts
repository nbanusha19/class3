import {
  arraysPerPanel,
  buildSerials,
  isPs30051,
  normalizeSupplyForm,
  type F2Serial,
  type F2State,
} from "./f2-logic";
import { samplingQtyForLot } from "./sampling";

export const F5_UOM = ["mm", "µm", "inch", "mil"] as const;
export const F5_UOM_CS = ["mm", "µm", "inch", "mil", "Degree"] as const;
export const F5_PLATE = ["PTH", "NPTH"] as const;
export const F5_MODE = ["Single", "L x W"] as const;
export const F5_CS_FEATURE = ["Counter Sink", "Cutout", "Slot"] as const;
export const F5_LASER_FEATURE = ["Via Hole", "Microvia", "Blind via"] as const;
export const F5_LASER_CHAR = ["Dimple", "Bump"] as const;
export const F5_BOARD_CHAR = ["Board thickness", "Bow & Twist", "Linear dimensional"] as const;
export const F5_BOW_MODE = ["Custom", "<=0.75", "<=1.50"] as const;

export type F5Reading = {
  go?: string;
  nogo?: string;
  goL?: string;
  goW?: string;
  nogoL?: string;
  nogoW?: string;
  actual?: string;
  bowMode?: string;
  bowLimit?: string;
  bowRemark?: string;
};

export type F5Unit = { id: string; prod: string; label: string };

export type F5ArrayGroup = {
  prod: string;
  panel: string;
  arrays: F2Serial[][];
};

export function f5PickId(row: Pick<F2Serial, "prod" | "serial">) {
  return `${row.prod}::${row.serial}`;
}

export function f5ParsePicked(raw: string): string[] {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function f5NormalizePicked(raw: string, good: F2Serial[]): string[] {
  const ids = new Set(good.filter((row) => !row.rejected).map(f5PickId));
  return f5ParsePicked(raw)
    .map((token) => {
      if (ids.has(token)) return token;
      const hit = good.find((row) => !row.rejected && row.serial === token);
      return hit ? f5PickId(hit) : "";
    })
    .filter((id) => ids.has(id));
}

export function f5ArrayGroups(state: F2State, spec: string): F5ArrayGroup[] {
  const per = Math.max(1, Number(state.perArray) || 0);
  const all = buildSerials(state, spec);
  const groups = new Map<string, F2Serial[]>();
  const order: string[] = [];
  for (const row of all) {
    const key = `${row.prod}::${row.panel}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(row);
  }
  return order.map((key) => {
    const items = groups.get(key) || [];
    const arrays: F2Serial[][] = [];
    for (let i = 0; i < items.length; i += per) arrays.push(items.slice(i, i + per));
    return { prod: items[0]?.prod || "", panel: items[0]?.panel || "", arrays };
  });
}

export function f5ArrayMode(state: F2State) {
  return normalizeSupplyForm(state.supplyForm).toLowerCase() === "array" && arraysPerPanel(state) > 0;
}

export function f5SelectedArrayCount(state: F2State, spec: string, picked: string[]): number {
  let n = 0;
  for (const group of f5ArrayGroups(state, spec)) {
    for (const chunk of group.arrays) {
      const ids = chunk.filter((row) => !row.rejected).map(f5PickId);
      if (ids.length && ids.every((id) => picked.includes(id))) n++;
    }
  }
  return n;
}

export function f5MeasureUnits(state: F2State, spec: string, picked: string[]): F5Unit[] {
  const hideProd = isPs30051(spec);
  if (f5ArrayMode(state)) {
    const out: F5Unit[] = [];
    let arrayNo = 0;
    f5ArrayGroups(state, spec).forEach((group) => {
      group.arrays.forEach((chunk) => {
        const good = chunk.filter((row) => !row.rejected);
        const ids = good.map(f5PickId);
        if (!ids.length || !ids.every((id) => picked.includes(id))) return;
        const range =
          good.length === 1
            ? `(${good[0]!.pcb}-${good[0]!.panel})`
            : `(${good[0]!.pcb}-${good[good.length - 1]!.pcb}-${good[0]!.panel})`;
        const prod = hideProd ? "" : good[0]!.prod;
        const ranged = prod ? range.replace(/\)$/, `-${prod})`) : range;
        arrayNo += 1;
        out.push({
          id: ids[0]!,
          prod,
          label: `Array ${arrayNo} ${ranged}`,
        });
      });
    });
    return out;
  }
  return picked.map((id) => {
    const [prod, ...rest] = id.split("::");
    const serial = rest.join("::") || id;
    const order = hideProd ? "" : prod || "";
    return { id, prod: order, label: f5UnitHeading({ prod: order, label: serial }) };
  });
}

/** Sample column title: 01-003-224876 */
export function f5UnitHeading(unit: Pick<F5Unit, "label" | "prod">): string {
  const label = String(unit.label || "").trim();
  const prod = String(unit.prod || "").trim();
  if (!prod) return label || "—";
  if (!label) return prod;
  if (label === prod || label.endsWith(`-${prod}`) || label.endsWith(`-${prod})`)) return label;
  return `${label}-${prod}`;
}

/** Split 01-001-226619 into { primary: "01-001", secondary: "226619" }. */
export function f5UnitHeadingParts(unit: Pick<F5Unit, "label" | "prod">): { primary: string; secondary?: string } {
  const heading = f5UnitHeading(unit);
  const prod = String(unit.prod || "").trim();
  const label = String(unit.label || "").trim() || heading;
  if (prod) {
    if (label.endsWith(`-${prod})`)) {
      const primary = `${label.slice(0, -(prod.length + 2))})`.trim();
      if (primary) return { primary, secondary: prod };
    }
    if (label.endsWith(`-${prod}`) || heading.endsWith(`-${prod}`)) {
      const source = label.endsWith(`-${prod}`) ? label : heading;
      const primary = source.slice(0, -(prod.length + 1)).trim();
      if (primary) return { primary, secondary: prod };
    }
  }
  const match = /^(.+)-(\d{5,})$/.exec(heading);
  if (match) return { primary: match[1]!, secondary: match[2]! };
  return { primary: heading || "—" };
}

/** Two-line PDF / UI header: 01-001 then (226619). */
export function f5UnitHeadingStacked(unit: Pick<F5Unit, "label" | "prod">): string {
  const { primary, secondary } = f5UnitHeadingParts(unit);
  return secondary ? `${primary}\n(${secondary})` : primary;
}

export const F5_SAMPLES_PER_PAGE = 3;

export function f5ChunkUnits<T>(units: T[], size = F5_SAMPLES_PER_PAGE): T[][] {
  if (!units.length) return [[]];
  const out: T[][] = [];
  for (let i = 0; i < units.length; i += size) out.push(units.slice(i, i + size));
  return out;
}

function ddmmyyFromDate(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return `${iso[3]}${iso[2]}${iso[1]!.slice(2)}`;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, "0");
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const yy = String(parsed.getFullYear()).slice(2);
    return `${dd}${mm}${yy}`;
  }
  return "";
}

/** Legacy print number: MI-{productionOrder}-{DDMMYY}. */
export function f5ReportNumber(productionOrder: string, date: string): string {
  const prod = String(productionOrder || "").trim();
  const stamp = ddmmyyFromDate(date);
  if (!prod && !stamp) return "";
  if (!prod) return `MI-${stamp}`;
  if (!stamp) return `MI-${prod}`;
  return `MI-${prod}-${stamp}`;
}

export function f5QtyNos(quantity: string): string {
  const token = String(quantity || "").trim();
  if (!token) return "";
  if (/no'?s/i.test(token)) return token;
  return /^\d+(\.\d+)?$/.test(token) ? `${token} No's` : token;
}

export function f5Plated(type: string): string {
  const token = String(type || "").trim().toUpperCase();
  if (!token) return "—";
  if (token === "NPTH" || token.includes("NPTH") || token === "NON PLATED" || token === "NON-PLATED") return "No";
  if (token === "PTH" || token.includes("PTH") || token === "PLATED") return "Yes";
  return token;
}

function joinRange(a?: string, b?: string) {
  const x = String(a || "").trim();
  const y = String(b || "").trim();
  if (x && y) return x === y ? x : `${x}-${y}`;
  return x || y || "";
}

export function f5ReadingText(reading: F5Reading | undefined, lw = false): string {
  if (!reading) return "";
  if (String(reading.actual || "").trim()) return String(reading.actual).trim();
  if (lw) {
    const length = joinRange(reading.goL, reading.nogoL);
    const width = joinRange(reading.goW, reading.nogoW);
    return [length && `L ${length}`, width && `W ${width}`].filter(Boolean).join(" / ");
  }
  return joinRange(reading.go, reading.nogo);
}

export function f5HasMeasuredRows(rows: Record<string, string>[], keys: string[]): boolean {
  return rows.some((row) => {
    const raw = String(row.readings || "").replace(/\s/g, "");
    if (raw && raw !== "{}" && raw !== "null") return true;
    return keys.some((key) => String(row[key] || "").trim());
  });
}

export function f5LotNote(lot: number, sampleQty: string, arrayMode: boolean) {
  if (!(lot > 0)) {
    return "Complete F2 panel entry — sample qty follows AQL 4.0 (C=0, IPC table 4-2) on the total production qty.";
  }
  return `AQL 4.0 on ${lot} produced · measure ${sampleQty || "—"} ${arrayMode ? "arrays" : "boards"} · select their serial numbers above`;
}

export function f5SampleNeed(sampleQty: string, lot: number) {
  const n = Number(sampleQty);
  if (n > 0) return n;
  if (/^100%/.test(sampleQty || "")) return lot;
  return 0;
}

export function f5ParseReadings(raw: string | undefined): Record<string, F5Reading> {
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, F5Reading>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function f5SetReading(raw: string | undefined, unitId: string, patch: F5Reading): string {
  const next = { ...f5ParseReadings(raw), [unitId]: { ...f5ParseReadings(raw)[unitId], ...patch } };
  return JSON.stringify(next);
}

export function f5LaserLimit(size: number): { dimple: number; bump: number } | null {
  if (!(size > 0)) return null;
  return size > 0.15 ? { dimple: 50, bump: 25 } : { dimple: 25, bump: 25 };
}

export function f5LaserReq(size: string, characteristic: string) {
  const limit = f5LaserLimit(parseFloat(size));
  if (!limit) return "Enter drill size";
  const key = /bump/i.test(characteristic) ? "bump" : "dimple";
  return `Max ${limit[key]} µm`;
}

export function f5Num(value: string) {
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

function f5FmtTol(n: number) {
  return String(Number(n.toFixed(6)));
}

export function f5GoNogoRange(nominalRaw: string, plusRaw: string, minusRaw: string): { lo: number; hi: number } | null {
  const nominal = f5Num(nominalRaw);
  if (nominal == null) return null;
  const plus = f5Num(plusRaw) || 0;
  const minus = f5Num(minusRaw) || 0;
  return { lo: nominal - minus, hi: nominal + plus };
}

/** Hover text for Go / NoGo / actual — shown even when the cell is in spec. */
export function f5GoNogoHint(
  kind: "go" | "nogo" | "actual",
  nominalRaw: string,
  plusRaw: string,
  minusRaw: string,
): string {
  const range = f5GoNogoRange(nominalRaw, plusRaw, minusRaw);
  if (!range) {
    if (kind === "go") return "Go — lower reading (must stay within dimension ± tolerance)";
    if (kind === "nogo") return "NoGo — upper reading (must stay within dimension ± tolerance)";
    return "Actual — must stay within dimension ± tolerance";
  }
  const lo = f5FmtTol(range.lo);
  const hi = f5FmtTol(range.hi);
  if (kind === "go") return `Go — lower reading, must be ≥ ${lo} and ≤ ${hi}`;
  if (kind === "nogo") return `NoGo — upper reading, must be ≥ ${lo} and ≤ ${hi}`;
  return `Actual — must be within ${lo} to ${hi}`;
}

export function f5GoNogoWarn(
  kind: "go" | "nogo" | "actual",
  reading: string,
  nominalRaw: string,
  plusRaw: string,
  minusRaw: string,
): string | null {
  const v = f5Num(reading);
  const range = f5GoNogoRange(nominalRaw, plusRaw, minusRaw);
  if (v == null || range == null || reading.trim() === "") return null;
  if (v < range.lo || v > range.hi) return f5GoNogoHint(kind, nominalRaw, plusRaw, minusRaw);
  return null;
}

export function f5LaserHint(size: string, characteristic: string): string {
  const limit = f5LaserLimit(parseFloat(size));
  if (!limit) return "Enter drill size to set the maximum";
  const max = /bump/i.test(characteristic) ? limit.bump : limit.dimple;
  const char = characteristic || "Dimple";
  return `Must not exceed ${max} µm for this drill size (${char})`;
}

export function f5LaserOut(actual: string, size: string, characteristic: string): boolean {
  const limit = f5LaserLimit(parseFloat(size));
  if (!limit) return false;
  const max = /bump/i.test(characteristic) ? limit.bump : limit.dimple;
  const n = f5Num(actual);
  if (n == null || String(actual).trim() === "") return false;
  return n >= max;
}

export function f5DrillReadingOut(reading: F5Reading | undefined, row: Record<string, string>): boolean {
  if (!reading) return false;
  if (row.mode === "L x W") {
    return Boolean(
      f5GoNogoWarn("go", reading.goL || "", row.dimL || "", row.tolPlusL || "", row.tolMinusL || "") ||
        f5GoNogoWarn("go", reading.goW || "", row.dimW || "", row.tolPlusW || "", row.tolMinusW || "") ||
        f5GoNogoWarn("nogo", reading.nogoL || "", row.dimL || "", row.tolPlusL || "", row.tolMinusL || "") ||
        f5GoNogoWarn("nogo", reading.nogoW || "", row.dimW || "", row.tolPlusW || "", row.tolMinusW || ""),
    );
  }
  return Boolean(
    f5GoNogoWarn("go", reading.go || "", row.dim || "", row.tolPlus || "", row.tolMinus || "") ||
      f5GoNogoWarn("nogo", reading.nogo || "", row.dim || "", row.tolPlus || "", row.tolMinus || ""),
  );
}

export function f5BoardReadingOut(reading: F5Reading | undefined, row: Record<string, string>): boolean {
  const val = reading?.actual || "";
  if (/bow/i.test(row.characteristic || "")) return Boolean(f5BowWarn(val, row.bowMode || "Custom", row.dim || ""));
  return Boolean(f5GoNogoWarn("actual", val, row.dim || "", row.tolPlus || "", row.tolMinus || ""));
}

export function f5BowWarn(reading: string, bowMode: string, custom: string): string | null {
  const v = f5Num(reading);
  if (v == null || reading.trim() === "") return null;
  const limit = bowMode === "<=0.75" ? 0.75 : bowMode === "<=1.50" ? 1.5 : f5Num(custom);
  if (limit == null) return null;
  return v > limit ? `Must be ≤ ${limit}%` : null;
}

export function f5AutoPickIds(state: F2State, spec: string, need: number): string[] {
  if (!(need > 0)) return [];
  if (f5ArrayMode(state)) {
    const allArrays: string[][] = [];
    f5ArrayGroups(state, spec).forEach((group) => {
      group.arrays.forEach((chunk) => {
        const ids = chunk.filter((row) => !row.rejected).map(f5PickId);
        if (ids.length) allArrays.push(ids);
      });
    });
    if (!allArrays.length) return [];
    const step = Math.max(1, Math.floor(allArrays.length / need));
    const chosen: string[][] = [];
    for (let i = 0; i < allArrays.length && chosen.length < need; i += step) chosen.push(allArrays[i]!);
    for (let i = 0; i < allArrays.length && chosen.length < need; i++) {
      if (!chosen.includes(allArrays[i]!)) chosen.push(allArrays[i]!);
    }
    return chosen.slice(0, need).flat();
  }
  const good = buildSerials(state, spec).filter((row) => !row.rejected);
  if (!good.length) return [];
  const step = Math.max(1, Math.floor(good.length / need));
  const out: string[] = [];
  for (let i = 0; i < good.length && out.length < need; i += step) out.push(f5PickId(good[i]!));
  for (const row of good) {
    const id = f5PickId(row);
    if (out.length >= need) break;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export function f5DefaultDrillRow(sl: string) {
  return { sl, type: "PTH", mode: "Single", uom: "mm", selected: "", readings: "{}" };
}

export function f5DefaultCsRow(sl: string) {
  return { sl, type: "PTH", mode: "Single", feature: "Counter Sink", uom: "mm", selected: "", readings: "{}" };
}

export type F5DrillInfo = {
  finishedSize: string;
  qty: string;
  drillType: string;
  tolPlus: string;
  tolMinus: string;
};

export function f5RowsFromDrillInfo(drills: F5DrillInfo[]): Record<string, string>[] {
  return drills.map((drill, index) => ({
    sl: String(index + 1),
    type: drill.drillType || "PTH",
    mode: "Single",
    dim: drill.finishedSize || "",
    holes: drill.qty || "",
    tolPlus: drill.tolPlus || "",
    tolMinus: drill.tolMinus || "",
    uom: "mm",
    remarks: "",
    selected: "",
    readings: "{}",
  }));
}

export function f5DrillIsBlank(rows: Record<string, string>[]): boolean {
  if (!rows.length) return true;
  return rows.every((row) => !row.dim && !row.holes && !row.tolPlus && !row.tolMinus && (!row.type || row.type === "PTH"));
}

export function f5DefaultLaserRow(sl: string) {
  return { sl, feature: "Via Hole", characteristic: "Dimple", selected: "", readings: "{}" };
}



export function f5DefaultBoardRow(sl: string) {
  return { sl, characteristic: "Board thickness", bowMode: "Custom", uom: "mm", selected: "", readings: "{}" };
}

export function f5ApplyBoardThickness(rows: Record<string, string>[], thickness: string): Record<string, string>[] {
  const value = String(thickness || "").trim();
  if (!value) return rows;
  const next = (rows.length ? rows : [f5DefaultBoardRow("1")]).map((row) => ({ ...row }));
  const index = next.findIndex((row) => /board thickness/i.test(row.characteristic || "") || !row.characteristic);
  if (index < 0) {
    next.unshift({ ...f5DefaultBoardRow("1"), dim: value });
  } else {
    next[index] = { ...next[index]!, characteristic: "Board thickness", dim: value, uom: next[index]!.uom || "mm" };
  }
  return next.map((row, i) => ({ ...row, sl: String(i + 1) }));
}

export function f5SamplingQty(lot: number) {
  return samplingQtyForLot(lot, "AQL 4.0");
}

/** Claude F5 subtitle on laser / board tables. */
export function f5SerialsNote(picked: string[]): string {
  if (!picked.length) return "Select sample boards above to record readings per serial.";
  return (
    "Sample boards: " +
    picked
      .map((id) => {
        const [prod, ...rest] = id.split("::");
        const serial = rest.join("::") || id;
        return f5UnitHeading({ label: serial, prod: prod || "" });
      })
      .join(", ")
  );
}

export function f5PickerProdLabel(prod: string, panel: string, spec: string, arrayMode: boolean): string {
  if (isPs30051(spec)) return arrayMode ? `Panel ${panel}` : "";
  return arrayMode ? `${prod} · Panel ${panel}` : prod;
}
