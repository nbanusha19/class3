import type { ReactNode } from "react";
import { stepStyle } from "@/lib/reports/palette";
import { useReports } from "@/lib/report-store";
import {
  F15_DURABILITY,
  F15_PASS_TEXT,
  F15_RESULT_OPTS,
  F15_YES_NO,
  f15PthLocked,
  f15ResultDisplay,
  f15SmtLocked,
  f15Multilayer,
} from "@/lib/reports/f15-logic";
import type { Field, Report, Section } from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import { CollapsiblePanel } from "@/components/report/SectionCollapse";

const inputClass =
  "h-7 w-full rounded-md border border-border bg-transparent px-2.5 text-[13px] text-ink outline-none transition-colors placeholder:text-muted-foreground/55 hover:border-primary/45 focus:border-primary focus:bg-field focus:ring-1 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-70";

function HeaderRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <tr className="border-b border-border/60 last:border-0">
      <td className="w-[260px] px-3 py-1.5 text-[13px] font-semibold text-ink">{label}</td>
      <td className="px-1.5 py-1">{children}</td>
    </tr>
  );
}

export function F15Form({ report }: { report: Report }) {
  const { state, getField, setField, getRows, setCell } = useReports();
  const fieldsSection = report.sections.find((s): s is Extract<Section, { kind: "fields" }> => s.kind === "fields");
  const tableSection = report.sections.find((s): s is Extract<Section, { kind: "table" }> => s.kind === "table");
  const rows = tableSection ? getRows(report.id, tableSection.key) : [];
  const layers = state.shared.layers || "";
  const smtLocked = f15SmtLocked(layers);
  const pthLocked = f15PthLocked(layers);
  const multilayer = f15Multilayer(layers);

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
            <HeaderRow label="Applicable Standard:">
              <input className={inputClass} value={value("standard", "Applicable Standard") || "J-STD-003"} onChange={(e) => set("standard", "Applicable Standard", e.target.value)} />
            </HeaderRow>
            <HeaderRow label="Coating Durability">
              <select
                className={cn(inputClass, "cursor-pointer appearance-none pr-7")}
                value={value("durability", "Coating Durability") || "Coating Durability A"}
                onChange={(e) => set("durability", "Coating Durability", e.target.value)}
              >
                {F15_DURABILITY.map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            </HeaderRow>
            <HeaderRow label="Solderable Surface mount land Present?">
              <select
                className={cn(inputClass, "cursor-pointer appearance-none pr-7")}
                value={smtLocked ? "No" : value("smtLand", "Solderable SMT land present?") || "Yes"}
                disabled={smtLocked}
                onChange={(e) => set("smtLand", "Solderable SMT land present?", e.target.value)}
              >
                {F15_YES_NO.map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            </HeaderRow>
            <HeaderRow label="Solderable PTH Present?">
              <select
                className={cn(inputClass, "cursor-pointer appearance-none pr-7")}
                value={pthLocked ? "No" : value("pth", "Solderable PTH present?") || "Yes"}
                disabled={pthLocked}
                onChange={(e) => set("pth", "Solderable PTH present?", e.target.value)}
              >
                {F15_YES_NO.map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            </HeaderRow>
            <HeaderRow label="Solder Used:">
              <input className={inputClass} value={value("solder", "Solder Used")} onChange={(e) => set("solder", "Solder Used", e.target.value)} />
            </HeaderRow>
            <HeaderRow label="No. of Panels in Lot:">
              <input className={inputClass} placeholder="—" value={value("lotPanels", "No. of Panels in Lot")} onChange={(e) => set("lotPanels", "No. of Panels in Lot", e.target.value)} />
            </HeaderRow>
            <HeaderRow label="AQL:">
              <input className={inputClass} value={value("aql", "AQL") || "AQL 2.5"} onChange={(e) => set("aql", "AQL", e.target.value)} />
            </HeaderRow>
            <HeaderRow label="No. of Panels Tested:">
              <input className={inputClass} placeholder="—" value={value("testedPanels", "No. of Panels Tested")} onChange={(e) => set("testedPanels", "No. of Panels Tested", e.target.value)} />
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
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="bg-muted/40">
                  <th className="border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Category
                  </th>
                  <th className="w-[130px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Test specimen
                  </th>
                  <th className="min-w-[220px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Requirement
                  </th>
                  <th className="min-w-[220px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Observation
                  </th>
                  <th className="w-[110px] border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const pthNo = pthLocked || value("pth", "Solderable PTH present?") === "No";
                  const smtNo = smtLocked || value("smtLand", "Solderable SMT land present?") === "No";
                  const locked = !multilayer && ((index === 0 && pthNo) || (index === 1 && smtNo));
                  const observation =
                    locked
                      ? "NA"
                      : multilayer && (row.observation === "NA" || !row.observation)
                        ? F15_PASS_TEXT
                        : row.observation || F15_PASS_TEXT;
                  const result = locked
                    ? "NA"
                    : f15ResultDisplay(
                        multilayer && (row.result === "NA" || row.result === "—" || !row.result) ? "Pass" : row.result || "Pass",
                      );
                  return (
                    <tr key={index} className="border-b border-border/60 last:border-0 hover:bg-primary/4">
                      <td className="px-2 py-1.5 font-display text-[12px] font-semibold uppercase tracking-[0.04em] text-ink">
                        {row.category}
                      </td>
                      <td className="px-2 py-1.5 text-ink">{row.specimen}</td>
                      <td className="px-0.5 py-1">
                        <input
                          className={inputClass}
                          placeholder="—"
                          value={row.requirement || ""}
                          onChange={(e) => setCell(report.id, tableSection.key, index, "requirement", e.target.value)}
                        />
                      </td>
                      <td className="px-0.5 py-1">
                        <input
                          className={inputClass}
                          placeholder="—"
                          value={observation}
                          disabled={locked}
                          onChange={(e) => setCell(report.id, tableSection.key, index, "observation", e.target.value)}
                        />
                      </td>
                      <td className="px-0.5 py-1">
                        <select
                          className={cn(inputClass, "cursor-pointer appearance-none pr-7")}
                          value={result}
                          disabled={locked}
                          onChange={(e) => setCell(report.id, tableSection.key, index, "result", e.target.value === "—" ? "" : e.target.value)}
                        >
                          {F15_RESULT_OPTS.map((opt) => (
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
