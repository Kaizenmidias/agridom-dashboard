import { supabase } from "@/lib/supabase";
import { buildApiUrl } from "@/config/api";
import type {
  BrazilianCity,
  CnaeCode,
  IntegrationLibraryResponse,
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

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("Usuario nao autenticado");

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session.access_token}`,
  };
}

async function request<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${PROSPECTING_BASE_URL}${endpoint}`, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  });
  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Erro na API de prospeccao (status ${response.status})`);
  }

  return data as T;
}

export const prospectingAPI = {
  getIntegrations() {
    return request<IntegrationLibraryResponse>("/integrations");
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
    return request<{ items: CnaeCode[] }>(`/cnaes?q=${encodeURIComponent(query)}`);
  },
  getCities(state: string) {
    return request<{ items: BrazilianCity[] }>(`/cities?state=${encodeURIComponent(state)}`);
  },
  createJob(payload: ProspectingSearchPayload) {
    return request<ProspectingJob>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  startJob(jobId: string) {
    return request<ProspectingJob>(`/jobs/${jobId}/start`, { method: "POST" });
  },
  getJob(jobId: string) {
    return request<{ job: ProspectingJob; events: ProspectingJobEvent[] }>(`/jobs/${jobId}`);
  },
  cancelJob(jobId: string) {
    return request<ProspectingJob>(`/jobs/${jobId}/cancel`, { method: "POST" });
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
