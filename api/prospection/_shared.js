const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const DEFAULT_APIFY_ACTOR = 'datamech/apify-google-maps-scraper';
const DEFAULT_CASA_BASE_URL = 'https://api.casadosdados.com.br';
const DEFAULT_CASA_API_VERSION = 'v5';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
const INTEGRATION_SETTINGS_PREFIX = 'prospection_integrations_user_';

function getAdminSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getAuthSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return {};

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString();
  return rawBody ? JSON.parse(rawBody) : {};
}

function cleanNullableString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function cleanOptionalString(value) {
  if (value === undefined || value === null) return undefined;
  return String(value).trim();
}

function maskSecret(value) {
  if (!value) return null;
  const stringValue = String(value);
  if (stringValue.length <= 6) return '******';
  return `${stringValue.slice(0, 3)}${'*'.repeat(Math.max(4, stringValue.length - 6))}${stringValue.slice(-3)}`;
}

function buildIntegrationSettingKey(ownerUserId) {
  return `${INTEGRATION_SETTINGS_PREFIX}${ownerUserId}`;
}

function getEnvIntegrationConfig() {
  return {
    apify: {
      token: process.env.APIFY_TOKEN || '',
      actorId: process.env.APIFY_GOOGLE_MAPS_ACTOR || DEFAULT_APIFY_ACTOR,
      googleMapsActorId: process.env.APIFY_GOOGLE_MAPS_ACTOR || DEFAULT_APIFY_ACTOR,
      instagramActorId: process.env.APIFY_INSTAGRAM_ACTOR || '',
      timeoutMinutes: Number(process.env.APIFY_TIMEOUT_MINUTES || 10),
      pollIntervalSeconds: Number(process.env.APIFY_POLL_INTERVAL_SECONDS || 5),
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
    google: {
      placesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
      pageSpeedApiKey: process.env.GOOGLE_PAGESPEED_API_KEY || '',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL,
    },
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: String(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || '',
    },
  };
}

function normalizeIntegrationConfig(config) {
  const source = config && typeof config === 'object' ? config : {};
  const envConfig = getEnvIntegrationConfig();

  return {
    apify: {
      token: cleanNullableString(source.apify?.token) || envConfig.apify.token,
      actorId: cleanNullableString(source.apify?.actorId) || envConfig.apify.actorId,
      googleMapsActorId: cleanNullableString(source.apify?.googleMapsActorId) || envConfig.apify.googleMapsActorId,
      instagramActorId: cleanNullableString(source.apify?.instagramActorId) || envConfig.apify.instagramActorId,
      timeoutMinutes: Number(cleanNullableString(source.apify?.timeoutMinutes) || envConfig.apify.timeoutMinutes || 10),
      pollIntervalSeconds: Number(cleanNullableString(source.apify?.pollIntervalSeconds) || envConfig.apify.pollIntervalSeconds || 5),
    },
    casa_dos_dados: {
      apiKey: cleanNullableString(source.casa_dos_dados?.apiKey) || envConfig.casa_dos_dados.apiKey,
      baseUrl: cleanNullableString(source.casa_dos_dados?.baseUrl) || envConfig.casa_dos_dados.baseUrl,
      apiVersion: cleanNullableString(source.casa_dos_dados?.apiVersion) || envConfig.casa_dos_dados.apiVersion,
    },
    whatsapp_validator: {
      baseUrl: cleanNullableString(source.whatsapp_validator?.baseUrl) || envConfig.whatsapp_validator.baseUrl,
      apiKey: cleanNullableString(source.whatsapp_validator?.apiKey) || envConfig.whatsapp_validator.apiKey,
      instanceName: cleanNullableString(source.whatsapp_validator?.instanceName) || envConfig.whatsapp_validator.instanceName,
      cacheDays: Number(cleanNullableString(source.whatsapp_validator?.cacheDays) || envConfig.whatsapp_validator.cacheDays || 30),
    },
    google: {
      placesApiKey: cleanNullableString(source.google?.placesApiKey) || envConfig.google.placesApiKey,
      pageSpeedApiKey: cleanNullableString(source.google?.pageSpeedApiKey) || envConfig.google.pageSpeedApiKey,
    },
    openai: {
      apiKey: cleanNullableString(source.openai?.apiKey) || envConfig.openai.apiKey,
      model: cleanNullableString(source.openai?.model) || envConfig.openai.model,
    },
    smtp: {
      host: cleanNullableString(source.smtp?.host) || envConfig.smtp.host,
      port: cleanNullableString(source.smtp?.port) || envConfig.smtp.port,
      user: cleanNullableString(source.smtp?.user) || envConfig.smtp.user,
      pass: cleanNullableString(source.smtp?.pass) || envConfig.smtp.pass,
      from: cleanNullableString(source.smtp?.from) || envConfig.smtp.from,
    },
  };
}

function mergeIntegrationConfig(currentConfig, patch) {
  const next = JSON.parse(JSON.stringify(currentConfig || getEnvIntegrationConfig()));

  if (patch.apify) {
    const token = cleanOptionalString(patch.apify.token);
    const actorId = cleanOptionalString(patch.apify.actorId);
    const googleMapsActorId = cleanOptionalString(patch.apify.googleMapsActorId);
    const instagramActorId = cleanOptionalString(patch.apify.instagramActorId);
    const timeoutMinutes = cleanOptionalString(patch.apify.timeoutMinutes);
    const pollIntervalSeconds = cleanOptionalString(patch.apify.pollIntervalSeconds);
    if (token) next.apify.token = token;
    if (actorId !== undefined) next.apify.actorId = actorId || DEFAULT_APIFY_ACTOR;
    if (googleMapsActorId !== undefined) next.apify.googleMapsActorId = googleMapsActorId || DEFAULT_APIFY_ACTOR;
    if (instagramActorId !== undefined) next.apify.instagramActorId = instagramActorId || '';
    if (timeoutMinutes !== undefined) next.apify.timeoutMinutes = Number(timeoutMinutes || 10);
    if (pollIntervalSeconds !== undefined) next.apify.pollIntervalSeconds = Number(pollIntervalSeconds || 5);
  }

  if (patch.casa_dos_dados) {
    const apiKey = cleanOptionalString(patch.casa_dos_dados.apiKey);
    const baseUrl = cleanOptionalString(patch.casa_dos_dados.baseUrl);
    const apiVersion = cleanOptionalString(patch.casa_dos_dados.apiVersion);
    if (apiKey) next.casa_dos_dados.apiKey = apiKey;
    if (baseUrl !== undefined) next.casa_dos_dados.baseUrl = baseUrl || DEFAULT_CASA_BASE_URL;
    if (apiVersion !== undefined) next.casa_dos_dados.apiVersion = apiVersion || DEFAULT_CASA_API_VERSION;
  }

  if (patch.whatsapp_validator) {
    const baseUrl = cleanOptionalString(patch.whatsapp_validator.baseUrl);
    const apiKey = cleanOptionalString(patch.whatsapp_validator.apiKey);
    const instanceName = cleanOptionalString(patch.whatsapp_validator.instanceName);
    const cacheDays = cleanOptionalString(patch.whatsapp_validator.cacheDays);
    if (baseUrl !== undefined) next.whatsapp_validator.baseUrl = baseUrl || '';
    if (apiKey) next.whatsapp_validator.apiKey = apiKey;
    if (instanceName !== undefined) next.whatsapp_validator.instanceName = instanceName || '';
    if (cacheDays !== undefined) next.whatsapp_validator.cacheDays = Number(cacheDays || 30);
  }

  if (patch.google) {
    const placesApiKey = cleanOptionalString(patch.google.placesApiKey);
    const pageSpeedApiKey = cleanOptionalString(patch.google.pageSpeedApiKey);
    if (placesApiKey) next.google.placesApiKey = placesApiKey;
    if (pageSpeedApiKey) next.google.pageSpeedApiKey = pageSpeedApiKey;
  }

  if (patch.openai) {
    const apiKey = cleanOptionalString(patch.openai.apiKey);
    const model = cleanOptionalString(patch.openai.model);
    if (apiKey) next.openai.apiKey = apiKey;
    if (model !== undefined) next.openai.model = model || OPENAI_DEFAULT_MODEL;
  }

  if (patch.smtp) {
    const host = cleanOptionalString(patch.smtp.host);
    const port = cleanOptionalString(patch.smtp.port);
    const user = cleanOptionalString(patch.smtp.user);
    const pass = cleanOptionalString(patch.smtp.pass);
    const from = cleanOptionalString(patch.smtp.from);
    if (host !== undefined) next.smtp.host = host;
    if (port !== undefined) next.smtp.port = port;
    if (user !== undefined) next.smtp.user = user;
    if (pass) next.smtp.pass = pass;
    if (from !== undefined) next.smtp.from = from;
  }

  return normalizeIntegrationConfig(next);
}

function buildIntegrationStatus(config) {
  return {
    apifyConfigured: Boolean(config.apify.token),
    casaConfigured: Boolean(config.casa_dos_dados.apiKey),
    whatsappValidatorConfigured: Boolean(config.whatsapp_validator.baseUrl && config.whatsapp_validator.apiKey),
    googlePlacesConfigured: Boolean(config.google.placesApiKey),
    pageSpeedConfigured: Boolean(config.google.pageSpeedApiKey),
    openAIConfigured: Boolean(config.openai.apiKey),
    smtpConfigured: Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from),
  };
}

