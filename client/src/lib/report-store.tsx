import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { REPORTS } from "./reports/schema";
import type { Field, Report, Section } from "./reports/types";
import { signoffFields } from "./reports/types";
import { f15AutoFromFinish, f4ValueFor, normalizeRohs, normalizeUlMark, resolveF4Spec, F1_APPROVED_BY, F1_APPROVED_DESIG, f1SignoffColumnOf, f1SignoffFieldCounts, f1SignoffFieldEditable, normalizeReportStatus, f1RohsFromBoardFinish } from "./reports/form-pack";
import { f4FillDefaults, f4SourceFromBbt } from "./reports/f4-logic";
import { defaultF2State, derivedF2Fields, f2ReportNumber, mergeF2State, perPcb, applyPcbDetailsToF2, acceptedPanelsTotal, f2LotSize, type F2State, countSupplied, countStock } from "./reports/f2-logic";
import { isClaudeF3Checklist, withDerivedF3Rows, f3ReportNumber } from "./reports/f3-logic";
import { f7ReportNumber, withDerivedF7Rows } from "./reports/f7-logic";
import { f5ApplyBoardThickness } from "./reports/f5-logic";
import { withDerivedF6Rows, f6AcceptedPanelLabels } from "./reports/f6-logic";
import { f15DerivedFields, withDerivedF15Rows } from "./reports/f15-logic";
import { f16DerivedFields, withDerivedF16Rows } from "./reports/f16-logic";
import { samplingQtyForLot } from "./reports/sampling";
import { ReportContext, type ReportContextValue, type ReportState, type Row } from "./report-context";
import {
  buildSerials,
  // keep the rest of the existing imports
} from "./reports/f2-logic";

export type { ReportState, Row } from "./report-context";

function productionOrdersFrom(state: Pick<ReportState, "combinedProductionOrders" | "fields">): string[] {
  if (state.combinedProductionOrders?.length) return state.combinedProductionOrders.filter(Boolean);
  const single = state.fields["f1.productionOrder"]?.trim();
  return single ? [single] : [];
}

function derivedBatchCode(state: Pick<ReportState, "combinedProductionOrders" | "fields" | "f2">, f2: F2State): string {
  const orders = [
    ...productionOrdersFrom(state),
    ...(f2.lines || []).map((line) => String(line.prod || "").trim()),
  ].filter(Boolean);
  return [...new Set(orders)].join(", ");
}

function withDerivedF2(state: ReportState): ReportState {
  const f2 = mergeF2State(state.f2, productionOrdersFrom(state));
  const spec = state.shared.specification || "";
  const lot = f2LotSize(f2, spec);
  const sample = samplingQtyForLot(lot, "AQL 4.0");
  const panels = acceptedPanelsTotal(f2);
  const hasSerialSource = perPcb(f2) > 0 && f2.lines.some((line) => Number(line.panels) > 0);

  const fields: Record<string, string> = {
    ...f4FillDefaults(state.fields, spec, state.shared.regulatoryRequirement || ""),
    ...(lot > 0 ? { "f5.lotSize": String(lot), "f5.sampleSize": sample || "", "f5.aql": "AQL 4.0" } : {}),
    ...f15DerivedFields(state.shared.layers || "", panels, state.fields),
    ...f16DerivedFields(panels),
    "f3.reportNumber": f3ReportNumber(state.shared.cocNumber || ""),
    "f2.reportNumber": f2ReportNumber(state.shared.cocNumber || ""),
    "f7.reportNumber": f7ReportNumber(state.shared.cocNumber || ""),  
    "f6.acceptedPanels": String(f6AcceptedPanelLabels(f2).length || ""),
  };

  let tables = state.tables;
  if (isClaudeF3Checklist(tables["f3.checklist"])) {
tables = {
  ...tables,
  "f3.checklist": withDerivedF3Rows(
    tables["f3.checklist"],
    f2,
    spec,
    state.shared.layers || "",
    state.fields["f1.impedanceControl"] || "",
    state.shared.viaProtection || "",
    state.shared.solderMask || "",
    state.shared.cocNumber || "",
    state.fields["f1.productionOrder"] || "",
    state.fields["f6.testedDate"] || "",
    state.shared.legendPrint || "",
  ),
};
  }
  if (tables["f6.structural"]?.length) {
    tables = { ...tables, "f6.structural": withDerivedF6Rows(tables["f6.structural"], state.shared.layers || "", state.shared.viaProtection || "", state.shared.backDrilling || "") };
  }
  if (tables["f7.characteristics"]?.length) {
    tables = {
      ...tables,
      "f7.characteristics": withDerivedF7Rows(tables["f7.characteristics"], spec, state.shared.regulatoryRequirement || "", state.shared.layers || ""),
    };
  }
  if (tables["f15.results"]?.length) {
    tables = {
      ...tables,
      "f15.results": withDerivedF15Rows(tables["f15.results"], fields["f15.pth"] === "No", fields["f15.smtLand"] === "No", state.shared.layers || ""),
    };
  }
  if (tables["f16.results"]?.length) {
    tables = { ...tables, "f16.results": withDerivedF16Rows(tables["f16.results"], state.shared.layers || "", state.shared.solderMask || "", state.shared.legendPrint || "", tables["f3.checklist"]) };
  }

  const batchCode = derivedBatchCode(state, f2);

  if (!hasSerialSource) {
    return { ...state, f2, fields, tables, shared: { ...state.shared, batchCode } };
  }
  const derived = derivedF2Fields(f2, spec);
  return {
    ...state,
    f2,
    shared: {
      ...state.shared,
      supplyForm: derived.supplyForm,
      weekCode: derived.weekCode || state.shared.weekCode || "",
      batchCode,
    },
    fields: {
      ...fields,
      "f2.suppliedSerials": derived.suppliedSerials,
      "f2.stockSerials": derived.stockSerials,
    },
    tables: {
      ...tables,
      "f2.suppliedXout": derived.suppliedXout,
      "f2.stockXout": derived.stockXout,
    },
  };
}

