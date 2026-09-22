import { buildApiUrl } from "@/config/api";
import type {
  BrazilianCity,
  CnaeCode,
  IntegrationProvider,
  IntegrationSummary,
  LeadImportPayload,
  LeadImportResult,
  ProspectingJob,
  ProspectingJobEvent,
  ProspectingResult,
  ProspectingSearchPayload,
} from "@/types/prospecting";

const PROSPECTING_BASE_URL = buildApiUrl("prospecting");

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("Usuário nao autenticado");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PROSPECTING_BASE_URL}${endpoint}`, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init?.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || `Erro na API de prospecção (${response.status})`);
  }

  return payload as T;
}

export const prospectingAPI = {
  getIntegrations() {
    return request<{ integrations: IntegrationSummary[] }>("/integrations");
  },

  saveIntegrationMetadata(provider: IntegrationProvider, metadata: Record<string, unknown>) {
    return request<IntegrationSummary>(`/integrations/${provider}`, {
      method: "PUT",
      body: JSON.stringify({ metadata }),
    });
  },

  testIntegration(provider: IntegrationProvider) {
    return request<{ success: boolean; message: string; details?: string[] }>(`/integrations/${provider}/test`, {
      method: "POST",
    });
  },

  searchCnaes(query: string) {
    if (!query.trim()) return Promise.resolve({ items: [] as CnaeCode[] });
    return request<{ items: CnaeCode[] }>(`/cnaes?query=${encodeURIComponent(query)}`);
  },

  getCities(state: string) {
    if (!state) return Promise.resolve({ items: [] as BrazilianCity[] });
    return request<{ items: BrazilianCity[] }>(`/cities?state=${encodeURIComponent(state)}`);
  },

  createJob(payload: ProspectingSearchPayload) {
    return request<ProspectingJob>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  startJob(jobId: string) {
    return request<ProspectingJob>(`/jobs/${jobId}/start`, {
      method: "POST",
    });
  },

  getJob(jobId: string) {
    return request<{ job: ProspectingJob; events: ProspectingJobEvent[] }>(`/jobs/${jobId}`);
  },

  cancelJob(jobId: string) {
    return request<ProspectingJob>(`/jobs/${jobId}/cancel`, {
      method: "POST",
    });
  },

  getResults(jobId: string) {
    return request<{ items: ProspectingResult[] }>(`/jobs/${jobId}/results`);
  },

  importResults(payload: LeadImportPayload) {
    return request<LeadImportResult>("/imports", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getHistory() {
    return request<{ items: ProspectingJob[] }>("/history");
  },
};