function sanitizeIntegrationConfigForClient(config) {
  const statuses = buildIntegrationStatus(config);
  return {
    apify: {
      configured: statuses.apifyConfigured,
      tokenMasked: maskSecret(config.apify.token),
      actorId: config.apify.actorId || DEFAULT_APIFY_ACTOR,
      googleMapsActorId: config.apify.googleMapsActorId || DEFAULT_APIFY_ACTOR,
      instagramActorId: config.apify.instagramActorId || '',
      timeoutMinutes: config.apify.timeoutMinutes || 10,
      pollIntervalSeconds: config.apify.pollIntervalSeconds || 5,
    },
    casa_dos_dados: {
      configured: statuses.casaConfigured,
      apiKeyMasked: maskSecret(config.casa_dos_dados.apiKey),
      baseUrl: config.casa_dos_dados.baseUrl || DEFAULT_CASA_BASE_URL,
      apiVersion: config.casa_dos_dados.apiVersion || DEFAULT_CASA_API_VERSION,
    },
    whatsapp_validator: {
      configured: statuses.whatsappValidatorConfigured,
      apiKeyMasked: maskSecret(config.whatsapp_validator.apiKey),
      baseUrl: config.whatsapp_validator.baseUrl || '',
      instanceName: config.whatsapp_validator.instanceName || '',
      cacheDays: config.whatsapp_validator.cacheDays || 30,
    },
    google: {
      configured: statuses.googlePlacesConfigured || statuses.pageSpeedConfigured,
      placesApiKeyMasked: maskSecret(config.google.placesApiKey),
      pageSpeedApiKeyMasked: maskSecret(config.google.pageSpeedApiKey),
    },
    openai: {
      configured: statuses.openAIConfigured,
      apiKeyMasked: maskSecret(config.openai.apiKey),
      model: config.openai.model || OPENAI_DEFAULT_MODEL,
    },
    smtp: {
      configured: statuses.smtpConfigured,
      host: config.smtp.host || '',
      port: config.smtp.port || '587',
      user: config.smtp.user || '',
      from: config.smtp.from || '',
      passMasked: maskSecret(config.smtp.pass),
    },
  };
}