function applyFormConditions(state: ReportState): ReportState {
  const spec = resolveF4Spec(
    state.shared.specification || "",
    state.shared.regulatoryRequirement || "",
  );
  const paramsKey = "f4.params";
  const params = state.tables[paramsKey];
  let tables = state.tables;
  if (params?.length) {
    tables = {
      ...tables,
      [paramsKey]: params.map((row) => {
        if (String(row.value || "").trim()) return row;
        const test = row.test || "";
        if (/test voltage/i.test(test)) return { ...row, value: "250 V" };
        const next = f4ValueFor(test, spec);
        return next ? { ...row, value: next } : row;
      }),
    };
  }

  const auto = f15AutoFromFinish(state.shared.boardFinish || "", state.shared.regulatoryRequirement || "");
  const f2 = mergeF2State(state.f2, productionOrdersFrom(state));
  const panels = acceptedPanelsTotal(f2);
  let fields: Record<string, string> = {
    ...f4FillDefaults(state.fields, state.shared.specification || "", state.shared.regulatoryRequirement || ""),
    ...f15DerivedFields(state.shared.layers || "", panels, state.fields),
    ...f16DerivedFields(panels),
    "f3.reportNumber": f3ReportNumber(state.shared.cocNumber || ""),
    "f2.reportNumber": f2ReportNumber(state.shared.cocNumber || ""),
    "f7.reportNumber": f7ReportNumber(state.shared.cocNumber || ""),
    "f6.acceptedPanels": String(f6AcceptedPanelLabels(f2).length || ""),
  };
  if (auto) {
    fields = {
      ...fields,
      "f15.durability": auto.durability,
      "f15.solder": auto.solder,
    };
  }

  const results = tables["f15.results"];
  if (results?.length) {
    const pthNo = fields["f15.pth"] === "No";
    const smtNo = fields["f15.smtLand"] === "No";
    tables = { ...tables, "f15.results": withDerivedF15Rows(results, pthNo, smtNo, state.shared.layers || "") };
  }

  if (tables["f6.structural"]?.length) {
    tables = { ...tables, "f6.structural": withDerivedF6Rows(tables["f6.structural"], state.shared.layers || "", state.shared.viaProtection || "", state.shared.backDrilling || "") };
  }
  if (tables["f7.characteristics"]?.length) {
    tables = {
      ...tables,
      "f7.characteristics": withDerivedF7Rows(
        tables["f7.characteristics"],
        state.shared.specification || "",
        state.shared.regulatoryRequirement || "",
        state.shared.layers || "",
      ),
    };
  }
  if (isClaudeF3Checklist(tables["f3.checklist"])) {
    tables = {
      ...tables,
      "f3.checklist": withDerivedF3Rows(tables["f3.checklist"], f2, state.shared.specification || "", state.shared.layers || "", state.fields["f1.impedanceControl"] || "", state.shared.viaProtection || "", state.shared.solderMask || "", state.shared.cocNumber || "",   state.fields["f1.productionOrder"] || "",
  state.fields["f6.testedDate"] || "",state.shared.legendPrint || ""),
    };
  }
  if (tables["f16.results"]?.length) {
    tables = { ...tables, "f16.results": withDerivedF16Rows(tables["f16.results"], state.shared.layers || "", state.shared.solderMask || "", state.shared.legendPrint || "", tables["f3.checklist"]) };
  }

  return { ...state, tables, fields };
}

