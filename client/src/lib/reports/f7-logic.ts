export const F7_REPORT_PREFIX = "CA-";
export const F7_RESULTS = ["Pass", "Fail", "NA"] as const;

/** F7 report number is CA- plus the F1 COC number. */
export function f7ReportNumber(cocNumber: string): string {
  const coc = String(cocNumber || "")
    .trim()
    .replace(/^(BPCBI-|CA-)/i, "");
  return coc ? `${F7_REPORT_PREFIX}${coc}` : F7_REPORT_PREFIX;
}

export const F7_SIDES = ["Top", "Bottom"] as const;

export type F7MeasureLine = {
  layer: string;
  requirement: string;
  measuredX: string;
  measuredY: string;
  result: string;
  remarks: string;
  side: string;
};

export type F7CharDef = {
  sl: string;
  characteristic: string;
  requirement: string;
  stage: "Before micro etch" | "After micro etch";
  defaultLines: F7MeasureLine[];
};

/** Split "L1-L2 (71.12µ)" into layer + requirement. Spec-only text stays in requirement. */
export function splitF7Requirement(text: string): { layer: string; requirement: string } {
  const raw = String(text || "").trim();
  if (!raw) return { layer: "", requirement: "" };
  const paren = /^(.*?)[\(\[]\s*([^)\]]+)[\)\]]\s*$/.exec(raw);
  if (paren) return { layer: paren[1]!.trim(), requirement: paren[2]!.trim() };
  if (/^L\d+/i.test(raw) && raw.length <= 24) return { layer: raw, requirement: "" };
  return { layer: "", requirement: raw };
}

export function f7LineDisplay(line: F7MeasureLine): { layer: string; requirement: string } {
  if (String(line.layer || "").trim()) {
    return { layer: String(line.layer).trim(), requirement: String(line.requirement || "") };
  }
  return splitF7Requirement(line.requirement);
}

function measureLine(text: string, result = "Pass", side = ""): F7MeasureLine {
  const split = splitF7Requirement(text);
  return {
    layer: split.layer,
    requirement: split.requirement,
    measuredX: "",
    measuredY: "",
    result,
    remarks: "",
    side,
  };
}

function surfaceCopperDefaults(): F7MeasureLine[] {
  return [measureLine("Finish: 34–65µ", "Pass", "Top"), measureLine("Finish: 34–65µ", "Pass", "Bottom")];
}

function dielectricDefaults(pairs = 4): F7MeasureLine[] {
  return Array.from({ length: pairs }, (_, i) => measureLine(`L${i + 1}-L${i + 2}`));
}

function innerCopperDefaults(count = 4): F7MeasureLine[] {
  return Array.from({ length: count }, (_, i) => measureLine(`L${i + 2} (11.4µ Min.)`));
}

function specLines(...requirements: string[]): F7MeasureLine[] {
  return requirements.map((requirement) => measureLine(requirement));
}

function char(
  sl: string,
  characteristic: string,
  stage: F7CharDef["stage"],
  defaultLines: F7MeasureLine[],
  requirement = "",
): F7CharDef {
  return { sl, characteristic, requirement, stage, defaultLines };
}

/** Official HIQ-QAD-P06-F7 photo rows — one PDF page each, in inspection order. */
export const F7_CHARS: F7CharDef[] = [
 char(
  "1",
  "After Thermal Stress",
  "Before micro etch",
  specLines(
    "Thermal Stress Test IPC-TM-650, Method 2.6.8, Condition A, No inner layer separation, delamination, barrel crack.",
  ),
),
  char("2", "PTH Copper Thickness", "Before micro etch", specLines("Avg. 25µ", "Min. 20µ")),
  char("3", "Cap Thickness", "After micro etch", specLines("Min. 12µ")),
  char("4", "Wrap Thickness", "After micro etch", specLines("Min. 12µ")),
  char("5", "Inner Layer Copper Thickness", "Before micro etch", innerCopperDefaults()),
  char("6", "Surface Final Copper Thickness", "Before micro etch", surfaceCopperDefaults()),
  char("7", "Di-electric Thickness", "Before micro etch", dielectricDefaults(), "As per stackup"),
  char("8", "Internal Annular Ring", "After micro etch", specLines("25µ Min.")),
  char("9", "External Annular Ring", "After micro etch", specLines("50µ Min.")),
  char("10", "Resin Recession", "After micro etch", specLines("Resin recession is acceptable following thermal stress testing")),
  char("11", "Etch Back", "After micro etch", specLines("Positive :- 80µ Max.", "Negative :- 13µ Max.")),
  char("12", "Wicking", "After micro etch", specLines("80µ Max.")),
  char("13", "Solder Mask Thickness", "After micro etch", specLines("No Copper Expose")),
  char("14", "Micro Via", "After micro etch", specLines("")),
  char("15", "Buried Via", "After micro etch", specLines("")),
];

