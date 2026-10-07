import { useMemo, useState, useEffect, startTransition, useRef } from "react";
import { Check, ChevronDown, ClipboardCheck, Download, FileDown, Home, Layers, Loader2, Save } from "lucide-react";
import { REPORTS } from "@/lib/reports/schema";
import { ReportProvider, useReports, readStoredDraft, clearStoredDraft } from "@/lib/report-store";
import { ReportForm } from "@/components/report/ReportForm";
import { CertificateNavigator } from "@/components/report/CertificateNavigator";
import { exportAll, exportReport } from "@/lib/pdf-export";
import type { PdfTemplateId } from "@/lib/pdf/types";
import { TemplateSelector } from "@/components/pdf/TemplateSelector";
import { ThemeSwitcher } from "@/components/report/ThemeSwitcher";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { UserMenu } from "@/components/auth/UserMenu";
import { HiQMark } from "@/components/brand/HiQMark";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { toast } from "sonner";
import {
  ApiError,
  acquireReportLock,
  createSavedReport,
  getSavedReport,
  heartbeatReportLocks,
  lookupCocByProductionOrder,
  releaseReportLocks,
  updateSavedReport,
  type CocLookup,
  type SavedReport,
  type WorkloadRow,
} from "@/lib/api";
import {
  formsCaption,
  formDisabledReason,
  formsDisabledByLayers,
  normalizeReportStatus,
  normalizeRohs,
  normalizeUlMark,
  reportsForRegulatory,
  suiteTypeForRegulatory,
  F1_APPROVED_BY,
  F1_APPROVED_DESIG,
} from "@/lib/reports/form-pack";
import { f4SourceFromBbt } from "@/lib/reports/f4-logic";
import { f3CleanlinessUploadMissing, f3ImpedanceUploadMissing, f3ReportNumber } from "@/lib/reports/f3-logic";
import { applyPcbDetailsToF2, defaultF2State, f2ReportNumber } from "@/lib/reports/f2-logic";
import { f7ReportNumber } from "@/lib/reports/f7-logic";
import { editorFormId, readAppRoute, writeAppRoute } from "@/lib/app-route";
import { cn } from "@/lib/utils";

const PCB_TYPES = [
  { id: "rigid", label: "Rigid PCB" },
  { id: "flex", label: "Flex PCB" },
  { id: "rigid-flex", label: "Rigid-Flex PCB" },
  { id: "hdi", label: "HDI PCB" },
  { id: "rf", label: "RF PCB" },
  { id: "military", label: "Military PCB" },
  { id: "medical", label: "Medical PCB" },
] as const;

type WorkspaceProps = {
  reportId: string | null;
  pcbType: string;
  status: string;
  initialFormId?: string;
  onPcbTypeChange: (value: string) => void;
  onSaved: (id: string, status: string) => void;
  onBack: () => void;
};

function ProgressChip({
  label,
  pct,
  variant,
  icon: Icon,
}: {
  label: string;
  pct: number;
  variant: "header" | "page";
  icon: typeof Layers;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  const header = variant === "header";
  const done = clamped >= 100;
  const r = 11.25;
  const c = 2 * Math.PI * r;
  return (
    <span
      title={`${label}: ${clamped}% complete`}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full pl-1 pr-2.5",
        header
          ? "bg-header-foreground/12 text-header-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.18)]"
          : "border border-primary/20 bg-[color:var(--glass-bg-strong)] text-ink shadow-[var(--shadow-card)] backdrop-blur-md",
      )}
    >
      <span
        className={cn(
          "relative grid size-6 place-items-center",
          header ? "text-header-foreground" : done ? "text-emerald-600" : "text-primary",
        )}
      >
        <svg viewBox="0 0 28 28" className="size-6 -rotate-90" aria-hidden>
          <circle
            cx="14"
            cy="14"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            className={header ? "opacity-25" : "opacity-15"}
          />
          <circle
            cx="14"
            cy="14"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - clamped / 100)}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center">
          {done ? <Check className="size-3" strokeWidth={2.75} /> : <Icon className="size-3" strokeWidth={2.25} />}
        </span>
      </span>
      <span className="min-w-[2.4ch] text-right text-[13px] font-semibold tabular-nums tracking-tight">{clamped}%</span>
      <span
        className={cn(
          "h-1.5 w-12 overflow-hidden rounded-full sm:w-16",
          header ? "bg-header-foreground/25" : "bg-primary/15",
        )}
      >
        <span
          className={cn(
            "block h-full rounded-full transition-[width] duration-500 ease-out",
            header ? "bg-header-foreground" : done ? "bg-emerald-500" : "bg-primary",
          )}
          style={{ width: `${clamped}%` }}
        />
      </span>
    </span>
  );
}

