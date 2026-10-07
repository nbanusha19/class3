/** PCB Type dropdown options driven by Regulatory Requirement (IPC family). */

export const PCB_TYPES_IPC_6012 = [
  "Type 1 — Single-Sided Printed Board",
  "Type 2 — Double-Sided Printed Board",
  "Type 3 — Multilayer Printed Board without blind or buried vias",
  "Type 4 — Multilayer Printed Board with blind and/or buried vias (may include microvias)",
  "Type 5 — Multilayer metal core Printed Board without blind or buried vias",
  "Type 6 — Multilayer metal core Printed Board with blind and/or buried vias (may include microvias)",
];

export const PCB_TYPES_IPC_6013 = [
  "Type 1 — Single-sided flexible printed boards containing one conductive layer, with or without stiffeners",
  "Type 2 — Double-sided flexible printed boards containing two conductive layers with PTHs, with or without stiffeners",
  "Type 3 — Multilayer flexible printed boards containing three or more conductive layers with PTHs, with or without stiffeners",
  "Type 4 — Multilayer rigid and flexible material combinations containing three or more conductive layers with PTHs",
  "Type 5 — Flexible or rigid-flex printed boards containing two or more conductive layers without PTHs",
];

export const PCB_TYPES_IPC_6018 = [
  "Type 1 — Single Sided",
  "Type 2 — Double Sided",
  "Type 3 — Homogeneous Dielectric Multilayer Construction",
  "Type 4 — Mixed Dielectric Multilayer",
  "Type 5 — Homogeneous Dielectric Multilayer with blind and/or buried vias",
  "Type 6 — Mixed Dielectric Multilayer with blind and/or buried vias",
  "Type 7 — Metal and/or composite backed printed boards, single sided or double sided",
  "Type 8 — Multilayer metal and/or composite backed or core printed boards with or without blind and/or buried vias",
];

/** Detect IPC-6012 / 6013 / 6018 from regulatory requirement text (any class). */
export function resolveIpcFamily(regulatoryRequirement: string): "6012" | "6013" | "6018" | null {
  const text = (regulatoryRequirement || "").toUpperCase().replace(/\s+/g, "");
  if (!text || text === "NA" || text === "-" || text === "--SELECT--") return null;
  if (text.includes("IPC-6018") || text.includes("IPC6018") || text.includes("6018")) return "6018";
  if (text.includes("IPC-6013") || text.includes("IPC6013") || text.includes("6013")) return "6013";
  if (text.includes("IPC-6012") || text.includes("IPC6012") || text.includes("6012")) return "6012";
  return null;
}

export function pcbTypeOptionsForRegulatory(regulatoryRequirement: string): string[] {
  const family = resolveIpcFamily(regulatoryRequirement);
  if (family === "6012") return PCB_TYPES_IPC_6012;
  if (family === "6013") return PCB_TYPES_IPC_6013;
  if (family === "6018") return PCB_TYPES_IPC_6018;
  return [];
}