export const F7_FIXED_REQUIREMENTS: Record<string, string[]> = {
  "8": ["25µ Min."],
  "9": ["50µ Min."],
  "10": ["Resin recession is acceptable following thermal stress testing"],
  "11": ["Positive :- 80µ Max.", "Negative :- 13µ Max."],
  "12": ["80µ Max."],
  "13": ["No Copper Expose"],
};

export const F7_NO_LAYER_COLS = new Set(["1", "2", "3", "4", "6", "8", "9", "10", "11", "12", "13"]);
export const F7_NO_Y_IMAGE = new Set(["13"]);

/** Inner-layer characteristics that do not apply on 1–2 layer boards. */
export const F7_HIDDEN_WHEN_LE_2_LAYERS = new Set(["5", "8", "11"]);

export function f7CharHiddenForLayers(sl: string, layers: string): boolean {
  const raw = String(layers || "").trim();
  if (!raw) return false;
  const n = Number(raw);
  if (!Number.isFinite(n) || n > 2) return false;
  return F7_HIDDEN_WHEN_LE_2_LAYERS.has(String(sl || "").trim());
}

/** Cap / wrap thickness apply only when ERP Via Protection is Type VII. */
export const F7_TYPE_VII_ONLY = new Set(["3", "4"]);

export function f7IsTypeVii(viaProtection: string): boolean {
  const token = String(viaProtection || "").replace(/\s+/g, " ").trim();
  if (!token || /viii/i.test(token)) return false;
  return /type\s*vii\b/i.test(token) || /\bvii\b/i.test(token) || /type\s*7\b/i.test(token);
}

export function f7CharHiddenForViaProtection(sl: string, viaProtection: string): boolean {
  if (!F7_TYPE_VII_ONLY.has(String(sl || "").trim())) return false;
  return !f7IsTypeVii(viaProtection);
}

/** Micro via / buried via apply only when F1 PCB Type is Type 4. */
export const F7_TYPE_4_ONLY = new Set(["14", "15"]);

export function f7IsPcbType4(pcbType: string): boolean {
  const token = String(pcbType || "").replace(/\s+/g, " ").trim();
  if (!token) return false;
  if (/^type\s*4\b/i.test(token)) return true;
  if (/^4\b/.test(token) && !/^4\d/.test(token)) return true;
  return false;
}

export function f7CharHiddenForPcbType(sl: string, pcbType: string): boolean {
  if (!F7_TYPE_4_ONLY.has(String(sl || "").trim())) return false;
  return !f7IsPcbType4(pcbType);
}

export function f7CharHidden(sl: string, layers: string, viaProtection: string, pcbType = ""): boolean {
  return (
    f7CharHiddenForLayers(sl, layers) ||
    f7CharHiddenForViaProtection(sl, viaProtection) ||
    f7CharHiddenForPcbType(sl, pcbType)
  );
}

export function f7VisibleCharRows(
  rows: Record<string, string>[],
  layers: string,
  viaProtection = "",
  pcbType = "",
): Record<string, string>[] {
  return rows.filter(
  (row) => !f7CharHidden(row.baseSl || row.sl || "", layers, viaProtection, pcbType),
);
}

export const F7_WRAP_REQ_DEFAULT = "Min. 12µ";
export const F7_WRAP_REQ_FIVE = "5µ Min.";

/** F1 specifications that use 5µ Min. wrap plating instead of 12µ. */
const F7_WRAP_FIVE_SPEC_TOKENS = [
  "IPC6012",
  "IPC6013",
  "IPC6018",
  "PS30051",
  "30051",
  "Q906D010ESXC02",
  "0906D010ESXC02",
  "5800798",
  "PPE1443",
  "16262721024",
];

function compactF7Spec(value: string): string {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function foldF7Req(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[µμ]/g, "u")
    .replace(/[^a-z0-9]/g, "");
}

function isF7WrapSystemReq(value: string): boolean {
  const token = foldF7Req(value);
  if (!token) return true;
  return token === "min12u" || token === "12umin" || token === "min5u" || token === "5umin";
}

