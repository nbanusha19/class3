import { samplingQtyForLot } from "./sampling";

export const F15_STANDARD = "J-STD-003";
export const F15_AQL = "AQL 2.5";
export const F15_PASS_TEXT = "No evidence of dewetting & Non-wetting.";
export const F15_DURABILITY = [
  "Coating Durability A",
  "Coating Durability B",
  "Category 1",
  "Category 2",
  "Category 3",
] as const;
export const F15_RESULT_OPTS = ["—", "Pass", "Fail", "NA"] as const;
export const F15_YES_NO = ["Yes", "No"] as const;

/** Claude: SMT present locked No when layer count is 0. */
export function f15SmtLocked(layers: string): boolean {
  return String(layers || "").trim() === "0";
}

/** Claude: PTH present locked No when layer count is 0 or 1. */
export function f15PthLocked(layers: string): boolean {
  const token = String(layers || "").trim();
  return token === "0" || token === "1";
}

export function f15Multilayer(layers: string): boolean {
  const n = Number(String(layers || "").trim());
  return Number.isFinite(n) && n > 1;
}

function unsetResult(value: string): boolean {
  return !value || value === "—" || value === "-" || value === "NA";
}

export function f15DerivedFields(layers: string, panels: number, current: Record<string, string> = {}): Record<string, string> {
  const fields: Record<string, string> = {
    "f15.aql": F15_AQL,
  };
  if (f15SmtLocked(layers)) {
    fields["f15.smtLand"] = "No";
    fields["f15.__smtLocked"] = "1";
  } else if (current["f15.__smtLocked"] === "1") {
    fields["f15.smtLand"] = "Yes";
    fields["f15.__smtLocked"] = "";
  }
  if (f15PthLocked(layers)) {
    fields["f15.pth"] = "No";
    fields["f15.__pthLocked"] = "1";
  } else if (current["f15.__pthLocked"] === "1") {
    fields["f15.pth"] = "Yes";
    fields["f15.__pthLocked"] = "";
  }
  if (panels > 0) {
    fields["f15.lotPanels"] = String(panels);
    fields["f15.testedPanels"] = samplingQtyForLot(panels, F15_AQL);
  }
  return fields;
}

export function withDerivedF15Rows(rows: Record<string, string>[], pthNo: boolean, smtNo: boolean, layers = "") {
  const multilayer = f15Multilayer(layers);
  return rows.map((row, i) => {
    const locked = !multilayer && ((i === 0 && pthNo) || (i === 1 && smtNo));
    if (locked) return { ...row, observation: "NA", result: "NA" };
    if (multilayer && row.result !== "Fail" && unsetResult(row.result || "")) {
      return {
        ...row,
        result: "Pass",
        observation: row.observation === "NA" || !row.observation ? F15_PASS_TEXT : row.observation,
      };
    }
    if ((i === 0 && !pthNo) || (i === 1 && !smtNo)) {
      const blanked = row.result === "NA" && row.observation === "NA";
      return blanked ? { ...row, observation: F15_PASS_TEXT, result: "Pass" } : row;
    }
    return row;
  });
}

export function f15ResultDisplay(value: string): string {
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

/** Legacy print number: ST-{productionOrder}-{DDMMYY}. */
export function f15ReportNumber(productionOrder: string, date: string): string {
  const prod = String(productionOrder || "").trim();
  const stamp = ddmmyyFromDate(date);
  if (!prod && !stamp) return "";
  if (!prod) return `ST-${stamp}`;
  if (!stamp) return `ST-${prod}`;
  return `ST-${prod}-${stamp}`;
}
