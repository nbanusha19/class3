import { pad, type F2State } from "./f2-logic";

/** Structural integrity rows and 1–2 layer NA lock from Claude CoC HTML Form F6. */

export const F6_PANEL_OPTS = ["", "Not Accepted", "Accepted", "NA", "None"] as const;

export type F6PanelOpt = (typeof F6_PANEL_OPTS)[number];

export const F6_DEFS: { sl: string; inspection: string; req: string }[] = [
  { sl: "1", inspection: "Plating Integrity", req: "3.6.2.1" },
  { sl: "2", inspection: "Laminate Integrity", req: "3.6.2.3/3.6.2.4/3.6.2.5" },
  { sl: "3", inspection: "Etchback/Negative Etchback", req: "3.6/3.6.2.6/3.6.2.8" },
  { sl: "4", inspection: "Annular Ring/Breakout — Internal (X)", req: "3.6/3.6.2.9.2" },
  { sl: "5", inspection: "Annular Ring/Breakout — Internal (Y)", req: "3.6/3.6.2.9.2" },
  { sl: "6", inspection: "Lifted Lands", req: "3.6.2.10" },
  { sl: "7", inspection: "Hole Plating Thickness", req: "3.6.2.11" },
  { sl: "8", inspection: "Wrap Plating", req: "3.6.2.11.1" },
  { sl: "9", inspection: "Cap Plating", req: "3.6.2.11.2" },
  { sl: "10", inspection: "Copper Filled Microvia", req: "3.6.2.11.3" },
  { sl: "11", inspection: "Microvia Target Land Contact", req: "3.6.2.12" },
  { sl: "12", inspection: "Microvia Target Land Penetration", req: "3.6.2.13" },
  { sl: "13", inspection: "Surface Conductor Thickness", req: "3.6/3.6.2.15" },
  { sl: "14", inspection: "Inner Layer Thickness", req: "3.6/3.6.2.14" },
  { sl: "15", inspection: "Metal Core Spacing", req: "3.6.2.17" },
  { sl: "16", inspection: "Dielectric Thickness", req: "3.6/3.6.2.18" },
  { sl: "17", inspection: "Material fill of blind/buried vias", req: "3.6.2.19" },
  { sl: "18", inspection: "Back Drill (X)", req: "3.6.2.20" },
  { sl: "19", inspection: "Back Drill (Y)", req: "3.6.2.20" },
  { sl: "20", inspection: "Nailheading", req: "3.6.2.21" },
];

/** Claude: NA locked on these rows when layer count is 1 or 2. */
const F6_NA_ROWS = new Set(["3", "4", "5", "14", "17", "18", "19", "20"]);
const F6_TWO_LAYER_NA_ROWS = new Set(["10", "11", "12", "15"]);
const F6_BACK_DRILL_ROWS = new Set(["18", "19"]);