export function f7WrapFiveMicronSpec(specification: string, regulatoryRequirement = ""): boolean {
  const hay = compactF7Spec(`${specification} ${regulatoryRequirement}`);
  if (!hay) return false;
  return F7_WRAP_FIVE_SPEC_TOKENS.some((token) => hay.includes(token));
}

export function f7WrapRequirement(specification: string, regulatoryRequirement = ""): string {
  return f7WrapFiveMicronSpec(specification, regulatoryRequirement) ? F7_WRAP_REQ_FIVE : F7_WRAP_REQ_DEFAULT;
}

export const F7_INNER_COPPER_REQ = "11.4µ Min.";

export function f7ParsedLayerCount(layers: string): number {
  const n = Number(String(layers || "").trim());
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Inner copper rows follow F1 layer count: L2 … L(n-1). */
export function f7InnerCopperLayerNos(layers: string): number[] {
  const n = f7ParsedLayerCount(layers);
  if (n < 3) return [];
  return Array.from({ length: n - 2 }, (_, i) => i + 2);
}

function innerCopperLineNo(line: F7MeasureLine): number | null {
  const display = f7LineDisplay(line);
  const match = /\bL(\d+)\b/i.exec(`${display.layer} ${display.requirement}`);
  const no = match ? Number(match[1]) : NaN;
  return Number.isFinite(no) && no > 0 ? no : null;
}

function deriveInnerCopperLines(existing: F7MeasureLine[], layers: string): F7MeasureLine[] {
  const nos = f7InnerCopperLayerNos(layers);
  if (!nos.length) return existing;
  const currentNos = existing.map(innerCopperLineNo);
  if (currentNos.length === nos.length && currentNos.every((no, i) => no === nos[i])) return existing;
  const byNo = new Map<number, F7MeasureLine>();
  for (const line of existing) {
    const no = innerCopperLineNo(line);
    if (no && !byNo.has(no)) byNo.set(no, line);
  }
  return nos.map((no) => {
    const prev = byNo.get(no);
    if (prev) {
      const display = f7LineDisplay(prev);
      return {
        ...prev,
        layer: `L${no}`,
        requirement: display.requirement || F7_INNER_COPPER_REQ,
      };
    }
    return measureLine(`L${no} (${F7_INNER_COPPER_REQ})`);
  });
}

/** Dielectric rows follow F1 layer count: L1-L2 … L(n-1)-Ln. */
export function f7DielectricPairLabels(layers: string): string[] {
  const n = f7ParsedLayerCount(layers);
  if (n < 2) return [];
  return Array.from({ length: n - 1 }, (_, i) => `L${i + 1}-L${i + 2}`);
}

function dielectricPairLabel(line: F7MeasureLine): string | null {
  const display = f7LineDisplay(line);
  const match = /L(\d+)\s*-\s*L(\d+)/i.exec(`${display.layer} ${display.requirement}`);
  return match ? `L${match[1]}-L${match[2]}` : null;
}

function deriveDielectricLines(existing: F7MeasureLine[], layers: string): F7MeasureLine[] {
  const labels = f7DielectricPairLabels(layers);
  if (!labels.length) return existing;
  const current = existing.map(dielectricPairLabel);
  if (current.length === labels.length && current.every((label, i) => label === labels[i])) return existing;
  const byLabel = new Map<string, F7MeasureLine>();
  for (const line of existing) {
    const label = dielectricPairLabel(line);
    if (label && !byLabel.has(label)) byLabel.set(label, line);
  }
  return labels.map((label) => {
    const prev = byLabel.get(label);
    if (prev) {
      const display = f7LineDisplay(prev);
      return {
        ...prev,
        layer: label,
        requirement: display.layer === label ? display.requirement : String(prev.requirement || ""),
      };
    }
    return measureLine(label);
  });
}

function deriveFixedReqLines(existing: F7MeasureLine[], reqs: string[]): F7MeasureLine[] {
  if (
    existing.length === reqs.length &&
    existing.every((line, i) => f7LineDisplay(line).requirement === reqs[i] && !String(line.layer || "").trim())
  ) {
    return existing;
  }
  return reqs.map((req, i) => {
    const prev = existing[i];
    if (!prev) return measureLine(req);
    return { ...prev, layer: "", requirement: req };
  });
}

/** Apply spec-based Wrap Thickness default without overwriting a custom requirement. */
export function withDerivedF7Rows(
  rows: Record<string, string>[] | undefined,
  specification: string,
  regulatoryRequirement = "",
  layers = "",
): Record<string, string>[] {
  const ensured = f7EnsureCharRows(rows);
  const want = f7WrapRequirement(specification, regulatoryRequirement);
  let changed = false;
  const next = ensured.map((row) => {
    const sl = String(row.baseSl || row.sl || "").trim();
    let out = row;
    if (sl === "4") {
      const lineRows = f7RowLines(out);
      const source = lineRows.length ? lineRows : [measureLine(want)];
      let lineChanged = false;
      const nextLines = source.map((line) => {
        if (!isF7WrapSystemReq(line.requirement)) return line;
        if (line.requirement === want) return line;
        lineChanged = true;
        return { ...line, requirement: want };
      });
      if (lineChanged) {
        changed = true;
        out = { ...out, lines: serializeF7Lines(nextLines) };
      }
    }
    if (sl === "5") {
      const lineRows = f7RowLines(out);
      const nextLines = deriveInnerCopperLines(lineRows, layers);
      if (nextLines !== lineRows) {
        changed = true;
        out = { ...out, lines: serializeF7Lines(nextLines) };
      }
    }
    if (sl === "7") {
      const lineRows = f7RowLines(out);
      const nextLines = deriveDielectricLines(lineRows, layers);
      if (nextLines !== lineRows) {
        changed = true;
        out = { ...out, lines: serializeF7Lines(nextLines) };
      }
    }
    const fixed = F7_FIXED_REQUIREMENTS[sl];
    if (fixed) {
      const lineRows = f7RowLines(out);
      const nextLines = deriveFixedReqLines(lineRows, fixed);
      if (nextLines !== lineRows) {
        changed = true;
        out = { ...out, lines: serializeF7Lines(nextLines) };
      }
    }
    return out;
  });
  return changed ? next : ensured;
}

function foldCharName(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[—–]/g, "-")
    .replace(/\s+/g, " ");
}

