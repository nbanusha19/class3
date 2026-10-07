/** IPC-6012 table 4-2, C=0 sampling (from CoC Claude design). */
const AQL_COLS = ["0.10", "1.0", "1.5", "2.5", "4.0", "6.5"] as const;
const SAMPLING_4_2: { max: number; v: (number | "**")[] }[] = [
  { max: 8, v: ["**", "**", "**", 5, 3, 3] },
  { max: 15, v: ["**", 13, 8, 5, 3, 3] },
  { max: 25, v: ["**", 13, 8, 5, 3, 3] },
  { max: 50, v: ["**", 13, 8, 7, 7, 5] },
  { max: 90, v: ["**", 13, 13, 11, 8, 5] },
  { max: 150, v: [125, 19, 19, 11, 9, 6] },
  { max: 280, v: [125, 29, 19, 13, 10, 7] },
  { max: 500, v: [125, 29, 21, 16, 11, 9] },
  { max: 1200, v: [125, 34, 27, 19, 15, 11] },
  { max: 3200, v: [125, 42, 35, 23, 18, 13] },
  { max: 10000, v: [192, 50, 38, 29, 22, 15] },
  { max: 35000, v: [294, 60, 46, 35, 29, 15] },
];

export function planApplies(size: string): boolean {
  const s = String(size || "");
  return /AQL\s*[0-9.]+/i.test(s) || /100\s*%/.test(s) || /every\s*(panel|layer|pcb)/i.test(s);
}

export function samplingQtyForLot(lot: number, size: string): string {
  if (!(lot > 0)) return "";
  const s = String(size || "");
  if (/every\s*(panel|layer|pcb)/i.test(s)) return "100%";
  if (/100\s*%/.test(s)) return String(lot);
  const match = s.match(/AQL\s*([0-9.]+)/i);
  if (!match) return "";
  const token = match[1] === "0.1" ? "0.10" : match[1]!;
  const col = AQL_COLS.indexOf(token as (typeof AQL_COLS)[number]);
  if (col < 0) return "";
  const band = SAMPLING_4_2.find((row) => lot <= row.max);
  if (!band) return "100%";
  const value = band.v[col];
  if (value === "**") return "100% (entire lot)";
  return lot < value ? "100%" : String(value);
}
