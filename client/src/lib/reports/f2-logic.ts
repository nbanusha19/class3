export type F2SupplyForm = string;
export const F2_SUPPLY_FORM_OPTIONS = ["Single", "Array", "Sets", "Merged"];
export type F2MarkMode = "Supplied" | "Rejected" | "Stock"| "FAI"| "Others";
export type F2SerialView = "All" | "Supplied" | "To stock" | "Rejected";
export type F2BoardState = "Rejected" | "Stock" | "Supplied" | "Others" | "Open";

export type F2Line = {
  prod: string;
  week: string;
  panels: string;
  rejP: number[];
  rejC: Record<string, number[]>;
};

export type F2Ship = {
  qty: string;
  date: string;
  note: string;
};

export type F2State = {
  supplyForm: F2SupplyForm;
  perArray: string;
  perPanel: string;
  panelDigits: string;
  lines: F2Line[];
  ships: F2Ship[];
  assign: Record<string, string>;
  reasons: Record<string, string>;
  openLine: number;
  markMode: F2MarkMode;
  serialView: F2SerialView;
  otherRemarks: Record<string, string>;
  fai: Record<string, boolean>;
  panelDigits: string;
  serialStart: string;
};

export type F2Serial = {
  rejected: boolean;
  hardRejected: boolean;
  ref: number;
  id: string;
  serial: string;
  pcb: string;
  panel: string;
  arrayNo: string;
  week: string;
  prod: string;
  reason: string;
  assigned: string;
};

export const F2_REASON_OPTIONS = [
  "",
  "Open circuit",
  "Short circuit",
  "Copper void in hole wall",
  "Annular ring below limit",
  "Solder mask misregistration",
  "Delamination",
  "Scratch / handling damage",
  "Dimensional out of tolerance",
  "Impedance out of tolerance",
  "Surface finish defect",
  "Other",
];

export const F2_PANEL_DIGIT_OPTIONS = ["2", "3", "4", "5"];

export const F2_REPORT_PREFIX = "SN-";

/** F2 report number is SN- plus the F1 COC number. */
export function f2ReportNumber(cocNumber: string): string {
  const coc = String(cocNumber || "")
    .trim()
    .replace(/^SN-/i, "");
  return coc ? `${F2_REPORT_PREFIX}${coc}` : F2_REPORT_PREFIX;
}

const SERIAL_CAP = 400;
const PANEL_CAP = 100;

export function emptyF2Line(prod = ""): F2Line {
  return { prod, week: "", panels: "", rejP: [], rejC: {} };
}

export function normalizeSupplyForm(raw: string | undefined | null): F2SupplyForm {
  const value = (raw || "").trim();
  const upper = value.toUpperCase();
  if (upper === "SINGLE" || upper === "SIN") return "Single";
  if (upper === "ARRAY" || upper === "ARR") return "Array";
  if (upper === "SETS") return "Sets";
  if (upper === "MERGED") return "Merged";
  return value;
}

export function isArrayLikeSupply(form: string | undefined | null): boolean {
  const value = normalizeSupplyForm(form).toLowerCase();
  return value === "array" || value === "sets" || value === "merged";
}

export function applyPcbDetailsToF2(
  state: F2State,
  details: {
    supplyForm?: string;
    pcbPerArray?: string;
    pcbPerPanel?: string;
    productionOrder?: string;
    launchPanel?: string;
  },
): F2State {
  const supplyForm = normalizeSupplyForm(details.supplyForm) || state.supplyForm || "Single";
  const arrayLike = isArrayLikeSupply(supplyForm);
  let next: F2State = {
    ...state,
    supplyForm,
    perArray: arrayLike ? String(details.pcbPerArray ?? state.perArray ?? "") : "",
    perPanel: String(details.pcbPerPanel ?? state.perPanel ?? ""),
  };
  const prod = (details.productionOrder || "").trim();
  if (prod && details.launchPanel !== undefined) {
    const launch = String(details.launchPanel ?? "").trim();
    next.lines.forEach((line, index) => {
      if (line.prod.trim() !== prod) return;
      const current = String(line.panels ?? "").trim();
      if (!current) next = setLinePanels(next, index, launch);
    });
  }
  return next;
}

