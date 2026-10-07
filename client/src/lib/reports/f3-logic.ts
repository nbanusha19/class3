import { acceptedPanelsTotal, f2LotSize, isPs30051, type F2State } from "./f2-logic";
import { f7ReportNumber } from "./f7-logic";
import { planApplies, samplingQtyForLot } from "./sampling";
import { f6ReportNumber } from "./f6-logic";

type Row = Record<string, string>;

export const F3_RESULT_OPTS = ["Accepted", "Passed", "Rejected", "NA"];
export const F3_REPORT_PREFIX = "MI-";
export const F4_REPORT_PREFIX = "ET-";
export const F15_REPORT_PREFIX = "ST-";
export const F16_REPORT_PREFIX = "AT-";

function cocWithoutReportPrefix(cocNumber: string): string {
  return String(cocNumber || "")
    .trim()
    .replace(/^(BPCBI-|MI-|ET-|AT-|SN-|SI-|ST-|CA-)/i, "");
}

/** F3 report number is MI- plus the F1 COC number. */
export function f3ReportNumber(cocNumber: string): string {
  const coc = cocWithoutReportPrefix(cocNumber);
  return coc ? `${F3_REPORT_PREFIX}${coc}` : F3_REPORT_PREFIX;
}

export function f3CocPrefixedReport(prefix: string, cocNumber: string): string {
  const coc = cocWithoutReportPrefix(cocNumber);
  return coc ? `${prefix}${coc}` : prefix;
}

type F3Def =
  | { group: string }
  | {
      no: string;
      label: string;
      section: string;
      specimen?: string;
      m: string;
      r?: string;
      size?: string;
      o?: string;
      upload?: boolean;
      attach?: boolean;
      inspector?: string;
    };

