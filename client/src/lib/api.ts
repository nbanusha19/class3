import type { F2State } from "./reports/f2-logic";

const TOKEN_KEY = "hiq-class3-auth-token";
const API_BASE = import.meta.env.VITE_API_URL ?? "";

export type ApiUser = {
  id: string;
  userId: string;
  uid: string;
  name: string;
  role: "admin" | "user";
  roleLabel: string;
  email: string;
  isActive: boolean;
  isAdmin: boolean;
  roleId?: number | null;
};

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) return token;

  const legacyToken = localStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    sessionStorage.setItem(TOKEN_KEY, legacyToken);
    localStorage.removeItem(TOKEN_KEY);
  }
  return legacyToken;
}

export function setAuthToken(token: string) {
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(TOKEN_KEY);
}

export function clearAuthToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      (payload as { error?: string }).error ?? `Request failed (${response.status})`,
      response.status,
    );
  }
  return payload as T;
}

export async function loginRequest(uid: string, password: string) {
  return apiFetch<{ token: string; user: ApiUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ uid, password }),
  });
}

export async function fetchCurrentUser() {
  return apiFetch<{ user: ApiUser }>("/api/auth/me");
}

export type CocLookup = {
  productionOrder: string;
  camNumber: string;
  cocNumber: string;
  cocDate: string;
  customer: string;
  customerAddress: string;
  partNumber: string;
  partRev: string;
  partNumberPo: string;
  poNumber: string;
  specification: string;
  regulatoryRequirement: string;
  material: string;
  layers: string;
  boardFinish: string;
  rohs: string;
  ulMark: string;
  quantity: string;
  received: string;
  supplyForm?: string;
  pcbPerArray?: string;
  pcbPerPanel?: string;
  launchPanel?: string;
  pcbThickness?: string;
  bbtType?: string;
  viaProtection?: string;
  solderMask?: string;
  legendPrint?: string;
  backDrilling?: string;
  impedanceControl?: string;
};

export async function lookupCocByProductionOrder(productionOrderNumber: string, cocDate?: string) {
  return apiFetch<{ coc: CocLookup }>("/api/coc/lookup", {
    method: "POST",
    body: JSON.stringify({ productionOrderNumber, cocDate: cocDate || undefined }),
  });
}

export type DrillInfoRow = {
  finishedSize: string;
  qty: string;
  drillType: string;
  tolPlus: string;
  tolMinus: string;
};

export async function lookupDrillInfo(productionOrderNumber: string) {
  return apiFetch<{ drills: DrillInfoRow[]; pcbThickness?: string }>("/api/coc/drill-info", {
    method: "POST",
    body: JSON.stringify({ productionOrderNumber }),
  });
}

/** Build COC as {productionOrder}-{DDMMYY} from the date field. */
export function buildCocNumber(productionOrder: string, dateValue: string) {
  const order = productionOrder.trim();
  if (!order) return "";

  const raw = dateValue.trim();
  let stamp = "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) {
    stamp = `${iso[3]}${iso[2]}${iso[1].slice(2)}`;
  } else {
    const dmy = /^(\d{2})[-/](\d{2})[-/](\d{4})$/.exec(raw);
    if (dmy) stamp = `${dmy[1]}${dmy[2]}${dmy[3].slice(2)}`;
  }
  if (!stamp) {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(2);
    stamp = `${dd}${mm}${yy}`;
  }
  return `${order}-${stamp}`;
}

