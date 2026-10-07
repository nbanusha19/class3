import { memo, useCallback, useEffect, useState, useTransition, Fragment } from "react";
import {
  Plus,
  Trash2,
  FileBadge2,
  Building2,
  ClipboardCheck,
  ShieldCheck,
  Info,
  Signature,
  Layers3,
  Images,
  Paperclip,
  Link2,
  type LucideIcon,
} from "lucide-react";
import type { Report, Section, Field, Column } from "@/lib/reports/types";
import { stepStyle } from "@/lib/reports/palette";
import { useReports, type Row } from "@/lib/report-store";
import { lookupCocByProductionOrder, buildCocNumber } from "@/lib/api";
import { pcbTypeOptionsForRegulatory } from "@/lib/reports/pcb-types";
import { cn } from "@/lib/utils";
import { F2Form } from "@/components/report/F2Form";
import { F3Checklist } from "@/components/report/F3Form";
import { F4Form } from "@/components/report/F4Form";
import { F5Form } from "@/components/report/F5Form";
import { F6Form } from "@/components/report/F6Form";
import { F7Form } from "@/components/report/F7Form";
import { F15Form } from "@/components/report/F15Form";
import { F16Form } from "@/components/report/F16Form";
import { isClaudeF3Checklist } from "@/lib/reports/f3-logic";
import { resolveF4Spec, f1SignoffColumnOf, f1SignoffFieldEditable, isNaFieldValue } from "@/lib/reports/form-pack";
import { CollapsiblePanel } from "@/components/report/SectionCollapse";
import { ASForm1 } from "@/components/report/ASForm1";

const fieldInputClass =
  "w-full rounded-lg border border-input/80 bg-field px-2.5 text-[12px] text-ink outline-none shadow-[var(--glass-highlight)] transition-colors duration-150 placeholder:text-muted-foreground/55 hover:border-primary/45 focus:border-primary focus:bg-[color:var(--glass-bg-strong)] focus:ring-2 focus:ring-primary/12 read-only:cursor-default read-only:bg-muted/35 read-only:hover:border-input/80 disabled:cursor-not-allowed disabled:bg-muted/35 disabled:opacity-80 disabled:hover:border-input/80";

const cellInputClass =
  "w-full h-7 rounded-md border border-transparent bg-transparent px-1.5 text-[11px] text-ink outline-none transition-colors hover:border-input focus:border-primary focus:bg-field focus:ring-1 focus:ring-primary/15";

function sectionIcon(title?: string, kind?: string): LucideIcon {
  const t = (title ?? "").toLowerCase();
  if (/customer|company|client|supplier/.test(t)) return Building2;
  if (/photo|image/.test(t)) return Images;
  if (/attach|document/.test(t)) return Paperclip;
  if (/construct|stack|layer|material/.test(t)) return Layers3;
  if (/inspect|check|test|measure/.test(t)) return ClipboardCheck;
  if (/result|conform|comply|accept|conclusion/.test(t)) return ShieldCheck;
  if (/sign|approv|authoris|authoriz/.test(t)) return Signature;
  if (kind === "note") return Info;
  if (kind === "table") return ClipboardCheck;
  if (kind === "signoff") return Signature;
  return FileBadge2;
}