/** Map legacy split characteristics onto the current F7 list. */
export function f7TargetFor(name: string): { characteristic: string; side: string } {
  const n = foldCharName(name);
  if (n.startsWith("surface final copper thickness")) {
    let side = "";
    if (/\bbottom\b/.test(n)) side = "Bottom";
    else if (/\btop\b/.test(n)) side = "Top";
    return { characteristic: "Surface Final Copper Thickness", side };
  }
  if (n.startsWith("etch back")) return { characteristic: "Etch Back", side: "" };
  return { characteristic: String(name || "").trim(), side: "" };
}

export function f7UsesSide(characteristic: string): boolean {
  return foldCharName(characteristic).startsWith("surface final copper thickness");
}

export function f7UsesLayer(characteristic: string, sl = ""): boolean {
  if (F7_NO_LAYER_COLS.has(String(sl || "").trim())) return false;
  return !foldCharName(characteristic).startsWith("surface final copper thickness");
}

export function f7UsesYImage(sl: string, layers = ""): boolean {
  const layerCount = f7ParsedLayerCount(layers);
  return !F7_NO_Y_IMAGE.has(String(sl || "").trim()) && layerCount !== 2;
}

export function f7RequirementLocked(sl: string): boolean {
  return Boolean(F7_FIXED_REQUIREMENTS[String(sl || "").trim()]);
}

export type F7Image = { id?: string; name: string; path?: string };

export function parseF7Image(raw: string | undefined): F7Image | null {
  try {
    const parsed = JSON.parse(raw || "null") as F7Image | F7Image[] | null;
    const item = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!item?.name) return null;
    if (!item.id && !item.path) return null;
    return { id: item.id, name: item.name, path: item.path };
  } catch {
    return null;
  }
}

export function serializeF7Image(file: F7Image | null): string {
  if (!file?.name) return "";
  return JSON.stringify({ id: file.id, name: file.name, path: file.path });
}

export function f7ImageCol(dir: "x" | "y"): "imageX" | "imageY" {
  return dir === "x" ? "imageX" : "imageY";
}

export function emptyF7MeasureLine(): F7MeasureLine {
  return measureLine("");
}