export function defaultF2State(productionOrders: string[] = []): F2State {
  const prods = productionOrders.length ? productionOrders : [""];
  return {
    supplyForm: "Single",
    perArray: "",
    perPanel: "",
    panelDigits: "3",
    serialStart: "",
    lines: prods.map((prod) => emptyF2Line(prod)),
    ships: [{ qty: "", date: "", note: "" }],
    assign: {},
    reasons: {},
    otherRemarks: {},
    openLine: -1,
    markMode: "Rejected",
    serialView: "All",
    fai: {},
  };
}

export function mergeF2State(raw: Partial<F2State> | null | undefined, productionOrders: string[] = []): F2State {
  const base = defaultF2State(productionOrders);
  if (!raw || typeof raw !== "object") return base;
  const lines = Array.isArray(raw.lines) && raw.lines.length ? raw.lines.map(normalizeLine) : base.lines;
  const ships = Array.isArray(raw.ships) && raw.ships.length ? raw.ships.map(normalizeShip) : base.ships;
  return {
    ...base,
    ...raw,
    supplyForm: normalizeSupplyForm(raw.supplyForm) || "Single",
    panelDigits: F2_PANEL_DIGIT_OPTIONS.includes(String(raw.panelDigits || "")) ? String(raw.panelDigits) : "3",
    serialStart: /^\d+$/.test(String(raw.serialStart ?? ""))
    ? String(raw.serialStart)
    : "",
    lines,
    ships,
    assign: raw.assign && typeof raw.assign === "object" ? raw.assign : {},
    reasons: raw.reasons && typeof raw.reasons === "object" ? raw.reasons : {},
    otherRemarks:raw.otherRemarks && typeof raw.otherRemarks === "object" ? raw.otherRemarks : {},
    openLine: Number.isFinite(Number(raw.openLine)) ? Number(raw.openLine) : -1,
    fai: raw.fai && typeof raw.fai === "object" ? raw.fai : {},
    markMode:
  raw.markMode === "Stock" ||
  raw.markMode === "Supplied" ||
  raw.markMode === "FAI" ||
  raw.markMode === "Others"
    ? raw.markMode
    : "Rejected",
    serialView:
      raw.serialView === "Supplied" || raw.serialView === "To stock" || raw.serialView === "Rejected"
        ? raw.serialView
        : "All",
  };
}

function normalizeLine(line: Partial<F2Line> | null | undefined): F2Line {
  return {
    prod: String(line?.prod || ""),
    week: String(line?.week || ""),
    panels: String(line?.panels ?? ""),
    rejP: Array.isArray(line?.rejP) ? line.rejP.map(Number).filter((n) => n > 0) : [],
    rejC: line?.rejC && typeof line.rejC === "object" ? line.rejC : {},
  };
}

function normalizeShip(ship: Partial<F2Ship> | null | undefined): F2Ship {
  return {
    qty: String(ship?.qty ?? ""),
    date: String(ship?.date || ""),
    note: String(ship?.note || ""),
  };
}

export function isPs30051(custSpec: string): boolean {
  return custSpec.replace(/\s+/g, "").toUpperCase().includes("PS-30051");
}

/** F2 print: rejected list only for Array, or for Single when spec is PS-30051. Not Sets/Merged. */
export function showRejectedBoardsOnPrint(supplyForm: string, custSpec: string): boolean {
  const form = normalizeSupplyForm(supplyForm).toLowerCase();
  if (form === "array") return true;
  return form === "single" && isPs30051(custSpec);
}

export function pad(n: number, digits: number): string {
  return String(n).padStart(digits, "0");
}

export function dispatchLabel(index: number): string {
  return "DN-" + String(index + 1).padStart(4, "0");
}

