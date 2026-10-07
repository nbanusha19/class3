import { useEffect, useRef } from "react";
import { stepStyle } from "@/lib/reports/palette";
import { useReports } from "@/lib/report-store";
import { lookupCocByProductionOrder } from "@/lib/api";
import {
  F4_RESULT,
  F4_TEST_METHODS,
  f4ApplicableStandard,
  f4ResultRequired,
  f4SourceFromBbt,
} from "@/lib/reports/f4-logic";
import type { Field, Report, Section } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { CollapsiblePanel } from "@/components/report/SectionCollapse";

const inputClass =
  "h-8 w-full rounded-md border border-border bg-transparent px-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-muted-foreground/55 hover:border-primary/45 focus:border-primary focus:ring-1 focus:ring-primary/15";

function F4Select({
  field,
  value,
  options,
  onChange,
}: {
  field: Field;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  const extras = value && !options.includes(value) ? [value] : [];
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {field.label}
      </span>
      <select
        className={cn(inputClass, "cursor-pointer appearance-none pr-7")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{field.placeholder || "Select"}</option>
        {[...options, ...extras].map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function F4Input({
  field,
  value,
  onChange,
  placeholder,
}: {
  field: Field;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {field.label}
      </span>
      <input
        className={inputClass}
        placeholder={placeholder || field.placeholder || ""}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function F4Form({ report }: { report: Report }) {
  const { state, getField, setField, getRows, setCell } = useReports();
  const fieldsSection = report.sections.find((s): s is Extract<Section, { kind: "fields" }> => s.kind === "fields");
  const tableSection = report.sections.find((s): s is Extract<Section, { kind: "table" }> => s.kind === "table");
  const rows = tableSection ? getRows(report.id, tableSection.key) : [];
  const standardDefault = f4ApplicableStandard(state.shared.specification || "");
  const sourceField = fieldsSection?.fields.find((f) => f.key === "sourceData") || {
    key: "sourceData",
    label: "Source data used",
  };
  const productionOrder = (state.fields["f1.productionOrder"] || state.f2?.lines?.[0]?.prod || "").trim();
  const fetchedFor = useRef("");

  useEffect(() => {
    if (!productionOrder) return;
    if (getField("f4", sourceField).trim()) {
      fetchedFor.current = productionOrder;
      return;
    }
    if (fetchedFor.current === productionOrder) return;
    fetchedFor.current = productionOrder;
    void lookupCocByProductionOrder(productionOrder)
      .then((result) => {
        const next = f4SourceFromBbt(result.coc.bbtType || "");
        if (next) setField("f4", sourceField, next);
      })
      .catch(() => {
        fetchedFor.current = "";
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productionOrder]);

  return (
    <div className="space-y-4">
      {fieldsSection ? (
        <section
          style={{ ["--section-accent" as string]: stepStyle(0).color }}
          className="panel panel-accent relative overflow-hidden p-3.5 sm:p-4"
        >
          <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
            {fieldsSection.fields.map((field) => {
              if (field.key === "testMethod") {
                return (
                  <F4Select
                    key={field.key}
                    field={field}
                    options={F4_TEST_METHODS}
                    value={getField(report.id, field)}
                    onChange={(v) => setField(report.id, field, v)}
                  />
                );
              }
              return (
                <F4Input
                  key={field.key}
                  field={field}
                  placeholder={field.key === "standard" ? standardDefault : field.placeholder || ""}
                  value={getField(report.id, field) || (field.key === "standard" ? standardDefault : field.default || "")}
                  onChange={(v) => setField(report.id, field, v)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {tableSection ? (
        <CollapsiblePanel
          accent={stepStyle(1).color}
          title={
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {tableSection.title}
            </p>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-[13px]">
              <thead>
                <tr className="bg-muted/40">
                  {tableSection.columns.map((col) => (
                    <th
                      key={col.key}
                      className="border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                      style={{
                        width:
                          col.key === "sl"
                            ? "52px"
                            : col.key === "value"
                              ? "220px"
                              : col.key === "result"
                                ? "120px"
                                : undefined,
                      }}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const resultExtras = row.result && !F4_RESULT.includes(row.result as (typeof F4_RESULT)[number]) ? [row.result] : [];
                  return (
                    <tr key={row.sl || index} className="border-b border-border/60 last:border-0 hover:bg-primary/4">
                      <td className="px-0.5">
                        <input
                          className={cn(inputClass, "h-7")}
                          value={row.sl || ""}
                          onChange={(e) => setCell(report.id, tableSection.key, index, "sl", e.target.value)}
                        />
                      </td>
                      <td className="px-0.5">
                        <input
                          className={cn(inputClass, "h-7")}
                          value={row.test || ""}
                          onChange={(e) => setCell(report.id, tableSection.key, index, "test", e.target.value)}
                        />
                      </td>
                      <td className="px-0.5">
                        <input
                          className={cn(inputClass, "h-7")}
                          value={row.value || ""}
                          onChange={(e) => setCell(report.id, tableSection.key, index, "value", e.target.value)}
                        />
                      </td>
                     <td className="px-0.5">
  {f4ResultRequired(row.test) ? (
    <select
      className={cn(inputClass, "h-7 cursor-pointer appearance-none pr-7")}
      value={row.result || ""}
      onChange={(e) => setCell(report.id, tableSection.key, index, "result", e.target.value)}
    >
      <option value=""></option>
      {[...F4_RESULT, ...resultExtras].map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  ) : (
    <div
      className="flex h-7 cursor-not-allowed items-center justify-center rounded-md border border-border bg-muted/35 text-destructive"
      title="Result not required"
      aria-label="Result not required"
    >
    </div>
  )}
</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsiblePanel>
      ) : null}

      {report.sections
        .filter((s): s is Extract<Section, { kind: "signoff" }> => s.kind === "signoff")
        .map((section, i) => (
          <section
            key={`signoff-${i}`}
            style={{ ["--section-accent" as string]: stepStyle(2).color }}
            className="panel panel-accent relative overflow-hidden p-3.5 sm:p-4"
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {section.title || "Sign-off"}
            </p>
            <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
              {(section.fields ?? []).map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    {field.label}
                  </span>
                  <input
                    className={inputClass}
                    type={field.type === "date" ? "date" : "text"}
                    placeholder=""
                    value={getField(report.id, field)}
                    onChange={(e) => setField(report.id, field, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </section>
        ))}
    </div>
  );
}