export function parseF7Lines(raw: string | undefined): F7MeasureLine[] {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const requirement = String(row.requirement ?? "");
      const layerStored = String(row.layer ?? "").trim();
      const split = splitF7Requirement(requirement);
      return {
        layer: layerStored || split.layer,
        requirement: layerStored ? requirement : split.requirement || (split.layer ? "" : requirement),
        measuredX: String(row.measuredX ?? ""),
        measuredY: String(row.measuredY ?? ""),
        result: String(row.result ?? "Pass"),
        remarks: String(row.remarks ?? ""),
        side: String(row.side ?? ""),
      };
    });
  } catch {
    return [];
  }
}

export function serializeF7Lines(lines: F7MeasureLine[]): string {
  return JSON.stringify(lines);
}

export function f7DefFor(row: Record<string, string> | undefined): F7CharDef | undefined {
  const name = (row?.characteristic || "").trim();
  if (!name) return undefined;
  const target = f7TargetFor(name).characteristic;
  return F7_CHARS.find(
    (def) =>
      def.characteristic.toLowerCase() === target.toLowerCase() || def.characteristic.toLowerCase() === name.toLowerCase(),
  );
}

function hasLegacyMeasures(row: Record<string, string> | undefined): boolean {
  if (!row) return false;
  return Boolean(
    String(row.measuredX || "").trim() ||
      String(row.measuredY || "").trim() ||
      String(row.remarks || "").trim() ||
      (String(row.result || "").trim() && String(row.result).trim() !== "Pass"),
  );
}

function applyLegacyMeasures(lines: F7MeasureLine[], row: Record<string, string> | undefined): F7MeasureLine[] {
  if (!lines.length || !hasLegacyMeasures(row)) return lines.map((line) => ({ ...line }));
  const next = lines.map((line) => ({ ...line }));
  const last = next[next.length - 1];
  next[next.length - 1] = {
    ...last,
    measuredX: String(row?.measuredX || last.measuredX),
    measuredY: String(row?.measuredY || last.measuredY),
    result: String(row?.result || last.result || "Pass"),
    remarks: String(row?.remarks || last.remarks),
  };
  return next;
}

export function f7RowLines(row: Record<string, string> | undefined): F7MeasureLine[] {
  if (String(row?.lines || "").trim()) return parseF7Lines(row?.lines);
  const def = f7DefFor(row);
  if (def?.defaultLines?.length) return applyLegacyMeasures(def.defaultLines, row);
  if (row && (row.requirement || hasLegacyMeasures(row))) {
    return applyLegacyMeasures([measureLine(row.requirement || "")], row);
  }
  return [emptyF7MeasureLine()];
}

export function f7NextLineRequirement(row: Record<string, string>, lines: F7MeasureLine[]): string {
  const name = (row.characteristic || "").toLowerCase();
  const last = [...lines].reverse().find((line) => (line.layer || line.requirement).trim());
  const token = last ? `${last.layer} ${last.requirement}`.trim() : "";
  if (name.includes("di-electric") || name.includes("dielectric")) {
    const pair = token.match(/L(\d+)\s*-\s*L(\d+)/i);
    if (pair) return `L${Number(pair[2])}-L${Number(pair[2]) + 1}`;
    return `L${lines.length + 1}-L${lines.length + 2}`;
  }
  if (name.includes("inner layer")) {
    const layer = token.match(/L(\d+)/i);
    if (layer) return `L${Number(layer[1]) + 1} (11.4µ Min.)`;
    return `L${lines.length + 2} (11.4µ Min.)`;
  }
  if (name.includes("surface final copper")) {
    return last?.requirement || "Finish: 34–65µ";
  }
  return "";
}

export function f7BlankMeasureLine(row: Record<string, string>, lines: F7MeasureLine[]): F7MeasureLine {
  return measureLine(f7NextLineRequirement(row, lines));
}

function emptyCharRow(def: F7CharDef): Record<string, string> {
  return {
    sl: def.sl,
    characteristic: def.characteristic,
    requirement: def.requirement,
    stage: def.stage,
    measuredX: "",
    measuredY: "",
    result: "Pass",
    remarks: "",
    imageX: "",
    imageY: "",
    lines: serializeF7Lines(def.defaultLines),
  };
}

export function f7CharRows(): Record<string, string>[] {
  return F7_CHARS.map((def) => emptyCharRow(def));
}