export function perPcb(state: F2State): number {
  return Number(state.perPanel) || (isArrayLikeSupply(state.supplyForm) ? Number(state.perArray) || 0 : 1);
}

export function arraysPerPanel(state: F2State): number {
  const perArr = Number(state.perArray) || 0;
  const perPan = Number(state.perPanel) || 0;
  if (!isArrayLikeSupply(state.supplyForm) || !(perArr > 0)) return 0;
  return perPan > 0 ? Math.max(1, Math.floor(perPan / perArr)) : 1;
}

export function isArraySupply(state: F2State): boolean {
  return isArrayLikeSupply(state.supplyForm) && arraysPerPanel(state) > 0;
}

/** Legacy helper: used only to read old combined-lot serials (01-004 across lines). */
export function lineStart(lines: F2Line[], index: number): number {
  let start = 1;
  for (let j = 0; j < index; j++) start += Math.max(0, Number(lines[j]?.panels) || 0);
  return start;
}

/** PCB index range covered by a panel when each panel has `per` boards (1-based panel index). */
export function panelPcbRange(panelIndex: number, per: number): { start: number; end: number } {
  const count = Math.max(0, per);
  const k = Math.max(1, panelIndex);
  const start = (k - 1) * count + 1;
  return { start, end: k * count };
}

/** Panel badge: 001 within that production order; PS-30051 uses running PCB range (Panel 1-10, 11-20, …). */
export function f2PanelLabel(state: F2State, lineIndex: number, panelIndex: number, custSpec = ""): string {
  const w = Number(state.panelDigits) || 3;
  if (isPs30051(custSpec)) {
    const per = perPcb(state);
    if (per > 0) {
      const { start, end } = panelPcbRange(panelIndex, per);
      return `Panel ${start}-${end}`;
    }
  }
  return `Panel ${pad(Math.max(1, panelIndex), w)}`;
}

export function f2PcbNumber(
  state: F2State,
  pcbIndex: number,
  sequence: number,
  digits = 2,
): string {
  const start = Math.max(0, Math.trunc(Number(state.serialStart) || 0));
  const number = start > 0 ? start + sequence : pcbIndex;
  return pad(number, digits);
}

export function serialFor(state: F2State, lineIndex: number, panelIndex: number, pcbIndex: number): string {
  const w = Number(state.panelDigits) || 3;
  return pad(pcbIndex, 2) + "-" + pad(Math.max(1, panelIndex), w);
}

export function assignKey(state: F2State, lineIndex: number, panelIndex: number, pcbIndex: number): string {
  return `${lineIndex}:${serialFor(state, lineIndex, panelIndex, pcbIndex)}`;
}

function legacySerial(state: F2State, lineIndex: number, panelIndex: number, pcbIndex: number): string {
  const w = Number(state.panelDigits) || 3;
  const panelNo = lineStart(state.lines, lineIndex) + panelIndex - 1;
  return pad(pcbIndex, 2) + "-" + pad(panelNo, w);
}

export function lookupAssign(state: F2State, lineIndex: number, panelIndex: number, pcbIndex: number): string {
  const assign = liveAssign(state);
  const key = assignKey(state, lineIndex, panelIndex, pcbIndex);
  if (assign[key]) return assign[key];
  const legacy = legacySerial(state, lineIndex, panelIndex, pcbIndex);
  if (assign[legacy]) return assign[legacy];
  const serial = serialFor(state, lineIndex, panelIndex, pcbIndex);
  if (serial === legacy && assign[serial]) return assign[serial];
  if ((state.lines || []).length <= 1 && assign[serial]) return assign[serial];
  return "";
}

function writeAssign(
  assign: Record<string, string>,
  state: F2State,
  lineIndex: number,
  panelIndex: number,
  pcbIndex: number,
  value: string | null,
) {
  const key = assignKey(state, lineIndex, panelIndex, pcbIndex);
  delete assign[key];
  delete assign[serialFor(state, lineIndex, panelIndex, pcbIndex)];
  delete assign[legacySerial(state, lineIndex, panelIndex, pcbIndex)];
  if (value) assign[key] = value;
}

