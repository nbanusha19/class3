import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Eye,
  FilePlus2,
  FolderOpen,
  Loader2,
  Play,
  Search,
  TimerReset,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { fetchWorkload, getSavedReport, updateSavedReport, type WorkloadRow, type WorkloadStage, deleteSavedReport } from "@/lib/api";
import { HiQMark } from "@/components/brand/HiQMark";
import { UserMenu } from "@/components/auth/UserMenu";
import { ThemeSwitcher } from "@/components/report/ThemeSwitcher";
import { useAuth } from "@/lib/auth";
import { STAGE_META } from "@/lib/reports/form-pack";
import { cn } from "@/lib/utils";

type DashboardProps = {
  onNew: () => void;
  onOpen: (id: string) => void;
  onStart: (lots: WorkloadRow[]) => void | Promise<void>;
};

type SortDir = "asc" | "desc";

const PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 10;
const STAGES: WorkloadStage[] = ["wip", "in-progress", "verification", "approved"];
const STAT_THEME: Record<WorkloadStage, string> = {
  wip: "rigid",
  "in-progress": "flex",
  verification: "rigid-flex",
  approved: "total",
};

function pageWindow(current: number, total: number): number[] {
  const last = Math.max(1, total);
  const curr = Math.min(Math.max(1, current), last);
  if (last <= 10) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }
  if (curr < 10) {
    return Array.from({ length: 10 }, (_, i) => i + 1);
  }
  const start = Math.max(1, curr - 5);
  const end = Math.min(last, curr + 5);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function SortTh({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  column: string;
  sortBy: string;
  sortDir: SortDir;
  onSort: (column: string) => void;
  align?: "left" | "right";
}) {
  const active = sortBy === column;
  return (
    <th
      className={cn("px-4 py-2.5 font-semibold", align === "right" && "text-right")}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em]",
          align === "right" && "ml-auto",
        )}
      >
        {label}
        <span className="inline-flex flex-col leading-none" aria-hidden>
          <ChevronUp
            className={cn("size-3", active && sortDir === "asc" ? "text-primary" : "opacity-35")}
          />
          <ChevronDown
            className={cn("-mt-1 size-3", active && sortDir === "desc" ? "text-primary" : "opacity-35")}
          />
        </span>
      </button>
    </th>
  );
}