const F3_DEFS: F3Def[] = [
  { group: "A. Material" },
  { no: "1", label: "Laminate", section: "3.2.1 – 3.2.14", m: "Verifiable certification of compliance", r: "Accepted", upload: true },
  { no: "2", label: "Prepreg", section: "3.2.1 – 3.2.14", m: "Verifiable certification of compliance", r: "Accepted", upload: true },
  { no: "3", label: "Copper Foil", section: "3.2.1 – 3.2.14", m: "Verifiable certification of compliance", r: "Accepted", upload: true },
  { no: "4", label: "Solder Mask Ink", section: "3.2.1 – 3.2.14", m: "Verifiable certification of compliance", r: "—", upload: true },
  { no: "5", label: "Legend Ink", section: "3.2.1 – 3.2.14", m: "Verifiable certification of compliance", r: "Accepted", upload: true },
  { no: "6", label: "Via Fill Ink", section: "3.2.1 – 3.2.14", m: "Verifiable certification of compliance", r: "Accepted", upload: true },
  { no: "7", label: "GPC", section: "3.2.1 – 3.2.14", m: "Verifiable certification of compliance", r: "Accepted", upload: true },
  { group: "B. Visual" },
  { no: "8", label: "Edges of Board", section: "3.3.1", specimen: "Printed Board", m: "Visual", size: "AQL 2.5", r: "Accepted" },
  { no: "9", label: "Laminate imperfections", section: "3.3.2", specimen: "Printed Board", m: "Visual", size: "AQL 2.5", r: "Accepted" },
  { no: "10", label: "Plating and coating voids in the Hole", section: "3.3.3", specimen: "Printed Board", m: "Visual", size: "AQL 1.0", r: "Accepted" },
  { no: "11", label: "Lifted lands", section: "3.3.4", specimen: "Printed Board", m: "Visual", size: "AQL 4.0", r: "Accepted" },
  { no: "12", label: "Marking & Traceability", section: "3.3.5", specimen: "Printed board/Coupon", m: "Visual", size: "AQL 4.0", r: "Accepted" },
  { no: "13", label: "Cavities, Printed Board", section: "3.3.10", specimen: "Printed Board", m: "Visual", size: "AQL 4.0", r: "Accepted" },
  { no: "14", label: "Workmanship", section: "3.3.11", specimen: "Printed Board", m: "Visual", size: "AQL 4.0", r: "Accepted" },
  { group: "C. Solderability" },
  { no: "15", label: "Surface", section: "3.3.6", specimen: "Panel (1 Coupon)", m: "Conducted on test coupon W as per J-STD-003", size: "AQL 2.5", o: "Refer report no", r: "Accepted" },
  { no: "16", label: "Hole", section: "3.3.6", specimen: "Panel (1 Coupon)", m: "Conducted on test coupon W as per J-STD-003", size: "AQL 2.5", o: "Refer report no", r: "Accepted" },
  { group: "D. Dimensional" },
  { no: "17", label: "Printed Circuit Board  Dimensions", section: "3.4", specimen: "Printed Board", m: "CMM", size: "AQL 4.0", o: "Report Enclosed", r: "Accepted", attach: true },
  { no: "18", label: "Hole sizes", section: "3.4.1", specimen: "Printed Board", m: "Pin gauge", size: "AQL 4.0", o: "Refer report no", r: "Accepted" },
  { no: "19", label: "Hole pattern accuracy", section: "3.4.1", specimen: "Printed Board", m: "CMM", size: "AQL 4.0", o: "As per gerber", r: "Accepted" },
  { no: "20", label: "Pattern feature accuracy", section: "3.4.1", specimen: "Printed Board", m: "CMM", size: "AQL 4.0", o: "As per gerber", r: "Accepted" },
  { no: "21", label: "Annular ring  (External)", section: "3.4.2", specimen: "Panel", m: "Microscope", size: "Every Panel", o: "Refer report no", r: "Accepted" },
  { no: "22", label: "Bow & Twist", section: "3.4.3", specimen: "Printed Board", m: "Granite Surface Plate", size: "AQL 4.0", o: "Refer report no", r: "Accepted" },
  { no: "23", label: "Solder mask coverage", section: "3.7-3.7.1", specimen: "Printed Board", m: "Visual", size: "AQL 4.0", r: "Accepted" },
  { no: "24", label: "Plating / Coating Thickness  (Electronic)", section: "3.2.7.6/ 3.2.7.7/ 3.2.7.8/ 3.2.7.9", specimen: "Panel (1 Coupon)", m: "XRF", size: "AQL 2.5", o: "Report Enclosed", r: "Accepted", attach: true },
  { group: "E. Conductor Width" },
  { no: "25", label: "Internal", section: "3.5.1", specimen: "Every Layer", m: "AOI/Visual", size: "Every Layer", o: "As per gerber", r: "Accepted", inspector: "AOI" },
  { no: "26", label: "External", section: "3.5.1", specimen: "Every Panel", m: "AOI/Visual", size: "Every Panel", o: "As per gerber", r: "Accepted", inspector: "AOI" },
  { group: "F. Conductor Spacing" },
  { no: "27", label: "Internal", section: "3.5.2", specimen: "Every Layer", m: "AOI/Visual", size: "Every Layer", o: "As per gerber", r: "Accepted", inspector: "AOI" },
  { no: "28", label: "External", section: "3.5.2", specimen: "Every Panel", m: "AOI/Visual", size: "Every Panel", o: "As per gerber", r: "Accepted", inspector: "AOI" },
  { group: "G. Conductive Surfaces (Surface Only)" },
  { no: "29", label: "Edge printed board contact, junction of gold plate to solder finish", section: "3.3.8", specimen: "Printed Board", m: "AOI/Visual", size: "AQL 2.5", r: "Accepted" },
  { no: "30", label: "Nicks, dents , pinholes", section: "3.5.4.1", specimen: "Printed Board", m: "AOI/Visual", size: "AQL 2.5", r: "Accepted" },
  { no: "31", label: "De wetting/Non wetting/ Final finish  Coverage", section: "3.5.4.5/3.5.4.6/3.5.4.7", specimen: "Printed Board", m: "Visual", size: "AQL 2.5", r: "Accepted" },
  { no: "32", label: "Edge printed board connector", section: "3.5.4.4", specimen: "Printed Board", m: "Visual", size: "AQL 2.5", r: "Accepted" },
  { no: "33", label: "Surface mount lands", section: "3.5.4.2", specimen: "Printed Board", m: "AOI/Visual", size: "AQL 2.5", r: "—" },
  { group: "H. Physical" },
  { no: "34", label: "Plating adhesion", section: "3.3.7", specimen: "Panel (1 Coupon)", m: "Tape Test", size: "AQL 4.0", o: "Refer report no", r: "Accepted" },
  { no: "35", label: "Ink marking adhesion", section: "3.3.5.3", specimen: "Panel (1 Coupon)", m: "Tape Test", size: "AQL 4.0", o: "Refer report no", r: "Accepted" },
  { no: "36", label: "Solder mask cure and adhesion", section: "3.7.2", specimen: "Panel (1 Coupon)", m: "Tape Test", size: "AQL 4.0", o: "Refer report no", r: "Accepted" },
  { group: "I. Structural Integrity After Thermal Stress" },
  { no: "37", label: "Structual Integrity after thermal stress", section: "3.6", specimen: "Every Panel", m: "Microscope", size: "Every Panel", o: "Refer report no", r: "Accepted" },
  { group: "J. Electrical" },
  { no: "38", label: "Electrical continuity and Isolation Resistance", section: "3.8.2", specimen: "Every PCB", m: "Flying probe test", size: "Every PCB", o: "Refer report no", r: "Accepted" },
  { group: "K. Cleanliness" },
  { no: "39", label: "Cleanliness Prior to solder mask application.", section: "3.9.1", specimen: "Panel", m: "Speciality Coating System", size: "1 Panel/ Lot", o: "Report Enclosed", r: "Accepted", attach: true },
  { group: "L. Special Requirements(When Specified)" },
  { no: "40", label: "Impedance Testing", section: "3.10.5", specimen: "Impedance coupon", m: "Polar TDR", size: "Every Panel", o: "Report Enclosed", r: "Accepted", attach: true },
  { no: "41", label: "Solder Mask thickness", section: "3.7.3", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "42", label: "Destructive Physical Analysis", section: "3.10.12", specimen: "NA", m: "NA", size: "NA", r: "NA" },
  { no: "43", label: "Dielectric withstanding voltage", section: "3.8.1", specimen: "NA", m: "NA", size: "NA", r: "NA" },
  { no: "44", label: "Peel strength(Foil Construction only)", section: "3.10.13", specimen: "NA", m: "NA", size: "NA", r: "NA" },
  { no: "45", label: "Thermal Shock", section: "3.10.7", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "46", label: "Performance based testing for microvia structures", section: "3.10.15", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "47", label: "Cleanliness after surface coating application", section: "3.9.2", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "48", label: "Cleanliness of inner layer after oxide treatment prior to lamination", section: "3.9.3", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "49", label: "Metal core(Horizontal Microsection)", section: "3.10.9", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "50", label: "Circuit/Plated through hole shorts to metal substrate", section: "3.8.3", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "51", label: "Outgassing", section: "3.10.1", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "52", label: "Fungus Resistance", section: "3.10.2", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "53", label: "Vibration", section: "3.10.3", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "54", label: "Mechanical shock", section: "3.10.4", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "55", label: "Coefficient of thermal expansion", section: "3.10.6", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "56", label: "Surface Insulation resistance (As received)", section: "3.10.8", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "57", label: "Design Data protection", section: "3.10.14", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "58", label: "CAF migration", section: "3.10.16", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "59", label: "Wire bond pad surface roughness", section: "3.10.17", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "60", label: "Repair", section: "3.11", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "61", label: "Circuit Repair", section: "3.11.1", specimen: "NA", m: "NA", size: "NA", r: "Accepted" },
  { no: "62", label: "Additional Customer Requirement", section: "5.1", specimen: "NA", m: "NA", size: "NA", r: "—" },
];