export function liveAssign(state: F2State): Record<string, string> {
  const raw = state.assign || {};
  const labels = state.ships.map((_, j) => dispatchLabel(j));
  const out: Record<string, string> = {};

  for (const key of Object.keys(raw)) {
    const value = raw[key] === "Supplied" ? "DN-0001" : raw[key];
    if (value === "Stock" || value === "Rejected" || value === "Others" || labels.includes(value)) {
      out[key] = value;
    }
  }
  return out;
}

export function boardState(
  state: F2State,
  lineIndex: number,
  panelIndex: number,
  pcbIndex: number,
): F2BoardState {
  const line = state.lines[lineIndex];
  if (!line) return "Open";
  if ((line.rejP || []).includes(panelIndex)) return "Rejected";
  if (rejList(line, panelIndex).includes(pcbIndex)) return "Rejected";

  const assigned = lookupAssign(state, lineIndex, panelIndex, pcbIndex);
  if (assigned === "Others") return "Others";
  if (assigned === "Stock") return "Stock";
  if (assigned) return "Supplied";
  return "Open";
}

export function lineArrays(state: F2State, line: F2Line): number {
  const apc = arraysPerPanel(state);
  if (!apc) return 0;
  const perArr = Number(state.perArray) || 0;
  const panels = Number(line.panels) || 0;
  let live = 0;
  for (let k = 1; k <= panels; k++) {
    if ((line.rejP || []).includes(k)) continue;
    const rc = rejList(line, k);
    for (let a = 0; a < apc; a++) {
      const members: number[] = [];
      for (let i = 1; i <= perArr; i++) members.push(a * perArr + i);
      if (members.some((n) => !rc.includes(n))) live++;
    }
  }
  return live;
}

export function acceptedPanelsTotal(state: F2State): number {
  return state.lines.reduce((sum, line) => sum + Math.max(0, (Number(line.panels) || 0) - (line.rejP || []).length), 0);
}

/** Claude lot basis: Array uses good arrays; otherwise good PCBs. */
export function f2LotSize(state: F2State, custSpec = ""): number {
  if (normalizeSupplyForm(state.supplyForm).toLowerCase() === "array" && arraysPerPanel(state)) {
    return state.lines.reduce((sum, line) => sum + lineArrays(state, line), 0);
  }
  return goodTotal(state, custSpec);
}

export function lineTotal(state: F2State, line: F2Line): number {
  const per = perPcb(state);
  const panels = Number(line.panels) || 0;
  if (!(per > 0) || !(panels > 0)) return 0;
  let total = 0;
  for (let k = 1; k <= panels; k++) {
    if ((line.rejP || []).includes(k)) continue;
    total += Math.max(0, per - rejList(line, k).length);
  }
  return total;
}

function rejList(line: F2Line, panelIndex: number): number[] {
  return line.rejC?.[String(panelIndex)] || line.rejC?.[panelIndex] || [];
}

