import { supabase } from "@/lib/supabase";
import type { Prospect, ProspectStatus as DatabaseProspectStatus } from "@/types/database";
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

type ProspectingJobRow = {
  id: string;
  source: ProspectingSearchPayload["source"];
  status: ProspectingJob["status"];
  search_parameters: Record<string, unknown> | null;
  requested_quantity: number;
  processed_count: number;
  found_count: number;
  duplicate_count: number;
  valid_count: number;
  invalid_count: number;
  external_run_id: string | null;
  external_dataset_id: string | null;
  integration_provider: string | null;
  credits_estimated: number | null;
  credits_consumed: number | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ProspectingResultRow = {
  id: string;
  job_id: string;
  source: ProspectingSearchPayload["source"];
  external_id: string | null;
  company_name: string;
  trade_name: string | null;
  legal_name: string | null;
  contact_name: string | null;
  category: string | null;
  cnpj: string | null;
  normalized_cnpj: string | null;
  phone: string | null;
  normalized_phone: string | null;
  whatsapp: string | null;
  whatsapp_status: string;
  email: string | null;
  normalized_email: string | null;
  secondary_email: string | null;
  website: string | null;
  normalized_website_domain: string | null;
  instagram_username: string | null;
  instagram_url: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  review_count: number | null;
  cnae_primary: string | null;
  cnae_secondary: unknown;
  raw_payload: unknown;
  duplicate_status: string;
  duplicate_lead_id: string | null;
  duplicate_reason: string | null;
  validation_status: string;
  selected: boolean;
  imported_to_leads_at: string | null;
  created_at: string;
  updated_at: string;
};

type ProspectingJobEventRow = {
  id: string;
  job_id: string;
  event_type: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function toJob(row: ProspectingJobRow): ProspectingJob {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    searchParameters: row.search_parameters || {},
    requestedQuantity: Number(row.requested_quantity || 0),
    processedCount: Number(row.processed_count || 0),
    foundCount: Number(row.found_count || 0),
    duplicateCount: Number(row.duplicate_count || 0),
    validCount: Number(row.valid_count || 0),
    invalidCount: Number(row.invalid_count || 0),
    externalRunId: row.external_run_id,
    externalDatasetId: row.external_dataset_id,
    integrationProvider: row.integration_provider,
    creditsEstimated: row.credits_estimated,
    creditsConsumed: row.credits_consumed,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toResult(row: ProspectingResultRow): ProspectingResult {
  return {
    id: row.id,
    jobId: row.job_id,
    source: row.source,
    externalId: row.external_id,
    companyName: row.company_name,
    tradeName: row.trade_name,
    legalName: row.legal_name,
    contactName: row.contact_name,
    category: row.category,
    cnpj: row.cnpj,
    normalizedCnpj: row.normalized_cnpj,
    phone: row.phone,
    normalizedPhone: row.normalized_phone,
    whatsapp: row.whatsapp,
    whatsappStatus: row.whatsapp_status as ProspectingResult["whatsappStatus"],
    email: row.email,
    normalizedEmail: row.normalized_email,
    secondaryEmail: row.secondary_email,
    website: row.website,
    normalizedWebsiteDomain: row.normalized_website_domain,
    instagramUsername: row.instagram_username,
    instagramUrl: row.instagram_url,
    address: row.address,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
    rating: row.rating,
    reviewCount: row.review_count,
    cnaePrimary: row.cnae_primary,
    cnaeSecondary: Array.isArray(row.cnae_secondary) ? row.cnae_secondary as string[] : [],
    rawPayload: row.raw_payload,
    duplicateStatus: row.duplicate_status as ProspectingResult["duplicateStatus"],
    duplicateLeadId: row.duplicate_lead_id,
    duplicateReason: row.duplicate_reason,
    validationStatus: row.validation_status,
    selected: Boolean(row.selected),
    importedToLeadsAt: row.imported_to_leads_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEvent(row: ProspectingJobEventRow): ProspectingJobEvent {
  return {
    id: row.id,
    jobId: row.job_id,
    eventType: row.event_type,
    message: row.message,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

async function resolveOwnerUserId(): Promise<number> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user?.email) throw new Error("Usuário não autenticado");

  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("id")
    .eq("email", authData.user.email)
    .limit(1)
    .maybeSingle();

  if (userError) throw userError;
  if (!userRow?.id) throw new Error("Usuário não encontrado na tabela users");

  return Number(userRow.id);
}

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getProspectSearchTerms(payload: ProspectingSearchPayload) {
  if (payload.source === "google_maps") return normalizeText(payload.searchTerms);
  if (payload.source === "instagram") return normalizeText(payload.searchTerms);
  return [
    ...(payload.cnaeCodes || []),
    payload.city || "",
    payload.state || "",
  ]
    .join(" ")
    .trim()
    .toLowerCase();
}

function matchesProspectFilter(prospect: Prospect, payload: ProspectingSearchPayload) {
  const haystack = normalizeText([
    prospect.business_name,
    prospect.normalized_business_name,
    prospect.category,
    prospect.address,
    prospect.city,
    prospect.state,
    prospect.website,
    prospect.instagram,
    prospect.facebook,
  ].filter(Boolean).join(" "));

  if (payload.source === "google_maps" || payload.source === "instagram") {
    const terms = normalizeText(payload.searchTerms);
    if (terms && !haystack.includes(terms)) return false;
  }

  if (payload.source === "cnpj") {
    if (payload.state && normalizeText(prospect.state) !== normalizeText(payload.state)) return false;
    if (payload.city && normalizeText(prospect.city) !== normalizeText(payload.city)) return false;
  }

  if (payload.source === "google_maps" && typeof payload.minimumRating === "number" && prospect.google_rating != null) {
    if (Number(prospect.google_rating) < payload.minimumRating) return false;
  }

  if (payload.source === "google_maps" && payload.onlyValidatedWhatsApp && !prospect.phone) {
    return false;
  }

  if (payload.source === "cnpj" && payload.onlyValidatedWhatsApp && !prospect.phone) {
    return false;
  }

  return true;
}

function prospectToResultRow(jobId: string, source: ProspectingSearchPayload["source"], prospect: Prospect, selected = false): Omit<ProspectingResultRow, "id" | "created_at" | "updated_at"> {
  return {
    job_id: jobId,
    source,
    external_id: String(prospect.id),
    company_name: prospect.business_name,
    trade_name: prospect.analysis_report?.folderName || null,
    legal_name: prospect.normalized_business_name || null,
    contact_name: null,
    category: prospect.category || null,
    cnpj: null,
    normalized_cnpj: null,
    phone: prospect.phone || null,
    normalized_phone: prospect.normalized_phone || null,
    whatsapp: prospect.phone || null,
    whatsapp_status: prospect.phone ? "valid" : "not_checked",
    email: prospect.email || null,
    normalized_email: prospect.email || null,
    secondary_email: null,
    website: prospect.website || null,
    normalized_website_domain: prospect.normalized_website || null,
    instagram_username: prospect.instagram ? String(prospect.instagram).replace(/^@/, "") : null,
    instagram_url: prospect.instagram || null,
    address: prospect.address || null,
    neighborhood: null,
    city: prospect.city || null,
    state: prospect.state || null,
    postal_code: null,
    latitude: null,
    longitude: null,
    rating: prospect.google_rating || null,
    review_count: prospect.google_reviews || null,
    cnae_primary: null,
    cnae_secondary: [],
    raw_payload: prospect,
    duplicate_status: "new",
    duplicate_lead_id: null,
    duplicate_reason: null,
    validation_status: "valid",
    selected,
    imported_to_leads_at: null,
  };
}

async function loadProspectsForJob(ownerUserId: number, payload: ProspectingSearchPayload) {
  const { data, error } = await supabase
    .from("prospects")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  const rows = (data || []) as Prospect[];
  return rows.filter((prospect) => matchesProspectFilter(prospect, payload));
}

async function ensureJobResults(job: ProspectingJobRow, ownerUserId: number) {
  const { data: existingResults, error: existingError } = await supabase
    .from("prospecting_results")
    .select("*")
    .eq("job_id", job.id)
    .order("created_at", { ascending: false });

  if (existingError) throw existingError;
  if ((existingResults || []).length > 0) {
    return (existingResults || []) as ProspectingResultRow[];
  }

  const prospects = await loadProspectsForJob(ownerUserId, job.search_parameters as ProspectingSearchPayload);
  const limitedProspects = prospects.slice(0, Number(job.requested_quantity || 20));
  const resultRows = limitedProspects.map((prospect) => prospectToResultRow(job.id, job.source, prospect));

  if (resultRows.length > 0) {
    const { error: insertError } = await supabase.from("prospecting_results").insert(resultRows);
    if (insertError) throw insertError;
  }

  const status = resultRows.length > 0 ? "completed" : "completed";
  const { error: updateError } = await supabase
    .from("prospecting_jobs")
    .update({
      status,
      processed_count: resultRows.length,
      found_count: resultRows.length,
      valid_count: resultRows.length,
      duplicate_count: 0,
      invalid_count: 0,
      started_at: job.started_at || new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (updateError) throw updateError;

  const { error: eventError } = await supabase.from("prospecting_job_events").insert([
    {
      job_id: job.id,
      event_type: "completed",
      message: resultRows.length > 0 ? `Consulta concluída com ${resultRows.length} resultado(s).` : "Nenhum lead encontrado na base atual.",
      metadata: { source: job.source, total: resultRows.length },
    },
  ]);

  if (eventError) throw eventError;

  return resultRows as ProspectingResultRow[];
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
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return Promise.resolve({ items: [] as CnaeCode[] });

    return supabase
      .from("cnae_codes")
      .select("id, code, formatted_code, description, section")
      .or(
        `code.ilike.%${normalizedQuery}%,formatted_code.ilike.%${normalizedQuery}%,description.ilike.%${normalizedQuery}%`
      )
      .limit(20)
      .then(({ data, error }) => {
        if (error) throw error;
        return {
          items: (data || []).map((item) => ({
            id: String(item.id),
            code: String(item.code),
            formattedCode: String(item.formatted_code),
            description: String(item.description),
            section: item.section || null,
          })),
        };
      });
  },
  getCities(state: string) {
    if (!state) return Promise.resolve({ items: [] as BrazilianCity[] });
    return fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(state)}/municipios`)
      .then((response) => {
        if (!response.ok) throw new Error("Nao foi possivel carregar cidades do IBGE");
        return response.json();
      })
      .then((data) => ({
        items: (Array.isArray(data) ? data : []).map((city) => ({
          id: String(city.id),
          name: String(city.nome),
          state,
        })),
      }));
  },
  async createJob(payload: ProspectingSearchPayload) {
    const ownerUserId = await resolveOwnerUserId();
    const { data, error } = await supabase
      .from("prospecting_jobs")
      .insert({
        source: payload.source,
        status: "queued",
        search_parameters: payload,
        requested_quantity: Number((payload as { quantity?: number }).quantity || 20),
        processed_count: 0,
        found_count: 0,
        duplicate_count: 0,
        valid_count: 0,
        invalid_count: 0,
        created_by: ownerUserId,
      })
      .select("*")
      .single();

    if (error) throw error;

    const job = toJob(data as ProspectingJobRow);

    await supabase.from("prospecting_job_events").insert({
      job_id: job.id,
      event_type: "queued",
      message: "Consulta criada",
      metadata: { source: job.source, quantity: job.requestedQuantity },
    });

    return job;
  },
  async startJob(jobId: string) {
    const ownerUserId = await resolveOwnerUserId();
    const { data: jobRow, error } = await supabase
      .from("prospecting_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (error) throw error;
    if (!jobRow) throw new Error("Job nao encontrado");

    const job = jobRow as ProspectingJobRow;
    await supabase.from("prospecting_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", job.id);
    await supabase.from("prospecting_job_events").insert({
      job_id: job.id,
      event_type: "running",
      message: "Buscando leads na base local",
      metadata: { ownerUserId, source: job.source },
    });

    const results = await ensureJobResults(job, ownerUserId);
    const { data: updatedJob, error: refreshedError } = await supabase
      .from("prospecting_jobs")
      .select("*")
      .eq("id", job.id)
      .maybeSingle();

    if (refreshedError) throw refreshedError;
    return toJob((updatedJob || job) as ProspectingJobRow);
  },
  async getJob(jobId: string) {
    const { data: jobRow, error: jobError } = await supabase
      .from("prospecting_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!jobRow) throw new Error("Job nao encontrado");

    const { data: eventRows, error: eventError } = await supabase
      .from("prospecting_job_events")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (eventError) throw eventError;

    return {
      job: toJob(jobRow as ProspectingJobRow),
      events: (eventRows || []).map((row) => toEvent(row as ProspectingJobEventRow)),
    };
  },
  async cancelJob(jobId: string) {
    const { data, error } = await supabase
      .from("prospecting_jobs")
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", jobId)
      .select("*")
      .single();

    if (error) throw error;

    await supabase.from("prospecting_job_events").insert({
      job_id: jobId,
      event_type: "cancelled",
      message: "Busca cancelada pelo usuario",
      metadata: {},
    });

    return toJob(data as ProspectingJobRow);
  },
  async getResults(jobId: string) {
    const { data, error } = await supabase
      .from("prospecting_results")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { items: (data || []).map((row) => toResult(row as ProspectingResultRow)) };
  },
  async importResults(payload: LeadImportPayload) {
    const ownerUserId = await resolveOwnerUserId();
    const { data: results, error } = await supabase
      .from("prospecting_results")
      .select("*")
      .in("id", payload.resultIds);

    if (error) throw error;

    let imported = 0;
    let skippedDuplicates = 0;
    let failed = 0;

    for (const rawRow of results || []) {
      const result = rawRow as ProspectingResultRow;
      if (result.duplicate_status === "duplicate") {
        skippedDuplicates += 1;
        continue;
      }

      const prospectInsert = {
        owner_user_id: ownerUserId,
        business_name: result.company_name,
        normalized_business_name: normalizeText(result.company_name),
        category: result.category,
        address: result.address,
        city: result.city,
        state: result.state,
        phone: result.phone,
        normalized_phone: result.normalized_phone,
        email: result.email,
        website: result.website,
        normalized_website: result.normalized_website_domain,
        google_maps_url: result.source === "google_maps" ? result.raw_payload && typeof result.raw_payload === "object" && "google_maps_url" in result.raw_payload ? String((result.raw_payload as Record<string, unknown>).google_maps_url || "") || null : null : null,
        google_rating: result.rating,
        google_reviews: result.review_count || 0,
        instagram: result.instagram_url,
        facebook: null,
        website_exists: Boolean(result.website),
        pagespeed_mobile: null,
        pagespeed_desktop: null,
        seo_score: null,
        lead_score: result.whatsapp_status === "valid" ? 75 : 55,
        website_quality: null,
        problems_found: [],
        approach_suggestion: null,
        diagnostic_summary: null,
        analysis_report: {
          folderName: payload.folderName || "Novos",
          source: result.source,
          origin: payload.origin,
          tags: payload.tags || [],
          importedFromProspectingResultId: result.id,
        },
        last_contact_date: null,
        status: payload.status as DatabaseProspectStatus,
      };

      const { error: insertError } = await supabase.from("prospects").insert(prospectInsert);
      if (insertError) {
        failed += 1;
        continue;
      }

      await supabase.from("prospecting_results").update({ imported_to_leads_at: new Date().toISOString() }).eq("id", result.id);
      await supabase.from("prospect_contact_history").insert({
        prospect_id: null,
        owner_user_id: ownerUserId,
        channel: "system",
        subject: "Importacao de lead",
        message: `Lead ${result.company_name} importado para ${payload.folderName}.`,
        recipient: null,
        delivery_status: "registrado",
        metadata: { source: result.source, resultId: result.id },
      });
      imported += 1;
    }

    return {
      imported,
      skippedDuplicates,
      failed,
      message: `${imported} lead(s) adicionados, ${skippedDuplicates} ignorado(s) por duplicidade e ${failed} falha(s).`,
    };
  },
  async getHistory() {
    const ownerUserId = await resolveOwnerUserId();
    const { data, error } = await supabase
      .from("prospecting_jobs")
      .select("*")
      .eq("created_by", ownerUserId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;
    return { items: (data || []).map((row) => toJob(row as ProspectingJobRow)) };
  },
};