function payloadFromLots(lots: WorkloadRow[], coc: CocLookup | null): SavedReport["payload"] {
  const first = lots[0];
  const combined = lots.map((lot) => lot.productionOrder).filter(Boolean);
  const qty = String(lots.reduce((total, lot) => total + (Number(lot.qty) || 0), 0) || coc?.quantity || "");
  const cam = [...new Set(lots.map((lot) => lot.camNumber).filter(Boolean))].join(" + ") || coc?.camNumber || "";
  const regulatory = coc?.regulatoryRequirement || first?.regulatoryRequirement || "";
  const specification = coc?.specification || first?.specification || "";
  return {
    shared: {
      cocNumber: coc?.cocNumber || "",
      cocDate: coc?.cocDate || "",
      customer: coc?.customer || first?.customer || "",
      customerAddress: coc?.customerAddress || "",
      partNumber: coc?.partNumber || first?.partNumber || "",
      partRev: coc?.partRev || "",
      poNumber: coc?.poNumber || first?.poNumber || "",
      specification,
      regulatoryRequirement: regulatory,
      material: coc?.material || "",
      layers: coc?.layers || "",
      boardFinish: coc?.boardFinish || "",
      camNumber: cam,
      quantity: qty,
      batchCode: combined.join(", "),
      pcbThickness: coc?.pcbThickness || "",
      viaProtection: coc?.viaProtection || "",
      solderMask: coc?.solderMask || "",
      legendPrint: coc?.legendPrint || "",
      backDrilling: coc?.backDrilling || "",
    },
    fields: {
      "f1.productionOrder": combined[0] || coc?.productionOrder || first?.productionOrder || "",
      "f1.partNumberPo": coc?.partNumberPo || "",
      "f1.rohs": normalizeRohs(coc?.rohs || ""),
      "f1.ulMark": normalizeUlMark(coc?.ulMark || ""),
      "f1.impedanceControl": coc?.impedanceControl || "",
      "f4.sourceData": f4SourceFromBbt(coc?.bbtType || ""),
      "f3.reportNumber": f3ReportNumber(coc?.cocNumber || ""),
      "f2.reportNumber": f2ReportNumber(coc?.cocNumber || ""),
      "f7.reportNumber": f7ReportNumber(coc?.cocNumber || ""),
      "f5.drawingNo": cam,
    },
    pcbSuiteType: suiteTypeForRegulatory(regulatory),
    combinedProductionOrders: combined,
    received: first?.received || coc?.received || "",
    f2: (() => {
      let f2 = applyPcbDetailsToF2(defaultF2State(combined), {
        supplyForm: coc?.supplyForm,
        pcbPerArray: coc?.pcbPerArray,
        pcbPerPanel: coc?.pcbPerPanel,
      });
      lots.forEach((lot, index) => {
        const launch = lot.launchPanel || (index === 0 ? coc?.launchPanel : "") || "";
        if (lot.productionOrder && launch) {
          f2 = applyPcbDetailsToF2(f2, { productionOrder: lot.productionOrder, launchPanel: launch });
        }
      });
      return f2;
    })(),
  };
}

