const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');

const router = express.Router();

const DEFAULT_APIFY_TIMEOUT_MINUTES = 10;
const DEFAULT_APIFY_POLL_SECONDS = 5;
const DEFAULT_CASA_BASE_URL = 'https://api.casadosdados.com.br';
const DEFAULT_CASA_API_VERSION = 'v5';
const INTEGRATION_PROVIDER_ORDER = ['apify', 'casa_dos_dados', 'whatsapp_validator', 'smtp'];
const INTEGRATION_PROVIDER_LABELS = {
  apify: {
    displayName: 'Apify',
    description: 'Executa os scrapers de Google Maps e Instagram utilizados pelo mÃ³dulo de prospecÃ§Ã£o.',
  },
  casa_dos_dados: {
    displayName: 'Casa dos Dados',
    description: 'Realiza pesquisas empresariais por CNAE, estado, cidade e situaÃ§Ã£o cadastral.',
  },
  whatsapp_validator: {
    displayName: 'Evolution API',
    description: 'Valida telefones WhatsApp por meio da Evolution API configurada no backend.',
  },
  smtp: {
    displayName: 'SMTP',
    description: 'Envia emails transacionais e em massa com as credenciais do provedor configurado.',
  },
};

function createLazySupabaseClient(keyName) {
  let client = null;
  return new Proxy({}, {
    get(_target, prop) {
      if (!client) {
        if (!process.env.SUPABASE_URL || !process.env[keyName]) {
          throw new Error(`Variaveis SUPABASE_URL e ${keyName} precisam estar configuradas no backend.`);
        }
        client = createClient(process.env.SUPABASE_URL, process.env[keyName]);
      }
      return client[prop];
    },
  });
}

const adminSupabase = createLazySupabaseClient('SUPABASE_SERVICE_ROLE_KEY');
const authSupabase = createLazySupabaseClient('SUPABASE_ANON_KEY');

const cnaeSeed = [
  { id: '6920601', code: '6920601', formattedCode: '6920-6/01', description: 'Atividades de contabilidade', section: 'Atividades profissionais' },
  { id: '8630503', code: '8630503', formattedCode: '8630-5/03', description: 'Atividade medica ambulatorial restrita a consultas', section: 'Saude humana' },
  { id: '7311400', code: '7311400', formattedCode: '7311-4/00', description: 'Agencias de publicidade', section: 'Comunicacao' },
  { id: '6911701', code: '6911701', formattedCode: '6911-7/01', description: 'Servicos advocaticios', section: 'Atividades profissionais' },
  { id: '8591100', code: '8591100', formattedCode: '8591-1/00', description: 'Ensino de esportes', section: 'Educacao' },
  { id: '8650004', code: '8650004', formattedCode: '8650-0/04', description: 'Atividades de fisioterapia', section: 'Saude humana' },
  { id: '7111100', code: '7111100', formattedCode: '7111-1/00', description: 'Servicos de arquitetura', section: 'Arquitetura e engenharia' },
  { id: '6821801', code: '6821801', formattedCode: '6821-8/01', description: 'Corretagem na compra e venda e avaliacao de imoveis', section: 'Atividades imobiliarias' },
];

function cleanString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function cleanBoolean(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return null;
}

function cleanNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeBrazilianPhone(value) {
  let digits = onlyDigits(value);
  if (!digits) return null;
  digits = digits.replace(/^0+/, '');
  if (digits.startsWith('55')) {
    const national = digits.slice(2);
    return national.length >= 10 && national.length <= 11 ? digits : null;
  }
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

function normalizeCnpj(value) {
  const digits = onlyDigits(value);
  return digits.length === 14 ? digits : null;
}

function normalizeEmail(value) {
  return cleanString(value)?.toLowerCase() || null;
}

function normalizeWebsiteDomain(value) {
  const trimmed = cleanString(value);
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase();
  }
}