export function f6LayerCount(layers: string): number {
  const n = Number(String(layers || "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function f6IsTypeVii(viaProtection: string): boolean {
  const token = String(viaProtection || "").replace(/\s+/g, " ").trim();
  if (!token || /viii/i.test(token)) return false;
  return /type\s*vii\b/i.test(token) || /\bvii\b/i.test(token) || /type\s*7\b/i.test(token);
}

export function f6ViaProtectNo(viaProtection: string): boolean {
  const token = String(viaProtection || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!token) return false;
  if (["no", "n", "0", "false", "none", "na", "n/a", "-"].includes(token)) return true;
  return /\bno\s*(via|protect|protection)?\b/.test(token) && !f6IsTypeVii(viaProtection);
}

export function f6NaForced(sl: string, layers: string): boolean {
  const n = f6LayerCount(layers);
  return (n > 0 && n <= 2 && F6_NA_ROWS.has(sl)) ||
    (n === 2 && F6_TWO_LAYER_NA_ROWS.has(sl));
}

/** Wrap Plating (sl. 8): Type VII → Accepted, Via Protect No → NA. */
export function f6WrapPlatingForced(sl: string, viaProtection: string): boolean {
  if (sl !== "8") return false;
  return f6IsTypeVii(viaProtection) || f6ViaProtectNo(viaProtection);
}

export function f6WrapPlatingValue(viaProtection: string): "Accepted" | "NA" {
  return f6IsTypeVii(viaProtection) ? "Accepted" : "NA";
}

export function f6CapPlatingForced(sl: string): boolean {
  return sl === "9";
}

export function f6CapPlatingValue(viaProtection: string): "Accepted" | "NA" {
  return f6IsTypeVii(viaProtection) ? "Accepted" : "NA";
}

export function f6IsBackDrillYes(backDrilling: string): boolean {
  const token = String(backDrilling || "").replace(/\s+/g, " ").trim().toLowerCase();
  return token === "yes" || token === "y" || token === "1" || token === "true";
}

/** Layers > 2: Back Drill X/Y follow PCB_DETAILS.BackDrilling. */
export function f6BackDrillForced(sl: string, layers: string): boolean {
  return f6LayerCount(layers) > 2 && F6_BACK_DRILL_ROWS.has(sl);
}

export function f6BackDrillValue(backDrilling: string): "Accepted" | "NA" {
  return f6IsBackDrillYes(backDrilling) ? "Accepted" : "NA";
}

export function f6PanelDisplay(value: string): string {
  if (!value || value === "-") return "";
  return value;
}

/** PDF marks: check = accepted, cross = not accepted. */
export const F6_MARK_ACCEPTED = "✓";
export const F6_MARK_NOT_ACCEPTED = "✗";
export const F6_PRINT_LEGEND = "✓ means accepted.  ✗ means not accepted.  NA means not applicable.";

/** Compact marks for narrow F6 panel columns. */
export function f6PanelPrintLabel(value: string): string {
  const token = f6PanelDisplay(value);
  if (token === "Accepted") return F6_MARK_ACCEPTED;
  if (token === "Not Accepted") return F6_MARK_NOT_ACCEPTED;
  return token;
}

/** Accepted F2 panels as print labels (001, 002, …), skipping rejected whole panels. */
export function f6AcceptedPanelLabels(state: F2State): string[] {
  const digits = Number(state.panelDigits) || 3;
  const labels: string[] = [];
  (state.lines || []).forEach((line, lineIndex) => {
    const n = Math.max(0, Number(line.panels) || 0);
    for (let k = 1; k <= n; k++) {
      if ((line.rejP || []).includes(k)) continue;
      labels.push(pad(k, digits));
    }
  });
  return labels;
}

export const F6_PANELS_PER_PAGE = 8;

export function f6ChunkPanels(labels: string[], size = F6_PANELS_PER_PAGE): string[][] {
  if (!labels.length) return [[""]];
  const out: string[][] = [];
  for (let i = 0; i < labels.length; i += size) out.push(labels.slice(i, i + size));
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

/** Legacy print number: SI-{productionOrder}-{DDMMYY}. */
export function f6ReportNumber(productionOrder: string, date: string): string {
  const prod = String(productionOrder || "").trim();
  const stamp = ddmmyyFromDate(date);
  if (!prod && !stamp) return "";
  if (!prod) return `SI-${stamp}`;
  if (!stamp) return `SI-${prod}`;
  return `SI-${prod}-${stamp}`;
}

export function f6Template() {
  return F6_DEFS.map((d) => ({ sl: d.sl, inspection: d.inspection, req: d.req, panel1: "", remarks: "" }));
}

export function withDerivedF6Rows(rows: Record<string, string>[], layers: string, viaProtection = "", backDrilling = "") {
  return rows.map((row) => {
    const sl = row.sl || "";
    if (f6WrapPlatingForced(sl, viaProtection)) return { ...row, panel1: f6WrapPlatingValue(viaProtection) };
    if (f6CapPlatingForced(sl)) return { ...row, panel1: f6CapPlatingValue(viaProtection) };
    if (f6BackDrillForced(sl, layers)) return { ...row, panel1: f6BackDrillValue(backDrilling) };
    if (!f6NaForced(sl, layers)) return row;
    return { ...row, panel1: "NA" };
  });
}
