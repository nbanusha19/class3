/** Header and table behaviour from Claude CoC HTML Form F4. */

export const F4_TEST_LEVEL = "IPC-9252B LEVEL-C";
export const F4_STANDARD = "IPC-9252B";
export const F4_YES = "Yes";
export const F4_TEST_METHODS = ["Resistive", "Indirect"] as const;

export function f4SourceFromBbt(raw: string): string {
  return String(raw || "").replace(/\s+/g, " ").trim();
}
export const F4_VOLTAGE = ["40 V", "250 V"] as const;
export const F4_RESULT = ["Pass", "Fail"] as const;

export function f4ResultRequired(test: string): boolean {
  return /^(continuity|isolation)\b/i.test(String(test || "").trim());
}

export const F4_STATIC_KEYS = new Set([
  "testLevel",
  "standard",
  "dataRetention",
  "traceability",
]);

function f4TextToken(value: string): string {
  const raw = String(value || "").trim();
  if (!raw || raw === "—" || raw === "-" || raw.toLowerCase() === "na" || raw.toLowerCase() === "n/a") return "";
  return raw;
}

/** Default applicable standard: IPC-9252B, plus customer specification when present. */
export function f4ApplicableStandard(specification: string): string {
  const spec = f4TextToken(specification);
  return spec ? `${F4_STANDARD} & ${spec}` : F4_STANDARD;
}

export function f4IsGeneratedStandard(value: string): boolean {
  const raw = String(value || "").trim();
  if (!raw) return true;
  if (raw === F4_STANDARD) return true;
  return raw.startsWith(`${F4_STANDARD} & `);
}

/** Fill F4 header defaults without overwriting a value the user already edited. */
export function f4FillDefaults(
  fields: Record<string, string>,
  specification = "",
  regulatoryRequirement = "",
): Record<string, string> {
  const next = { ...fields };
  if (!String(next["f4.testLevel"] || "").trim()) next["f4.testLevel"] = F4_TEST_LEVEL;
  const currentStandard = next["f4.standard"] || "";
  const regulatory = f4TextToken(regulatoryRequirement);
  const spec = f4TextToken(specification);
  const previousJoin = regulatory && spec ? `${regulatory} & ${spec}` : regulatory || spec;
  if (
    f4IsGeneratedStandard(currentStandard) ||
    (previousJoin && currentStandard === previousJoin)
  ) {
    next["f4.standard"] = f4ApplicableStandard(specification);
  }
  if (!String(next["f4.dataRetention"] || "").trim()) next["f4.dataRetention"] = F4_YES;
  if (!String(next["f4.traceability"] || "").trim()) next["f4.traceability"] = F4_YES;
  return next;
}

/** @deprecated Use f4FillDefaults so header fields stay editable. */
export function f4LockedFields(custSpec: string, _regulatoryRequirement = ""): Record<string, string> {
  return {
    "f4.testLevel": F4_TEST_LEVEL,
    "f4.standard": f4ApplicableStandard(custSpec),
    "f4.dataRetention": F4_YES,
    "f4.traceability": F4_YES,
  };
}

export const F4_SOURCE_OPTS = ["Gerber Extracted", "IPC-D 356 Compare"] as const;

export const F4_CERT_TEXT =
  "We hereby certify that printed boards (PBs) have been electrically tested to the requirements of the referenced purchase order/specifications.";

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

/** Legacy print number: ET-{productionOrder}-{DDMMYY}. */
export function f4ReportNumber(productionOrder: string, date: string): string {
  const prod = String(productionOrder || "").trim();
  const stamp = ddmmyyFromDate(date);
  if (!prod && !stamp) return "";
  if (!prod) return `ET-${stamp}`;
  if (!stamp) return `ET-${prod}`;
  return `ET-${prod}-${stamp}`;
}

export function f4QtyPassed(quantity: string): string {
  const token = String(quantity || "").trim();
  if (!token) return "";
  if (/no'?s/i.test(token)) return token;
  return /^\d+(\.\d+)?$/.test(token) ? `${token} No's` : token;
}

export function f4CheckLine(options: { label: string; on: boolean }[]): string {
  return options.map((opt) => `${opt.on ? "[X]" : "[  ]"}  ${opt.label}`).join("          ");
}

export function f4TestMethodLine(method: string): string {
  const token = String(method || "").trim().toLowerCase();
  return f4CheckLine([
    { label: "Resistive", on: token === "resistive" },
    { label: "Indirect", on: token === "indirect" },
  ]);
}

export function f4SourceDataLine(source: string): string {
  const token = String(source || "").replace(/\s+/g, " ").trim();
  const gerber = /gerber/i.test(token);
  const ipc356 = /356|netlist/i.test(token) || /ipc-?d/i.test(token);
  if (!token || gerber || ipc356) {
    return f4CheckLine([
      { label: "Gerber Extracted", on: gerber },
      { label: "IPC-D 356 Compare", on: ipc356 },
    ]);
  }
  return token;
}

export function f4ParamRow(rows: Record<string, string>[], match: RegExp): Record<string, string> | undefined {
  return rows.find((row) => match.test(row.test || ""));
}

export function f4IsolationRequirement(isolationValue: string, voltage: string): string {
  const iso = String(isolationValue || "").trim();
  const volts = String(voltage || "").trim();
  if (!iso) return volts;
  if (!volts) return iso;
  const compact = iso.replace(/\s+/g, "").toLowerCase();
  if (compact.includes(volts.replace(/\s+/g, "").toLowerCase())) return iso;
  return `${iso} at ${volts}`;
}