function normalizeIntegrationMetadata(provider, metadata) {
  const source = metadata && typeof metadata === 'object' ? metadata : {};

  if (provider === 'apify') {
    return {
      token: cleanString(source.token),
      googleMapsActorId: cleanString(source.googleMapsActorId),
      instagramActorId: cleanString(source.instagramActorId),
      timeoutMinutes: cleanNumber(source.timeoutMinutes) ?? DEFAULT_APIFY_TIMEOUT_MINUTES,
      pollIntervalSeconds: cleanNumber(source.pollIntervalSeconds) ?? DEFAULT_APIFY_POLL_SECONDS,
    };
  }

  if (provider === 'casa_dos_dados') {
    return {
      apiKey: cleanString(source.apiKey),
      baseUrl: cleanString(source.baseUrl) || DEFAULT_CASA_BASE_URL,
      apiVersion: cleanString(source.apiVersion) || DEFAULT_CASA_API_VERSION,
    };
  }

  if (provider === 'whatsapp_validator') {
    return {
      baseUrl: cleanString(source.baseUrl),
      apiKey: cleanString(source.apiKey),
      instanceName: cleanString(source.instanceName),
      cacheDays: cleanNumber(source.cacheDays) ?? 30,
    };
  }

  if (provider === 'smtp') {
    return {
      host: cleanString(source.host),
      port: cleanNumber(source.port) ?? 587,
      secure: cleanBoolean(source.secure) ?? false,
      user: cleanString(source.user),
      pass: cleanString(source.pass),
      from: cleanString(source.from),
    };
  }

  return source;
}

function buildIntegrationDefaults() {
  return {
    apify: {
      token: process.env.APIFY_TOKEN || '',
      googleMapsActorId: process.env.APIFY_GOOGLE_MAPS_ACTOR || '',
      instagramActorId: process.env.APIFY_INSTAGRAM_ACTOR || '',
      timeoutMinutes: Number(process.env.APIFY_TIMEOUT_MINUTES || DEFAULT_APIFY_TIMEOUT_MINUTES),
      pollIntervalSeconds: Number(process.env.APIFY_POLL_INTERVAL_SECONDS || DEFAULT_APIFY_POLL_SECONDS),
    },
    casa_dos_dados: {
      apiKey: process.env.CASA_DOS_DADOS_API_KEY || '',
      baseUrl: process.env.CASA_DOS_DADOS_BASE_URL || DEFAULT_CASA_BASE_URL,
      apiVersion: process.env.CASA_DOS_DADOS_API_VERSION || DEFAULT_CASA_API_VERSION,
    },
    whatsapp_validator: {
      baseUrl: process.env.EVOLUTION_API_BASE_URL || process.env.WHATSAPP_VALIDATION_BASE_URL || '',
      apiKey: process.env.EVOLUTION_API_KEY || process.env.WHATSAPP_VALIDATION_API_KEY || '',
      instanceName: process.env.EVOLUTION_API_INSTANCE || process.env.WHATSAPP_VALIDATION_PROVIDER || '',
      cacheDays: Number(process.env.WHATSAPP_VALIDATION_CACHE_DAYS || 30),
    },
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || '',
    },
  };
}

function buildIntegrationSummary(provider, row) {
  const defaults = buildIntegrationDefaults();
  const base = defaults[provider] || {};
  const metadata = normalizeIntegrationMetadata(provider, row?.configuration_metadata || {});
  const mergedMetadata = { ...base, ...metadata };
  const label = INTEGRATION_PROVIDER_LABELS[provider];
  const configured =
    provider === 'apify'
      ? Boolean(mergedMetadata.token)
      : provider === 'casa_dos_dados'
        ? Boolean(mergedMetadata.apiKey)
        : provider === 'whatsapp_validator'
          ? Boolean(mergedMetadata.baseUrl && mergedMetadata.apiKey)
          : Boolean(mergedMetadata.host && mergedMetadata.user && mergedMetadata.pass && mergedMetadata.from);
  const status = row?.status || (configured ? 'configured' : 'not_configured');

  return {
    provider,
    displayName: label.displayName,
    description: label.description,
    status,
    configured: status !== 'not_configured',
    connected: row?.status === 'connected',
    lastTestedAt: row?.last_tested_at || null,
    lastError: row?.last_error || null,
    tokenMasked: provider === 'apify' ? maskSecret(mergedMetadata.token) : null,
    apiKeyMasked: provider === 'casa_dos_dados' || provider === 'whatsapp_validator' ? maskSecret(mergedMetadata.apiKey) : null,
    passwordMasked: provider === 'smtp' ? maskSecret(mergedMetadata.pass) : null,
    secure: provider === 'smtp' ? Boolean(mergedMetadata.secure) : null,
    creditsBalance: null,
    metadata: mergedMetadata,
  };
}

async function loadIntegrationSummaries() {
  const { data, error } = await adminSupabase
    .from('integration_providers')
    .select('*');

  if (error) {
    if (isMissingRelation(error)) {
      return INTEGRATION_PROVIDER_ORDER.map((provider) => buildIntegrationSummary(provider, null));
    }
    throw error;
  }

  const rowsByProvider = new Map((data || []).map((row) => [row.provider, row]));
  return INTEGRATION_PROVIDER_ORDER.map((provider) => buildIntegrationSummary(provider, rowsByProvider.get(provider) || null));
}

