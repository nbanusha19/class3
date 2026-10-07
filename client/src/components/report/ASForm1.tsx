import { Plus, Trash2 } from "lucide-react";
import { CollapsiblePanel } from "@/components/report/SectionCollapse";
import { useReports } from "@/lib/report-store";
import { stepStyle } from "@/lib/reports/palette";
import type { Field, Report, Section } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

const inputClass =
  "h-7 w-full rounded-md border border-border bg-transparent px-2.5 text-[12px] text-ink outline-none hover:border-primary/45 focus:border-primary focus:bg-field focus:ring-1 focus:ring-primary/15";

function FieldControl({
  value,
  field,
  onChange,
}: {
  value: string;
  field: Field;
  onChange: (value: string) => void;
}) {
  if (field.type === "textarea") {
    return (
      <textarea
        className={cn(inputClass, "h-16 resize-y py-1.5")}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select
        className={cn(inputClass, "cursor-pointer")}
        value={value || field.default || ""}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select…</option>
        {(field.options || []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      className={inputClass}
      type={field.type === "date" ? "date" : "text"}
      placeholder={field.placeholder || ""}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function gridSpan(field: Field) {
  if (field.span === 3) return "xl:col-span-3";
  if (field.span === 2) return "xl:col-span-2";
  return "";
}

export function ASForm1({ report }: { report: Report }) {
  const { getField, setField, getRows, setCell, addRow, removeRow } = useReports();

  function findField(key: string, label: string): Field {
    for (const section of report.sections) {
      if (section.kind !== "fields") continue;
      const found = section.fields.find((field) => field.key === key);
      if (found) return found;
    }
    return { key, label };
  }

  function renderField(field: Field) {
    const value = getField(report.id, field);

    return (
      <label key={field.key} className={cn("block min-w-0", gridSpan(field))}>
        <span className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          {field.label}
          {field.shared ? (
            <span className="ml-1 rounded bg-primary/10 px-1 text-[8px] text-primary">
              LINKED
            </span>
          ) : null}
        </span>
        <FieldControl
          field={field}
          value={value || field.default || ""}
          onChange={(next) => setField(report.id, field, next)}
        />
      </label>
    );
  }

  function renderFields(
    section: Extract<Section, { kind: "fields" }>,
    index: number,
  ) {
    return (
      <CollapsiblePanel
        key={section.title || index}
        accent={stepStyle(index).color}
        title={
          <span className="text-[11px] font-semibold text-ink">
            {section.title}
          </span>
        }
      >
        <div className="grid grid-cols-1 gap-x-2 gap-y-2 border-t border-border/60 px-3 py-2 sm:grid-cols-2 xl:grid-cols-4">
          {section.fields.map(renderField)}
        </div>
      </CollapsiblePanel>
    );
  }

  function renderIndex(
    section: Extract<Section, { kind: "table" }>,
    index: number,
  ) {
    const rows = getRows(report.id, section.key);

    return (
      <CollapsiblePanel
        key={section.key}
        accent={stepStyle(index).color}
        title={
          <span className="text-[11px] font-semibold text-ink">
            {section.title}
          </span>
        }
        headerExtra={
          <button
            type="button"
            onClick={() => addRow(report.id, section)}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[10px] font-semibold text-primary-foreground"
          >
            <Plus className="size-3" />
            {section.addLabel || "Add row"}
          </button>
        }
      >
        <div className="overflow-x-auto border-t border-border/60">
          <table className="w-full min-w-[760px] table-fixed border-collapse text-[11px]">
            <thead>
              <tr className="bg-muted/30 text-left text-[9px] font-semibold uppercase text-muted-foreground">
                {section.columns.map((column) => (
                  <th key={column.key} className="px-2 py-1.5">
                    {column.label}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex} className="border-t border-border/50">
                  {section.columns.map((column) => (
                    <td key={column.key} className="px-1 py-1">
                      <FieldControl
                        field={{
                          key: column.key,
                          label: column.label,
                          type: column.type,
                          options: column.options,
                          placeholder: column.key === "" ? "Part Type" : undefined,
                        }}
                        value={row[column.key] || ""}
                        onChange={(value) =>
                          setCell(report.id, section.key, rowIndex, column.key, value)
                        }
                      />
                    </td>
                  ))}
                  <td className="px-1 text-center">
                    <button
                      type="button"
                      aria-label="Remove part or sub-assembly"
                      onClick={() => removeRow(report.id, section.key, rowIndex)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsiblePanel>
    );
  }

  return (
    <div className="space-y-2">
      {report.sections.map((section, index) => {
        if (section.kind === "fields") return renderFields(section, index);

        if (section.kind === "note") {
          return (
            <CollapsiblePanel
              key={section.title || index}
              accent={stepStyle(index).color}
              title={
                <span className="text-[11px] font-semibold text-ink">
                  {section.title}
                </span>
              }
            >
              <p className="whitespace-pre-line border-t border-border/60 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
                {section.text}
              </p>
            </CollapsiblePanel>
          );
        }

        if (section.kind === "table") return renderIndex(section, index);

        return (
          <CollapsiblePanel
            key={section.title || index}
            accent={stepStyle(index).color}
            title={
              <span className="text-[11px] font-semibold text-ink">
                {section.title}
              </span>
            }
          >
            <div className="grid gap-2 border-t border-border/60 px-3 py-2 md:grid-cols-3">
              {(section.columns || []).map((column) => (
                <div
                  key={column.title}
                  className="rounded-lg border border-border/70 bg-muted/10 p-2"
                >
                  <p className="mb-2 text-[10px] font-semibold text-primary">
                    {column.title}
                  </p>
                  <div className="space-y-2">
                    {column.fields.map((field) => renderField(field))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsiblePanel>
        );
      })}
    </div>
  );
}