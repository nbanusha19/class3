import { createContext } from "react";
import type { Field, Report, Section } from "./reports/types";
import type { F2State } from "./reports/f2-logic";

export type Row = Record<string, string>;

export interface ReportState {
  shared: Record<string, string>;
  fields: Record<string, string>;
  tables: Record<string, Row[]>;
  combinedProductionOrders?: string[];
  received?: string;
  f2?: F2State;
}

export interface ReportContextValue {
  state: ReportState;
  getField: (reportId: string, field: Field) => string;
  setField: (reportId: string, field: Field, value: string) => void;
  applyCocLookup: (reportId: string, data: Record<string, string>) => void;
  getRows: (reportId: string, tableKey: string) => Row[];
  setCell: (reportId: string, tableKey: string, index: number, col: string, value: string) => void;
  addRow: (reportId: string, section: Extract<Section, { kind: "table" }>) => void;
  replaceRows: (reportId: string, tableKey: string, rows: Row[]) => void;
  removeRow: (reportId: string, tableKey: string, index: number) => void;
  reset: () => void;
  loadState: (next: Partial<ReportState>) => void;
  getSnapshot: () => ReportState;
  completion: (report: Report) => number;
  updateF2: (next: F2State | ((prev: F2State) => F2State)) => void;
  stage: "in-progress" | "verification" | "approved";
}

/** Stable across Vite HMR of report-store.tsx — do not recreate this object. */
export const ReportContext = createContext<ReportContextValue | null>(null);