async function authenticateAndResolveOwnerUserId(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    const error = new Error('Token nao fornecido');
    error.statusCode = 401;
    throw error;
  }

  const authSupabase = getAuthSupabase();
  const adminSupabase = getAdminSupabase();
  const { data, error } = await authSupabase.auth.getUser(token);

  if (error || !data?.user?.email) {
    const authError = new Error('Token invalido');
    authError.statusCode = 401;
    throw authError;
  }

  const { data: userRow, error: userError } = await adminSupabase
    .from('users')
    .select('id, email')
    .eq('email', data.user.email)
    .limit(1)
    .maybeSingle();

  if (userError) throw userError;
  if (!userRow?.id) {
    const notFoundError = new Error(`Usuario ${data.user.email} nao encontrado na tabela users`);
    notFoundError.statusCode = 404;
    throw notFoundError;
  }

  return userRow.id;
}

async function fetchStoredIntegrationConfig(ownerUserId) {
  const adminSupabase = getAdminSupabase();
  const { data, error } = await adminSupabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', buildIntegrationSettingKey(ownerUserId))
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.setting_value) return getEnvIntegrationConfig();

  try {
    return normalizeIntegrationConfig(JSON.parse(data.setting_value));
  } catch {
    return getEnvIntegrationConfig();
  }
}