function Workspace({ reportId, pcbType, status, initialFormId, onPcbTypeChange, onSaved, onBack }: WorkspaceProps) {
  const [activeId, setActiveId] = useState(initialFormId || REPORTS[0]!.id);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);
  const [exportMode, setExportMode] = useState<"one" | "all" | null>(null);
  const [exporting, setExporting] = useState(false);
  const { completion, getField, getRows, getSnapshot, state } = useReports();
  const regulatory = getField("f1", {
    key: "regulatoryRequirement",
    label: "Regulatory Requirement",
    shared: "regulatoryRequirement",
  });
  const visibleReports = useMemo(() => reportsForRegulatory(regulatory), [regulatory]);
  const layers = getField("f1", { key: "layers", label: "No. of Layers", shared: "layers" });
  const disabledForms = useMemo(() => formsDisabledByLayers(layers), [layers]);
  const report = useMemo(
    () => visibleReports.find((r) => r.id === activeId) || visibleReports[0] || REPORTS[0]!,
    [activeId, visibleReports],
  );
  const src = { getField, getRows, f2: state.f2, reportId };
  const stage = normalizeReportStatus(status);
  const readOnly = stage === "verification" || stage === "approved";
  const formPct = Math.round(completion(report) * 100);
  const overallPct = useMemo(() => {
    const applicable = visibleReports.filter((item) => !disabledForms.has(item.id));
    if (!applicable.length) return 0;
    const sum = applicable.reduce((total, item) => total + completion(item), 0);
    return Math.round((sum / applicable.length) * 100);
  }, [completion, disabledForms, visibleReports]);

  useEffect(() => {
    if (!visibleReports.some((item) => item.id === activeId) && visibleReports[0]) {
      setActiveId(visibleReports[0].id);
      return;
    }
    if (disabledForms.has(activeId)) {
      const fallback = visibleReports.find((item) => !disabledForms.has(item.id));
      if (fallback) setActiveId(fallback.id);
    }
  }, [activeId, disabledForms, visibleReports]);

  useEffect(() => {
    const route = readAppRoute();
    if (route.view !== "editor") return;
    writeAppRoute({ ...route, form: activeId }, true);
  }, [activeId]);

  const selectReport = (id: string) => {
  if (disabledForms.has(id) || id === activeId) return;
  if (!readOnly) void persist(status || "in-progress", { autosave: true });
  startTransition(() => setActiveId(id));
  const route = readAppRoute();
  if (route.view === "editor") writeAppRoute({ ...route, form: id }, true);
};

  async function runExport(template: PdfTemplateId) {
    setExporting(true);
    try {
      if (exportMode === "all") {
        await exportAll(
          visibleReports.filter((item) => !disabledForms.has(item.id)),
          src,
          template,
        );
      } else {
        await exportReport(report, src, template);
      }
      } catch (error) {
      console.error("PDF export failed:", error);
      setSaveNote(
        error instanceof Error
          ? `PDF export failed: ${error.message}`
          : "PDF export failed.",
      );
      window.setTimeout(() => setSaveNote(null), 5000);
    } finally {
      setExporting(false);
      setExportMode(null);
    }
  }

  async function persist(nextStatus = status || "in-progress", options?: { autosave?: boolean }) {
    const autosave = Boolean(options?.autosave);
    setSaving(true);
    if (!autosave) setSaveNote(null);
    try {
      if (!autosave && nextStatus === "verification") {
        const impedance = state.fields["f1.impedanceControl"] || "";
        const f3Rows = getRows("f3", "checklist");
        if (f3ImpedanceUploadMissing(f3Rows, impedance)) {
          setSaveNote("F3 sl. 40: upload the impedance report before submitting.");
          window.setTimeout(() => setSaveNote(null), 3500);
          return;
        }
        if (f3CleanlinessUploadMissing(f3Rows, state.shared.solderMask || "")) {
          setSaveNote("F3 sl. 39: upload the cleanliness report before submitting.");
          window.setTimeout(() => setSaveNote(null), 3500);
          return;
        }
      }
      const snapshot = getSnapshot();
      const payload = { ...snapshot, pcbSuiteType: pcbType };
      if (nextStatus === "approved") {
        payload.fields = {
          ...payload.fields,
          "f1.approvedBy": F1_APPROVED_BY,
          "f1.designation": F1_APPROVED_DESIG,
        };
      }
      if (reportId) {
        await updateSavedReport(reportId, payload, nextStatus);
        onSaved(reportId, nextStatus);
        setSaveNote(nextStatus === status ? "Saved" : nextStatus === "verification" ? "Submitted" : "Approved");
      } else {
        const result = await createSavedReport(payload, nextStatus);
        onSaved(result.report.id, nextStatus);
        setSaveNote("Saved");
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message);
      } else {
        setSaveNote(err instanceof Error ? err.message : "Save failed");
      }
    } finally {
      setSaving(false);
      window.setTimeout(() => setSaveNote(null), 2500);
    }
  }

  return (
    <div data-pcb={pcbType} className="theme-transition relative min-h-screen bg-transparent">
      <div className="sticky top-0 z-20">
        <div className="gradient-header relative z-30 border-b border-primary/20 text-header-foreground shadow-[0_8px_30px_-20px_oklch(0.279_0.041_260/0.28)]">
          <header className="flex w-full flex-wrap items-center gap-x-5 gap-y-2 px-6 py-2">
            <button
              type="button"
              onClick={() => {
                void persist(status || "in-progress", { autosave: true }).finally(() => onBack());
              }}
              className="flex min-w-0 items-center gap-2.5 rounded-lg text-left outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-header-foreground/30"
              aria-label="Back to dashboard"
            >
              <HiQMark className="size-8 text-[12px]" />
              <div className="min-w-0 leading-tight">
                <span className="font-display block text-[15px] font-bold tracking-tight text-header-foreground">
                  HI-Q
                </span>
                <span className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-header-foreground/65 sm:block">
                  Quality Documentation Suite
                </span>
              </div>
            </button>

            <div className="h-8 w-px bg-header-foreground/20" />

            <button
              type="button"
              onClick={() => {
                void persist(status || "in-progress", { autosave: true }).finally(() => onBack());
              }}
              title="Home"
              aria-label="Home"
              className="inline-flex size-8 items-center justify-center rounded-lg border border-header-foreground/20 bg-header-foreground/10 text-header-foreground hover:border-header-foreground/40"
            >
              <Home className="size-4" />
            </button>

            <label className="flex items-center gap-2">
              <span className="hidden text-[11px] font-medium uppercase tracking-[0.08em] text-header-foreground/65 lg:block">
                PCB Type
              </span>
              <span className="relative">
                <select
                disabled={readOnly}
                  value={pcbType}
                  onChange={(e) => onPcbTypeChange(e.target.value)}
                  className="h-8 cursor-pointer appearance-none rounded-lg border border-header-foreground/20 bg-header-foreground/10 pl-3 pr-8 text-[13px] font-medium text-header-foreground outline-none backdrop-blur-md transition-colors hover:border-header-foreground/40 focus:border-header-foreground/60 focus:ring-2 focus:ring-header-foreground/15 [&>option]:text-ink"
                >
                  {PCB_TYPES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-header-foreground/70" />
              </span>
            </label>

            <div className="ml-auto flex items-center gap-2">
              {saveNote ? (
                <span
                  className={`hidden items-center gap-1 text-[12px] font-medium sm:inline-flex ${
                    saveNote === "Saved" || saveNote === "Submitted" || saveNote === "Approved"
                      ? "text-emerald-200"
                      : "text-amber-100"
                  }`}
                >
                  {saveNote === "Saved" || saveNote === "Submitted" || saveNote === "Approved" ? (
                    <Check className="size-3.5" />
                  ) : null}
                  {saveNote}
                </span>
              ) : null}
              <ProgressChip label="Overall" pct={overallPct} variant="header" icon={Layers} />
              <button
                type="button"
                disabled={saving || readOnly}
                onClick={() => {
                  void persist();
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-header-foreground/15 px-3 text-[13px] font-semibold text-header-foreground hover:bg-header-foreground/25 disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save
              </button>
              <ThemeSwitcher />
              <div className="mx-0.5 h-8 w-px bg-header-foreground/20" />
              <UserMenu />
            </div>
          </header>
        </div>

        <div className="relative z-10 px-4 pb-2 pt-2 sm:px-6">
          <div className="w-full overflow-hidden rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-strong)] shadow-[0_10px_40px_-18px_oklch(0.279_0.041_260/0.35),0_2px_8px_-4px_oklch(0.279_0.041_260/0.12),var(--glass-highlight)] backdrop-blur-xl ring-1 ring-black/[0.03]">
            <CertificateNavigator
              reports={visibleReports}
              activeId={activeId}
              onSelect={selectReport}
              completion={completion}
              disabledIds={disabledForms}
              disabledReason={(id) => formDisabledReason(id, layers)}
            />
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-4">
        <div className="mb-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-[22px] font-bold leading-tight text-ink">{report.title}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                <span className="font-semibold uppercase tracking-[0.08em] text-primary">{report.code}</span>
                <span className="opacity-40">·</span>
                <span>{report.rev}</span>
                <span className="opacity-40">·</span>
                <span>{formsCaption(regulatory)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ProgressChip label="This form" pct={formPct} variant="page" icon={ClipboardCheck} />
              {stage === "in-progress" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void persist("verification");
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-strong)] px-3 text-[13px] font-medium text-ink shadow-[var(--shadow-card)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:text-primary disabled:opacity-60"
                >
                  Submit for verification
                </button>
              ) : null}
              {stage === "verification" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    void persist("approved");
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-strong)] px-3 text-[13px] font-medium text-ink shadow-[var(--shadow-card)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:text-primary disabled:opacity-60"
                >
                  Approve
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setExportMode("all")}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--glass-border)] bg-[color:var(--glass-bg-strong)] px-3 text-[13px] font-medium text-ink shadow-[var(--shadow-card)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:border-primary/40 hover:text-primary"
              >
                <FileDown className="size-4" /> Export all
              </button>
              <button
                type="button"
                disabled={disabledForms.has(report.id)}
                onClick={() => setExportMode("one")}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary/95 px-3.5 text-[13px] font-semibold text-primary-foreground shadow-[0_8px_20px_-10px_var(--primary)] backdrop-blur-md transition-all duration-200 hover:-translate-y-px hover:brightness-110 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"
              >
                <Download className="size-4" /> Export PDF
              </button>
            </div>
          </div>
        </div>
       <fieldset disabled={readOnly} className="m-0 min-w-0 border-0 p-0">
  {disabledForms.has(report.id) ? (
    <div className="rounded-xl border border-border bg-[color:var(--glass-bg-strong)] px-6 py-16 text-center shadow-[var(--shadow-card)]">
      <p className="font-display text-[16px] font-semibold text-ink">Form not applicable</p>
      <p className="mt-2 text-[13px] text-muted-foreground">
        {formDisabledReason(report.id, layers) || "This form is disabled for the current layer count."}
      </p>
    </div>
  ) : (
    <ReportForm report={report} />
  )}
</fieldset>
        <p className="mt-6 text-center text-[12px] text-muted-foreground">
          Use <span className="font-semibold text-primary">Save</span> to store this report in Class3Report. Fields marked{" "}
          <span className="font-semibold text-primary">linked</span> flow across every certificate.
        </p>
      </div>
      <TemplateSelector
        open={exportMode !== null}
        busy={exporting}
        onClose={() => {
          if (!exporting) setExportMode(null);
        }}
        onExport={(template) => {
          void runExport(template);
        }}
      />
    </div>
  );
}

function OpeningOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-[2px]">
      <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-field px-4 py-3 text-[13px] font-medium text-ink shadow-lg">
        <Loader2 className="size-4 animate-spin" /> Opening report…
      </div>
    </div>
  );
}

function AppGate() {
  const { user } = useAuth();
  const [lockedProductionOrders, setLockedProductionOrders] = useState<string[]>([]);
  const lockedProductionOrdersRef = useRef<string[]>([]);
  const [view, setView] = useState<"dashboard" | "editor">(() =>
    typeof window !== "undefined" && readAppRoute().view === "editor" ? "editor" : "dashboard",
  );
  const [reportId, setReportId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const route = readAppRoute();
    return route.view === "editor" && route.reportId !== "new" ? route.reportId : null;
  });
  const [pcbType, setPcbType] = useState("rigid");
  const [status, setStatus] = useState("in-progress");
  const [editorKey, setEditorKey] = useState(0);
  const [initialPayload, setInitialPayload] = useState<SavedReport["payload"] | null>(() => {
    if (typeof window === "undefined") return null;
    const route = readAppRoute();
    if (route.view === "editor" && route.reportId === "new") return readStoredDraft();
    return null;
  });
  const [applyConditions, setApplyConditions] = useState(false);
  const [opening, setOpening] = useState(() => {
    if (typeof window === "undefined") return false;
    const route = readAppRoute();
    return route.view === "editor" && route.reportId !== "new";
  });
  const [openError, setOpenError] = useState<string | null>(null);
  const [routeReady, setRouteReady] = useState(() => {
    if (typeof window === "undefined") return true;
    const route = readAppRoute();
    return route.view === "dashboard" || route.reportId === "new";
  });

  function rememberLocks(orders: string[]) {
    const normalized = [...new Set(orders.map((order) => order.trim()).filter(Boolean))];
    lockedProductionOrdersRef.current = normalized;
    setLockedProductionOrders(normalized);
  }

  function releaseCurrentLocks() {
    const orders = lockedProductionOrdersRef.current;
    lockedProductionOrdersRef.current = [];
    setLockedProductionOrders([]);
    if (orders.length) {
      void releaseReportLocks(orders).catch((err) => {
        console.error("Unable to release report editing locks:", err);
      });
    }
  }

  useEffect(() => {
    if (!user || view !== "editor" || !lockedProductionOrders.length) return;
    const timer = window.setInterval(() => {
      void heartbeatReportLocks(lockedProductionOrders).catch((err) => {
        toast.error(
          err instanceof Error
            ? `Editing lock lost: ${err.message}`
            : "Editing lock lost. Reopen the report before saving.",
        );
        rememberLocks([]);
        setView("dashboard");
        writeAppRoute({ view: "dashboard" }, true);
      });
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [lockedProductionOrders, user, view]);

  function openEditor(next: {
    id: string | null;
    payload: SavedReport["payload"] | null;
    pcbType: string;
    status: string;
    applyConditions: boolean;
    push?: boolean;
    form?: string;
  }) {
    setReportId(next.id);
    setInitialPayload(next.payload);
    setPcbType(next.pcbType);
    setStatus(next.status);
    setApplyConditions(next.applyConditions);
    setOpenError(null);
    setEditorKey((k) => k + 1);
    setView("editor");
    writeAppRoute(
      { view: "editor", reportId: next.id || "new", form: next.form || editorFormId() },
      !next.push,
    );
  }

  function goDashboard(push = true) {
    releaseCurrentLocks();
    setView("dashboard");
    setOpenError(null);
    writeAppRoute({ view: "dashboard" }, !push);
  }

  async function loadSavedReport(id: string, push = false, form?: string) {
    setOpening(true);
    setOpenError(null);
    try {
      const lockResult = await acquireReportLock({ reportId: id });
      rememberLocks(lockResult.productionOrders);
      const result = await getSavedReport(id);
      const payload = result.report.payload || {};
      openEditor({
        id: result.report.id,
        payload,
        pcbType: payload.pcbSuiteType || result.report.pcbSuiteType || "rigid",
        status: normalizeReportStatus(result.report.status),
        applyConditions: false,
        push,
        form,
      });
      } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message);
      } else {
        setOpenError(err instanceof Error ? err.message : "Unable to open report.");
      }
        releaseCurrentLocks();
        setView("dashboard");
      writeAppRoute({ view: "dashboard" }, true);
    } finally {
      setOpening(false);
      setRouteReady(true);
    }
  }

  useEffect(() => {
    if (!user) return;
    const route = readAppRoute();
    if (route.view !== "editor") {
      setRouteReady(true);
      return;
    }
    if (route.reportId === "new") {
      setView("editor");
      setReportId(null);
      setInitialPayload(readStoredDraft());
      setRouteReady(true);
      return;
    }
    void loadSavedReport(route.reportId, false, route.form);
    // Hydrate from the current URL once after login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    function onPopState() {
      const route = readAppRoute();
      if (route.view === "dashboard") {
        releaseCurrentLocks();
        setView("dashboard");
        setOpenError(null);
        return;
      }
      if (route.reportId === "new") {
        setReportId(null);
        setInitialPayload(readStoredDraft());
        setApplyConditions(false);
        setEditorKey((k) => k + 1);
        setView("editor");
        return;
      }
      void loadSavedReport(route.reportId, false, route.form);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return <LoginScreen />;

  const showOverlay = !routeReady || (view === "editor" && opening && !initialPayload && reportId);

  return (
    <ReportProvider
      key={view === "editor" ? `editor-${editorKey}` : "dashboard"}
      initial={view === "editor" ? initialPayload : null}
      applyConditions={applyConditions}
      persistDraft={view === "editor" && !opening}
      status={view === "editor" ? status : "in-progress"}
    >
      {showOverlay ? (
        <OpeningOverlay />
      ) : view === "dashboard" ? (
        <>
          <Dashboard
            onNew={() => {
              clearStoredDraft();
              openEditor({
                id: null,
                payload: null,
                pcbType: "rigid",
                status: "in-progress",
                applyConditions: false,
                push: true,
              });
            }}
            onOpen={(id) => {
              void loadSavedReport(id, true, undefined);
            }}
            onStart={async (lots) => {
              if (!lots.length) return;
              setOpening(true);
              setOpenError(null);
              try {
                let coc: CocLookup | null = null;
                try {
                  const lookedUp = await lookupCocByProductionOrder(lots[0]!.productionOrder);
                  coc = lookedUp.coc;
                } catch {
                  coc = null;
                }
                const payload = payloadFromLots(lots, coc);
                const lockResult = await acquireReportLock({ payload });
                rememberLocks(lockResult.productionOrders);
                const result = await createSavedReport(payload, "in-progress");
                openEditor({
                  id: result.report.id,
                  payload: result.report.payload || payload,
                  pcbType: payload.pcbSuiteType || "rigid",
                  status: "in-progress",
                  applyConditions: true,
                  push: true,
                });
              } catch (err) {
                if (err instanceof ApiError && err.status === 409) {
                  toast.error(err.message);
                } else {
                  setOpenError(err instanceof Error ? err.message : "Unable to start inspection.");
                }
                releaseCurrentLocks();
              } finally {
                setOpening(false);
              }
            }}
          />
          {opening ? <OpeningOverlay /> : null}
          {openError ? (
            <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-destructive/30 bg-field px-4 py-2 text-[13px] font-medium text-destructive shadow-lg">
              {openError}
            </div>
          ) : null}
        </>
      ) : (
        <>
          <Workspace
            reportId={reportId}
            pcbType={pcbType}
            status={status}
            initialFormId={editorFormId()}
            onPcbTypeChange={setPcbType}
            onSaved={(id, nextStatus) => {
              setReportId(id);
              setStatus(nextStatus);
              const route = readAppRoute();
              writeAppRoute(
                { view: "editor", reportId: id, form: route.view === "editor" ? route.form : editorFormId() },
                true,
              );
            }}
            onBack={() => goDashboard(true)}
          />
          {opening ? <OpeningOverlay /> : null}
          {openError ? (
            <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-destructive/30 bg-field px-4 py-2 text-[13px] font-medium text-destructive shadow-lg">
              {openError}
            </div>
          ) : null}
        </>
      )}
    </ReportProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