const F3_DEF_BY_SL = new Map(
  F3_DEFS.filter((def): def is Exclude<F3Def, { group: string }> => "no" in def).map((def) => [def.no, def]),
);

const PANEL_AQL_NOS = new Set(["15", "16", "24", "34", "35", "36"]);

/** F3 solderability rows point at the F15 solderability report (ST- plus COC number). */
const F3_REFER_F15_OBS = new Set(["15", "16"]);

/** F3 hole sizes / bow & twist point at the F5 mechanical report (MI- plus COC number). */
const F3_REFER_F5_OBS = new Set(["18", "22"]);

/** F3 electrical continuity points at the F4 electrical-test report (ET- plus COC number). */
const F3_REFER_F4_OBS = new Set(["38"]);

/** F3 adhesion rows point at the F16 tape-test report (AT- plus COC number). */
const F3_REFER_F16_OBS = new Set(["34", "35", "36"]);

/** F3 annular ring / structural integrity point at the F7 microsection report (CA- plus COC number). */
const F3_REFER_F7_OBS = new Set(["21"]);
const F3_REFER_F6_OBS = new Set(["37"]);

const F3_GERBER_OBS = new Set(["25", "26", "27", "28"]);
const F3_GERBER_OBS_TEXT = "As per gerber";

export function f3RefersF15Observation(sl: string): boolean {
  return F3_REFER_F15_OBS.has(String(sl || "").trim());
}

