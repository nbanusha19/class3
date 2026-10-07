import type { ReactNode } from "react";
import { stepStyle } from "@/lib/reports/palette";
import { useReports } from "@/lib/report-store";
import {
  F16_RESULT_OPTS,
  f16LockReason,
  f16Multilayer,
  f16ResultDisplay,
  f16ResultLocked,
} from "@/lib/reports/f16-logic";
import type { Field, Report, Section } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { CollapsiblePanel } from "@/components/report/SectionCollapse";

const inputClass =
  "h-7 w-full rounded-md border border-border bg-transparent px-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-muted-foreground/55 hover:border-primary/45 focus:border-primary focus:bg-field focus:ring-1 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-70";

function HeaderRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="w-[260px] px-3 py-1.5 text-[13px] font-semibold text-ink">{label}</td>
      <td className="px-1.5 py-1">{children}</td>
    </tr>
  );
}

export function F16Form({ report }: { report: Report }) {
  const { state, getField, setField, getRows, setCell } = useReports();
  const fieldsSection = report.sections.find((s): s is Extract<Section, { kind: "fields" }> => s.kind === "fields");
  const tableSection = report.sections.find((s): s is Extract<Section, { kind: "table" }> => s.kind === "table");
  const rows = tableSection ? getRows(report.id, tableSection.key) : [];
  const layers = state.shared.layers || "";
  const solderMask = state.shared.solderMask || "";
  const legendPrint = state.shared.legendPrint || "";
  const f3Rows = getRows("f3", "checklist");
  const multilayer = f16Multilayer(layers);

  function field(key: string, label: string): Field {
    return fieldsSection?.fields.find((f) => f.key === key) || { key, label };
  }

  function value(key: string, label: string) {
    return getField(report.id, field(key, label));
  }

  function set(key: string, label: string, next: string) {
    setField(report.id, field(key, label), next);
  }

  return (
    <div className="space-y-4">
      <section
        style={{ ["--section-accent" as string]: stepStyle(0).color }}
        className="panel panel-accent relative overflow-hidden"
      >
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            <HeaderRow label="No. of Panels in Lot:">
              <input
                className={inputClass}
                placeholder="—"
                value={value("lotPanels", "No. of Panels in Lot")}
                onChange={(e) => set("lotPanels", "No. of Panels in Lot", e.target.value)}
              />
            </HeaderRow>
            <HeaderRow label="AQL:">
              <input className={inputClass} value={value("aql", "AQL") || "AQL 4.0"} onChange={(e) => set("aql", "AQL", e.target.value)} />
            </HeaderRow>
            <HeaderRow label="No. of Panels Tested:">
              <input
                className={inputClass}
                placeholder="—"
                value={value("testedPanels", "No. of Panels Tested")}
                onChange={(e) => set("testedPanels", "No. of Panels Tested", e.target.value)}
              />
            </HeaderRow>
          </tbody>
        </table>
      </section>

      {tableSection ? (
        <CollapsiblePanel
          accent={stepStyle(1).color}
          title={
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {tableSection.title || "Test Result"}
            </p>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-muted/40">
                  <th className="min-w-[150px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Adhesion type
                  </th>
                  <th className="w-[170px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Test method
                  </th>
                  <th className="w-[110px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Test specimen
                  </th>
                  <th className="min-w-[180px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Requirement
                  </th>
                  <th className="min-w-[180px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Observation
                  </th>
                  <th className="w-[110px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const locked = f16ResultLocked(index, layers, solderMask, legendPrint, f3Rows);
                  const result = locked
                    ? "NA"
                    : f16ResultDisplay(
                        multilayer && (row.result === "NA" || row.result === "—" || !row.result) ? "Pass" : row.result || (multilayer ? "Pass" : ""),
                      );
                  const lockTitle = locked ? f16LockReason(index, layers, solderMask, legendPrint, f3Rows) : undefined;
                  return (
                    <tr key={index} className="border-b border-border/60 last:border-0 hover:bg-primary/4">
                      <td className="px-2 py-1.5 text-ink">{row.type}</td>
                      <td className="px-2 py-1.5 text-ink">{row.method}</td>
                      <td className="px-0.5 py-1">
                        <input
                          className={inputClass}
                          placeholder="—"
                          value={row.specimen || ""}
                          disabled={locked}
                          title={lockTitle}
                          onChange={(e) => setCell(report.id, tableSection.key, index, "specimen", e.target.value)}
                        />
                      </td>
                      <td className="px-0.5 py-1">
                        <input
                          className={inputClass}
                          placeholder="—"
                          value={row.requirement || ""}
                          disabled={locked}
                          title={lockTitle}
                          onChange={(e) => setCell(report.id, tableSection.key, index, "requirement", e.target.value)}
                        />
                      </td>
                      <td className="px-0.5 py-1">
                        <input
                          className={inputClass}
                          placeholder="—"
                          value={row.observation || ""}
                          disabled={locked}
                          title={lockTitle}
                          onChange={(e) => setCell(report.id, tableSection.key, index, "observation", e.target.value)}
                        />
                      </td>
                      <td className="px-0.5 py-1">
                        <select
                          className={cn(inputClass, "cursor-pointer appearance-none pr-7")}
                          value={result}
                          disabled={locked}
                          title={lockTitle}
                          onChange={(e) => setCell(report.id, tableSection.key, index, "result", e.target.value === "—" ? "" : e.target.value)}
                        >
                          {F16_RESULT_OPTS.map((opt) => (
                            <option key={opt}>{opt}</option>
                          ))}
                        </select>
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
                    placeholder="—"
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