async function saveIntegrationProvider(provider, metadata) {
  const normalizedMetadata = normalizeIntegrationMetadata(provider, metadata);
  const summary = buildIntegrationSummary(provider, {
    status: null,
    configuration_metadata: normalizedMetadata,
    last_tested_at: null,
    last_error: null,
  });

  const { data, error } = await adminSupabase
    .from('integration_providers')
    .upsert(
      {
        provider,
        display_name: summary.displayName,
        status: summary.configured ? 'configured' : 'not_configured',
        configuration_metadata: normalizedMetadata,
        last_error: null,
      },
      { onConflict: 'provider' }
    )
    .select('*')
    .single();

  if (error) {
    if (isMissingRelation(error)) return null;
    throw error;
  }

  return buildIntegrationSummary(provider, data);
}

async function markIntegrationTestResult(provider, success, lastError = null) {
  const { error } = await adminSupabase
    .from('integration_providers')
    .update({
      status: success ? 'connected' : 'auth_error',
      last_tested_at: new Date().toISOString(),
      last_error: lastError,
    })
    .eq('provider', provider);

  if (error && !isMissingRelation(error)) throw error;
}

function applyIntegrationToProcess(provider, metadata) {
  if (provider === 'apify') {
    process.env.APIFY_TOKEN = metadata.token || '';
    process.env.APIFY_GOOGLE_MAPS_ACTOR = metadata.googleMapsActorId || '';
    process.env.APIFY_INSTAGRAM_ACTOR = metadata.instagramActorId || '';
    process.env.APIFY_TIMEOUT_MINUTES = String(metadata.timeoutMinutes || DEFAULT_APIFY_TIMEOUT_MINUTES);
    process.env.APIFY_POLL_INTERVAL_SECONDS = String(metadata.pollIntervalSeconds || DEFAULT_APIFY_POLL_SECONDS);
  }

  if (provider === 'casa_dos_dados') {
    process.env.CASA_DOS_DADOS_API_KEY = metadata.apiKey || '';
    process.env.CASA_DOS_DADOS_BASE_URL = metadata.baseUrl || DEFAULT_CASA_BASE_URL;
    process.env.CASA_DOS_DADOS_API_VERSION = metadata.apiVersion || DEFAULT_CASA_API_VERSION;
  }

  if (provider === 'whatsapp_validator') {
    process.env.EVOLUTION_API_BASE_URL = metadata.baseUrl || '';
    process.env.EVOLUTION_API_KEY = metadata.apiKey || '';
    process.env.EVOLUTION_API_INSTANCE = metadata.instanceName || '';
    process.env.WHATSAPP_VALIDATION_BASE_URL = metadata.baseUrl || '';
    process.env.WHATSAPP_VALIDATION_API_KEY = metadata.apiKey || '';
    process.env.WHATSAPP_VALIDATION_PROVIDER = metadata.instanceName || '';
    process.env.WHATSAPP_VALIDATION_CACHE_DAYS = String(metadata.cacheDays || 30);
  }

  if (provider === 'smtp') {
    process.env.SMTP_HOST = metadata.host || '';
    process.env.SMTP_PORT = String(metadata.port || 587);
    process.env.SMTP_SECURE = metadata.secure ? 'true' : 'false';
    process.env.SMTP_USER = metadata.user || '';
    process.env.SMTP_PASS = metadata.pass || '';
    process.env.EMAIL_FROM = metadata.from || '';
    process.env.SMTP_FROM = metadata.from || '';
  }
}

function normalizeInstagramUsername(value) {
  return cleanString(value)
    ?.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]
    .toLowerCase() || null;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMissingRelation(error) {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42P01' || message.includes('does not exist') || message.includes('schema cache');
}

function sendMigrationRequired(res, error) {
  return res.status(409).json({
    error: 'Estrutura de prospeccao pendente',
    message: 'Execute e revise database/proposed_prospecting_v2.sql no Supabase antes de usar jobs, resultados e importacao.',
    details: error?.message,
  });
}

