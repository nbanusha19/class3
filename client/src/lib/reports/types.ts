export type FieldType = "text" | "textarea" | "date" | "number" | "select";

export interface Field {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  placeholder?: string;
  default?: string;
  /** shared key — value is mirrored across every report that uses it (like the Excel cross-sheet formulas) */
  shared?: string;
  span?: 1 | 2 | 3;
}

export interface Column {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  width?: number; // relative flex weight
  /** render as static text — big win for large fixed checklists */
  readonly?: boolean;
}

export type Section =
  | { kind: "fields"; title?: string; subtitle?: string; fields: Field[] }
  | {
      kind: "table";
      title?: string;
      subtitle?: string;
      key: string;
      columns: Column[];
      rows: Record<string, string>[];
      /** rows are fixed checklist lines (no add/remove) */
      fixed?: boolean;
      addLabel?: string;
    }
  | { kind: "note"; title?: string; text: string }
  | {
      kind: "signoff";
      title?: string;
      /** Flat fields (legacy single-row sign-off) */
      fields?: Field[];
      /** Multi-column sign-off: Inspected / Verified / Approved */
      columns?: { title: string; fields: Field[] }[];
    };

export interface Report {
  id: string;
  code: string;
  title: string;
  rev: string;
  group: string;
  sections: Section[];
}

export function signoffFields(section: Extract<Section, { kind: "signoff" }>): Field[] {
  if (section.columns?.length) return section.columns.flatMap((col) => col.fields);
  return section.fields ?? [];
}

export const RESULTS = ["Accepted", "Passed", "Pass", "Fail", "NA"];