export function buildSerials(state: F2State, custSpec = ""): F2Serial[] {
  const per = perPcb(state);
  const w = Number(state.panelDigits) || 3;
  const psFormat = isPs30051(custSpec);
  const perArr = Number(state.perArray) || 0;
  const out: F2Serial[] = [];
  if (!(per > 0)) return [];
  const reasons = state.reasons || {};

  state.lines.forEach((line, li) => {
    const panels = Number(line.panels) || 0;
    let seq = 0;
    for (let k = 1; k <= panels && out.length < SERIAL_CAP; k++) {
      const panelRejected = (line.rejP || []).includes(k);
      const rejPcbs = rejList(line, k);
      for (let i = 1; i <= per && out.length < SERIAL_CAP; i++) {
        const hardRejected = panelRejected || rejPcbs.includes(i);
        seq++;
        const id = assignKey(state, li, k, i);
        const pcbNumber = f2PcbNumber(state, i, seq, psFormat ? 3 : 2);
const serial = psFormat
  ? `${line.prod || "—"}-${pcbNumber}`
  : `${pcbNumber}-${pad(Math.max(1, k), w)}`;
        const assignedValue = lookupAssign(state, li, k, i);
        const dropRejected = !hardRejected && assignedValue === "Rejected";
        const rejected = hardRejected || dropRejected;
        out.push({
          rejected,
          hardRejected,
          ref: out.length + 1,
          id,
          serial,
          pcb: pcbNumber,
          panel: psFormat && per > 0 ? `${(k - 1) * per + 1}-${k * per}` : pad(k, w),
          arrayNo: isArrayLikeSupply(state.supplyForm) && perArr > 0 ? String(Math.floor((i - 1) / perArr) + 1) : "—",
          week: line.week || "",
          prod: line.prod || "—",
          reason: rejected ? reasons[id] || reasons[serial] || "" : "",
          assigned: hardRejected ? "Rejected" : assignedValue || "Unassigned",
        });
      }
    }
  });

  return out;
}

export function visibleSerials(state: F2State, custSpec = ""): F2Serial[] {
  const all = buildSerials(state, custSpec);
  if (state.serialView === "All") return all;
  if (state.serialView === "To stock") return all.filter((row) => row.assigned === "Stock");
  if (state.serialView === "Rejected") return all.filter((row) => row.assigned === "Rejected");
  return all.filter((row) => row.assigned !== "Stock" && row.assigned !== "Rejected" && row.assigned !== "Unassigned");
}

export function goodTotal(state: F2State, custSpec = ""): number {
  const list = buildSerials(state, custSpec);
  return list.length - list.filter((row) => row.rejected).length;
}

export function shipQty(state: F2State, index: number, custSpec = ""): { value: string; cap: number; clamped: boolean } {
  const label = dispatchLabel(index);
  const count = buildSerials(state, custSpec).filter((row) => row.assigned === label).length;
  return { value: String(count), cap: count, clamped: false };
}

export function dispositionOptions(state: F2State): string[] {
  return ["Unassigned", ...state.ships.map((_, i) => dispatchLabel(i)), "Stock", "Rejected"];
}