async function resolveOwnerUserId(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    const error = new Error('Token nao fornecido');
    error.statusCode = 401;
    throw error;
  }

  const { data, error } = await authSupabase.auth.getUser(token);
  if (error || !data?.user?.email) {
    const authError = new Error('Token invalido');
    authError.statusCode = 401;
    throw authError;
  }

  const { data: userRow, error: userError } = await adminSupabase
    .from('users')
    .select('id, email, role')
    .eq('email', data.user.email)
    .limit(1)
    .maybeSingle();

  if (userError) throw userError;
  if (!userRow?.id) {
    const notFoundError = new Error('Usuario nao encontrado na tabela users');
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  return userRow;
}

function getIntegrationConfig() {
  const defaults = buildIntegrationDefaults();
  return {
    apify: defaults.apify,
    casaDosDados: defaults.casa_dos_dados,
    whatsapp: {
      provider: defaults.whatsapp_validator.instanceName,
      apiKey: defaults.whatsapp_validator.apiKey,
      baseUrl: defaults.whatsapp_validator.baseUrl,
      instanceName: defaults.whatsapp_validator.instanceName,
      cacheDays: defaults.whatsapp_validator.cacheDays,
    },
    smtp: defaults.smtp,
  };
}

function maskSecret(value) {
  if (!value) return null;
  const stringValue = String(value);
  if (stringValue.length <= 4) return '****';
  return `${'•'.repeat(12)}${stringValue.slice(-4)}`;
}

async function logJobEvent(jobId, eventType, message, metadata = {}) {
  const { error } = await adminSupabase
    .from('prospecting_job_events')
    .insert({ job_id: jobId, event_type: eventType, message, metadata });
  if (error && !isMissingRelation(error)) throw error;
}

function mapJob(row) {
  return {
    id: row.id,
    source: row.source,
    status: row.status,
    searchParameters: row.search_parameters || {},
    requestedQuantity: row.requested_quantity || 0,
    processedCount: row.processed_count || 0,
    foundCount: row.found_count || 0,
    duplicateCount: row.duplicate_count || 0,
    validCount: row.valid_count || 0,
    invalidCount: row.invalid_count || 0,
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

function mapResult(row) {
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
    phone: row.phone,
    normalizedPhone: row.normalized_phone,
    whatsappStatus: row.whatsapp_status,
    email: row.email,
    secondaryEmail: row.secondary_email,
    website: row.website,
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
    cnaeSecondary: row.cnae_secondary || [],
    duplicateStatus: row.duplicate_status,
    duplicateLeadId: row.duplicate_lead_id,
    duplicateReason: row.duplicate_reason,
    validationStatus: row.validation_status,
    selected: row.selected,
    importedToLeadsAt: row.imported_to_leads_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function testApify() {
  const { apify } = getIntegrationConfig();
  if (!apify.token) throw new Error('A integracao com a Apify nao esta configurada.');
  const response = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(apify.token)}`);
  if (!response.ok) throw new Error('Token da Apify invalido ou sem acesso.');
  const account = await response.json();
  const checks = [];
  for (const actorId of [apify.googleMapsActorId, apify.instagramActorId].filter(Boolean)) {
    const normalizedActor = String(actorId).replace('/', '~');
    const actorResponse = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(normalizedActor)}?token=${encodeURIComponent(apify.token)}`);
    if (!actorResponse.ok) throw new Error(`Actor ${actorId} nao encontrado ou indisponivel.`);
    checks.push(`Actor ${actorId} localizado`);
  }
  return { success: true, message: `Apify conectada para ${account?.data?.username || 'a conta informada'}.`, details: checks };
}

async function testCasaDosDados() {
  const { casaDosDados } = getIntegrationConfig();
  if (!casaDosDados.apiKey) throw new Error('A API Key da Casa dos Dados nao esta configurada.');
  const response = await fetch(`${casaDosDados.baseUrl.replace(/\/$/, '')}/${casaDosDados.apiVersion}/health`, {
    headers: { Authorization: `Bearer ${casaDosDados.apiKey}` },
  });
  if (!response.ok) throw new Error('Nao foi possivel validar a Casa dos Dados com uma chamada de baixo consumo.');
  return { success: true, message: 'Casa dos Dados validada com sucesso.' };
}

