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
const INTEGRATION_SETTINGS_PREFIX = "prospection_integrations_user_";
const DEFAULT_APIFY_ACTOR = "datamech/apify-google-maps-scraper";
const DEFAULT_CASA_BASE_URL = "https://api.casadosdados.com.br";
const DEFAULT_CASA_API_VERSION = "v5";

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

type StoredIntegrationConfig = {
  apify: {
    token: string;
    actorId: string;
    googleMapsActorId: string;
    instagramActorId: string;
    timeoutMinutes: number;
    pollIntervalSeconds: number;
  };
  casa_dos_dados: {
    apiKey: string;
    baseUrl: string;
    apiVersion: string;
  };
  whatsapp_validator: {
    baseUrl: string;
    apiKey: string;
    instanceName: string;
    cacheDays: number;
  };
  smtp: {
    host: string;
    port: string;
    user: string;
    pass: string;
    from: string;
    secure: boolean;
  };
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

function maskSecret(value: string | null | undefined) {
  if (!value) return null;
  if (value.length <= 6) return "******";
  return `${value.slice(0, 3)}${"*".repeat(Math.max(4, value.length - 6))}${value.slice(-3)}`;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getDefaultIntegrationConfig(): StoredIntegrationConfig {
  return {
    apify: {
      token: "",
      actorId: DEFAULT_APIFY_ACTOR,
      googleMapsActorId: DEFAULT_APIFY_ACTOR,
      instagramActorId: "",
      timeoutMinutes: 10,
      pollIntervalSeconds: 5,
    },
    casa_dos_dados: {
      apiKey: "",
      baseUrl: DEFAULT_CASA_BASE_URL,
      apiVersion: DEFAULT_CASA_API_VERSION,
    },
    whatsapp_validator: {
      baseUrl: "",
      apiKey: "",
      instanceName: "",
      cacheDays: 30,
    },
    smtp: {
      host: "",
      port: "587",
      user: "",
      pass: "",
      from: "",
      secure: false,
    },
  };
}

function normalizeStoredConfig(value: unknown): StoredIntegrationConfig {
  const source = value && typeof value === "object" ? value as Record<string, Record<string, unknown> | undefined> : {};
  const defaults = getDefaultIntegrationConfig();

  return {
    apify: {
      token: cleanString(source.apify?.token) || defaults.apify.token,
      actorId: cleanString(source.apify?.actorId) || defaults.apify.actorId,
      googleMapsActorId: cleanString(source.apify?.googleMapsActorId) || cleanString(source.apify?.actorId) || defaults.apify.googleMapsActorId,
      instagramActorId: cleanString(source.apify?.instagramActorId) || defaults.apify.instagramActorId,
      timeoutMinutes: cleanNumber(source.apify?.timeoutMinutes, defaults.apify.timeoutMinutes),
      pollIntervalSeconds: cleanNumber(source.apify?.pollIntervalSeconds, defaults.apify.pollIntervalSeconds),
    },
    casa_dos_dados: {
      apiKey: cleanString(source.casa_dos_dados?.apiKey) || defaults.casa_dos_dados.apiKey,
      baseUrl: cleanString(source.casa_dos_dados?.baseUrl) || defaults.casa_dos_dados.baseUrl,
      apiVersion: cleanString(source.casa_dos_dados?.apiVersion) || defaults.casa_dos_dados.apiVersion,
    },
    whatsapp_validator: {
      baseUrl: cleanString(source.whatsapp_validator?.baseUrl) || defaults.whatsapp_validator.baseUrl,
      apiKey: cleanString(source.whatsapp_validator?.apiKey) || defaults.whatsapp_validator.apiKey,
      instanceName: cleanString(source.whatsapp_validator?.instanceName) || defaults.whatsapp_validator.instanceName,
      cacheDays: cleanNumber(source.whatsapp_validator?.cacheDays, defaults.whatsapp_validator.cacheDays),
    },
    smtp: {
      host: cleanString(source.smtp?.host) || defaults.smtp.host,
      port: cleanString(source.smtp?.port) || defaults.smtp.port,
      user: cleanString(source.smtp?.user) || defaults.smtp.user,
      pass: cleanString(source.smtp?.pass) || defaults.smtp.pass,
      from: cleanString(source.smtp?.from) || defaults.smtp.from,
      secure: Boolean(source.smtp?.secure),
    },
  };
}

function sanitizeConfigForClient(config: StoredIntegrationConfig): StoredIntegrationSettingsResponse {
  return {
    apify: {
      configured: Boolean(config.apify.token),
      tokenMasked: maskSecret(config.apify.token),
      actorId: config.apify.actorId,
      googleMapsActorId: config.apify.googleMapsActorId,
      instagramActorId: config.apify.instagramActorId,
      timeoutMinutes: config.apify.timeoutMinutes,
      pollIntervalSeconds: config.apify.pollIntervalSeconds,
    },
    casa_dos_dados: {
      configured: Boolean(config.casa_dos_dados.apiKey),
      apiKeyMasked: maskSecret(config.casa_dos_dados.apiKey),
      baseUrl: config.casa_dos_dados.baseUrl,
      apiVersion: config.casa_dos_dados.apiVersion,
    },
    whatsapp_validator: {
      configured: Boolean(config.whatsapp_validator.baseUrl && config.whatsapp_validator.apiKey),
      apiKeyMasked: maskSecret(config.whatsapp_validator.apiKey),
      baseUrl: config.whatsapp_validator.baseUrl,
      instanceName: config.whatsapp_validator.instanceName,
      cacheDays: config.whatsapp_validator.cacheDays,
    },
    smtp: {
      configured: Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from),
      host: config.smtp.host,
      port: config.smtp.port,
      user: config.smtp.user,
      from: config.smtp.from,
      passMasked: maskSecret(config.smtp.pass),
      secure: config.smtp.secure,
    },
  };
}

function mergeStoredConfig(currentConfig: StoredIntegrationConfig, provider: IntegrationProvider, metadata: Record<string, unknown>) {
  const next = normalizeStoredConfig(currentConfig);

  if (provider === "apify") {
    const token = cleanString(metadata.token);
    if (token) next.apify.token = token;
    next.apify.actorId = cleanString(metadata.actorId) || next.apify.actorId || DEFAULT_APIFY_ACTOR;
    next.apify.googleMapsActorId = cleanString(metadata.googleMapsActorId) || next.apify.googleMapsActorId || DEFAULT_APIFY_ACTOR;
    next.apify.instagramActorId = cleanString(metadata.instagramActorId);
    next.apify.timeoutMinutes = cleanNumber(metadata.timeoutMinutes, next.apify.timeoutMinutes);
    next.apify.pollIntervalSeconds = cleanNumber(metadata.pollIntervalSeconds, next.apify.pollIntervalSeconds);
  }

  if (provider === "casa_dos_dados") {
    const apiKey = cleanString(metadata.apiKey);
    if (apiKey) next.casa_dos_dados.apiKey = apiKey;
    next.casa_dos_dados.baseUrl = cleanString(metadata.baseUrl) || DEFAULT_CASA_BASE_URL;
    next.casa_dos_dados.apiVersion = cleanString(metadata.apiVersion) || DEFAULT_CASA_API_VERSION;
  }

  if (provider === "whatsapp_validator") {
    const apiKey = cleanString(metadata.apiKey);
    if (apiKey) next.whatsapp_validator.apiKey = apiKey;
    next.whatsapp_validator.baseUrl = cleanString(metadata.baseUrl);
    next.whatsapp_validator.instanceName = cleanString(metadata.instanceName);
    next.whatsapp_validator.cacheDays = cleanNumber(metadata.cacheDays, next.whatsapp_validator.cacheDays);
  }

  if (provider === "smtp") {
    const pass = cleanString(metadata.pass);
    next.smtp.host = cleanString(metadata.host);
    next.smtp.port = cleanString(metadata.port) || "587";
    next.smtp.user = cleanString(metadata.user);
    if (pass) next.smtp.pass = pass;
    next.smtp.from = cleanString(metadata.from);
    next.smtp.secure = Boolean(metadata.secure);
  }

  return next;
}

async function getIntegrationSettingKey() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.email) throw new Error("Usuario nao autenticado");

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("email", authData.user.email)
    .limit(1)
    .maybeSingle();

  if (userError) throw userError;

  return `${INTEGRATION_SETTINGS_PREFIX}${userRow?.id || authData.user.id}`;
}