export function markBoards(
  state: F2State,
  lineIndex: number,
  panelIndex: number,
  members: number[],
): F2State {
  const line = state.lines[lineIndex];
  if (!line) return state;

  const mode = state.markMode;
  const rejC = { ...(line.rejC || {}) };
  const cur = (rejC[String(panelIndex)] || rejC[panelIndex] || []).slice();
  const assign = { ...state.assign };
  const otherRemarks = { ...state.otherRemarks };
  const allSame = members.every(
    (n) => boardState(state, lineIndex, panelIndex, n) === mode,
  );

  if (state.markMode === "FAI") {
  const eligible = members.length > 0 && members.every(
    (n) =>
      boardState(state, lineIndex, panelIndex, n) === "Supplied" &&
      /^DN-/.test(lookupAssign(state, lineIndex, panelIndex, n)),
  );
  if (!eligible) return state;

  const fai = { ...state.fai };
  const clear = members.every((n) => fai[assignKey(state, lineIndex, panelIndex, n)]);

  for (const n of members) {
    const key = assignKey(state, lineIndex, panelIndex, n);
    if (clear) delete fai[key];
    else fai[key] = true;
  }

  return { ...state, fai };
}

  if (mode === "Rejected") {
    const nextMembers = allSame
      ? cur.filter((n) => !members.includes(n))
      : [...cur, ...members.filter((n) => !cur.includes(n))].sort((a, b) => a - b);

    if (nextMembers.length) rejC[String(panelIndex)] = nextMembers;
    else delete rejC[String(panelIndex)];

    members.forEach((n) => {
      writeAssign(assign, state, lineIndex, panelIndex, n, null);
      delete otherRemarks[assignKey(state, lineIndex, panelIndex, n)];
    });

    return updateLine(
      state,
      lineIndex,
      {
        rejC,
        rejP: (line.rejP || []).filter((p) => p !== panelIndex),
      },
      { assign, otherRemarks },
    );
  }

  const kept = cur.filter((n) => !members.includes(n));
  if (kept.length) rejC[String(panelIndex)] = kept;
  else delete rejC[String(panelIndex)];

  members.forEach((n) => {
    const value = allSame
      ? null
      : mode === "Stock" || mode === "Others"
        ? mode
        : "DN-0001";
    writeAssign(assign, state, lineIndex, panelIndex, n, value);
    if (value !== "Others") {
      delete otherRemarks[assignKey(state, lineIndex, panelIndex, n)];
    }
  });

  return updateLine(
    state,
    lineIndex,
    {
      rejC,
      rejP: (line.rejP || []).filter((p) => p !== panelIndex),
    },
    { assign, otherRemarks },
  );
}
export function togglePanelReject(state: F2State, lineIndex: number, panelIndex: number): F2State {
  const line = state.lines[lineIndex];
  if (!line) return state;
  if (state.markMode === "Rejected") {
    const on = (line.rejP || []).includes(panelIndex);
    return updateLine(state, lineIndex, {
      rejP: on ? line.rejP.filter((x) => x !== panelIndex) : [...line.rejP, panelIndex].sort((a, b) => a - b),
    });
  }
  const per = perPcb(state);
  const all = Array.from({ length: per }, (_, n) => n + 1);
  return markBoards(state, lineIndex, panelIndex, all);
}

export function updateLine(
  state: F2State,
  index: number,
  patch: Partial<F2Line>,
  extra: Partial<F2State> = {},
): F2State {
  return {
    ...state,
    ...extra,
    lines: state.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
  };
}

export function setLinePanels(state: F2State, index: number, value: string): F2State {
  const n = Number(value) || 0;
  const line = state.lines[index];
  if (!line) return state;
  const keptC: Record<string, number[]> = {};
  Object.keys(line.rejC || {}).forEach((key) => {
    if (Number(key) <= n) keptC[key] = line.rejC[key]!;
  });
  return updateLine(state, index, {
    panels: value,
    rejP: (line.rejP || []).filter((p) => p <= n),
    rejC: keptC,
  });
}

export function clearLineMarks(state: F2State, lineIndex: number): F2State {
  const line = state.lines[lineIndex];
  if (!line) return state;

  const per = perPcb(state);
  const panels = Number(line.panels) || 0;
  const assign = { ...state.assign };

  for (let panel = 1; panel <= panels; panel++) {
    for (let pcb = 1; pcb <= per; pcb++) {
      writeAssign(assign, state, lineIndex, panel, pcb, null);
    }
  }

  const reasons = { ...state.reasons };
  Object.keys(reasons).forEach((key) => {
    if (key.startsWith(`${lineIndex}:`)) delete reasons[key];
  });

  const otherRemarks = { ...state.otherRemarks };
  Object.keys(otherRemarks).forEach((key) => {
    if (key.startsWith(`${lineIndex}:`)) delete otherRemarks[key];
  });

  return updateLine(
    state,
    lineIndex,
    { rejP: [], rejC: {} },
    { assign, reasons, otherRemarks },
  );
}

export function panelRowsLimit(panels: number): number {
  return Math.min(Math.max(0, panels), PANEL_CAP);
}

export function linesNote(state: F2State): string {
  const per = perPcb(state);
  if (!(per > 0)) return "Enter PCBs per panel (or PCBs per array for array supply) to compute totals.";
  const total = state.lines.reduce((sum, line) => sum + lineTotal(state, line), 0);
  const panels = state.lines.reduce(
    (sum, line) => sum + Math.max(0, (Number(line.panels) || 0) - (line.rejP || []).length),
    0,
  );
  const arrays = state.lines.reduce((sum, line) => sum + lineArrays(state, line), 0);
  return (
    `${state.lines.length} production order line${state.lines.length === 1 ? "" : "s"}` +
    ` · ${panels} accepted panels` +
    (arrays ? ` · ${arrays} arrays` : "") +
    ` · ${total} PCBs in total`
  );
}