const STORAGE_KEY = "hiq-coc-draft-v1";

export function readStoredDraft(): Partial<ReportState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReportState>;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearStoredDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function initialState(): ReportState {
  const shared: Record<string, string> = {};
  const fields: Record<string, string> = {};
  const tables: Record<string, Row[]> = {};
  for (const report of REPORTS) {
    for (const section of report.sections) {
      if (section.kind === "table") {
        tables[`${report.id}.${section.key}`] = section.rows.map((r) => ({ ...r }));
      } else if (section.kind === "fields" || section.kind === "signoff") {
        const sectionFields = section.kind === "signoff" ? signoffFields(section) : section.fields;
        for (const f of sectionFields) {
          if (f.default === undefined) continue;
          if (f.shared) {
            if (shared[f.shared] === undefined) shared[f.shared] = f.default;
          } else {
            fields[`${report.id}.${f.key}`] = f.default;
          }
        }
      }
    }
  }
  return withDerivedF2({ shared, fields, tables, f2: defaultF2State() });
}

export function ReportProvider({
  children,
  initial,
  applyConditions = false,
  persistDraft = true,
  status,
}: {
  children: ReactNode;
  initial?: Partial<ReportState> | null;
  applyConditions?: boolean;
  persistDraft?: boolean;
  status?: string | null;
}) {
  const [state, setState] = useState<ReportState>(() => {
    if (!initial) return initialState();
    const base = initialState();
    const merged = withDerivedF2({
      shared: { ...base.shared, ...(initial.shared || {}) },
      fields: { ...base.fields, ...(initial.fields || {}) },
      tables: { ...base.tables, ...(initial.tables || {}) },
      combinedProductionOrders: initial.combinedProductionOrders,
      received: initial.received,
      f2: mergeF2State(
        initial.f2,
        initial.combinedProductionOrders ||
          (initial.fields?.["f1.productionOrder"] ? [initial.fields["f1.productionOrder"]] : []),
      ),
    });
    return applyConditions ? applyFormConditions(merged) : merged;
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !persistDraft) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* quota */
      }
    }, 800);
    return () => clearTimeout(t);
  }, [state, hydrated, persistDraft]);

  const stage = normalizeReportStatus(status);

  const getField = useCallback(
    (reportId: string, field: Field) => {
      if (reportId === "f3" && field.key === "reportNumber") {
        return f3ReportNumber(state.shared.cocNumber || "");
      }
      if (reportId === "f2" && field.key === "reportNumber") {
        return f2ReportNumber(state.shared.cocNumber || "");
      }
      if (reportId === "f7" && field.key === "reportNumber") {
        return f7ReportNumber(state.shared.cocNumber || "");
      }
      if (reportId === "f6" && field.key === "acceptedPanels") {
        const f2 = mergeF2State(state.f2, productionOrdersFrom(state));
        const n = f6AcceptedPanelLabels(f2).length;
        return n ? String(n) : "";
      }
      if (reportId === "f1" && field.key === "rohs") {
      return f1RohsFromBoardFinish(state.shared.boardFinish || "");
      }
      if (reportId === "f1" && field.key === "ulMark") {
        return normalizeUlMark(state.fields["f1.ulMark"] || "");
      }
      if (reportId === "f1" && field.key === "approvedBy") {
        return stage === "approved" ? F1_APPROVED_BY : "";
      }
      if (reportId === "f1" && field.key === "designation") {
        return stage === "approved" ? F1_APPROVED_DESIG : "";
      }
      return (field.shared ? state.shared[field.shared] : state.fields[`${reportId}.${field.key}`]) ?? "";
    },
    [stage, state],
  );

  const setField = useCallback((reportId: string, field: Field, value: string) => {
    if (stage !== "in-progress") return;
    if (field.key === "reportNumber" && (reportId === "f2" || reportId === "f3" || reportId === "f7")) return;
    if (reportId === "f1") {
      const column = f1SignoffColumnOf(field.key);
      if (column && !f1SignoffFieldEditable(stage, column, field.key)) return;
    }
    setState((s) => {
      const next = field.shared
        ? { ...s, shared: { ...s.shared, [field.shared]: value } }
        : { ...s, fields: { ...s.fields, [`${reportId}.${field.key}`]: value } };
      if (
        field.shared === "specification" ||
        field.shared === "regulatoryRequirement" ||
        field.shared === "boardFinish" ||
        field.shared === "cocNumber" ||
        field.shared === "layers" ||
        field.shared === "viaProtection" ||
        field.shared === "solderMask" ||
        field.shared === "legendPrint" ||
        field.shared === "backDrilling" ||
        field.key === "specification" ||
        field.key === "regulatoryRequirement" ||
        field.key === "boardFinish" ||
        field.key === "layers" ||
        field.key === "smtLand" ||
        field.key === "pth"
      ) {
        return applyFormConditions(next);
      }
      return next;
    });
  }, [stage]);

  const applyCocLookup = useCallback((reportId: string, data: Record<string, string>) => {
    const sharedKeys = [
      "cocNumber",
      "cocDate",
      "customer",
      "customerAddress",
      "partNumber",
      "partRev",
      "poNumber",
      "specification",
      "regulatoryRequirement",
      "material",
      "layers",
      "boardFinish",
      "camNumber",
      "quantity",
      "pcbThickness",
      "viaProtection",
      "solderMask",
      "legendPrint",
      "backDrilling",
      "productionOrder",
    ] as const;
    const localKeys = ["productionOrder", "partNumberPo", "rohs", "ulMark", "impedanceControl"] as const;

    setState((s) => {
      const shared = { ...s.shared };
      const fields = { ...s.fields };

      for (const key of sharedKeys) {
        if (data[key] !== undefined) shared[key] = data[key] ?? "";
      }
      for (const key of localKeys) {
        if (data[key] === undefined) continue;
        const value =
          key === "rohs"
            ? normalizeRohs(data[key] || "")
            : key === "ulMark"
              ? normalizeUlMark(data[key] || "")
              : (data[key] ?? "");
        fields[`${reportId}.${key}`] = value;
        if (key === "rohs") fields["f1.rohs"] = value;
        if (key === "ulMark") fields["f1.ulMark"] = value;
        if (key === "impedanceControl") fields["f1.impedanceControl"] = value;
      }
      const sourceData = f4SourceFromBbt(data.bbtType || data.sourceData || "");
      if (sourceData) fields["f4.sourceData"] = sourceData;
      if (!fields["f5.drawingNo"] && (data.camNumber || shared.camNumber)) {
        fields["f5.drawingNo"] = data.camNumber || shared.camNumber || "";
      }

      let tables = s.tables;
      if (data.pcbThickness) {
        tables = { ...tables, "f5.board": f5ApplyBoardThickness(tables["f5.board"] || [], data.pcbThickness) };
      }

      return withDerivedF2(
        applyFormConditions({
          ...s,
          shared,
          fields,
          tables,
          received: data.received || s.received,
          f2: applyPcbDetailsToF2(mergeF2State(s.f2, productionOrdersFrom({ combinedProductionOrders: s.combinedProductionOrders, fields })), {
            supplyForm: data.supplyForm,
            pcbPerArray: data.pcbPerArray,
            pcbPerPanel: data.pcbPerPanel,
            productionOrder: data.productionOrder,
            launchPanel: data.launchPanel,
          }),
        }),
      );
    });
  }, []);

  const getRows = useCallback(
    (reportId: string, tableKey: string) => state.tables[`${reportId}.${tableKey}`] ?? [],
    [state],
  );

  const setCell = useCallback((reportId: string, tableKey: string, index: number, col: string, value: string) => {
    const id = `${reportId}.${tableKey}`;
    setState((s) => {
      const prev = s.tables[id] ?? [];
      if (index < 0) return s;
      const rows = prev.slice();
      while (rows.length <= index) rows.push({});
      const current = rows[index] || {};
      if (current[col] === value && rows.length === prev.length) return s;
      rows[index] = { ...current, [col]: value };
      const next = { ...s, tables: { ...s.tables, [id]: rows } };
      if (reportId === "f3" && tableKey === "checklist") {
        return withDerivedF2(applyFormConditions(next));
      }
      return next;
    });
  }, []);

  const addRow = useCallback((reportId: string, section: Extract<Section, { kind: "table" }>) => {
    const id = `${reportId}.${section.key}`;
    setState((s) => {
      const rows = s.tables[id] ?? [];
      const blank: Row = {};
      for (const c of section.columns) blank[c.key] = "";
      if (blank["sl"] !== undefined) blank["sl"] = String(rows.length + 1);
      return { ...s, tables: { ...s.tables, [id]: [...rows, blank] } };
    });
  }, []);

  const replaceRows = useCallback((reportId: string, tableKey: string, rows: Row[]) => {
    const id = `${reportId}.${tableKey}`;
    setState((s) => ({ ...s, tables: { ...s.tables, [id]: rows } }));
  }, []);

  const removeRow = useCallback((reportId: string, tableKey: string, index: number) => {
    const id = `${reportId}.${tableKey}`;
    setState((s) => ({ ...s, tables: { ...s.tables, [id]: (s.tables[id] ?? []).filter((_, i) => i !== index) } }));
  }, []);

  const reset = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialState());
  }, []);

  const loadState = useCallback((next: Partial<ReportState>) => {
    const base = initialState();
    setState(
      withDerivedF2({
        shared: { ...base.shared, ...(next.shared || {}) },
        fields: { ...base.fields, ...(next.fields || {}) },
        tables: { ...base.tables, ...(next.tables || {}) },
        combinedProductionOrders: next.combinedProductionOrders,
        received: next.received,
        f2: mergeF2State(next.f2, next.combinedProductionOrders || productionOrdersFrom({
          combinedProductionOrders: next.combinedProductionOrders,
          fields: { ...base.fields, ...(next.fields || {}) },
        })),
      }),
    );
  }, []);

  const updateF2 = useCallback((next: F2State | ((prev: F2State) => F2State)) => {
    setState((s) => {
      const current = mergeF2State(s.f2, productionOrdersFrom(s));
      const f2 = typeof next === "function" ? next(current) : next;
      return withDerivedF2({ ...s, f2 });
    });
  }, []);

  const getSnapshot = useCallback(() => state, [state]);

  const completion = useCallback(
    (report: Report) => {
      const f2State =
       report.id === "f2" ? mergeF2State(state.f2, productionOrdersFrom(state)) : null;
      const spec = state.shared.specification || "";
      const noStockBoards = f2State ? countStock(f2State, spec) === 0 : false;
      const noSuppliedBoards = f2State ? countSupplied(f2State, spec) === 0 : false;
      let total = 0;
      let filled = 0;
      for (const section of report.sections) {
        if (section.kind === "fields") {
          for (const f of section.fields) {
            total++;
const value = getField(report.id, f).trim();
const emptyF2ListHasNoBoards =
  report.id === "f2" &&
  ((f.key === "stockSerials" && noStockBoards) ||
    (f.key === "suppliedSerials" && noSuppliedBoards));

if (value || emptyF2ListHasNoBoards) filled++;
          }
        } else if (section.kind === "signoff") {
          for (const f of signoffFields(section)) {
            if (report.id === "f1") {
              const column = f1SignoffColumnOf(f.key);
              if (column && !f1SignoffFieldCounts(stage, column)) continue;
            }
            total++;
            if (getField(report.id, f).trim()) filled++;
          }
        }
      }
      if (report.id === "f2" && f2State) {
  const rejectedBoards = buildSerials(f2State, spec).filter((row) => row.rejected);
  total += rejectedBoards.length;
  filled += rejectedBoards.filter((row) => row.reason.trim()).length;
}
      return total === 0 ? 1 : filled / total;
    },
    [getField, stage],
  );
  

  const value = useMemo<ReportContextValue>(
    () => ({
      state,
      getField,
      setField,
      applyCocLookup,
      getRows,
      setCell,
      addRow,
      replaceRows,
      removeRow,
      reset,
      loadState,
      getSnapshot,
      completion,
      updateF2,
      stage,
    }),
    [
      state,
      getField,
      setField,
      applyCocLookup,
      getRows,
      setCell,
      addRow,
      replaceRows,
      removeRow,
      reset,
      loadState,
      getSnapshot,
      completion,
      updateF2,
      stage,
    ],
  );

  return <ReportContext.Provider value={value}>{children}</ReportContext.Provider>;
}

export function useReports() {
  const ctx = useContext(ReportContext);
  if (!ctx) throw new Error("useReports must be used inside ReportProvider");
  return ctx;
}
