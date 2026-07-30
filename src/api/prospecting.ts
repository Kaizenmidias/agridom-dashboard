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
const PROSPECTION_BASE_URL = buildApiUrl("prospection");

type StoredIntegrationSection = {
  configured?: boolean;
  tokenMasked?: string | null;
  actorId?: string;
  googleMapsActorId?: string;
  instagramActorId?: string;
  timeoutMinutes?: number;
  pollIntervalSeconds?: number;
  apiKeyMasked?: string | null;
  placesApiKeyMasked?: string | null;
  pageSpeedApiKeyMasked?: string | null;
  baseUrl?: string;
  apiVersion?: string;
  instanceName?: string;
  cacheDays?: number;
  host?: string;
  port?: string | number;
  user?: string;
  from?: string;
  passMasked?: string | null;
  secure?: boolean;
};

type StoredIntegrationSettingsResponse = {
  apify: StoredIntegrationSection;
  casa_dos_dados?: StoredIntegrationSection;
  whatsapp_validator?: StoredIntegrationSection;
  google?: StoredIntegrationSection;
  openai?: StoredIntegrationSection;
  smtp: StoredIntegrationSection;
};

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

async function requestProspection<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${PROSPECTION_BASE_URL}${endpoint}`, {
    ...init,
    headers: { ...headers, ...(init?.headers || {}) },
  });
  const rawText = await response.text();
  const data = rawText ? JSON.parse(rawText) : null;

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Erro na API de integracoes (status ${response.status})`);
  }

  return data as T;
}

function buildIntegrationSummary(provider: IntegrationProvider, settings: StoredIntegrationSettingsResponse): IntegrationSummary {
  const section =
    provider === "apify"
      ? settings.apify
      : provider === "casa_dos_dados"
        ? settings.casa_dos_dados || {}
        : provider === "whatsapp_validator"
          ? settings.whatsapp_validator || {}
          : settings.smtp;

  const configured =
    provider === "apify"
      ? Boolean(section.tokenMasked || section.actorId || section.googleMapsActorId)
      : provider === "casa_dos_dados"
        ? Boolean(section.apiKeyMasked || section.baseUrl)
        : provider === "whatsapp_validator"
          ? Boolean(section.apiKeyMasked || section.baseUrl)
          : Boolean(section.host && section.user && section.from);

  return {
    provider,
    displayName:
      provider === "apify"
        ? "Apify"
        : provider === "casa_dos_dados"
          ? "Casa dos Dados"
          : provider === "whatsapp_validator"
            ? "Evolution API"
            : "SMTP",
    description:
      provider === "apify"
        ? "Scrapers utilizados na prospeccao comercial."
        : provider === "casa_dos_dados"
          ? "Consulta de dados empresariais por CNAE e localidade."
          : provider === "whatsapp_validator"
            ? "Valida telefone WhatsApp com a Evolution API."
            : "Envio de emails pelo backend.",
    status: configured ? "configured" : "not_configured",
    configured,
    connected: Boolean(configured),
    lastTestedAt: null,
    lastError: null,
    tokenMasked: provider === "apify" ? section.tokenMasked || null : null,
    apiKeyMasked:
      provider === "casa_dos_dados" || provider === "whatsapp_validator" ? section.apiKeyMasked || null : null,
    passwordMasked: provider === "smtp" ? section.passMasked || null : null,
    secure: provider === "smtp" ? Boolean(section.secure) : null,
    creditsBalance: null,
    metadata:
      provider === "apify"
        ? {
            googleMapsActorId: section.googleMapsActorId || section.actorId || "",
            instagramActorId: section.instagramActorId || "",
            timeoutMinutes: section.timeoutMinutes || 10,
            pollIntervalSeconds: section.pollIntervalSeconds || 5,
          }
        : provider === "casa_dos_dados"
          ? {
              apiKeyMasked: section.apiKeyMasked || null,
              baseUrl: section.baseUrl || "",
              apiVersion: section.apiVersion || "v5",
            }
          : provider === "whatsapp_validator"
            ? {
                baseUrl: section.baseUrl || "",
                instanceName: section.instanceName || "",
                cacheDays: section.cacheDays || 30,
              }
            : {
                host: section.host || "",
                port: section.port || 587,
                user: section.user || "",
                from: section.from || "",
              },
  };
}

export const prospectingAPI = {
  getIntegrations() {
    return requestProspection<StoredIntegrationSettingsResponse>("/integrations").then((settings) => ({
      integrations: ["apify", "casa_dos_dados", "whatsapp_validator", "smtp"].map((provider) =>
        buildIntegrationSummary(provider as IntegrationProvider, settings)
      ),
    }));
  },
  saveIntegrationMetadata(provider: IntegrationProvider, metadata: Record<string, unknown>) {
    return requestProspection<StoredIntegrationSettingsResponse>("/integrations", {
      method: "PUT",
      body: JSON.stringify({
        [provider]: metadata,
      }),
    }).then((settings) => buildIntegrationSummary(provider, settings));
  },
  testIntegration(provider: IntegrationProvider) {
    return requestProspection<{ success: boolean; message: string; details?: string[] }>(`/integrations/${provider}/test`, {
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

