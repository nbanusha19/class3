import { REPORTS } from "./schema";
import { resolveIpcFamily } from "./pcb-types";
import type { Report } from "./types";

/** HIQ `d.ULMARK` is NO or a mark/file value. F1 stores Yes / No and stays editable. */
export function normalizeUlMark(value: string): string {
  const raw = String(value || "").trim();
  if (!raw || raw === "-" || raw === "—" || raw === "–") return "";
  const upper = raw.toUpperCase().replace(/\s+/g, " ");
  if (["0", "N", "NO", "FALSE", "NA", "N/A", "NONE", "NIL"].includes(upper)) return "No";
  if (upper === "YES" || upper === "Y" || upper === "TRUE" || upper === "1") return "Yes";
  return "Yes";
}

export function isNaFieldValue(value: string) {
  return /^(n\/?a|n\.a\.?|nil)$/i.test(String(value || "").trim());
}

export function f1RohsFromBoardFinish(boardFinish: string): "Yes" | "No" {
  return /\bHASL\b/i.test(boardFinish) ? "No" : "Yes";
}

export const F1_ROHS_OPTS = ["ROHS", "REACH", "ROHS & REACH"] as const;

/** HIQ `d.ROHS` is stored as 1/2/3 (or Yes/No). Map onto F1 display text. */
export function normalizeRohs(value: string): string {
  const raw = String(value || "").trim();
  if (!raw || raw === "-" || raw === "—" || raw === "–") return "";
  const upper = raw.toUpperCase().replace(/&/g, "AND").replace(/\s+/g, " ");
  if (["1", "Y", "YES", "TRUE", "ROHS", "ROHS COMPLIANT"].includes(upper)) return "ROHS";
  if (["2", "REACH"].includes(upper)) return "REACH";
  if (["3", "BOTH", "ROHS AND REACH", "ROHS+REACH"].includes(upper)) return "ROHS & REACH";
  if (["0", "N", "NO", "FALSE", "NA", "N/A"].includes(upper)) return "";
  if ((F1_ROHS_OPTS as readonly string[]).includes(raw)) return raw;
  return raw;
}

/** F1 Specification shows customer spec and regulatory requirement, joined with &. */
export function combineSpecWithRegulatory(specification: string, regulatoryRequirement: string): string {
  const clean = (value: string) => {
    const token = String(value || "").trim();
    if (!token || /^(n\/?a|na|nil|-|—|–)$/i.test(token)) return "";
    return token;
  };
  const spec = clean(specification);
  const regulatory = clean(regulatoryRequirement);
  if (spec && regulatory) return `${spec} & ${regulatory}`;
  return spec || regulatory;
}

/** Common CoC forms for every IPC family (dashboard pack). */
export const COMMON_FORM_IDS = ["f1", "f2", "f4", "f5", "f7", "f15", "f16", "as-f1"] as const;

/** IPC-6012 extras developed in the Claude CoC HTML. F11/F22 and F24/F25 come later. */
const IPC_6012_EXTRA = ["f3", "f6"] as const;

const FORM_ORDER = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f11", "f15", "f16", "as-f1","f22", "f24", "f25"] as const;

/**
 * Form packs from the CoC workload design:
 *   all IPC → F1 F2 F4 F5 F7 F15 F16
 *   IPC-6012 → + F3 F6
 *   IPC-6013 → + F11 F22 (not in this suite yet)
 *   IPC-6018 → + F24 F25 (not in this suite yet)
 */
export function formIdsForRegulatory(regulatoryRequirement: string): string[] {
  const family = resolveIpcFamily(regulatoryRequirement);
  if (family === "6013" || family === "6018") {
    return [...COMMON_FORM_IDS];
  }
  return [...COMMON_FORM_IDS, ...IPC_6012_EXTRA];
}

export function reportsForRegulatory(regulatoryRequirement: string): Report[] {
  const allowed = new Set(formIdsForRegulatory(regulatoryRequirement));
  const ordered = FORM_ORDER.map((id) => REPORTS.find((report) => report.id === id)).filter(
    (report): report is Report => !!report && allowed.has(report.id),
  );
  const extra = REPORTS.filter((report) => allowed.has(report.id) && !FORM_ORDER.includes(report.id as (typeof FORM_ORDER)[number]));
  return [...ordered, ...extra];
}

export function ipcFamilyLabel(regulatoryRequirement: string): string {
  const family = resolveIpcFamily(regulatoryRequirement);
  if (family === "6013") return "IPC-6013";
  if (family === "6018") return "IPC-6018";
  return "IPC-6012";
}