export function f3RefersF5Observation(sl: string): boolean {
  return F3_REFER_F5_OBS.has(String(sl || "").trim());
}

export function f3RefersF4Observation(sl: string): boolean {
  return F3_REFER_F4_OBS.has(String(sl || "").trim());
}

export function f3RefersF16Observation(sl: string): boolean {
  return F3_REFER_F16_OBS.has(String(sl || "").trim());
}

export function f3RefersF6Observation(sl: string): boolean {
  return F3_REFER_F6_OBS.has(String(sl || "").trim());
}

export function f3RefersF7Observation(sl: string): boolean {
  return F3_REFER_F7_OBS.has(String(sl || "").trim());
}

export function f3GerberObservation(sl: string): boolean {
  return F3_GERBER_OBS.has(String(sl || "").trim());
}

/** Special-requirements rows 41–62: Sample Qty and Observations are always NA. */
export function f3SpecialReqQtyObsNa(sl: string): boolean {
  const n = Number(sl);
  return Number.isFinite(n) && n >= 41 && n <= 62;
}

export function f3ObservationLocked(sl: string): boolean {
  return (
    f3SpecialReqQtyObsNa(sl) ||
    f3RefersF6Observation(sl) ||
    f3RefersF4Observation(sl) ||
    f3RefersF5Observation(sl) ||
    f3RefersF15Observation(sl) ||
    f3RefersF7Observation(sl) ||
    f3RefersF16Observation(sl)
  );
}

/** Standard cross-form observation: "Refer report no {report number}". */
export function f3ReferReportObservation(reportNo: string): string {
  const no = String(reportNo || "").trim();
  const ready = Boolean(no) && !/^(MI|ET|AT|CA|ST|SN|SI)-?$/i.test(no);
  return ready ? `Refer report no ${no}` : "Refer report no";
}

export function f3ImpedanceControl(value: string): "Yes" | "No" | "" {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (["1", "y", "yes", "true"].includes(raw)) return "Yes";
  if (["0", "n", "no", "false"].includes(raw)) return "No";
  return "";
}

export function f3Row40FromImpedance(impedanceControl: string): {
  obs: string;
  result: string;
  attach: boolean;
} | null {
  const flag = f3ImpedanceControl(impedanceControl);
  if (flag === "Yes") return { obs: "Report Enclosed", result: "Accepted", attach: true };
  if (flag === "No") return { obs: "NA", result: "NA", attach: false };
  return null;
}

export function f3ResultIsNa(result: string | undefined): boolean {
  return String(result || "").trim().toUpperCase() === "NA";
}

export function f3ImpedanceUploadMissing(rows: Row[] | undefined, impedanceControl: string): boolean {
  if (f3ImpedanceControl(impedanceControl) !== "Yes") return false;
  const row = (rows || []).find((item) => item.sl === "40");
  if (!row || f3ResultIsNa(row.result)) return false;
  return parseF3Attachments(row).length === 0;
}