export function shipNote(state: F2State, orderQty: number, custSpec = ""): string {
  const list = buildSerials(state, custSpec);
  const rejected = list.filter((row) => row.rejected).length;
  const total = list.length - rejected;
  const declared = state.ships.reduce((sum, _, i) => sum + (Number(shipQty(state, i, custSpec).value) || 0), 0);
  const shipped = list.filter((row) => /^DN-/.test(row.assigned) && !row.rejected).length;
  const stock = list.filter((row) => row.assigned === "Stock" && !row.rejected).length;
  if (total === 0) return "Generate serials, then assign each board to a dispatch or to stock.";
  return (
    `declared ${declared} of ${orderQty} order qty · assigned ${shipped} to dispatch · ${stock} to stock` +
    (rejected ? ` · ${rejected} rejected` : "") +
    ` · ${Math.max(0, total - shipped - stock)} unassigned`
  );
}

export function serialSummary(state: F2State, orderQty: number, custSpec = ""): string {
  const list = buildSerials(state, custSpec);
  if (list.length === 0) return "Enter PCBs per panel and no. of panels to generate serials.";
  const rejected = list.filter((row) => row.rejected).length;
  const good = list.length - rejected;
  const extra = orderQty ? Math.max(0, good - orderQty) : 0;
  return (
    `${list.length} serials` +
    (rejected ? ` · ${rejected} rejected · ${good} good` : "") +
    ` · order qty ${orderQty}` +
    (extra ? ` · ${extra} extra for stock` : "")
  );
}

export function serialColHeading(state: F2State): string {
  if (isArraySupply(state)) return "Serial numbers — array no.";
  const sample = pad(5, Number(state.panelDigits) || 3);
  return `Serial numbers — PCB no. – panel no. (e.g. 01-${sample})`;
}

export function countSupplied(state: F2State, custSpec = ""): number {
  return buildSerials(state, custSpec).filter((row) => /^DN-/.test(row.assigned) && !row.rejected).length;
}

export function countStock(state: F2State, custSpec = ""): number {
  return buildSerials(state, custSpec).filter((row) => row.assigned === "Stock" && !row.rejected).length;
}

export function countRejected(state: F2State, custSpec = ""): number {
  return buildSerials(state, custSpec).filter((row) => row.rejected).length;
}

export function pcbRejectCount(line: F2Line): number {
  const panels = Number(line.panels) || 0;
  const rejP = line.rejP || [];
  return Object.keys(line.rejC || {}).reduce((total, key) => {
    const panel = Number(key);
    if (panel > panels || rejP.includes(panel)) return total;
    return total + (line.rejC[key]?.length || 0);
  }, 0);
}

export function derivedF2Fields(state: F2State, custSpec = "") {
  const serials = buildSerials(state, custSpec);
  const supplied = serials
    .filter((row) => row.assigned !== "Stock" && row.assigned !== "Rejected" && row.assigned !== "Unassigned" && !row.hardRejected)
    .map((row) => row.serial);
  const stock = serials.filter((row) => row.assigned === "Stock" && !row.rejected).map((row) => row.serial);
  const rejected = serials.filter((row) => row.rejected);
  const xout = rejected.map((row, i) => ({
    sl: String(i + 1),
    serial: row.serial,
    reason: row.reason === "—" ? "" : row.reason,
  }));
  while (xout.length < 4) xout.push({ sl: String(xout.length + 1), serial: "", reason: "" });
  return {
    supplyForm: state.supplyForm,
    weekCode: state.lines[0]?.week || "",
    suppliedSerials: supplied.join(", "),
    stockSerials: stock.join(", "),
    suppliedXout: xout,
    stockXout: [
      { sl: "1", serial: "", reason: "" },
      { sl: "2", serial: "", reason: "" },
      { sl: "3", serial: "", reason: "" },
      { sl: "4", serial: "", reason: "" },
    ],
  };
}