export function suiteTypeForRegulatory(regulatoryRequirement: string): string {
  const family = resolveIpcFamily(regulatoryRequirement);
  if (family === "6013") return "flex";
  if (family === "6018") return "rf";
  return "rigid";
}

/** Compact standard label used on the workload grid, e.g. "IPC-6012 Cl 3A". */
export function formatIpcStandard(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "—";
  const compact = text.replace(/\s+/g, " ");
  return compact
    .replace(/CLASS\s*/i, "Cl ")
    .replace(/Cl\s+/g, "Cl ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formsCaption(regulatoryRequirement: string): string {
  const std = ipcFamilyLabel(regulatoryRequirement);
  const formatted = formatIpcStandard(regulatoryRequirement);
  const cls = formatted.replace(std, "").trim();
  return cls ? `${std} ${cls} — applicable forms` : `${std} — applicable forms`;
}

/** F4/F6/F7 N/A at 0 or 1 layer; F15 N/A at 0 layers. */
export function formsDisabledByLayers(layers: string): Set<string> {
  const n = String(layers || "").trim();
  const ids = new Set<string>();
  if (n === "0" || n === "1") {
    ids.add("f4");
    ids.add("f6");
    ids.add("f7");
  }
  if (n === "0") ids.add("f15");
  return ids;
}

export function formDisabledReason(formId: string, layers: string): string | null {
  if (!formsDisabledByLayers(layers).has(formId)) return null;
  const n = String(layers || "").trim();
  if (formId === "f15") return "Not applicable when No. of Layers is 0";
  return `Not applicable when No. of Layers is ${n}`;
}

export const F4_SPECS = [
  "IPC-9252B",
  "30051",
  "Q906-D010-ESX-C-02",
  "ISRO-TS-304 A",
  "ISRO-PAX-304 Issue 2",
  "IPC-6012 CLASS 3A",
] as const;

type F4ParamKey =
  | "Continuity (Opens)"
  | "Isolation (Shorts)"
  | "Test Voltage"
  | "Adjacency Test method used?"
  | "Horizontal Distance"
  | "Vertical Distance";

const F4_PARAMS: Record<F4ParamKey, Record<(typeof F4_SPECS)[number], string>> = {
  "Continuity (Opens)": {
    "IPC-9252B": "< 8 Ω",
    "30051": "< 8 Ω",
    "Q906-D010-ESX-C-02": "< 8 Ω",
    "ISRO-TS-304 A": "< 8 Ω",
    "ISRO-PAX-304 Issue 2": "< 5 Ω",
    "IPC-6012 CLASS 3A": "< 10 Ω",
  },
  "Isolation (Shorts)": {
    "IPC-9252B": "≥12.7MΩ",
    "30051": "≥12.7MΩ",
    "Q906-D010-ESX-C-02": "≥12.7MΩ",
    "ISRO-TS-304 A": "≥10MΩ",
    "ISRO-PAX-304 Issue 2": "≥6MΩ",
    "IPC-6012 CLASS 3A": "≥100MΩ",
  },
  "Test Voltage": {
    "IPC-9252B": "250 V",
    "30051": "250 V",
    "Q906-D010-ESX-C-02": "250 V",
    "ISRO-TS-304 A": "250 V",
    "ISRO-PAX-304 Issue 2": "250 V",
    "IPC-6012 CLASS 3A": "250 V dc",
  },
  "Adjacency Test method used?": {
    "IPC-9252B": "Yes",
    "30051": "Yes",
    "Q906-D010-ESX-C-02": "Yes",
    "ISRO-TS-304 A": "Yes",
    "ISRO-PAX-304 Issue 2": "Yes",
    "IPC-6012 CLASS 3A": "Yes",
  },
  "Horizontal Distance": {
    "IPC-9252B": "< 1.27mm",
    "30051": "< 1.27mm",
    "Q906-D010-ESX-C-02": "< 1.27mm",
    "ISRO-TS-304 A": "< 1.27mm",
    "ISRO-PAX-304 Issue 2": "< 1.27mm",
    "IPC-6012 CLASS 3A": "< 1.27mm",
  },
  "Vertical Distance": {
    "IPC-9252B": "None",
    "30051": "None",
    "Q906-D010-ESX-C-02": "None",
    "ISRO-TS-304 A": "None",
    "ISRO-PAX-304 Issue 2": "None",
    "IPC-6012 CLASS 3A": "None",
  },
};

function normalizeSpecToken(value: string): string {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function resolveF4Spec(specification: string, regulatoryRequirement: string): (typeof F4_SPECS)[number] {
  const haystack = `${specification} ${regulatoryRequirement}`;
  const compact = normalizeSpecToken(haystack);
  if (compact.includes("0906D010ESXC02")) return "Q906-D010-ESX-C-02";
  const ranked = [...F4_SPECS].sort((a, b) => normalizeSpecToken(b).length - normalizeSpecToken(a).length);
  for (const spec of ranked) {
    const token = normalizeSpecToken(spec);
    if (token && compact.includes(token)) return spec;
  }
  if (compact.includes("3A")) return "IPC-6012 CLASS 3A";
  return "IPC-9252B";
}

export function f4ValueFor(test: string, spec: (typeof F4_SPECS)[number]): string | null {
  const key = test as F4ParamKey;
  if (key in F4_PARAMS) return F4_PARAMS[key][spec];
  const match = (Object.keys(F4_PARAMS) as F4ParamKey[]).find(
    (label) => normalizeSpecToken(label) === normalizeSpecToken(test),
  );
  return match ? F4_PARAMS[match][spec] : null;
}

function isClass3A(regulatoryRequirement: string): boolean {
  return /3A/i.test(regulatoryRequirement || "");
}

export function f15AutoFromFinish(
  boardFinish: string,
  regulatoryRequirement: string,
): { durability: string; solder: string } | null {
  const finish = (boardFinish || "").toUpperCase();
  if (!finish) return null;
  const class3A = isClass3A(regulatoryRequirement);
  if (finish.includes("HASL")) {
    return { durability: class3A ? "Category 3" : "Category 2", solder: "Sn63Pb37" };
  }
  if (finish.includes("ENIG") || finish.includes("IMMERSION SILVER") || finish.includes("IMAG")) {
    return {
      durability: class3A ? "Coating Durability B" : "Coating Durability A",
      solder: "SAC 305",
    };
  }
  return null;
}

export const STAGE_META = {
  wip: {
    label: "WIP",
    title: "WIP — lots received, inspection not started",
    note: "Boards logged into final quality. Open a lot to begin the test sequence.",
    action: "Start",
  },
  "in-progress": {
    label: "In-progress",
    title: "In-progress — tests being recorded",
    note: "Mechanical, impedance, cross-section, CMM and material checks in progress.",
    action: "Continue",
  },
  verification: {
    label: "Verification",
    title: "Verification — awaiting QA review and sign-off",
    note: "All test groups recorded. Reviewer confirms data, deviations and coupon attachments.",
    action: "Review",
  },
  approved: {
    label: "Approved",
    title: "Approved — certificates issued",
    note: "Signed CoC released with the shipment. Records retained against the lot.",
    action: "Open",
  },
} as const;

export type WorkloadStage = keyof typeof STAGE_META;

export const F1_APPROVED_BY = "Karthik Palaniswamy";
export const F1_APPROVED_DESIG = "Quality Manager";

export type F1SignoffColumn = "inspected" | "verified" | "approved";

export function f1SignoffColumnOf(titleOrKey: string): F1SignoffColumn | null {
  const token = (titleOrKey || "").toLowerCase();
  if (token.includes("inspect") || token.startsWith("inspected")) return "inspected";
  if (token.includes("verif")) return "verified";
  if (token.includes("approv") || token === "designation") return "approved";
  return null;
}

/** Which F1 approval fields can be edited at this workflow stage. */
export function f1SignoffFieldEditable(
  stage: Exclude<WorkloadStage, "wip">,
  column: F1SignoffColumn,
  fieldKey: string,
): boolean {
  if (column === "inspected") return stage === "in-progress";
  if (column === "verified") return stage === "verification";
  return stage === "approved" && fieldKey === "approvedDate";
}

/** Count a sign-off column toward F1 completion only once that stage is reached. */
export function f1SignoffFieldCounts(stage: Exclude<WorkloadStage, "wip">, column: F1SignoffColumn): boolean {
  if (column === "inspected") return true;
  if (column === "verified") return stage !== "in-progress";
  return stage === "approved";
}

export function normalizeReportStatus(status: string | null | undefined): Exclude<WorkloadStage, "wip"> {
  const value = (status || "").toLowerCase().trim();
  if (value === "verification") return "verification";
  if (value === "approved") return "approved";
  return "in-progress";
}