async function testEvolutionApi() {
  const { whatsapp } = getIntegrationConfig();
  if (!whatsapp.baseUrl) throw new Error('A Evolution API nao esta configurada.');
  if (!whatsapp.apiKey) throw new Error('A chave da Evolution API nao esta configurada.');

  const normalizedBaseUrl = whatsapp.baseUrl.replace(/\/$/, '');
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 8000);

  try {
    const response = await fetch(normalizedBaseUrl, {
      method: 'GET',
      headers: {
        apikey: whatsapp.apiKey,
        Authorization: `Bearer ${whatsapp.apiKey}`,
      },
      signal: abortController.signal,
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('A Evolution API recusou a autenticacao informada.');
    }

    return {
      success: true,
      message: `Evolution API acessivel em ${normalizedBaseUrl}.`,
      details: whatsapp.instanceName ? [`Instancia: ${whatsapp.instanceName}`] : [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function testSmtp() {
  const { smtp } = getIntegrationConfig();
  if (!smtp.host) throw new Error('O host SMTP nao esta configurado.');
  if (!smtp.user) throw new Error('O usuario SMTP nao esta configurado.');
  if (!smtp.pass) throw new Error('A senha SMTP nao esta configurada.');
  if (!smtp.from) throw new Error('O remetente SMTP nao esta configurado.');

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: Number(smtp.port || 587),
    secure: Boolean(smtp.secure),
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  await transport.verify();
  return {
    success: true,
    message: 'SMTP validado com sucesso.',
    details: [`Remetente: ${smtp.from}`],
  };
}

async function runApifyActor(actorId, input) {
  const { apify } = getIntegrationConfig();
  if (!apify.token) throw new Error('A integracao com a Apify nao esta configurada. Acesse Administracao / Integracoes.');
  if (!actorId) throw new Error('Actor da Apify nao configurado para esta fonte.');

  const normalizedActor = String(actorId).replace('/', '~');
  const response = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(normalizedActor)}/run-sync-get-dataset-items?token=${encodeURIComponent(apify.token)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Falha ao executar Actor da Apify: ${body.slice(0, 180)}`);
  }

  return response.json();
}

function normalizeApifyGoogleItem(item, fallback = {}) {
  const website = cleanString(item.website || item.url || item.webUrl);
  const phone = cleanString(item.phone || item.phoneUnformatted || item.phoneNumber);
  return {
    source: 'google_maps',
    external_id: cleanString(item.placeId || item.id || item.cid),
    company_name: cleanString(item.title || item.name || item.businessName) || 'Empresa sem nome',
    category: cleanString(item.categoryName || item.category || fallback.searchTerms),
    phone,
    normalized_phone: normalizeBrazilianPhone(phone),
    whatsapp_status: 'not_checked',
    email: normalizeEmail(item.email),
    normalized_email: normalizeEmail(item.email),
    website,
    normalized_website_domain: normalizeWebsiteDomain(website),
    address: cleanString(item.address),
    city: cleanString(item.city || fallback.city),
    state: cleanString(item.state || fallback.state),
    latitude: item.location?.lat || item.latitude || null,
    longitude: item.location?.lng || item.longitude || null,
    rating: item.totalScore || item.rating || null,
    review_count: item.reviewsCount || item.reviewCount || 0,
    raw_payload: item,
  };
}

function normalizeApifyInstagramItem(item, fallback = {}) {
  const username = normalizeInstagramUsername(item.username || item.handle || item.url);
  const phone = cleanString(item.phone || item.publicPhoneNumber);
  return {
    source: 'instagram',
    external_id: cleanString(item.id || username),
    company_name: cleanString(item.fullName || item.name || username) || 'Perfil sem nome',
    category: cleanString(item.biography || fallback.searchTerms),
    phone,
    normalized_phone: normalizeBrazilianPhone(phone),
    whatsapp_status: 'not_checked',
    email: normalizeEmail(item.email || item.publicEmail),
    normalized_email: normalizeEmail(item.email || item.publicEmail),
    website: cleanString(item.externalUrl || item.website),
    normalized_website_domain: normalizeWebsiteDomain(item.externalUrl || item.website),
    instagram_username: username,
    instagram_url: username ? `https://instagram.com/${username}` : cleanString(item.url),
    raw_payload: item,
  };
}

function detectDuplicate(result, existingProspects) {
  for (const prospect of existingProspects) {
    if (result.normalized_cnpj && normalizeCnpj(prospect.analysis_report?.cnpj) === result.normalized_cnpj) {
      return { duplicate_status: 'duplicate', duplicate_lead_id: String(prospect.id), duplicate_reason: 'cnpj' };
    }
    if (result.normalized_phone && prospect.normalized_phone === result.normalized_phone) {
      return { duplicate_status: 'duplicate', duplicate_lead_id: String(prospect.id), duplicate_reason: 'telefone' };
    }
    if (result.normalized_email && normalizeEmail(prospect.email) === result.normalized_email) {
      return { duplicate_status: 'possible_duplicate', duplicate_lead_id: String(prospect.id), duplicate_reason: 'email' };
    }
    if (result.normalized_website_domain && prospect.normalized_website === result.normalized_website_domain) {
      return { duplicate_status: 'possible_duplicate', duplicate_lead_id: String(prospect.id), duplicate_reason: 'website' };
    }
    const sameName = normalizeName(prospect.business_name) === normalizeName(result.company_name);
    const sameLocation = cleanString(prospect.city)?.toLowerCase() === cleanString(result.city)?.toLowerCase()
      && cleanString(prospect.state)?.toLowerCase() === cleanString(result.state)?.toLowerCase();
    if (sameName && sameLocation) {
      return { duplicate_status: 'possible_duplicate', duplicate_lead_id: String(prospect.id), duplicate_reason: 'nome_localizacao' };
    }
  }
  return { duplicate_status: 'new', duplicate_lead_id: null, duplicate_reason: null };
}

async function processJob(job, ownerUserId) {
  const params = job.search_parameters || {};
  await adminSupabase.from('prospecting_jobs').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', job.id);
  await logJobEvent(job.id, 'preparing', 'Preparando consulta');

  let rawItems = [];
  if (job.source === 'google_maps') {
    const terms = String(params.searchTerms || '').split('\n').map((term) => term.trim()).filter(Boolean);
    const maxItems = Math.min(Number(job.requested_quantity || 20), 100);
    await logJobEvent(job.id, 'provider', 'Enviando busca ao Actor do Google Maps');
    rawItems = await runApifyActor(getIntegrationConfig().apify.googleMapsActorId, {
      searchTerms: terms,
      maxItems,
      includeReviews: false,
    });
    rawItems = rawItems.map((item) => normalizeApifyGoogleItem(item, params));
  } else if (job.source === 'instagram') {
    await logJobEvent(job.id, 'provider', 'Enviando busca ao Actor do Instagram');
    rawItems = await runApifyActor(getIntegrationConfig().apify.instagramActorId, {
      search: params.searchTerms,
      maxItems: Math.min(Number(job.requested_quantity || 20), 100),
    });
    rawItems = rawItems.map((item) => normalizeApifyInstagramItem(item, params));
  } else {
    throw new Error('A execucao da Casa dos Dados depende da API real configurada e da migration aplicada.');
  }

  await adminSupabase.from('prospecting_jobs').update({ status: 'normalizing', found_count: rawItems.length }).eq('id', job.id);
  await logJobEvent(job.id, 'normalizing', 'Normalizando contatos');

  const { data: existingProspects, error: existingError } = await adminSupabase
    .from('prospects')
    .select('*')
    .eq('owner_user_id', ownerUserId);
  if (existingError) throw existingError;

  const rows = rawItems.slice(0, job.requested_quantity).map((item) => ({
    ...item,
    job_id: job.id,
    ...detectDuplicate(item, existingProspects || []),
    validation_status: item.company_name ? 'valid' : 'invalid',
    selected: false,
  }));

  const filteredRows = params.onlyValidatedWhatsApp
    ? rows.filter((item) => item.whatsapp_status === 'valid')
    : rows;

  if (filteredRows.length) {
    const { error: insertError } = await adminSupabase.from('prospecting_results').insert(filteredRows);
    if (insertError) throw insertError;
  }

  const duplicateCount = filteredRows.filter((item) => item.duplicate_status !== 'new').length;
  const validCount = filteredRows.filter((item) => item.validation_status === 'valid').length;
  const invalidCount = filteredRows.length - validCount;

  const { data: updatedJob, error: updateError } = await adminSupabase
    .from('prospecting_jobs')
    .update({
      status: 'completed',
      processed_count: filteredRows.length,
      found_count: rawItems.length,
      duplicate_count: duplicateCount,
      valid_count: validCount,
      invalid_count: invalidCount,
      completed_at: new Date().toISOString(),
      integration_provider: job.source === 'instagram' ? 'apify_instagram' : 'apify_google_maps',
    })
    .eq('id', job.id)
    .select()
    .single();

  if (updateError) throw updateError;
  await logJobEvent(job.id, 'completed', 'Busca finalizada');
  return mapJob(updatedJob);
}

router.get('/integrations', async (req, res) => {
  try {
    await resolveOwnerUserId(req);
    const integrations = await loadIntegrationSummaries();
    res.json({ integrations });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao carregar integracoes' });
  }
});

router.put('/integrations/:provider', async (req, res) => {
  try {
    await resolveOwnerUserId(req);
    const provider = req.params.provider;
    if (!INTEGRATION_PROVIDER_ORDER.includes(provider)) {
      return res.status(404).json({ error: 'Integracao nao encontrada' });
    }
    const normalizedMetadata = normalizeIntegrationMetadata(provider, req.body?.metadata || req.body || {});
    const savedIntegration = await saveIntegrationProvider(provider, normalizedMetadata);
    applyIntegrationToProcess(provider, normalizedMetadata);
    const response = savedIntegration || buildIntegrationSummary(provider, {
      status: null,
      configuration_metadata: normalizedMetadata,
      last_tested_at: null,
      last_error: null,
    });
    res.json(response);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao salvar integracao' });
  }
});

router.post('/integrations/:provider/test', async (req, res) => {
  try {
    await resolveOwnerUserId(req);
    const provider = req.params.provider;
    if (provider === 'apify') {
      const result = await testApify();
      await markIntegrationTestResult(provider, true, null);
      return res.json(result);
    }
    if (provider === 'casa_dos_dados') {
      const result = await testCasaDosDados();
      await markIntegrationTestResult(provider, true, null);
      return res.json(result);
    }
    if (provider === 'whatsapp_validator') {
      const result = await testEvolutionApi();
      await markIntegrationTestResult(provider, true, null);
      return res.json(result);
    }
    if (provider === 'smtp') {
      const result = await testSmtp();
      await markIntegrationTestResult(provider, true, null);
      return res.json(result);
    }
    return res.status(400).json({ error: 'Integracao invalida' });
  } catch (error) {
    if (['apify', 'casa_dos_dados', 'whatsapp_validator', 'smtp'].includes(req.params.provider)) {
      await markIntegrationTestResult(req.params.provider, false, error.message || 'Falha ao testar integracao').catch(() => {});
    }
    res.status(error.statusCode || 500).json({ success: false, error: error.message || 'Falha ao testar integracao' });
  }
});

router.get('/cnaes', async (req, res) => {
  try {
    await resolveOwnerUserId(req);
    const query = normalizeName(req.query.q);
    const items = cnaeSeed
      .filter((item) => !query || normalizeName(`${item.code} ${item.formattedCode} ${item.description}`).includes(query))
      .slice(0, 20)
      .map((item) => ({ ...item, formattedCode: item.formattedCode }));
    res.json({ items });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao buscar CNAEs' });
  }
});

router.get('/cities', async (req, res) => {
  try {
    await resolveOwnerUserId(req);
    const state = cleanString(req.query.state);
    if (!state) return res.json({ items: [] });
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(state)}/municipios`);
    if (!response.ok) throw new Error('Nao foi possivel carregar cidades do IBGE');
    const data = await response.json();
    res.json({ items: (Array.isArray(data) ? data : []).map((city) => ({ id: String(city.id), name: city.nome, state })) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao carregar cidades' });
  }
});

router.post('/jobs', async (req, res) => {
  try {
    const user = await resolveOwnerUserId(req);
    const body = req.body || {};
    const source = body.source;
    const quantity = Math.min(100, Math.max(1, Number(body.quantity || 20)));
    if (!['google_maps', 'cnpj', 'instagram'].includes(source)) return res.status(400).json({ error: 'Fonte invalida' });

    const { data, error } = await adminSupabase
      .from('prospecting_jobs')
      .insert({
        source,
        status: 'queued',
        search_parameters: body,
        requested_quantity: quantity,
        created_by: user.id,
        credits_estimated: null,
      })
      .select()
      .single();

    if (error) {
      if (isMissingRelation(error)) return sendMigrationRequired(res, error);
      throw error;
    }

    await logJobEvent(data.id, 'queued', 'Consulta criada');
    res.json(mapJob(data));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao criar job de prospeccao' });
  }
});

router.post('/jobs/:id/start', async (req, res) => {
  try {
    const user = await resolveOwnerUserId(req);
    const { data: job, error } = await adminSupabase
      .from('prospecting_jobs')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();
    if (error) {
      if (isMissingRelation(error)) return sendMigrationRequired(res, error);
      throw error;
    }
    if (!job) return res.status(404).json({ error: 'Job nao encontrado' });
    res.json(await processJob(job, user.id));
  } catch (error) {
    await adminSupabase
      .from('prospecting_jobs')
      .update({ status: 'failed', failed_at: new Date().toISOString(), error_message: error.message })
      .eq('id', req.params.id);
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao executar job' });
  }
});

router.get('/jobs/:id', async (req, res) => {
  try {
    await resolveOwnerUserId(req);
    const { data: job, error } = await adminSupabase.from('prospecting_jobs').select('*').eq('id', req.params.id).maybeSingle();
    if (error) {
      if (isMissingRelation(error)) return sendMigrationRequired(res, error);
      throw error;
    }
    if (!job) return res.status(404).json({ error: 'Job nao encontrado' });
    const { data: events, error: eventsError } = await adminSupabase
      .from('prospecting_job_events')
      .select('*')
      .eq('job_id', req.params.id)
      .order('created_at', { ascending: true });
    if (eventsError) throw eventsError;
    res.json({
      job: mapJob(job),
      events: (events || []).map((event) => ({
        id: event.id,
        jobId: event.job_id,
        eventType: event.event_type,
        message: event.message,
        metadata: event.metadata,
        createdAt: event.created_at,
      })),
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao carregar job' });
  }
});

router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    await resolveOwnerUserId(req);
    const { data, error } = await adminSupabase
      .from('prospecting_jobs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) {
      if (isMissingRelation(error)) return sendMigrationRequired(res, error);
      throw error;
    }
    await logJobEvent(req.params.id, 'cancelled', 'Busca cancelada pelo usuario');
    res.json(mapJob(data));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao cancelar job' });
  }
});

router.get('/jobs/:id/results', async (req, res) => {
  try {
    await resolveOwnerUserId(req);
    const { data, error } = await adminSupabase
      .from('prospecting_results')
      .select('*')
      .eq('job_id', req.params.id)
      .order('created_at', { ascending: false });
    if (error) {
      if (isMissingRelation(error)) return sendMigrationRequired(res, error);
      throw error;
    }
    res.json({ items: (data || []).map(mapResult) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao carregar resultados' });
  }
});

router.post('/imports', async (req, res) => {
  try {
    const user = await resolveOwnerUserId(req);
    const resultIds = Array.isArray(req.body.resultIds) ? req.body.resultIds : [];
    if (resultIds.length === 0) return res.status(400).json({ error: 'Selecione ao menos um resultado' });

    const { data: results, error } = await adminSupabase.from('prospecting_results').select('*').in('id', resultIds);
    if (error) {
      if (isMissingRelation(error)) return sendMigrationRequired(res, error);
      throw error;
    }

    let imported = 0;
    let skippedDuplicates = 0;
    let failed = 0;

    for (const result of results || []) {
      if (result.duplicate_status === 'duplicate') {
        skippedDuplicates += 1;
        continue;
      }
      try {
        const { error: insertError } = await adminSupabase.from('prospects').insert({
          owner_user_id: user.id,
          business_name: result.company_name,
          normalized_business_name: normalizeName(result.company_name),
          category: result.category || result.cnae_primary,
          address: result.address,
          city: result.city,
          state: result.state,
          phone: result.phone,
          normalized_phone: result.normalized_phone,
          email: result.email,
          website: result.website,
          normalized_website: result.normalized_website_domain,
          google_maps_url: result.source === 'google_maps' ? result.raw_payload?.googleUrl || result.raw_payload?.url || null : null,
          google_rating: result.rating,
          google_reviews: result.review_count || 0,
          instagram: result.instagram_url,
          website_exists: Boolean(result.website),
          lead_score: result.whatsapp_status === 'valid' ? 75 : 55,
          status: req.body.status || 'Novo',
          analysis_report: {
            folderName: req.body.folderName || 'Novos',
            source: result.source,
            origin: req.body.origin,
            tags: req.body.tags || [],
            cnpj: result.normalized_cnpj,
            whatsappStatus: result.whatsapp_status,
            importedFromProspectingResultId: result.id,
          },
        });
        if (insertError) throw insertError;
        await adminSupabase.from('prospecting_results').update({ imported_to_leads_at: new Date().toISOString() }).eq('id', result.id);
        imported += 1;
      } catch {
        failed += 1;
      }
    }

    res.json({
      imported,
      skippedDuplicates,
      failed,
      message: `${imported} lead(s) adicionados, ${skippedDuplicates} ignorado(s) por duplicidade e ${failed} falha(s).`,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao importar leads' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const user = await resolveOwnerUserId(req);
    const { data, error } = await adminSupabase
      .from('prospecting_jobs')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      if (isMissingRelation(error)) return sendMigrationRequired(res, error);
      throw error;
    }
    res.json({ items: (data || []).map(mapJob) });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao carregar historico' });
  }
});

module.exports = router;