/** Result locked to NA when F1 No. of Layers is 0. */
const F3_ZERO_LAYER_NA = new Set([
  "10", "11", "15", "16", "21", "24", "25", "26", "27", "28", "29", "31", "32", "33", "34", "37", "38", "40",
]);

/** Result locked to NA when F1 No. of Layers is 1. */
const F3_ONE_LAYER_NA = new Set(["10", "16", "25", "27", "37", "38", "40"]);

export function f3ViaProtectionType(viaProtection: string): number | null {
  const token = String(viaProtection || "").replace(/\s+/g, " ").trim().toLowerCase();
  if (!token) return null;
  const roman = /\b(?:type\s*)?(viii|vii|vi|iv|v|iii|ii|i)\b/.exec(token);
  if (roman?.[1]) {
    const map: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
    return map[roman[1]] ?? null;
  }
  const arabic = /\b(?:type\s*)?([1-8])\b/.exec(token);
  return arabic?.[1] ? Number(arabic[1]) : null;
}

/** Via Fill Ink (sl. 6) applies only for Type V / VI / VII. Empty = not yet fetched. */
export function f3ViaFillApplies(viaProtection: string): boolean | null {
  const raw = String(viaProtection || "").trim();
  if (!raw) return null;
  const n = f3ViaProtectionType(raw);
  return n === 5 || n === 6 || n === 7;
}

export function f3ViaFillLocked(sl: string, viaProtection: string): boolean {
  return sl === "6" && f3ViaFillApplies(viaProtection) === false;
}

/** Solder Mask Ink (sl. 4) and solder-mask adhesion (sl. 36) are NA when SolderMask is NO MASK, COVERLAY, or empty. */
export function f3SolderMaskMissing(solderMask: string): boolean {
  const raw = String(solderMask || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!raw || raw === "null" || raw === "none" || raw === "n/a" || raw === "na" || raw === "-") return true;
  if (raw === "nomask" || raw.includes("no mask")) return true;
  if (raw.includes("coverlay") || raw.includes("cover lay")) return true;
  return false;
}

/** Ticket listed 4+35 / 5+36; pair by characteristic so No Mask → 4+36 and Legend No → 5+35 (matches F16 names). */
const F3_SOLDER_MASK_NA = new Set(["4", "36"]);

export function f3SolderMaskLocked(sl: string, solderMask: string): boolean {
  return F3_SOLDER_MASK_NA.has(sl) && f3SolderMaskMissing(solderMask);
}

/** Anything other than NO MASK, COVERLAY, or blank/null is treated as solder mask Yes. */
export function f3SolderMaskPresent(solderMask: string): boolean {
  return !f3SolderMaskMissing(solderMask);
}