export function Dashboard({ onNew, onOpen, onStart }: DashboardProps) {
  const { user } = useAuth();
  const isAdmin = user?.role.toLowerCase() === "admin";
  const [stage, setStage] = useState<WorkloadStage>("wip");
  const [rows, setRows] = useState<WorkloadRow[]>([]);
  const [stats, setStats] = useState({ wip: 0, inProgress: 0, verification: 0, approved: 0 });
  const [customers, setCustomers] = useState<string[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("all");
  const [overdueFirst, setOverdueFirst] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortBy, setSortBy] = useState("received");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<WorkloadRow | null>(null);
  const [previewRow, setPreviewRow] = useState<WorkloadRow | null>(null);
  const [revertingId, setRevertingId] = useState<string | null>(null);
  const [pendingRevert, setPendingRevert] = useState<WorkloadRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next === search) return;
      setSearch(next);
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchInput, search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchWorkload({
        stage,
        search,
        customer,
        overdueFirst,
        page,
        pageSize,
        sortBy,
        sortDir,
      });
      setRows(result.rows || []);
      setStats(result.stats || { wip: 0, inProgress: 0, verification: 0, approved: 0 });
      setCustomers(result.customers || []);
      const nextPagination = result.pagination || { page: 1, pageSize, total: 0, totalPages: 1 };
      setPagination(nextPagination);
      if (nextPagination.page && nextPagination.page !== page) {
        setPage(nextPagination.page);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load CoC workload.");
    } finally {
      setLoading(false);
    }
  }, [customer, overdueFirst, page, pageSize, search, sortBy, sortDir, stage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelected([]);
  }, [stage, search, customer, page, pageSize, sortBy, sortDir]);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected.includes(row.productionOrder)),
    [rows, selected],
  );
  const selectedPos = useMemo(
    () => [...new Set(selectedRows.map((row) => row.poNumber).filter(Boolean))],
    [selectedRows],
  );
  const selectedSpecs = useMemo(
    () => [...new Set(selectedRows.map((row) => row.ipcStandard).filter(Boolean))],
    [selectedRows],
  );
  const combineBlocked = selected.length === 0 || selectedPos.length > 1 || selectedSpecs.length > 1;

  const selSummary = useMemo(() => {
    if (!selected.length) return "";
    const count = `${selected.length} production order${selected.length === 1 ? "" : "s"} selected`;
    if (selectedPos.length > 1) {
      return `${count} · ${selectedPos.join(", ")} differ — a combined report needs a single PO`;
    }
    if (selectedSpecs.length > 1) {
      return `${count} · ${selectedPos[0] || "PO"} · standards differ (${selectedSpecs.join(", ")}) — combine only orders on one standard`;
    }
    return `${count} · ${selectedPos[0] || "one PO"} · one combined CoC`;
  }, [selected.length, selectedPos, selectedSpecs]);

  const pages = pageWindow(pagination.page, pagination.totalPages);
  const rangeStart = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.total);

  function toggleRow(productionOrder: string) {
    setSelected((prev) =>
      prev.includes(productionOrder) ? prev.filter((id) => id !== productionOrder) : [...prev, productionOrder],
    );
  }

  function changeStage(next: WorkloadStage) {
    setStage(next);
    setPage(1);
    setOverdueFirst(false);
  }

  function toggleSort(column: string) {
    setOverdueFirst(false);
    setPage(1);
    if (sortBy === column) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(column);
    setSortDir(column === "received" || column === "qty" ? "desc" : "asc");
  }

  async function startLots(lots: WorkloadRow[]) {
    if (!lots.length) return;
    setStarting(true);
    try {
      await Promise.resolve(onStart(lots));
    } finally {
      setStarting(false);
    }
  }

  async function deleteReport(row: WorkloadRow) {
  if (!isAdmin || stage === "wip" || !row.id) return;

  try {
    await deleteSavedReport(row.id);
    setPendingDelete(null);
    await load();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unable to delete report.");
  }
}

  async function revertReport(row: WorkloadRow) {
  if (!row.id || (stage !== "verification" && stage !== "approved")) return;

  const nextStatus = stage === "approved" ? "verification" : "in-progress";
  setRevertingId(row.id);

  try {
    const { report } = await getSavedReport(row.id);
    await updateSavedReport(row.id, report.payload, nextStatus);
    await load();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unable to revert report.");
  } finally {
    setRevertingId(null);
  }
}

  const meta = STAGE_META[stage];
  const firstCol = stage === "wip" ? "productionOrder" : "cocNumber";
  const cards = [
    { key: "wip" as const, value: stats.wip, Icon: TimerReset },
    { key: "in-progress" as const, value: stats.inProgress, Icon: Play },
    { key: "verification" as const, value: stats.verification, Icon: ClipboardCheck },
    { key: "approved" as const, value: stats.approved, Icon: CheckCircle2 },
  ];

  return (
    <div className="theme-transition relative min-h-screen bg-transparent">
      <div className="gradient-header relative z-40 border-b border-primary/20 text-header-foreground">
        <header className="flex w-full items-center gap-x-5 px-6 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <HiQMark className="size-8" />
            <div className="min-w-0 leading-tight">
              <span className="font-display block text-[15px] font-bold tracking-tight">CERTIFICATE OF CONFORMANCE</span>
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.14em] text-header-foreground/65 sm:block">
                Quality — final inspection
              </span>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeSwitcher />
            <div className="mx-0.5 h-8 w-px bg-header-foreground/20" />
            <UserMenu />
          </div>
        </header>
      </div>

      <div className="w-full px-6 py-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[28px] font-bold tracking-tight text-ink">Dashboard</h1>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Welcome, {user?.name || "there"}. Open a saved COC or start a new report.
            </p>
          </div>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground hover:brightness-110"
          >
            <FilePlus2 className="size-3.5" /> New
          </button>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.Icon;
            const active = stage === card.key;
            return (
              <button
                key={card.key}
                type="button"
                data-stat={STAT_THEME[card.key]}
                onClick={() => changeStage(card.key)}
                className={cn("dash-stat theme-transition p-4 text-left", active && "ring-2 ring-primary/40")}
              >
                <div className="relative z-[1] flex items-start justify-between gap-3">
                  <div>
                    <p className="dash-stat-label text-[11px] font-semibold uppercase tracking-[0.08em]">
                      {STAGE_META[card.key].label}
                    </p>
                    <p className="dash-stat-value mt-2 font-display text-[28px] font-bold leading-none">
                      {loading && !stats.wip && !stats.inProgress && !stats.verification && !stats.approved
                        ? "—"
                        : card.value}
                    </p>
                  </div>
                  <span className="dash-stat-icon">
                    <Icon className="size-5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mb-0 flex gap-0 border-b border-border">
          {STAGES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => changeStage(name)}
              className={cn(
                "px-4 py-2.5 text-[13px] font-semibold uppercase tracking-[0.06em]",
                stage === name
                  ? "border-b-2 border-primary text-primary"
                  : "border-b-2 border-transparent text-muted-foreground hover:text-ink",
              )}
            >
              {STAGE_META[name].label}
            </button>
          ))}
        </div>

        <section className="panel dash-table theme-transition mt-4 overflow-hidden">
          <div className="dash-table-toolbar flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <h2 className="text-[15px] font-semibold text-ink">{meta.title}</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">{meta.note}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="relative min-w-[220px] sm:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search production order or part number"
                  className="dash-table-search h-8 w-full rounded-lg border pl-9 pr-3 text-[12px] text-ink outline-none placeholder:text-muted-foreground"
                />
              </label>
              <select
                value={customer}
                title={customer === "all" ? "All customers" : customer}
                onChange={(e) => {
                  setCustomer(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-[9.5rem] shrink-0 rounded-lg border px-2 text-[12px] font-medium text-ink outline-none"
              >
                <option value="all">All customers</option>
                {customers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setOverdueFirst((v) => {
                    const next = !v;
                    if (next) {
                      setSortBy("received");
                      setSortDir("asc");
                    }
                    return next;
                  });
                  setPage(1);
                }}
                className={cn(
                  "h-8 rounded-lg border px-3 text-[12px] font-medium",
                  overdueFirst ? "border-primary bg-primary/10 text-primary" : "text-ink",
                )}
              >
                Overdue first
              </button>
            </div>
          </div>

          {stage === "wip" && selected.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/30 bg-primary/8 px-4 py-2.5">
              <p className="text-[13px] text-ink">{selSummary}</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSelected([])} className="h-8 rounded-lg px-3 text-[12px] font-medium text-ink">
                  Clear selection
                </button>
                <button
                  type="button"
                  disabled={combineBlocked || starting}
                  onClick={() => {
                    void startLots(selectedRows);
                  }}
                  className="h-8 rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground disabled:opacity-40"
                >
                  Combine into one report
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-16 text-[13px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="px-4 py-10 text-center text-[13px] font-medium text-destructive">{error}</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p className="text-[14px] text-muted-foreground">
                {search ? "No lots match this search." : stage === "wip" ? "No lots waiting in final quality." : "No reports in this stage."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.06em]">
                    <th className="w-10 px-4 py-2.5" />
                    <SortTh
                      label={stage === "wip" ? "Production order no." : "CoC no."}
                      column={firstCol}
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    {stage !== "wip" ? (
  <th className="px-4 py-2.5 font-semibold">Batch number</th>
) : null}
                    <SortTh label="Customer" column="customer" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="CAM no." column="camNumber" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh label="PO number" column="poNumber" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <SortTh
                      label="Customer specification"
                      column="customerSpec"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortTh
                      label="IPC standard"
                      column="ipcStandard"
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortTh label="Qty" column="qty" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} align="right" />
                    {stage !== "wip" ? <th className="px-4 py-2.5 font-semibold">Inspected by</th> : null}
                    {stage === "approved" ? <th className="px-4 py-2.5 font-semibold">Verified by</th> : null}
                    <SortTh label="Received" column="received" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                    <th className="px-4 py-2.5 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id || row.productionOrder} className="border-t">
                      <td className="px-4 py-3">
                        {stage === "wip" ? (
                          <input
                            type="checkbox"
                            checked={selected.includes(row.productionOrder)}
                            onChange={() => toggleRow(row.productionOrder)}
                            className="size-3.5 accent-primary"
                          />
                        ) : null}
                      </td>
                      <td className="px-4 py-3 font-semibold tabular-nums text-ink">
                        {stage === "wip" ? row.productionOrder : row.cocNumber || row.productionOrder || "Untitled"}
                      </td>
                      {stage !== "wip" ? (
                      <td className="px-4 py-3 tabular-nums text-ink">
                      {row.combinedProductionOrders?.join(", ") || row.productionOrder || "—"}
                      </td>
                    ) : null}
                      <td className="px-4 py-3 text-ink">{row.customer || "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-ink">{row.camNumber || "—"}</td>
                      <td className="px-4 py-3 tabular-nums text-ink">{row.poNumber || "—"}</td>
                      <td className="px-4 py-3 text-ink">{row.customerSpec || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.ipcStandard || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-ink">{row.qty || "—"}</td>
                      {stage !== "wip" ? (
                      <td className="px-4 py-3 text-ink">{row.inspectedBy || "—"}</td>
                      ) : null}
                      {stage === "approved" ? (
                      <td className="px-4 py-3 text-ink">{row.verifiedBy || "—"}</td>
                      ) : null}
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {row.received || "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-2">
                          {stage === "wip" ? (
                            <>
                              <button
                                type="button"
                                title="View production order"
                                aria-label={`View ${row.productionOrder}`}
                                onClick={() => setPreviewRow(row)}
                                className="inline-flex size-7 items-center justify-center rounded-md text-ink hover:bg-muted"
                              >
                                <Eye className="size-4" />
                              </button>
                              <button
                                type="button"
                                title={meta.action}
                                aria-label={`${meta.action} ${row.productionOrder}`}
                                disabled={starting}
                                onClick={() => void startLots([row])}
                                className="inline-flex size-7 items-center justify-center rounded-md text-ink hover:bg-muted disabled:opacity-50"
                              >
                                <Play className="size-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              title={meta.action}
                              aria-label={`${meta.action} ${row.cocNumber || row.productionOrder}`}
                              disabled={starting}
                              onClick={() => {
                                if (row.id) onOpen(row.id);
                              }}
                              className="inline-flex size-7 items-center justify-center rounded-md text-ink hover:bg-muted disabled:opacity-50"
                            >
                              {stage === "in-progress" ? (
                                <Play className="size-4" />
                              ) : stage === "verification" ? (
                                <ClipboardCheck className="size-4" />
                              ) : (
                                <FolderOpen className="size-4" />
                              )}
                            </button>
                          )}

                          {stage === "verification" || stage === "approved" ? (
                            <button
                              type="button"
                              title={stage === "approved" ? "Revert to verification" : "Revert to in-progress"}
                              aria-label={stage === "approved" ? "Revert to verification" : "Revert to in-progress"}
                              disabled={!row.id || revertingId === row.id}
                              onClick={() => setPendingRevert(row)}
                              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-ink disabled:opacity-50"
                            >
                              <RotateCcw className="size-4" />
                            </button>
                          ) : null}

                          {isAdmin && stage !== "wip" && row.id ? (
                            <button
                              type="button"
                              title="Delete report"
                              aria-label={`Delete ${row.cocNumber || row.productionOrder}`}
                              onClick={() => setPendingDelete(row)}
                              className="inline-flex size-7 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="dash-table-footer flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[12px] text-muted-foreground">
                {pagination.total ? `${rangeStart}–${rangeEnd} of ${pagination.total} Rows` : "0 Rows"}
              </p>
              <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border px-2 text-[12px] font-medium text-ink outline-none"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-8 items-center rounded-lg border px-2.5 text-[12px] font-medium text-ink disabled:opacity-40"
              >
                {"< Prev"}
              </button>
              {pages.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={loading}
                  data-active={n === pagination.page}
                  onClick={() => setPage(n)}
                  className="dash-page-btn inline-flex size-8 items-center justify-center rounded-lg border text-[12px] font-medium text-ink disabled:opacity-40"
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-8 items-center rounded-lg border px-2.5 text-[12px] font-medium text-ink disabled:opacity-40"
              >
                {"Next >"}
              </button>
            </div>
          </div>

          <AlertDialog
            open={previewRow !== null}
            onOpenChange={(open) => {
              if (!open) setPreviewRow(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Production order {previewRow?.productionOrder}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Customer: {previewRow?.customer || "—"}
                  <br />
                  Part number: {previewRow?.partNumber || "—"}
                  <br />
                  P.O. number: {previewRow?.poNumber || "—"}
                  <br />
                  Quantity: {previewRow?.qty || "—"}
                  <br />
                  Specification: {previewRow?.specification || "—"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setPreviewRow(null)}>
                  Close
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={pendingRevert !== null}
            onOpenChange={(open) => {
              if (!open) setPendingRevert(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Move to {stage === "approved" ? "verification" : "in-progress"}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to move{" "}
                  {pendingRevert?.cocNumber || pendingRevert?.productionOrder} back to the{" "}
                  {stage === "approved" ? "verification" : "in-progress"} tab?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (pendingRevert) void revertReport(pendingRevert);
                    setPendingRevert(null);
                  }}
                >
                  Move
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={pendingDelete !== null}
            onOpenChange={(open) => {
              if (!open) setPendingDelete(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this report?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove {pendingDelete?.cocNumber || pendingDelete?.productionOrder} from the dashboard.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (pendingDelete) void deleteReport(pendingDelete);
                  }}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </div>
    </div>
  );
}