async function saveIntegrationConfig(ownerUserId, payload) {
  const adminSupabase = getAdminSupabase();
  const currentConfig = await fetchStoredIntegrationConfig(ownerUserId);
  const nextConfig = mergeIntegrationConfig(currentConfig, payload);

  const { error } = await adminSupabase
    .from('system_settings')
    .upsert(
      {
        setting_key: buildIntegrationSettingKey(ownerUserId),
        setting_value: JSON.stringify(nextConfig),
        description: 'Configuracoes de integracoes do modulo de prospeccao',
      },
      { onConflict: 'setting_key' }
    );

  if (error) throw error;
  return nextConfig;
}

function createEmailTransport(config) {
  const host = config.smtp.host;
  const port = Number(config.smtp.port || 587);
  const user = config.smtp.user;
  const pass = config.smtp.pass;

  if (!host || !user || !pass) {
    throw new Error('SMTP nao configurado com credenciais reais');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

async function testIntegration(provider, config) {
  switch (provider) {
    case 'apify': {
      if (!config.apify.token) throw new Error('Token do Apify nao configurado');
      const response = await fetch(`https://api.apify.com/v2/users/me?token=${encodeURIComponent(config.apify.token)}`);
      if (!response.ok) throw new Error('Falha ao validar token do Apify');
      const data = await response.json();
      return {
        success: true,
        message: `Apify conectado com sucesso para ${data?.data?.username || 'a conta informada'}.`,
      };
    }
    case 'casa_dos_dados': {
      if (!config.casa_dos_dados.apiKey) throw new Error('API Key da Casa dos Dados nao configurada');
      const baseUrl = String(config.casa_dos_dados.baseUrl || DEFAULT_CASA_BASE_URL).replace(/\/$/, '');
      const version = String(config.casa_dos_dados.apiVersion || DEFAULT_CASA_API_VERSION).replace(/^\/+/, '');
      const response = await fetch(`${baseUrl}/${version}/health`, {
        headers: { Authorization: `Bearer ${config.casa_dos_dados.apiKey}` },
      });
      if (!response.ok) throw new Error('Falha ao validar a Casa dos Dados');
      return { success: true, message: 'Casa dos Dados validada com sucesso.' };
    }
    case 'whatsapp_validator': {
      if (!config.whatsapp_validator.baseUrl) throw new Error('URL da Evolution API nao configurada');
      if (!config.whatsapp_validator.apiKey) throw new Error('API Key da Evolution API nao configurada');
      const response = await fetch(String(config.whatsapp_validator.baseUrl).replace(/\/$/, ''), {
        headers: {
          apikey: config.whatsapp_validator.apiKey,
          Authorization: `Bearer ${config.whatsapp_validator.apiKey}`,
        },
      });
      if (response.status === 401 || response.status === 403) throw new Error('Falha ao validar a Evolution API');
      return { success: true, message: 'Evolution API validada com sucesso.' };
    }
    case 'google': {
      const details = [];

      if (config.google.placesApiKey) {
        const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': config.google.placesApiKey,
            'X-Goog-FieldMask': 'places.displayName',
          },
          body: JSON.stringify({ textQuery: 'Dentistas Sao Paulo', maxResultCount: 1 }),
        });
        if (!response.ok) throw new Error('Falha ao validar a Google Places API');
        details.push('Google Places validado com sucesso');
      }

      if (config.google.pageSpeedApiKey) {
        const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
        endpoint.searchParams.set('url', 'https://example.com');
        endpoint.searchParams.set('strategy', 'mobile');
        endpoint.searchParams.set('key', config.google.pageSpeedApiKey);
        const response = await fetch(endpoint.toString());
        if (!response.ok) throw new Error('Falha ao validar a Google PageSpeed API');
        details.push('Google PageSpeed validado com sucesso');
      }

      if (details.length === 0) throw new Error('Nenhuma chave do Google foi configurada');
      return { success: true, message: 'Integracoes Google validadas com sucesso.', details };
    }
    case 'openai': {
      if (!config.openai.apiKey) throw new Error('Chave da OpenAI nao configurada');
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${config.openai.apiKey}` },
      });
      if (!response.ok) throw new Error('Falha ao validar a OpenAI API');
      return { success: true, message: 'OpenAI validada com sucesso.' };
    }
    case 'smtp': {
      const transport = createEmailTransport(config);
      await transport.verify();
      return { success: true, message: 'SMTP validado com sucesso.' };
    }
    default:
      throw new Error('Integracao invalida');
  }
}

module.exports = {
  authenticateAndResolveOwnerUserId,
  fetchStoredIntegrationConfig,
  readJsonBody,
  sanitizeIntegrationConfigForClient,
  saveIntegrationConfig,
  sendJson,
  testIntegration,
};