export function f7EnsureCharRows(rows: Record<string, string>[] | undefined): Record<string, string>[] {
  const current = rows?.length ? rows : [];
  const used = new Set<number>();

  function partsFor(def: F7CharDef): Record<string, string>[] {
    const parts: Record<string, string>[] = [];
    current.forEach((row, i) => {
  if (used.has(i) || row.baseSl) return;
      const target = f7TargetFor(row.characteristic || "").characteristic;
      const name = (row.characteristic || "").trim();
      if (
        target.toLowerCase() === def.characteristic.toLowerCase() ||
        name.toLowerCase() === def.characteristic.toLowerCase()
      ) {
        used.add(i);
        parts.push(row);
      }
    });
    return parts;
  }

  function mergeParts(def: F7CharDef, parts: Record<string, string>[]): Record<string, string> {
    if (!parts.length) return emptyCharRow(def);
    const primary = parts[0]!;
    const next: Record<string, string> = {
      ...emptyCharRow(def),
      ...primary,
      sl: def.sl,
      characteristic: def.characteristic,
      requirement: def.requirement,
      stage: def.stage,
    };
    const hasStored = parts.some((part) => String(part.lines || "").trim() || hasLegacyMeasures(part));
    if (hasStored) {
      const merged: F7MeasureLine[] = [];
      for (const part of parts) {
        const inherited = f7TargetFor(part.characteristic || "").side;
        if (String(part.lines || "").trim()) {
          merged.push(
            ...parseF7Lines(part.lines).map((line) => ({
              ...line,
              side: line.side || inherited,
            })),
          );
        } else if (hasLegacyMeasures(part)) {
          merged.push(
            ...applyLegacyMeasures([measureLine(part.requirement || "")], part).map((line) => ({
              ...line,
              side: line.side || inherited,
            })),
          );
        }
      }
      next.lines = serializeF7Lines(merged.length ? merged : def.defaultLines);
    } else if (!String(primary.lines || "").trim()) {
      next.lines = serializeF7Lines(def.defaultLines);
    }

        if (def.sl === "1") {
      const savedLines = parseF7Lines(next.lines);
      const defaultLine = def.defaultLines[0]!;
      const combineValues = (key: "measuredX" | "measuredY") =>
        savedLines
          .map((line) => line[key].trim())
          .filter(Boolean)
          .join(" / ");

      next.lines = serializeF7Lines([
        {
          ...defaultLine,
          measuredX: combineValues("measuredX"),
          measuredY: combineValues("measuredY"),
          result: savedLines.some((line) => line.result === "Fail")
            ? "Fail"
            : savedLines.length > 0 &&
                savedLines.every((line) => line.result === "NA")
              ? "NA"
              : "Pass",
          remarks: savedLines
            .map((line) => line.remarks.trim())
            .filter(Boolean)
            .join("; "),
        },
      ]);
    }
    for (const col of ["imageX", "imageY"] as const) {
      const found = parts.find((part) => String(part[col] || "").trim());
      if (found) next[col] = found[col]!;
    }
    return next;
  }

  const bound = F7_CHARS.map((def) => mergeParts(def, partsFor(def)));
  const extra: Record<string, string>[] = current
    .filter((_, i) => !used.has(i))
    .filter((row) => {
      if (row.baseSl) return true;
      const name = (row.characteristic || "").trim();
      const target = f7TargetFor(name).characteristic;
      if (target && F7_CHARS.some((def) => def.characteristic.toLowerCase() === target.toLowerCase())) return false;
      if (name && F7_CHARS.some((def) => def.characteristic.toLowerCase() === name.toLowerCase())) return false;
      return Object.values(row).some((value) => String(value || "").trim());
    })
    .map((row, index) => {
      const next: Record<string, string> = {
        ...row,
        sl: row.sl || String(F7_CHARS.length + index + 1),
      };
      if (!String(next.lines || "").trim()) {
        next.lines = serializeF7Lines(f7RowLines(next));
      }
      return next;
    });
  const copiesByBase = new Map<string, Record<string, string>[]>();
const otherExtra: Record<string, string>[] = [];

for (const row of extra) {
  const baseSl = String(row.baseSl || "").trim();
  if (!baseSl) {
    otherExtra.push(row);
    continue;
  }

  const copies = copiesByBase.get(baseSl) || [];
  copies.push(row);
  copiesByBase.set(baseSl, copies);
}

const ordered = bound.flatMap((row) => [
  row,
  ...(copiesByBase.get(String(row.sl || "").trim()) || []),
]);

const canonicalSerials = new Set(bound.map((row) => String(row.sl || "").trim()));
const unmatchedCopies = extra.filter(
  (row) => row.baseSl && !canonicalSerials.has(row.baseSl),
);

return [...ordered, ...unmatchedCopies, ...otherExtra];
}
