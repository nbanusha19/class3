import { samplingQtyForLot } from "./sampling";
import { f3LegendPrintMissing, f3RowResultIsNa, f3SolderMaskMissing } from "./f3-logic";

export const F16_AQL = "AQL 4.0";
export const F16_RESULT_OPTS = ["—", "Pass", "Fail", "NA"] as const;
export const F16_REQ = "No evidence of material removal in tape and test area.";
export const F16_OBS = "No material removal observed in tape test area";

type F16Row = Record<string, string>;

/** Claude: plating adhesion result locked NA when layer count is 0. */
export function f16PlatingLocked(layers: string): boolean {
  return String(layers || "").trim() === "0";
}

export function f16SolderMaskLocked(solderMask: string, f3Rows?: F16Row[]): boolean {
  return f3SolderMaskMissing(solderMask) || f3RowResultIsNa(f3Rows, "4");
}

export function f16LegendLocked(legendPrint: string, f3Rows?: F16Row[]): boolean {
  return f3LegendPrintMissing(legendPrint) || f3RowResultIsNa(f3Rows, "5");
}

export function f16ResultLocked(
  index: number,
  layers: string,
  solderMask = "",
  legendPrint = "",
  f3Rows?: F16Row[],
): boolean {
  if (index === 0) return f16PlatingLocked(layers);
  if (index === 1) return f16SolderMaskLocked(solderMask, f3Rows);
  if (index === 2) return f16LegendLocked(legendPrint, f3Rows);
  return false;
}

export function f16LockReason(
  index: number,
  layers: string,
  solderMask = "",
  legendPrint = "",
  f3Rows?: F16Row[],
): string {
  if (index === 0 && f16PlatingLocked(layers)) return "NA — layer count is 0";
  if (index === 1) {
    if (f3SolderMaskMissing(solderMask)) return "NA — solder mask is No Mask";
    if (f3RowResultIsNa(f3Rows, "4")) return "NA — F3 Solder Mask Ink result is NA";
  }
  if (index === 2) {
    if (f3LegendPrintMissing(legendPrint)) return "NA — legend print is No";
    if (f3RowResultIsNa(f3Rows, "5")) return "NA — F3 Legend Ink result is NA";
  }
  return "";
}

export function f16Multilayer(layers: string): boolean {
  const n = Number(String(layers || "").trim());
  return Number.isFinite(n) && n > 1;
}

function unsetResult(value: string): boolean {
  return !value || value === "—" || value === "-" || value === "NA";
}

export function f16DerivedFields(panels: number): Record<string, string> {
  const fields: Record<string, string> = { "f16.aql": F16_AQL };
  if (panels > 0) {
    fields["f16.lotPanels"] = String(panels);
    fields["f16.testedPanels"] = samplingQtyForLot(panels, F16_AQL);
  }
  return fields;
}

export function withDerivedF16Rows(
  rows: Record<string, string>[],
  layers: string,
  solderMask = "",
  legendPrint = "",
  f3Rows?: Record<string, string>[],
) {
  if (!rows.length) return rows;
  const multilayer = f16Multilayer(layers);
  return rows.map((row, i) => {
    if (f16ResultLocked(i, layers, solderMask, legendPrint, f3Rows)) return { ...row, result: "NA" };
    if (multilayer && row.result !== "Fail" && unsetResult(row.result || "")) {
      return { ...row, result: "Pass" };
    }
    return row;
  });
}

export function f16ResultDisplay(value: string): string {
  if (!value || value === "-") return "—";
  return value;
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

/** Legacy print number: AT-{productionOrder}-{DDMMYY}. */
export function f16ReportNumber(productionOrder: string, date: string): string {
  const prod = String(productionOrder || "").trim();
  const stamp = ddmmyyFromDate(date);
  if (!prod && !stamp) return "";
  if (!prod) return `AT-${stamp}`;
  if (!stamp) return `AT-${prod}`;
  return `AT-${prod}-${stamp}`;
}
