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

function mapJob(row: any): ProspectingJob {
  return {
    ...row,
    searchParameters: typeof row.search_parameters === "string" ? JSON.parse(row.search_parameters || "{}") : (row.search_parameters || {}),
    requestedQuantity: Number(row.requestedQuantity ?? row.requested_quantity ?? 0),
    processedCount: Number(row.processedCount ?? row.processed_count ?? 0),
    foundCount: Number(row.foundCount ?? row.found_count ?? 0),
    duplicateCount: Number(row.duplicateCount ?? row.duplicate_count ?? 0),
    invalidCount: Number(row.invalidCount ?? row.invalid_count ?? 0),
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
    startedAt: row.startedAt ?? row.started_at,
    completedAt: row.completedAt ?? row.completed_at,
    errorMessage: row.errorMessage ?? row.error_message,
  };
}

function mapResult(row: any): ProspectingResult {
  return {
    ...row,
    companyName: row.companyName ?? row.company_name,
    normalizedPhone: row.normalizedPhone ?? row.normalized_phone,
    normalizedWebsiteDomain: row.normalizedWebsiteDomain ?? row.normalized_website_domain,
    instagramUrl: row.instagramUrl ?? row.instagram_url,
    googleMapsUrl: row.googleMapsUrl ?? row.google_maps_url,
    reviewCount: row.reviewCount ?? row.review_count,
    duplicateStatus: row.duplicateStatus ?? row.duplicate_status,
    prospectId: row.prospectId ?? row.prospect_id,
    whatsappStatus: row.whatsappStatus ?? row.whatsapp_status,
    validationStatus: row.validationStatus ?? row.validation_status ?? "not_checked",
  };
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
    return request<any>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(mapJob);
  },

  startJob(jobId: string) {
    return request<any>(`/jobs/${jobId}/start`, {
      method: "POST",
    }).then(mapJob);
  },

  getJob(jobId: string) {
    return request<any>(`/jobs/${jobId}`).then((data) => ({ ...data, job: mapJob(data.job) }));
  },

  cancelJob(jobId: string) {
    return request<any>(`/jobs/${jobId}/cancel`, {
      method: "POST",
    }).then(mapJob);
  },

  getResults(jobId: string) {
    return request<{ items: any[] }>(`/jobs/${jobId}/results`).then((data) => ({ items: data.items.map(mapResult) }));
  },

  importResults(payload: LeadImportPayload) {
    return request<LeadImportResult>("/imports", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getHistory() {
    return request<{ items: any[] }>("/history").then((data) => ({ items: data.items.map(mapJob) }));
  },
};