export type F2PrintBoard = {
  serial: string;
  week: string;
  prod: string;
  reason?: string;
};

export type F2PrintBatch = {
  prod: string;
  week: string;
  qty: string;
  dispatch: string;
  date: string;
  serials: string[];
};

export type F2PrintModel = {
  customer: string;
  po: string;
  part: string;
  supplyFormat: string;
  showRejected: boolean;
  batches: F2PrintBatch[];
  stock: F2PrintBoard[];
  rejected: F2PrintBoard[];
};

export function chunkSerials(list: string[], size = 8): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i < list.length; i += size) {
    const row = list.slice(i, i + size);
    while (row.length < size) row.push("");
    rows.push(row);
  }
  return rows;
}

export type F2PrintBoardGroup = {
  week: string;
  prod: string;
  qty: string;
  serials: string[];
  reason?: string;
};

/** Groups stock/rejected boards by week code + batch no. (and rejection reason when present). */
export function groupF2PrintBoards(boards: F2PrintBoard[], byReason = false): F2PrintBoardGroup[] {
  const groups = new Map<string, F2PrintBoardGroup>();
  const order: string[] = [];
  for (const row of boards) {
    const reason = byReason ? (row.reason || "").trim() : "";
    const key = `${row.prod}::${row.week}::${reason}`;
    let group = groups.get(key);
    if (!group) {
      group = { week: row.week, prod: row.prod, qty: "0", serials: [], ...(byReason ? { reason } : {}) };
      groups.set(key, group);
      order.push(key);
    }
    group.serials.push(row.serial);
  }
  return order.map((key) => {
    const group = groups.get(key)!;
    return { ...group, qty: String(group.serials.length) };
  });
}

/** Groups shipped serials one block per production order + week code (batch) + dispatch. */
export function buildF2PrintModel(
  state: F2State,
  meta: { customer?: string; po?: string; part?: string; custSpec?: string } = {},
): F2PrintModel {
  const custSpec = meta.custSpec || "";
  const serials = buildSerials(state, custSpec);
  const groups = new Map<string, F2PrintBatch>();
  const order: string[] = [];

  for (const row of serials) {
    if (!row.assigned || !/^DN-/.test(row.assigned)) continue;
    const key = `${row.prod}::${row.week}::${row.assigned}`;
    let group = groups.get(key);
    if (!group) {
      group = { prod: row.prod, week: row.week, qty: "0", dispatch: row.assigned, date: "", serials: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.serials.push(row.serial);
  }

  const batches = order
    .map((key) => {
      const group = groups.get(key)!;
      const idx = Number(group.dispatch.replace("DN-", "")) - 1;
      const ship = state.ships[idx];
      return { ...group, qty: String(group.serials.length), date: ship?.date || "" };
    })
    .sort((a, b) => {
      const da = Number(a.dispatch.replace("DN-", "")) || 0;
      const db = Number(b.dispatch.replace("DN-", "")) || 0;
      if (da !== db) return da - db;
      return 0;
    });

  return {
    customer: meta.customer || "",
    po: meta.po || "",
    part: meta.part || "",
    supplyFormat: state.supplyForm,
    showRejected: showRejectedBoardsOnPrint(state.supplyForm, custSpec),
    batches,
    stock: serials
      .filter((row) => row.assigned === "Stock")
      .map((row) => ({ serial: row.serial, week: row.week, prod: row.prod })),
    rejected: serials
      .filter((row) => row.assigned === "Rejected")
      .map((row) => ({
        serial: row.serial,
        week: row.week,
        prod: row.prod,
        reason: row.reason && row.reason !== "—" ? row.reason : "",
      })),
  };
}