/** Legend Ink (sl. 5) and ink-marking adhesion (sl. 35) are NA when PCB details LegendPrint is No. */
export function f3LegendPrintMissing(legendPrint: string): boolean {
  const raw = String(legendPrint || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  if (!raw) return false;
  if (["0", "n", "no", "false", "none", "na", "n/a", "-"].includes(raw)) return true;
  if (raw.includes("no legend") || raw.includes("no print") || raw === "nolegend") return true;
  return false;
}

const F3_LEGEND_PRINT_NA = new Set(["5", "35"]);

export function f3LegendPrintLocked(sl: string, legendPrint: string): boolean {
  return F3_LEGEND_PRINT_NA.has(sl) && f3LegendPrintMissing(legendPrint);
}

/** True when an F3 checklist line (by Sl. No.) has Result NA. */
export function f3RowResultIsNa(rows: Row[] | undefined, sl: string): boolean {
  const row = rows?.find((item) => item.sl === sl && !item.__group);
  return /^na$/i.test(String(row?.result || "").trim());
}

export function f3Row39FromSolderMask(solderMask: string): {
  obs: string;
  result: string;
  attach: boolean;
} | null {
  if (!f3SolderMaskPresent(solderMask)) return null;
  return { obs: "Report enclosed", result: "Accepted", attach: true };
}

export function f3CleanlinessUploadMissing(rows: Row[] | undefined, solderMask: string): boolean {
  if (!f3SolderMaskPresent(solderMask)) return false;
  const row = (rows || []).find((item) => item.sl === "39");
  if (!row || f3ResultIsNa(row.result)) return false;
  return parseF3Attachments(row).length === 0;
}

export function f3ResultLocked(
  sl: string,
  layers: string,
  impedanceControl = "",
  viaProtection = "",
  solderMask = "",
  legendPrint = "",
): boolean {
  if (f3SolderMaskLocked(sl, solderMask)) return true;
  if (f3LegendPrintLocked(sl, legendPrint)) return true;
  if (f3ViaFillLocked(sl, viaProtection)) return true;
  if (sl === "39" && f3Row39FromSolderMask(solderMask)) return true;
  if (sl === "40" && f3Row40FromImpedance(impedanceControl)) return true;
  const n = String(layers || "").trim();
  if (n === "0") return F3_ZERO_LAYER_NA.has(sl);
  if (n === "1") return F3_ONE_LAYER_NA.has(sl);
  return false;
}

export function f3ChecklistTemplate(): Row[] {
  return F3_DEFS.map((def): Row => {
    if ("group" in def) return { __group: def.group };
    return {
      sl: def.no,
      characteristic: def.label,
      req: def.section,
      specimen: def.specimen || "",
      method: def.m,
      sample: def.size || "",
      qty: f3SpecialReqQtyObsNa(def.no) ? "NA" : "",
      obs: f3SpecialReqQtyObsNa(def.no) ? "NA" : def.o || "",
      inspector: def.inspector || "",
      result: def.r === "NA" ? "NA" : "",
      remarks: "",
      qtyDerived: f3QtyDerived(def.no, def.size || "") ? "1" : "",
      sampleEditable: Number(def.no) >= 40 ? "1" : "",
      upload: def.upload ? "1" : "",
      attach: def.upload || def.attach ? "1" : "",
    };
  });
}

/** True for the Claude 1–62 checklist. Old lots use 1.1 / 2.1 rows and stay as saved. */
export function isClaudeF3Checklist(rows: Row[] | undefined): boolean {
  if (!rows?.length) return false;
  if (rows.some((row) => row.sl === "1.1" || row.sl === "2.1")) return false;
  return rows.some((row) => row.sl === "62") || rows.some((row) => row.sl === "1" && /laminate/i.test(row.characteristic || ""));
}

export const F3_CERT_TEXT = "Verifiable certification of compliance";

/** Material rows: one merged Sample→Observations cell, spanning consecutive upload rows (Excel layout). */
export function f3CertMerge(
  rows: Row[] | undefined,
  index: number,
): { kind: "none" } | { kind: "start"; rowSpan: number } | { kind: "cont" } {
  const row = rows?.[index];
  if (!row || row.upload !== "1") return { kind: "none" };
  if (rows[index - 1]?.upload === "1") return { kind: "cont" };
  let rowSpan = 0;
  for (let i = index; i < (rows?.length ?? 0) && rows[i]!.upload === "1"; i++) rowSpan++;
  return { kind: "start", rowSpan };
}

export type F3Attachment = { id?: string; name: string; path?: string; dataUrl?: string };

export function parseF3Attachments(row: Row): F3Attachment[] {
  try {
    const parsed = JSON.parse(row.attachments || "[]") as F3Attachment[];
    return Array.isArray(parsed)
      ? parsed.filter((file) => file?.name && (file.id || file.path || file.dataUrl))
      : [];
  } catch {
    return [];
  }
}

export function serializeF3Attachments(files: F3Attachment[]): string {
  return JSON.stringify(
    files.map((file) => {
      if (file.id || file.path) {
        return { id: file.id, name: file.name, path: file.path };
      }
      return { name: file.name, dataUrl: file.dataUrl };
    }),
  );
}

function f3QtyDerived(no: string, size: string): boolean {
  if (f3SpecialReqQtyObsNa(no)) return true;
  if (no === "38" || no === "39" || no === "25" || no === "27" || PANEL_AQL_NOS.has(no)) return true;
  return planApplies(size);
}

function f2ProductionOrderLineCount(f2: F2State): number {
  return (f2.lines || []).filter((line) => String(line.prod || "").trim()).length;
}

function f3Ps30051FullSample(no: string, custSpec: string): boolean {
  const sl = Number(no);
  return isPs30051(custSpec) && ((sl >= 8 && sl <= 14) || sl === 22);
}

export function f3SampleQty(row: Row, f2: F2State, custSpec: string): string {
  const no = row.sl || "";
  const size = row.sample || "";
  const lot = f2LotSize(f2, custSpec);
  const panels = acceptedPanelsTotal(f2);
 if (f3SpecialReqQtyObsNa(no)) return "NA";
if (f3Ps30051FullSample(no, custSpec)) return "100%";
if (no === "38") return "100%";
  if (no === "39") {
    const orders = f2ProductionOrderLineCount(f2);
    return orders ? String(orders) : "";
  }
  if (no === "25" || no === "27") return samplingQtyForLot(lot, size || "Every Layer");
  if (PANEL_AQL_NOS.has(no)) return samplingQtyForLot(panels, size);
  if (planApplies(size)) return samplingQtyForLot(lot, size);
  return row.qty || "";
}

/** First Inspected-by in a section fills empty/matching rows. Locked defaults (e.g. AOI) and custom names are left alone. */
export function f3SectionInspectorUpdates(
  rows: Row[],
  editedIndex: number,
  value: string,
): { index: number; value: string }[] {
  const edited = rows[editedIndex];
  if (!edited || edited.__group) return [];
  let start = editedIndex;
  while (start > 0 && !rows[start]?.__group) start--;
  if (rows[start]?.__group) start += 1;
  let end = editedIndex + 1;
  while (end < rows.length && !rows[end]?.__group) end++;
  let lead = start;
  while (lead < end && rows[lead]?.__group) lead++;
  const updates: { index: number; value: string }[] = [];
  if (editedIndex !== lead) {
    if ((edited.inspector || "") !== value) updates.push({ index: editedIndex, value });
    return updates;
  }
  const prev = edited.inspector || "";
  for (let i = start; i < end; i++) {
    const row = rows[i];
    if (!row || row.__group) continue;
    if (i === lead) {
      if ((row.inspector || "") !== value) updates.push({ index: i, value });
      continue;
    }
    const locked = F3_DEF_BY_SL.get(row.sl || "")?.inspector;
    if (locked && (!(row.inspector || "").trim() || row.inspector === locked)) continue;
    const name = row.inspector || "";
    if (name && name !== prev) continue;
    if (name !== value) updates.push({ index: i, value });
  }
  return updates;
}

export function withDerivedF3Rows(
  rows: Row[],
  f2: F2State,
  custSpec: string,
  layers = "",
  impedanceControl = "",
  viaProtection = "",
  solderMask = "",
  cocNumber = "",
  productionOrder = "",
  f6TestedDate = "",
  legendPrint = "",
): Row[] {
  const f5ReportNo = f3ReportNumber(cocNumber);
  const f6ReportNo = f6ReportNumber(productionOrder, f6TestedDate);
  const f4ReportNo = f3CocPrefixedReport(F4_REPORT_PREFIX, cocNumber);
  const f15ReportNo = f3CocPrefixedReport(F15_REPORT_PREFIX, cocNumber);
  const f16ReportNo = f3CocPrefixedReport(F16_REPORT_PREFIX, cocNumber);
  const f7ReportNo = f7ReportNumber(cocNumber);
  return rows.map((row) => {
    if (row.__group) return row;
    const sl = Number(row.sl);
    const def = F3_DEF_BY_SL.get(row.sl || "");
    const next = { ...row };
    if (f3Ps30051FullSample(row.sl || "", custSpec)) {
  next.sample = "100%";
  next.qtyDerived = "1";
}
    if (def) {
      if (!next.specimen) next.specimen = def.specimen || "";
      if (def.section && next.req !== def.section && (!next.req || next.req.length < def.section.length)) {
        next.req = def.section;
      }
      if (def.upload) next.upload = "1";
      if (def.upload || def.attach) next.attach = "1";
      if (def.inspector && !next.inspector) next.inspector = def.inspector;
    }
    if (row.sl === "38") {
      if (next.sample === "1" || next.sample === "") next.sample = "Every PCB";
      if (next.specimen === "1" || next.specimen === "") next.specimen = "Every PCB";
      next.qtyDerived = "1";
    }
    if (row.sl === "25" || row.sl === "27") next.qtyDerived = "1";
    if (row.sl === "40" && def) {
      if (!next.specimen || next.specimen === "NA") next.specimen = def.specimen || "";
      if (!next.method || next.method === "NA") next.method = def.m;
      if (!next.sample || next.sample === "NA") next.sample = def.size || "";
    }
    if (sl >= 40) {
      next.sampleEditable = "1";
      if (!next.specimen) next.specimen = "NA";
    }
    if (f3SpecialReqQtyObsNa(row.sl || "")) {
      next.qty = "NA";
      next.obs = "NA";
      next.qtyDerived = "1";
      next.__ro_qty = "1";
      next.__ro_obs = "1";
    }
    if (f3GerberObservation(row.sl || "") && !String(next.obs || "").trim()) {
      next.obs = F3_GERBER_OBS_TEXT;
    }
    if (f3RefersF15Observation(row.sl || "")) {
      next.obs = f3ReferReportObservation(f15ReportNo);
      next.__ro_obs = "1";
    }
    if (f3RefersF5Observation(row.sl || "")) {
      next.obs = f3ReferReportObservation(f5ReportNo);
      next.__ro_obs = "1";
    }
    if (f3RefersF4Observation(row.sl || "")) {
      next.obs = f3ReferReportObservation(f4ReportNo);
      next.__ro_obs = "1";
    }
    if (f3RefersF16Observation(row.sl || "")) {
      next.obs = f3ReferReportObservation(f16ReportNo);
      next.__ro_obs = "1";
    }
    if (f3RefersF6Observation(row.sl || "")) {
    next.obs = f3ReferReportObservation(f6ReportNo);
    next.__ro_obs = "1";
    }
    if (f3RefersF7Observation(row.sl || "")) {
      next.obs = f3ReferReportObservation(f7ReportNo);
      next.__ro_obs = "1";
    }
    const row40 = row.sl === "40" ? f3Row40FromImpedance(impedanceControl) : null;
    const row39 = row.sl === "39" ? f3Row39FromSolderMask(solderMask) : null;
    if (row40) {
      next.obs = row40.obs;
      next.result = row40.result;
      next.__ro_obs = "1";
      next.__ro_result = "1";
      next.attach = row40.attach ? "1" : "";
    } else if (row39) {
      next.obs = row39.obs;
      next.result = row39.result;
      next.__ro_obs = "1";
      next.__ro_result = "1";
      next.attach = row39.attach ? "1" : "";
    } else if (f3ResultLocked(row.sl || "", layers, impedanceControl, viaProtection, solderMask, legendPrint)) {
      next.result = "NA";
      next.__ro_result = "1";
      if (
        f3ViaFillLocked(row.sl || "", viaProtection) ||
        f3SolderMaskLocked(row.sl || "", solderMask) ||
        f3LegendPrintLocked(row.sl || "", legendPrint)
      ) {
        next.__ro_upload = "1";
      }
    } else if (next.__ro_result === "1") {
      next.result = def?.r === "NA" ? "NA" : "";
      next.__ro_result = "";
      if (row.sl === "39" || row.sl === "40") next.__ro_obs = "";
      if (row.sl === "6" || row.sl === "4" || row.sl === "5") next.__ro_upload = "";
    }
    if (next.qtyDerived !== "1") return next;
    return { ...next, qty: f3SampleQty(next, f2, custSpec), __ro_qty: "1" };
  });
}
