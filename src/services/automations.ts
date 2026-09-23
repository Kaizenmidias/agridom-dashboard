import { buildApiUrl } from "@/config/api";

export type AutomationStatus = "draft" | "active" | "paused" | "archived";
export type AutomationVersionStatus = "draft" | "published" | "superseded";

export type AutomationDefinition = {
  schemaVersion: 1;
  trigger: { type: string; config: Record<string, unknown> };
  steps: Array<Record<string, unknown>>;
};

export type AutomationSummary = {
  id: number;
  name: string;
  description?: string | null;
  status: AutomationStatus;
  trigger_type: string;
  active_version_id?: number | null;
  active_version_number?: number | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type AutomationVersion = {
  id: number;
  automation_id: number;
  version_number: number;
  status: AutomationVersionStatus;
  definition: AutomationDefinition;
  created_by_name?: string | null;
  created_at: string;
  published_at?: string | null;
};

export type AutomationAuditLog = {
  id: number;
  action: string;
  metadata?: Record<string, unknown> | null;
  user_name?: string | null;
  created_at: string;
};

export type AutomationDetail = AutomationSummary & {
  owner_user_id: number;
  versions: AutomationVersion[];
  auditLogs: AutomationAuditLog[];
};

export type AutomationRun = {
  id: number;
  automation_id: number;
  automation_version_id: number;
  status: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  event_id?: number | null;
  event_type?: string | null;
  automation_name?: string;
  version_number?: number;
  correlation_id?: string | null;
};

function headers() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário não autenticado.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

async function request<T>(endpoint: string, init?: RequestInit) {
  const response = await fetch(buildApiUrl(`automations${endpoint}`), {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(payload?.details) ? ` ${payload.details.map((item: { path?: string; message?: string }) => `${item.path || "definition"}: ${item.message || "erro"}`).join(" ")}` : "";
    throw new Error(`${payload?.error || "Não foi possível concluir a operação."}${details}`);
  }
  return payload as T;
}

async function requestAt<T>(base: string, endpoint: string, init?: RequestInit) {
  const response = await fetch(buildApiUrl(`${base}${endpoint}`), {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "Não foi possível concluir a operação.");
  return payload as T;
}

export const automationsAPI = {
  list: () => request<{ automations: AutomationSummary[] }>(""),
  create: (values: { name: string; description?: string; trigger_type: string; definition?: AutomationDefinition }) => request<AutomationDetail>("", { method: "POST", body: JSON.stringify(values) }),
  get: (id: number) => request<AutomationDetail>(`/${id}`),
  update: (id: number, values: { name?: string; description?: string }) => request<AutomationDetail>(`/${id}`, { method: "PATCH", body: JSON.stringify(values) }),
  createVersion: (id: number, definition: AutomationDefinition) => request<AutomationVersion>(`/${id}/versions`, { method: "POST", body: JSON.stringify({ definition }) }),
  updateVersion: (id: number, versionId: number, definition: AutomationDefinition) => request<AutomationVersion>(`/${id}/versions/${versionId}`, { method: "PATCH", body: JSON.stringify({ definition }) }),
  publish: (id: number, versionId: number) => request<AutomationSummary>(`/${id}/publish`, { method: "POST", body: JSON.stringify({ version_id: versionId }) }),
  pause: (id: number) => request<AutomationSummary>(`/${id}/pause`, { method: "POST" }),
  activate: (id: number) => request<AutomationSummary>(`/${id}/activate`, { method: "POST" }),
  archive: (id: number) => request<AutomationSummary>(`/${id}/archive`, { method: "POST" }),
  runs: (id: number) => request<{ runs: AutomationRun[] }>(`/${id}/runs`),
  allRuns: (page = 1) => requestAt<{ runs: AutomationRun[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }>("automation-runs", `?page=${page}&page_size=25`),
  getRun: (id: number) => requestAt<AutomationRun & { steps: unknown[]; jobs: unknown[] }>("automation-runs", `/${id}`),
};