export type SavedReportSummary = {
  id: string;
  productionOrder: string;
  cocNumber: string;
  cocDate: string;
  customer: string;
  partNumber: string;
  poNumber: string;
  specification: string;
  regulatoryRequirement: string;
  pcbSuiteType: string;
  status: string;
  createdByUid: string;
  createdByName: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SavedReport = SavedReportSummary & {
  payload: {
    shared?: Record<string, string>;
    fields?: Record<string, string>;
    tables?: Record<string, Record<string, string>[]>;
    pcbSuiteType?: string;
    combinedProductionOrders?: string[];
    received?: string;
    f2?: F2State;
  };
};

export type ReportListParams = {
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export type ReportListResponse = {
  reports: SavedReportSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  stats: {
    rigid: number;
    flex: number;
    rigidFlex: number;
    total: number;
  };
  sort: { sortBy: string; sortDir: "asc" | "desc" };
  search: string;
};

export async function listSavedReports(params: ReportListParams = {}) {
  const query = new URLSearchParams();
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);
  const qs = query.toString();
  return apiFetch<ReportListResponse>(`/api/reports${qs ? `?${qs}` : ""}`);
}

export async function getSavedReport(id: string) {
  return apiFetch<{ report: SavedReport }>(`/api/reports/${id}`);
}

export async function createSavedReport(payload: SavedReport["payload"], status = "in-progress") {
  return apiFetch<{ report: SavedReport }>("/api/reports", {
    method: "POST",
    body: JSON.stringify({ payload, status }),
  });
}

export async function updateSavedReport(id: string, payload: SavedReport["payload"], status?: string) {
  return apiFetch<{ report: SavedReport }>(`/api/reports/${id}`, {
    method: "PUT",
    body: JSON.stringify({ payload, status: status || undefined }),
  });
}

export async function deleteSavedReport(id: string) {
  return apiFetch<{ success: boolean }>(`/api/reports/${id}`, {
    method: "DELETE",
  });
}

export type ReportFile = {
  id: string;
  reportId: string;
  form: string;
  rowSl: string;
  name: string;
  path: string;
  mimeType?: string;
  size?: number | null;
};

export async function uploadReportFile(reportId: string, file: File, meta: { form?: string; rowSl: string }) {
  const data = new FormData();
  data.append("file", file);
  data.append("form", meta.form || "f3");
  data.append("rowSl", meta.rowSl);

  const headers = new Headers();
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}/api/reports/${encodeURIComponent(reportId)}/files`, {
    method: "POST",
    headers,
    body: data,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      (payload as { error?: string }).error ?? `Upload failed (${response.status})`,
      response.status,
    );
  }
  return payload as { file: ReportFile };
}

export async function deleteReportFile(reportId: string, fileId: string) {
  return apiFetch<{ success: boolean }>(
    `/api/reports/${encodeURIComponent(reportId)}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
}

export async function acquireReportLock(
  target:
    | string
    | { productionOrders: string[] }
    | { reportId: string }
    | { payload: SavedReport["payload"] },
) {
  const body =
    typeof target === "string"
      ? { productionOrder: target }
      : target;
  return apiFetch<{ productionOrders: string[] }>("/api/report-locks/acquire", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function heartbeatReportLocks(productionOrders: string[]) {
  return apiFetch<{ success: boolean }>("/api/report-locks/heartbeat", {
    method: "POST",
    body: JSON.stringify({ productionOrders }),
  });
}

export async function releaseReportLocks(productionOrders: string[]) {
  return apiFetch<{ success: boolean }>("/api/report-locks/release", {
    method: "POST",
    body: JSON.stringify({ productionOrders }),
  });
}

export async function openReportFile(reportId: string, fileId: string) {
  const headers = new Headers();
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(
    `${API_BASE}/api/reports/${encodeURIComponent(reportId)}/files/${encodeURIComponent(fileId)}`,
    { headers },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(
      (payload as { error?: string }).error ?? `Download failed (${response.status})`,
      response.status,
    );
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function fetchReportFileBlob(reportId: string, fileId: string) {
  const headers = new Headers();
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(
    `${API_BASE}/api/reports/${encodeURIComponent(reportId)}/files/${encodeURIComponent(fileId)}`,
    { headers },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(
      (payload as { error?: string }).error ?? `Download failed (${response.status})`,
      response.status,
    );
  }
  return response.blob();
}

export async function fetchReportFileDataUrl(reportId: string, fileId: string) {
  const blob = await fetchReportFileBlob(reportId, fileId);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export type WorkloadStage = "wip" | "in-progress" | "verification" | "approved";

export type WorkloadRow = {
  id?: string;
  productionOrder: string;
  cocNumber: string;
  customer: string;
  camNumber: string;
  poNumber: string;
  customerSpec: string;
  ipcStandard: string;
  regulatoryRequirement: string;
  specification: string;
  partNumber: string;
  qty: string;
  launchPanel?: string;
  received: string;
  receivedAt?: string;
  status: string;
  createdByName?: string;
  updatedAt?: string | null;
  inspectedBy?: string;
  verifiedBy?: string;
  combinedProductionOrders?: string[];
};

export type WorkloadResponse = {
  stage: WorkloadStage;
  rows: WorkloadRow[];
  stats: {
    wip: number;
    inProgress: number;
    verification: number;
    approved: number;
  };
  customers: string[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  sort: { sortBy: string; sortDir: "asc" | "desc" };
  search: string;
};

export type WorkloadParams = {
  stage?: WorkloadStage;
  search?: string;
  customer?: string;
  overdueFirst?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export async function fetchWorkload(params: WorkloadParams = {}) {
  const query = new URLSearchParams();
  if (params.stage) query.set("stage", params.stage);
  if (params.search?.trim()) query.set("search", params.search.trim());
  if (params.customer && params.customer !== "all") query.set("customer", params.customer);
  if (params.overdueFirst) query.set("overdueFirst", "true");
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortDir) query.set("sortDir", params.sortDir);
  const qs = query.toString();
  return apiFetch<WorkloadResponse>(`/api/workload${qs ? `?${qs}` : ""}`);
}