async function fetchStoredConfigFromSupabase() {
  const settingKey = await getIntegrationSettingKey();
  const { data, error } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("setting_key", settingKey)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.setting_value) return getDefaultIntegrationConfig();

  try {
    return normalizeStoredConfig(JSON.parse(String(data.setting_value)));
  } catch {
    return getDefaultIntegrationConfig();
  }
}

async function saveStoredConfigToSupabase(config: StoredIntegrationConfig) {
  const settingKey = await getIntegrationSettingKey();
  const { error } = await supabase
    .from("system_settings")
    .upsert(
      {
        setting_key: settingKey,
        setting_value: JSON.stringify(config),
        description: "Configuracoes de integracoes do modulo de prospeccao",
      },
      { onConflict: "setting_key" }
    );

  if (error) throw error;
  return config;
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
  async getIntegrations() {
    const config = await fetchStoredConfigFromSupabase();
    const settings = sanitizeConfigForClient(config);
    return {
      integrations: ["apify", "casa_dos_dados", "whatsapp_validator", "smtp"].map((provider) =>
        buildIntegrationSummary(provider as IntegrationProvider, settings)
      ),
    };
  },
  async saveIntegrationMetadata(provider: IntegrationProvider, metadata: Record<string, unknown>) {
    const currentConfig = await fetchStoredConfigFromSupabase();
    const nextConfig = mergeStoredConfig(currentConfig, provider, metadata);
    const savedConfig = await saveStoredConfigToSupabase(nextConfig);
    return buildIntegrationSummary(provider, sanitizeConfigForClient(savedConfig));
  },
  async testIntegration(provider: IntegrationProvider) {
    const config = await fetchStoredConfigFromSupabase();
    const settings = sanitizeConfigForClient(config);
    const summary = buildIntegrationSummary(provider, settings);

    if (!summary.configured) {
      return {
        success: false,
        message: "Preencha e salve os campos obrigatorios antes de testar esta integracao.",
      };
    }

    return {
      success: true,
      message: "Configuracao encontrada no Supabase. O teste externo sera executado pelo backend quando a rota API estiver disponivel no dominio.",
    };
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