/** Local draft while typing — commits to store on blur (keeps large tables responsive). */
function Control({
  value,
  onChange,
  type,
  options,
  placeholder,
  compact,
  className,
  title,
  readOnly,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: Field["type"] | undefined;
  options?: string[] | undefined;
  placeholder?: string | undefined;
  compact?: boolean | undefined;
  className?: string | undefined;
  title?: string | undefined;
  readOnly?: boolean | undefined;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const cls = cn(compact ? cellInputClass : fieldInputClass, className);

  if (type === "select") {
    return (
      <select
        className={cn(cls, "cursor-pointer appearance-none pr-7")}
        value={value}
        title={title}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options?.filter(Boolean).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }

  if (type === "textarea") {
    return (
      <textarea
        rows={2}
        className={cn(cls, "h-auto resize-y py-1.5 leading-snug")}
        value={draft}
        placeholder={placeholder}
        title={title}
        readOnly={readOnly}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onChange(draft);
        }}
      />
    );
  }

  return (
    <input
      className={cls}
      type={type === "date" ? "date" : type === "number" ? "number" : "text"}
      value={draft}
      placeholder={placeholder}
      title={title}
      readOnly={readOnly && type !== "date"}
      disabled={Boolean(readOnly && type === "date")}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onChange(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function SectionHeading({ title, subtitle, kind }: { title?: string | undefined; subtitle?: string | undefined; kind?: string }) {
  if (!title) return null;
  const Icon = sectionIcon(title, kind);
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-md ring-1"
        style={{
          background: "color-mix(in oklab, var(--section-accent, var(--primary)) 10%, transparent)",
          color: "var(--section-accent, var(--primary))",
          borderColor: "transparent",
          boxShadow: "inset 0 0 0 1px color-mix(in oklab, var(--section-accent, var(--primary)) 18%, transparent)",
        }}
      >
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <h3 className="font-display text-[13px] font-semibold leading-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function LinkedBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/8 px-1.5 py-px text-[8px] font-semibold tracking-normal text-primary ring-1 ring-primary/15">
      <Link2 className="size-2" /> Linked
    </span>
  );
}

function FieldsSection({ report, section, accent }: { report: Report; section: Extract<Section, { kind: "fields" }>; accent: string }) {
  const { getField, setField, applyCocLookup, stage } = useReports();
  const productionOrderLocked =
  report.id === "f1" && (stage === "verification" || stage === "approved");
  const [fetchBusy, setFetchBusy] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const productionOrderField = section.fields.find((f) => f.key === "productionOrder");
  const dateField = section.fields.find((f) => f.key === "date" || f.shared === "cocDate");
  const cocNumberField = section.fields.find((f) => f.key === "cocNumber" || f.shared === "cocNumber");

  const regulatoryValue = getField(report.id, {
    key: "regulatoryRequirement",
    label: "Regulatory Requirement",
    shared: "regulatoryRequirement",
  });
  const pcbTypeOptions = pcbTypeOptionsForRegulatory(regulatoryValue);

  useEffect(() => {
    if (report.id !== "f1") return;
    const refField = { key: "prevCoc", label: "Previous COC Reference" };
    const dateRef = { key: "prevCocDate", label: "Previous COC Date", type: "date" as const };
    if (isNaFieldValue(getField(report.id, refField)) && getField(report.id, dateRef) !== "NA") {
      setField(report.id, dateRef, "NA");
    }
  }, [getField, report.id, setField]);

  const syncCocNumber = useCallback(
    (productionOrder: string, dateValue: string) => {
      if (!cocNumberField) return;
      const next = buildCocNumber(productionOrder, dateValue);
      if (next) setField(report.id, cocNumberField, next);
    },
    [cocNumberField, report.id, setField],
  );

  const fetchByProductionOrder = useCallback(async () => {
    if (!productionOrderField) return;
    const productionOrder = getField(report.id, productionOrderField).trim();
    if (!productionOrder) {
      setFetchError("Enter a production order number.");
      return;
    }

    const cocDate = dateField ? getField(report.id, dateField).trim() : "";

    setFetchBusy(true);
    setFetchError(null);
    try {
      const result = await lookupCocByProductionOrder(productionOrder, cocDate || undefined);
      applyCocLookup(report.id, result.coc);
      // Clear PCB type if it no longer matches the fetched regulatory family.
      const nextOptions = pcbTypeOptionsForRegulatory(result.coc.regulatoryRequirement || "");
      const pcbField = { key: "pcbType", label: "PCB Type" };
      const currentPcb = getField(report.id, pcbField);
      if (currentPcb && !nextOptions.includes(currentPcb)) {
        setField(report.id, pcbField, "");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lookup failed.";
      setFetchError(message);
    } finally {
      setFetchBusy(false);
    }
  }, [applyCocLookup, dateField, getField, productionOrderField, report.id, setField]);

  return (
    <CollapsiblePanel
      accent={accent}
      title={<SectionHeading title={section.title} subtitle={section.subtitle} kind="fields" />}
    >
 <div
  className={cn(
    "grid gap-x-3 gap-y-2.5 px-3.5 pb-3.5 sm:grid-cols-2 sm:px-4 sm:pb-4",
    report.id === "f1" ? "xl:grid-cols-12" : "xl:grid-cols-4",
  )}
>
        {section.fields.map((f) => {
          const isProductionOrder = f.key === "productionOrder";
          const isDate = f.key === "date" || f.shared === "cocDate";
          const isRegulatory = f.key === "regulatoryRequirement" || f.shared === "regulatoryRequirement";
          const isF1Specification = report.id === "f1" && (f.key === "specification" || f.shared === "specification");
          const isPcbType = f.key === "pcbType";
          const isF3ReportNumber = report.id === "f3" && f.key === "reportNumber";
          const isF2ReportNumber = report.id === "f2" && f.key === "reportNumber";
          const isF7ReportNumber = report.id === "f7" && f.key === "reportNumber";
          const isLinkedReportNumber = isF3ReportNumber || isF2ReportNumber || isF7ReportNumber;
          const isPrevCoc = report.id === "f1" && f.key === "prevCoc";
          const isPrevCocDate = report.id === "f1" && f.key === "prevCocDate";
          const prevCocValue = isPrevCoc || isPrevCocDate ? getField(report.id, { key: "prevCoc", label: "Previous COC Reference" }) : "";
          const prevCocIsNa = isNaFieldValue(prevCocValue);
          const fieldOptions = isPcbType ? pcbTypeOptions : f.options;
          return (
            <div
              key={f.key}
              className={cn(
  report.id === "f1" ? "xl:col-span-3" : "",
  f.span === 2 && "sm:col-span-2",
  f.span === 2 && report.id === "f1" && "xl:col-span-6",
  f.span === 3 && "sm:col-span-2",
  f.span === 3 && (report.id === "f1" ? "xl:col-span-9" : "xl:col-span-3"),
  isProductionOrder && "sm:col-span-2 xl:col-span-2",
  isProductionOrder && report.id === "f1" && "xl:col-span-6",
  isPcbType && "sm:col-span-2 xl:col-span-2",
  isPcbType && report.id === "f1" && "xl:col-span-3",
)}
            >
              <label className="label-eyebrow mb-1 flex items-center gap-1.5">
                {f.label}
                {(f.shared || isLinkedReportNumber) && <LinkedBadge />}
              </label>
              {isProductionOrder ? (
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <Control
  value={getField(report.id, f)}
  readOnly={productionOrderLocked}
  onChange={(v) => {
    if (productionOrderLocked) return;
    setField(report.id, f, v);
    const dateValue = dateField ? getField(report.id, dateField) : "";
    syncCocNumber(v, dateValue);
  }}
  type={f.type}
  options={f.options}
  placeholder={f.placeholder ?? "Enter traveler / production order"}
/>
                  </div>
                  <button
                    type="button"
                    disabled={fetchBusy}
                    onClick={() => {
  if (!productionOrderLocked) void fetchByProductionOrder();
}}
                    className="inline-flex h-[38px] shrink-0 items-center justify-center rounded-lg bg-primary px-3.5 text-[12px] font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-70"
                  >
                    {fetchBusy ? "Fetching…" : "Fetch"}
                  </button>
                </div>
              ) : (
                <Control
                  value={
                    isF1Specification
                      ? getField(report.id, f)
                      : isPrevCocDate && prevCocIsNa
                        ? "NA"
                        : getField(report.id, f)
                  }
                  onChange={(v) => {
                    setField(report.id, f, v);
                    if (isDate && productionOrderField) {
                      syncCocNumber(getField(report.id, productionOrderField), v);
                    }
                    if (isPrevCoc) {
                      const dateFieldRef = { key: "prevCocDate", label: "Previous COC Date", type: "date" as const };
                      if (isNaFieldValue(v)) setField(report.id, dateFieldRef, "NA");
                      else if (isNaFieldValue(getField(report.id, dateFieldRef))) setField(report.id, dateFieldRef, "");
                    }
                    if (isRegulatory) {
                      const nextOptions = pcbTypeOptionsForRegulatory(v);
                      const pcbField = { key: "pcbType", label: "PCB Type" };
                      const currentPcb = getField(report.id, pcbField);
                      if (currentPcb && !nextOptions.includes(currentPcb)) {
                        setField(report.id, pcbField, "");
                      }
                    }
                  }}
                  type={isPrevCocDate && (prevCocIsNa || isNaFieldValue(getField(report.id, f))) ? "text" : f.type}
                  options={fieldOptions}
                  // readOnly={isLinkedReportNumber || (report.id === "f1" && f.key === "rohs")}
                  title={
                    isLinkedReportNumber
                      ? "Bound to F1 COC number"
                      : undefined
                  }
                  placeholder={
                    isPcbType && !fieldOptions?.length
                      ? "Set regulatory requirement (IPC-6012 / 6013 / 6018) first"
                      : f.placeholder
                  }
                />
              )}
              {isProductionOrder && fetchError ? (
                <p className="mt-1 text-[11px] font-medium text-destructive">{fetchError}</p>
              ) : null}
            </div>
          );
        })}
      </div>
    </CollapsiblePanel>
  );
}

function f5ActualOutOfTol(row: Row): boolean {
  const raw = row.actual ?? "";
  const actual = parseFloat(raw);
  if (raw.trim() === "" || Number.isNaN(actual)) return false;
  const req = row.requirement || "";
  if (/bow/i.test(req)) {
    const limit = parseFloat(req.replace(/[^\d.]/g, ""));
    return !Number.isNaN(limit) && actual > limit;
  }
  const nominal = parseFloat(req);
  if (Number.isNaN(nominal)) return false;
  const plus = parseFloat(row.tolPlus || "") || 0;
  const minus = parseFloat(row.tolMinus || "") || 0;
  return actual < nominal - minus || actual > nominal + plus;
}

const TableDataRow = memo(function TableDataRow({
  row,
  index,
  columns,
  fixed,
  onCell,
  onRemove,
  voltageOptions,
  warnActual,
}: {
  row: Row;
  index: number;
  columns: Column[];
  fixed?: boolean;
  onCell: (index: number, col: string, value: string) => void;
  onRemove: (index: number) => void;
  voltageOptions?: string[];
  warnActual?: boolean;
}) {
  return (
    <tr className="border-b border-border/60 last:border-0 hover:bg-primary/4">
      {columns.map((c) => {
        const isVoltage =
          c.key === "value" && !!voltageOptions?.length && /test voltage/i.test(row.test || "");
        const warn = warnActual && c.key === "actual";
        return (
          <td key={c.key} className="px-0.5 align-middle">
            {isVoltage ? (
              <select
                className={cn(cellInputClass, "cursor-pointer appearance-none pr-7")}
                value={row[c.key] || "250 V"}
                onChange={(e) => onCell(index, c.key, e.target.value)}
              >
                {voltageOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : c.readonly || row[`__ro_${c.key}`] === "1" ? (
              <div className="px-1.5 py-1.5 text-[11px] leading-snug text-ink">{row[c.key] || "—"}</div>
            ) : (
              <Control
                compact
                value={row[c.key] ?? ""}
                onChange={(v) => onCell(index, c.key, v)}
                type={c.type}
                options={c.options}
                className={warn ? "border-[#c0392b] bg-[#fdeaea] font-semibold text-[#c0392b]" : undefined}
                title={warn ? "Must be within the stated requirement / tolerance" : undefined}
              />
            )}
          </td>
        );
      })}
      {!fixed && (
        <td className="px-0.5 text-center align-middle">
          <button
            onClick={() => onRemove(index)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label="Remove row"
          >
            <Trash2 className="size-3" />
          </button>
        </td>
      )}
    </tr>
  );
});

function TableSection({ report, section, accent }: { report: Report; section: Extract<Section, { kind: "table" }>; accent: string }) {
  const { getRows, setCell, addRow, removeRow, state } = useReports();
  const rows = getRows(report.id, section.key);
  const totalWeight = section.columns.reduce((a, c) => a + (c.width ?? 1), 0);
  const f4Spec =
    report.id === "f4"
      ? resolveF4Spec(state.shared.specification || "", state.shared.regulatoryRequirement || "")
      : "";
  const voltageOptions = f4Spec === "IPC-9252B" ? ["40 V", "250 V"] : undefined;

  const onCell = useCallback(
    (index: number, col: string, value: string) => setCell(report.id, section.key, index, col, value),
    [report.id, section.key, setCell],
  );
  const onRemove = useCallback(
    (index: number) => removeRow(report.id, section.key, index),
    [report.id, section.key, removeRow],
  );

  return (
    <CollapsiblePanel
      accent={accent}
      title={<SectionHeading title={section.title} subtitle={section.subtitle} kind="table" />}
      headerExtra={
        !section.fixed ? (
          <button
            onClick={() => addRow(report.id, section)}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground shadow-[0_6px_16px_-10px_var(--primary)] transition-all duration-200 hover:-translate-y-px hover:brightness-110 active:translate-y-0"
          >
            <Plus className="size-3.5" /> {section.addLabel ?? "Add row"}
          </button>
        ) : null
      }
    >
      <div className="scrollbar-slim overflow-x-auto">
        <table className="w-full min-w-[1180px] table-fixed border-collapse text-[12px]">
          <thead>
            <tr className="bg-muted/40">
              {section.columns.map((c: Column) => (
                <th
                  key={c.key}
                  className="border-b border-border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground"
                  style={{ width: `${((c.width ?? 1) / totalWeight) * 100}%` }}
                >
                  {c.label}
                </th>
              ))}
              {!section.fixed && <th className="w-8 border-b border-border" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) =>
              row["__group"] ? (
                <tr key={`g-${i}`}>
                  <td
                    colSpan={section.columns.length + (section.fixed ? 0 : 1)}
                    className="bg-primary/6 px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-primary"
                  >
                    {row["__group"]}
                  </td>
                </tr>
              ) : (
                <TableDataRow
                  key={`r-${i}`}
                  row={row}
                  index={i}
                  columns={section.columns}
                  fixed={section.fixed}
                  onCell={onCell}
                  onRemove={onRemove}
                  voltageOptions={voltageOptions}
                  warnActual={report.id === "f5" && f5ActualOutOfTol(row)}
                />
              ),
            )}
          </tbody>
        </table>
      </div>
    </CollapsiblePanel>
  );
}

function NoteSection({ section, accent }: { section: Extract<Section, { kind: "note" }>; accent: string }) {
  return (
    <CollapsiblePanel accent={accent} title={<SectionHeading title={section.title} kind="note" />}>
      <p className="whitespace-pre-line px-3.5 pb-3.5 text-[12px] leading-relaxed text-muted-foreground sm:px-4 sm:pb-4">{section.text}</p>
    </CollapsiblePanel>
  );
}

function SignoffSection({ report, section, accent }: { report: Report; section: Extract<Section, { kind: "signoff" }>; accent: string }) {
  const { getField, setField, stage } = useReports();

  if (section.columns?.length) {
    return (
      <CollapsiblePanel accent={accent} title={<SectionHeading title={section.title} kind="signoff" />}>
        <div className="grid gap-3 px-3.5 pb-3.5 sm:grid-cols-3 sm:px-4 sm:pb-4">
          {section.columns.map((col) => {
            const column = f1SignoffColumnOf(col.title);
            const columnActive =
              report.id !== "f1" ||
              !column ||
              (column === "inspected" && stage === "in-progress") ||
              (column === "verified" && stage === "verification") ||
              (column === "approved" && stage === "approved");
            return (
              <div
                key={col.title}
                className={cn("rounded-lg border border-border/70 bg-field/40 p-3", !columnActive && "opacity-70")}
              >
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">{col.title}</p>
                <div className="space-y-2.5">
                  {col.fields.map((f) => {
                    const frozen = report.id === "f1" && column ? !f1SignoffFieldEditable(stage, column, f.key) : false;
                    return (
                      <div key={f.key}>
                        <label className="label-eyebrow mb-1 block">{f.label}</label>
                        <Control
                          value={getField(report.id, f)}
                          onChange={(v) => {
                            if (frozen) return;
                            setField(report.id, f, v);
                          }}
                          type={f.type}
                          options={f.options}
                          readOnly={frozen}
                          title={frozen ? "Locked for this stage" : undefined}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </CollapsiblePanel>
    );
  }

  return (
    <CollapsiblePanel accent={accent} title={<SectionHeading title={section.title} kind="signoff" />}>
      <div className="grid gap-x-3 gap-y-2.5 px-3.5 pb-3.5 sm:grid-cols-2 sm:px-4 sm:pb-4 xl:grid-cols-4">
        {(section.fields ?? []).map((f) => (
          <div key={f.key}>
            <label className="label-eyebrow mb-1 block">{f.label}</label>
            <Control value={getField(report.id, f)} onChange={(v) => setField(report.id, f, v)} type={f.type} options={f.options} />
          </div>
        ))}
      </div>
    </CollapsiblePanel>
  );
}

function ReportSections({ report }: { report: Report }) {
  const { getRows } = useReports();
  if (report.id === "f2") return <F2Form report={report} />;
  if (report.id === "f4") return <F4Form report={report} />;
  if (report.id === "f5") return <F5Form report={report} />;
  if (report.id === "f6") return <F6Form report={report} />;
  if (report.id === "f7") return <F7Form report={report} />;
  if (report.id === "f15") return <F15Form report={report} />;
  if (report.id === "f16") return <F16Form report={report} />;
  if (report.id === "as-f1") return <ASForm1 report={report} />;
  const f3Claude = report.id === "f3" && isClaudeF3Checklist(getRows("f3", "checklist"));
  return (
    <div className="space-y-3">
      {report.sections.map((section, i) => {
        const accent = stepStyle(i).color;
        if (section.kind === "fields") {
          return (
            <Fragment key={i}>
              <FieldsSection report={report} section={section} accent={accent} />
            </Fragment>
          );
        }
        if (section.kind === "table") {
          if (f3Claude && section.key === "checklist") {
            return <F3Checklist key={i} />;
          }
          return <TableSection key={i} report={report} section={section} accent={accent} />;
        }
        if (section.kind === "note") return <NoteSection key={i} section={section} accent={accent} />;
        return <SignoffSection key={i} report={report} section={section} accent={accent} />;
      })}
    </div>
  );
}

/** Defer heavy sheet mounts so navigation stays responsive. */
export function ReportForm({ report }: { report: Report }) {
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useState(report);

  useEffect(() => {
    startTransition(() => setShown(report));
  }, [report]);

  return (
    <div className={cn(pending && "opacity-70 transition-opacity")}>
      <ReportSections report={shown} />
    </div>
  );
}
