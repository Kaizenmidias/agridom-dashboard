const express = require('express');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();
const DEFAULT_APIFY_ACTOR = 'datamech/apify-google-maps-scraper';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
const INTEGRATION_SETTINGS_PREFIX = 'prospection_integrations_user_';

const STATUS_OPTIONS = [
  'Novo',
  'Contato Enviado',
  'Respondeu',
  'Interessado',
  'Reuniao Agendada',
  'Proposta Enviada',
  'Fechado',
  'Perdido'
];

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const authSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const nicheMappings = {
  dentistas: ['nwr["amenity"="dentist"]'],
  imobiliarias: ['nwr["office"="estate_agent"]'],
  restaurantes: ['nwr["amenity"="restaurant"]', 'nwr["amenity"="fast_food"]'],
  advogados: ['nwr["office"="lawyer"]'],
  academias: ['nwr["leisure"="fitness_centre"]', 'nwr["sport"="fitness"]']
};

function stripAccents(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeBusinessName(value) {
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

function normalizeWebsite(value) {
  if (!value) return null;

  try {
    const normalizedUrl = value.startsWith('http') ? value : `https://${value}`;
    const url = new URL(normalizedUrl);
    return url.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return String(value).trim().toLowerCase();
  }
}

function cleanNullableString(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function cleanOptionalString(value) {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed;
}

function mergeAnalysisReport(currentValue, patch) {
  return {
    ...(currentValue && typeof currentValue === 'object' ? currentValue : {}),
    ...patch
  };
}

function buildIntegrationSettingKey(ownerUserId) {
  return `${INTEGRATION_SETTINGS_PREFIX}${ownerUserId}`;
}

function getEnvIntegrationConfig() {
  return {
    apify: {
      token: process.env.APIFY_TOKEN || '',
      actorId: process.env.APIFY_GOOGLE_MAPS_ACTOR || DEFAULT_APIFY_ACTOR
    },
    google: {
      placesApiKey: process.env.GOOGLE_PLACES_API_KEY || '',
      pageSpeedApiKey: process.env.GOOGLE_PAGESPEED_API_KEY || ''
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || OPENAI_DEFAULT_MODEL
    },
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: String(process.env.SMTP_PORT || '587'),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
      from: process.env.EMAIL_FROM || process.env.SMTP_USER || ''
    }
  };
}

function normalizeIntegrationConfig(config) {
  const source = config && typeof config === 'object' ? config : {};
  const envConfig = getEnvIntegrationConfig();

  return {
    apify: {
      token: cleanNullableString(source.apify?.token) || envConfig.apify.token,
      actorId: cleanNullableString(source.apify?.actorId) || envConfig.apify.actorId
    },
    google: {
      placesApiKey: cleanNullableString(source.google?.placesApiKey) || envConfig.google.placesApiKey,
      pageSpeedApiKey: cleanNullableString(source.google?.pageSpeedApiKey) || envConfig.google.pageSpeedApiKey
    },
    openai: {
      apiKey: cleanNullableString(source.openai?.apiKey) || envConfig.openai.apiKey,
      model: cleanNullableString(source.openai?.model) || envConfig.openai.model
    },
    smtp: {
      host: cleanNullableString(source.smtp?.host) || envConfig.smtp.host,
      port: cleanNullableString(source.smtp?.port) || envConfig.smtp.port,
      user: cleanNullableString(source.smtp?.user) || envConfig.smtp.user,
      pass: cleanNullableString(source.smtp?.pass) || envConfig.smtp.pass,
      from: cleanNullableString(source.smtp?.from) || envConfig.smtp.from
    }
  };
}

function mergeIntegrationConfig(currentConfig, patch) {
  const next = JSON.parse(JSON.stringify(currentConfig || getEnvIntegrationConfig()));

  if (patch.apify) {
    const token = cleanOptionalString(patch.apify.token);
    const actorId = cleanOptionalString(patch.apify.actorId);
    if (token) next.apify.token = token;
    if (actorId !== undefined) next.apify.actorId = actorId || DEFAULT_APIFY_ACTOR;
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

function maskSecret(value) {
  if (!value) return null;
  const stringValue = String(value);
  if (stringValue.length <= 6) return '******';
  return `${stringValue.slice(0, 3)}${'*'.repeat(Math.max(4, stringValue.length - 6))}${stringValue.slice(-3)}`;
}

function buildIntegrationStatus(config) {
  return {
    apifyConfigured: Boolean(config.apify.token),
    googlePlacesConfigured: Boolean(config.google.placesApiKey),
    pageSpeedConfigured: Boolean(config.google.pageSpeedApiKey),
    openAIConfigured: Boolean(config.openai.apiKey),
    smtpConfigured: Boolean(config.smtp.host && config.smtp.user && config.smtp.pass && config.smtp.from)
  };
}

function sanitizeIntegrationConfigForClient(config) {
  const statuses = buildIntegrationStatus(config);
  return {
    apify: {
      configured: statuses.apifyConfigured,
      tokenMasked: maskSecret(config.apify.token),
      actorId: config.apify.actorId || DEFAULT_APIFY_ACTOR
    },
    google: {
      configured: statuses.googlePlacesConfigured || statuses.pageSpeedConfigured,
      placesApiKeyMasked: maskSecret(config.google.placesApiKey),
      pageSpeedApiKeyMasked: maskSecret(config.google.pageSpeedApiKey)
    },
    openai: {
      configured: statuses.openAIConfigured,
      apiKeyMasked: maskSecret(config.openai.apiKey),
      model: config.openai.model || OPENAI_DEFAULT_MODEL
    },
    smtp: {
      configured: statuses.smtpConfigured,
      host: config.smtp.host || '',
      port: config.smtp.port || '587',
      user: config.smtp.user || '',
      from: config.smtp.from || '',
      passMasked: maskSecret(config.smtp.pass)
    }
  };
}

function applyIntegrationConfigToProcess(config) {
  process.env.APIFY_TOKEN = config.apify.token || '';
  process.env.APIFY_GOOGLE_MAPS_ACTOR = config.apify.actorId || DEFAULT_APIFY_ACTOR;
  process.env.GOOGLE_PLACES_API_KEY = config.google.placesApiKey || '';
  process.env.GOOGLE_PAGESPEED_API_KEY = config.google.pageSpeedApiKey || '';
  process.env.OPENAI_API_KEY = config.openai.apiKey || '';
  process.env.OPENAI_MODEL = config.openai.model || OPENAI_DEFAULT_MODEL;
  process.env.SMTP_HOST = config.smtp.host || '';
  process.env.SMTP_PORT = String(config.smtp.port || '587');
  process.env.SMTP_USER = config.smtp.user || '';
  process.env.SMTP_PASS = config.smtp.pass || '';
  process.env.EMAIL_FROM = config.smtp.from || '';
}

function escapeOverpassRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getLeadTemperature(score) {
  if (score >= 90) return 'Muito Quente';
  if (score >= 70) return 'Quente';
  if (score >= 50) return 'Morno';
  return 'Frio';
}

function getProblemText(problems) {
  if (!Array.isArray(problems) || problems.length === 0) {
    return 'uma oportunidade de modernizacao digital';
  }

  return problems.slice(0, 2).join(' e ');
}

function interpolateTemplate(template, prospect) {
  const firstName = (prospect.business_name || 'empresa').split(' ')[0];
  const problem = getProblemText(prospect.problems_found);

  return (template || '')
    .replace(/{{nome}}/g, firstName)
    .replace(/{{empresa}}/g, prospect.business_name || 'empresa')
    .replace(/{{cidade}}/g, prospect.city || 'sua cidade')
    .replace(/{{problema}}/g, problem)
    .replace(/{{score}}/g, String(prospect.lead_score ?? 0));
}

function buildGoogleMapsUrl(name, address, lat, lon) {
  if (lat && lon) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }

  const query = [name, address].filter(Boolean).join(' ');
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

function extractTag(tags, keys) {
  for (const key of keys) {
    if (tags[key]) return tags[key];
  }

  return null;
}

function extractHtmlTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : null;
}

function extractMetaDescription(html) {
  const match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i);
  return match ? match[1].trim() : null;
}

function hasViewportMeta(html) {
  return /<meta[^>]+name=["']viewport["']/i.test(html);
}

function hasResponsiveSignals(html) {
  return hasViewportMeta(html) || /@media\s*\(/i.test(html);
}

function hasCallToAction(html) {
  return /(fale conosco|entre em contato|solicite|orcamento|agende|whatsapp|ligue|comprar|saiba mais)/i.test(html);
}

function detectLegacyWebsite(html, analysis) {
  const lowSignals = [
    !analysis.responsive,
    !analysis.https,
    (analysis.pagespeedMobile ?? 100) < 60,
    (analysis.pagespeedDesktop ?? 100) < 60,
    (analysis.seoScore ?? 100) < 60,
    !analysis.metaTitle,
    !analysis.metaDescription
  ].filter(Boolean).length;

  return lowSignals >= 3 || /<table[\s>]/i.test(html);
}

function determineWebsiteQuality(analysis, legacyWebsite) {
  if (!analysis.websiteExists) return 'Sem site';
  if (legacyWebsite) return 'Ultrapassado';

  const avg =
    ((analysis.pagespeedMobile ?? 70) +
      (analysis.pagespeedDesktop ?? 70) +
      (analysis.seoScore ?? 70)) / 3;

  if (avg >= 85 && analysis.https && analysis.responsive) return 'Excelente';
  if (avg >= 70) return 'Bom';
  if (avg >= 55) return 'Regular';
  return 'Ruim';
}

function buildProblems(analysis, legacyWebsite, hasCta) {
  const problems = [];

  if (!analysis.websiteExists) {
    problems.push('Sem site');
    return problems;
  }

  if ((analysis.pagespeedMobile ?? 100) < 50 || (analysis.pagespeedDesktop ?? 100) < 50) {
    problems.push('Site lento');
  }

  if (!analysis.https) {
    problems.push('Sem SSL');
  }

  if (!analysis.metaDescription) {
    problems.push('Sem Meta Description');
  }

  if (!hasCta) {
    problems.push('Sem CTA');
  }

  if (legacyWebsite) {
    problems.push('Visual ultrapassado');
  }

  if (!analysis.responsive) {
    problems.push('Nao responsivo');
  }

  if ((analysis.seoScore ?? 100) < 60) {
    problems.push('SEO fraco');
  }

  if (hasCta === false || (analysis.performanceScore ?? 100) < 60) {
    problems.push('Pagina sem conversao');
  }

  return [...new Set(problems)];
}

function calculateLeadScore(prospect, analysis, legacyWebsite) {
  let score = 0;

  if (!prospect.website_exists) score += 40;
  if (legacyWebsite) score += 25;
  if ((analysis.pagespeedMobile ?? 100) < 50 || (analysis.pagespeedDesktop ?? 100) < 50) score += 20;
  if ((analysis.seoScore ?? 100) < 60) score += 15;
  if ((prospect.google_reviews ?? 0) < 20) score += 5;
  if (!prospect.instagram) score += 5;

  if (prospect.website_exists && !legacyWebsite && ['Bom', 'Excelente'].includes(analysis.websiteQuality)) score -= 20;
  if ((analysis.pagespeedMobile ?? 0) > 80 && (analysis.pagespeedDesktop ?? 0) > 80) score -= 10;
  if ((analysis.seoScore ?? 0) > 80) score -= 10;

  return clampScore(score);
}

async function generateOpenAIText(prompt) {
  if (!process.env.OPENAI_API_KEY) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: 'Voce escreve em portugues do Brasil com tom comercial consultivo, objetivo e profissional.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

async function generateDiagnosticSummary(prospect, analysis, options = {}) {
  const problemText = getProblemText(prospect.problems_found);
  const fallback = !prospect.website_exists
    ? `A empresa ${prospect.business_name} ainda nao possui site, o que indica uma oportunidade direta para ofertar uma landing page ou site institucional com foco em captacao de contatos.`
    : `A empresa ${prospect.business_name} apresenta ${problemText}. Existe uma oportunidade clara para oferecer uma nova presenca digital orientada a performance, confianca e captacao de leads.`;

  if (options.fastMode) {
    return fallback;
  }

  const prompt = [
    `Empresa: ${prospect.business_name}`,
    `Cidade: ${prospect.city || 'Nao informada'}`,
    `Categoria: ${prospect.category || 'Nao informada'}`,
    `Tem site: ${prospect.website_exists ? 'Sim' : 'Nao'}`,
    `Problemas: ${Array.isArray(prospect.problems_found) ? prospect.problems_found.join(', ') : 'Nenhum'}`,
    `Score: ${prospect.lead_score}`,
    `Qualidade do site: ${analysis.websiteQuality}`,
    'Escreva um resumo comercial curto, objetivo e persuasivo em 1 ou 2 frases.'
  ].join('\n');

  return (await generateOpenAIText(prompt)) || fallback;
}

async function generateApproachSuggestion(prospect, analysis, options = {}) {
  const problemText = getProblemText(prospect.problems_found);
  const serviceHint = prospect.website_exists
    ? 'uma nova landing page, site institucional ou sistema web mais moderno'
    : 'um site institucional ou landing page para gerar mais contatos';

  const fallback = `Percebi que ${prospect.business_name} em ${prospect.city || 'sua cidade'} possui ${problemText}. Trabalhamos com ${serviceHint}, otimizados para gerar mais contatos. Posso te mostrar algumas melhorias especificas para o seu caso.`;

  if (options.fastMode) {
    return fallback;
  }

  const prompt = [
    `Empresa: ${prospect.business_name}`,
    `Cidade: ${prospect.city || 'Nao informada'}`,
    `Categoria: ${prospect.category || 'Nao informada'}`,
    `Tem site: ${prospect.website_exists ? 'Sim' : 'Nao'}`,
    `Problemas: ${Array.isArray(prospect.problems_found) ? prospect.problems_found.join(', ') : 'Nenhum'}`,
    `Score: ${prospect.lead_score}`,
    'Escreva uma abordagem comercial personalizada em portugues do Brasil, curta e consultiva.'
  ].join('\n');

  return (await generateOpenAIText(prompt)) || fallback;
}

async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token nao fornecido' });
  }

  const { data, error } = await authSupabase.auth.getUser(token);
  if (error || !data?.user) {
    return res.status(401).json({ error: 'Token invalido' });
  }

  req.authUser = data.user;
  next();
}

async function resolveOwnerUserId(authUser) {
  const email = authUser?.email;
  if (!email) {
    throw new Error('Usuario autenticado sem email');
  }

  const { data, error } = await adminSupabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) {
    throw new Error(`Usuario ${email} nao encontrado na tabela users`);
  }

  return data.id;
}

async function geocodeCity(city, state) {
  const query = [city, state, 'Brasil'].filter(Boolean).join(', ');
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
    {
      headers: {
        'User-Agent': 'KaizenProspection/1.0'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Falha ao localizar a cidade informada');
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Cidade nao encontrada');
  }

  return {
    lat: Number(data[0].lat),
    lon: Number(data[0].lon)
  };
}

function buildOverpassSelectors(niche) {
  const normalizedNiche = normalizeBusinessName(niche);
  const mappedSelectors = nicheMappings[normalizedNiche];

  if (mappedSelectors) {
    return mappedSelectors;
  }

  const escaped = escapeOverpassRegex(niche);
  return [
    `nwr["name"~"${escaped}", i]`,
    `nwr["shop"]["name"~"${escaped}", i]`,
    `nwr["office"]["name"~"${escaped}", i]`,
    `nwr["amenity"]["name"~"${escaped}", i]`
  ];
}

async function searchWithOverpass({ niche, city, state, quantity }) {
  const { lat, lon } = await geocodeCity(city, state);
  const selectors = buildOverpassSelectors(niche);
  const overpassQuery = `
[out:json][timeout:25];
(
${selectors.map((selector) => `  ${selector}(around:18000,${lat},${lon});`).join('\n')}
);
out center tags;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
      'User-Agent': 'KaizenProspection/1.0'
    },
    body: overpassQuery
  });

  if (!response.ok) {
    throw new Error('Falha ao consultar a base de negocios');
  }

  const data = await response.json();
  const elements = Array.isArray(data?.elements) ? data.elements : [];

  return elements.slice(0, Math.min(Math.max(quantity * 10, quantity), 80)).map((element) => {
    const tags = element.tags || {};
    const website = extractTag(tags, ['contact:website', 'website']);
    const addressParts = [
      tags['addr:street'],
      tags['addr:housenumber'],
      tags['addr:suburb']
    ].filter(Boolean);

    return {
      business_name: tags.name || niche,
      category: niche,
      address: addressParts.join(', ') || tags['addr:full'] || null,
      city: tags['addr:city'] || city,
      state: tags['addr:state'] || state || null,
      phone: extractTag(tags, ['contact:phone', 'phone']),
      email: extractTag(tags, ['contact:email', 'email']),
      website,
      google_maps_url: buildGoogleMapsUrl(tags.name, addressParts.join(', '), element.lat || element.center?.lat, element.lon || element.center?.lon),
      google_rating: null,
      google_reviews: 0,
      instagram: extractTag(tags, ['contact:instagram', 'instagram']),
      facebook: extractTag(tags, ['contact:facebook', 'facebook']),
      website_exists: Boolean(website)
    };
  });
}

async function searchWithGooglePlaces({ niche, city, state, quantity }) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const query = [niche, city, state].filter(Boolean).join(' ');

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri'
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: Math.min(Math.max(quantity * 10, 10), 50)
    })
  });

  if (!response.ok) {
    throw new Error('Falha ao consultar Google Places');
  }

  const data = await response.json();
  const places = Array.isArray(data?.places) ? data.places : [];

  return places.map((place) => ({
    business_name: place.displayName?.text || niche,
    category: niche,
    address: place.formattedAddress || null,
    city,
    state: state || null,
    phone: place.internationalPhoneNumber || place.nationalPhoneNumber || null,
    email: null,
    website: place.websiteUri || null,
    google_maps_url: place.googleMapsUri || null,
    google_rating: place.rating || null,
    google_reviews: place.userRatingCount || 0,
    instagram: null,
    facebook: null,
    website_exists: Boolean(place.websiteUri)
  }));
}

function normalizeApifyActorId(actorId) {
  return String(actorId || DEFAULT_APIFY_ACTOR).replace('/', '~');
}

function cleanApifyUrl(value) {
  if (!value) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    const isGoogleRedirect = /(^|\.)google\./i.test(url.hostname) && url.pathname === '/url';
    if (isGoogleRedirect) {
      return url.searchParams.get('q') || normalized;
    }

    return normalized;
  } catch {
    return normalized;
  }
}

function mapApifyLead(item, fallback) {
  const website =
    cleanApifyUrl(item.website) ||
    cleanApifyUrl(item.webSite) ||
    cleanApifyUrl(item.domain);

  const cityFromAddress =
    cleanNullableString(item.city) ||
    cleanNullableString(item.locality) ||
    cleanNullableString(item.town);

  return {
    business_name:
      cleanNullableString(item.title) ||
      cleanNullableString(item.name) ||
      cleanNullableString(item.businessName) ||
      fallback.niche,
    category:
      cleanNullableString(item.categoryName) ||
      cleanNullableString(item.category) ||
      fallback.niche,
    address:
      cleanNullableString(item.address) ||
      cleanNullableString(item.street) ||
      cleanNullableString(item.fullAddress),
    city: cityFromAddress || fallback.city,
    state: cleanNullableString(item.state) || fallback.state || null,
    phone:
      cleanNullableString(item.phone) ||
      cleanNullableString(item.phoneUnformatted) ||
      cleanNullableString(item.phoneNumber),
    email: cleanNullableString(item.email),
    website,
    google_maps_url:
      cleanApifyUrl(item.googleUrl) ||
      cleanApifyUrl(item.url) ||
      cleanApifyUrl(item.googleMapsUrl) ||
      cleanApifyUrl(item.placeUrl) ||
      buildGoogleMapsUrl(item.title || item.name, item.address, item.latitude, item.longitude),
    google_rating:
      item.totalScore ??
      item.rating ??
      item.stars ??
      null,
    google_reviews:
      item.reviewsCount ??
      item.reviews ??
      item.reviewCount ??
      item.totalReviews ??
      0,
    instagram:
      cleanApifyUrl(item.instagram) ||
      cleanApifyUrl(item.instagramUrl),
    facebook:
      cleanApifyUrl(item.facebook) ||
      cleanApifyUrl(item.facebookUrl),
    website_exists: Boolean(website)
  };
}

async function searchWithApify({ niche, city, state, quantity }, options = {}) {
  const token = process.env.APIFY_TOKEN;
  const actorId = normalizeApifyActorId(process.env.APIFY_GOOGLE_MAPS_ACTOR);
  const searchTerm = [niche, city, state, 'Brasil'].filter(Boolean).join(', ');
  const controller = options.timeoutMs ? new AbortController() : null;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(new Error('Tempo limite excedido ao consultar Apify')), options.timeoutMs)
    : null;

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          searchTerms: [searchTerm],
          maxItems: Math.min(Math.max(quantity * 10, 10), 50),
          includeReviews: false
        }),
        signal: controller?.signal
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Falha ao consultar Apify: ${errorBody.slice(0, 240)}`);
    }

    const data = await response.json();
    const items = Array.isArray(data) ? data : [];

    return items.map((item) =>
      mapApifyLead(item, {
        niche,
        city,
        state
      })
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function searchBusinessLeads(searchParams) {
  const preferFastProviders = Boolean(process.env.VERCEL);

  const providers = [];
  if (preferFastProviders && process.env.GOOGLE_PLACES_API_KEY) {
    providers.push({
      name: 'google_places',
      run: () => searchWithGooglePlaces(searchParams)
    });
  }

  if (process.env.APIFY_TOKEN) {
    providers.push({
      name: 'apify',
      run: () => searchWithApify(searchParams, { timeoutMs: preferFastProviders ? 8000 : undefined })
    });
  }

  if (!preferFastProviders && process.env.GOOGLE_PLACES_API_KEY) {
    providers.push({
      name: 'google_places',
      run: () => searchWithGooglePlaces(searchParams)
    });
  }

  providers.push({
    name: 'osm_fallback',
    run: () => searchWithOverpass(searchParams)
  });

  for (const provider of providers) {
    try {
      const leads = await provider.run();
      return {
        leads,
        provider: provider.name
      };
    } catch (error) {
      console.warn(`Falha na fonte ${provider.name}, tentando a proxima:`, error.message);
    }
  }

  throw new Error('Nenhuma fonte de prospeccao respondeu com sucesso');
}

async function runPageSpeed(url, strategy) {
  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
  endpoint.searchParams.set('url', url);
  endpoint.searchParams.set('strategy', strategy);

  if (process.env.GOOGLE_PAGESPEED_API_KEY) {
    endpoint.searchParams.set('key', process.env.GOOGLE_PAGESPEED_API_KEY);
  }

  const response = await fetch(endpoint.toString(), {
    headers: {
      'User-Agent': 'KaizenProspection/1.0'
    }
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const categories = data?.lighthouseResult?.categories || {};
  return {
    performance: categories.performance?.score != null ? Math.round(categories.performance.score * 100) : null,
    accessibility: categories.accessibility?.score != null ? Math.round(categories.accessibility.score * 100) : null,
    bestPractices: categories['best-practices']?.score != null ? Math.round(categories['best-practices'].score * 100) : null,
    seo: categories.seo?.score != null ? Math.round(categories.seo.score * 100) : null
  };
}

async function analyzeWebsite(website, options = {}) {
  const defaultAnalysis = {
    websiteExists: false,
    pagespeedMobile: null,
    pagespeedDesktop: null,
    seoScore: null,
    responsive: false,
    https: false,
    metaTitle: null,
    metaDescription: null,
    performanceScore: null,
    accessibilityScore: null,
    bestPracticesScore: null,
    websiteQuality: 'Sem site',
    problemsFound: [],
    legacyWebsite: false
  };

  if (!website) {
    return defaultAnalysis;
  }

  let normalizedUrl = website;
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  try {
    const pageResponse = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KaizenProspection/1.0)'
      }
    });

    const html = await pageResponse.text();
    const mobile = options.fastMode ? null : await runPageSpeed(normalizedUrl, 'mobile');
    const desktop = options.fastMode ? null : await runPageSpeed(normalizedUrl, 'desktop');
    const metaTitle = extractHtmlTitle(html);
    const metaDescription = extractMetaDescription(html);
    const responsive = hasResponsiveSignals(html);
    const https = normalizedUrl.startsWith('https://');
    const hasCta = hasCallToAction(html);
    const seoScore = mobile?.seo ?? desktop?.seo ?? (metaTitle && metaDescription ? 75 : 45);

    const analysis = {
      websiteExists: true,
      pagespeedMobile: mobile?.performance ?? null,
      pagespeedDesktop: desktop?.performance ?? null,
      seoScore,
      responsive,
      https,
      metaTitle,
      metaDescription,
      performanceScore: mobile?.performance ?? desktop?.performance ?? null,
      accessibilityScore: mobile?.accessibility ?? desktop?.accessibility ?? null,
      bestPracticesScore: mobile?.bestPractices ?? desktop?.bestPractices ?? null
    };

    const legacyWebsite = detectLegacyWebsite(html, analysis);
    const websiteQuality = determineWebsiteQuality(
      { ...analysis, websiteExists: true },
      legacyWebsite
    );
    const problemsFound = buildProblems(
      { ...analysis, websiteExists: true },
      legacyWebsite,
      hasCta
    );

    return {
      ...analysis,
      websiteQuality,
      problemsFound,
      legacyWebsite
    };
  } catch (error) {
    return {
      ...defaultAnalysis,
      websiteExists: true,
      websiteQuality: 'Indisponivel',
      problemsFound: ['Site inacessivel'],
      legacyWebsite: false
    };
  }
}

async function insertContactHistory(ownerUserId, prospectId, payload) {
  const { error } = await adminSupabase.from('prospect_contact_history').insert({
    owner_user_id: ownerUserId,
    prospect_id: prospectId,
    channel: payload.channel,
    subject: payload.subject || null,
    message: payload.message,
    recipient: payload.recipient || null,
    delivery_status: payload.delivery_status || 'registrado',
    metadata: payload.metadata || {}
  });

  if (error) {
    throw error;
  }
}

async function fetchProspectsForOwner(ownerUserId) {
  const { data, error } = await adminSupabase
    .from('prospects')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

async function fetchSettingsForOwner(ownerUserId) {
  const { data, error } = await adminSupabase
    .from('prospecting_settings')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (data) return data;

  const { data: inserted, error: insertError } = await adminSupabase
    .from('prospecting_settings')
    .insert({ owner_user_id: ownerUserId })
    .select()
    .single();

  if (insertError) throw insertError;
  return inserted;
}

async function fetchStoredIntegrationConfig(ownerUserId) {
  const { data, error } = await adminSupabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', buildIntegrationSettingKey(ownerUserId))
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.setting_value) {
    return getEnvIntegrationConfig();
  }

  try {
    return normalizeIntegrationConfig(JSON.parse(data.setting_value));
  } catch {
    return getEnvIntegrationConfig();
  }
}

async function hydrateIntegrationConfig(ownerUserId) {
  const config = await fetchStoredIntegrationConfig(ownerUserId);
  applyIntegrationConfigToProcess(config);
  return config;
}

async function saveIntegrationConfig(ownerUserId, payload) {
  const currentConfig = await fetchStoredIntegrationConfig(ownerUserId);
  const nextConfig = mergeIntegrationConfig(currentConfig, payload);

  const { error } = await adminSupabase
    .from('system_settings')
    .upsert(
      {
        setting_key: buildIntegrationSettingKey(ownerUserId),
        setting_value: JSON.stringify(nextConfig),
        description: 'Configuracoes de integracoes do modulo de prospeccao'
      },
      {
        onConflict: 'setting_key'
      }
    );

  if (error) {
    throw error;
  }

  applyIntegrationConfigToProcess(nextConfig);
  return nextConfig;
}

async function fetchMetricsForOwner(ownerUserId) {
  const prospects = await fetchProspectsForOwner(ownerUserId);

  const { data: history, error } = await adminSupabase
    .from('prospect_contact_history')
    .select('channel, created_at')
    .eq('owner_user_id', ownerUserId);

  if (error) throw error;

  const contacted = prospects.filter((prospect) => prospect.status !== 'Novo').length;
  const responded = prospects.filter((prospect) => ['Respondeu', 'Interessado', 'Reuniao Agendada', 'Proposta Enviada', 'Fechado'].includes(prospect.status)).length;

  return {
    leadsFound: prospects.length,
    hotLeads: prospects.filter((prospect) => Number(prospect.lead_score || 0) >= 70).length,
    noWebsite: prospects.filter((prospect) => prospect.website_exists === false).length,
    whatsappSent: (history || []).filter((item) => item.channel === 'whatsapp').length,
    emailsSent: (history || []).filter((item) => item.channel === 'email').length,
    responseRate: contacted > 0 ? Math.round((responded / contacted) * 100) : 0,
    meetingsScheduled: prospects.filter((prospect) => prospect.status === 'Reuniao Agendada').length,
    clientsClosed: prospects.filter((prospect) => prospect.status === 'Fechado').length
  };
}

function createEmailTransport() {
  const config = getEnvIntegrationConfig();
  const host = config.smtp.host;
  const port = Number(config.smtp.port || 587);
  const user = config.smtp.user;
  const pass = config.smtp.pass;

  const invalidConfig =
    !host ||
    !user ||
    !pass ||
    /your-email|ethereal|seu-email|your-app-password|ethereal\.email/i.test(user) ||
    /your-app-password|ethereal\.pass|sua-senha-de-app/i.test(pass);

  if (invalidConfig) {
    throw new Error('SMTP nao configurado com credenciais reais');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function testApifyConnection() {
  if (!process.env.APIFY_TOKEN) {
    throw new Error('Token do Apify nao configurado');
  }

  const response = await fetch(
    `https://api.apify.com/v2/users/me?token=${encodeURIComponent(process.env.APIFY_TOKEN)}`
  );

  if (!response.ok) {
    throw new Error('Falha ao validar token do Apify');
  }

  const data = await response.json();
  return {
    success: true,
    message: `Apify conectado com sucesso para ${data?.data?.username || 'a conta informada'}.`
  };
}

async function testGoogleConnection() {
  const details = [];

  if (process.env.GOOGLE_PLACES_API_KEY) {
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.displayName'
      },
      body: JSON.stringify({
        textQuery: 'Dentistas Sao Paulo',
        maxResultCount: 1
      })
    });

    if (!response.ok) {
      throw new Error('Falha ao validar a Google Places API');
    }

    details.push('Google Places validado com sucesso');
  }

  if (process.env.GOOGLE_PAGESPEED_API_KEY) {
    const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed');
    endpoint.searchParams.set('url', 'https://example.com');
    endpoint.searchParams.set('strategy', 'mobile');
    endpoint.searchParams.set('key', process.env.GOOGLE_PAGESPEED_API_KEY);

    const response = await fetch(endpoint.toString());
    if (!response.ok) {
      throw new Error('Falha ao validar a Google PageSpeed API');
    }

    details.push('Google PageSpeed validado com sucesso');
  }

  if (details.length === 0) {
    throw new Error('Nenhuma chave do Google foi configurada');
  }

  return {
    success: true,
    message: 'Integracoes Google validadas com sucesso.',
    details
  };
}

async function testOpenAIConnection() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Chave da OpenAI nao configurada');
  }

  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    }
  });

  if (!response.ok) {
    throw new Error('Falha ao validar a OpenAI API');
  }

  return {
    success: true,
    message: 'OpenAI validada com sucesso.'
  };
}

async function testSMTPConnection() {
  const transport = createEmailTransport();
  await transport.verify();

  return {
    success: true,
    message: 'SMTP validado com sucesso.'
  };
}

router.use(authenticateRequest);

router.get('/integrations', async (req, res) => {
  try {
    const ownerUserId = await resolveOwnerUserId(req.authUser);
    const integrationConfig = await hydrateIntegrationConfig(ownerUserId);
    res.json(sanitizeIntegrationConfigForClient(integrationConfig));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao carregar integracoes' });
  }
});

router.put('/integrations', async (req, res) => {
  try {
    const ownerUserId = await resolveOwnerUserId(req.authUser);
    const integrationConfig = await saveIntegrationConfig(ownerUserId, req.body || {});
    res.json(sanitizeIntegrationConfigForClient(integrationConfig));
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao salvar integracoes' });
  }
});

router.post('/integrations/:provider/test', async (req, res) => {
  try {
    const ownerUserId = await resolveOwnerUserId(req.authUser);
    await hydrateIntegrationConfig(ownerUserId);

    const provider = String(req.params.provider || '').toLowerCase();
    let result;

    switch (provider) {
      case 'apify':
        result = await testApifyConnection();
        break;
      case 'google':
        result = await testGoogleConnection();
        break;
      case 'openai':
        result = await testOpenAIConnection();
        break;
      case 'smtp':
        result = await testSMTPConnection();
        break;
      default:
        return res.status(400).json({ error: 'Integracao invalida' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || 'Falha ao testar integracao'
    });
  }
});

router.get('/bootstrap', async (req, res) => {
  try {
    const ownerUserId = await resolveOwnerUserId(req.authUser);
    const integrationConfig = await hydrateIntegrationConfig(ownerUserId);
    const [prospects, settings, metrics, historyResponse] = await Promise.all([
      fetchProspectsForOwner(ownerUserId),
      fetchSettingsForOwner(ownerUserId),
      fetchMetricsForOwner(ownerUserId),
      adminSupabase
        .from('prospect_contact_history')
        .select('*')
        .eq('owner_user_id', ownerUserId)
        .order('created_at', { ascending: false })
    ]);

    if (historyResponse.error) throw historyResponse.error;

    res.json({
      prospects,
      settings,
      metrics,
      history: historyResponse.data || [],
      integrations: buildIntegrationStatus(integrationConfig)
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao carregar modulo de prospeccao' });
  }
});

router.post('/search', async (req, res) => {
  try {
    const ownerUserId = await resolveOwnerUserId(req.authUser);
    await hydrateIntegrationConfig(ownerUserId);
    const niche = cleanNullableString(req.body.niche);
    const city = cleanNullableString(req.body.city);
    const state = cleanNullableString(req.body.state);
    const quantity = Math.min(50, Math.max(1, Number(req.body.quantity || 10)));

    if (!niche || !city) {
      return res.status(400).json({ error: 'Nicho e cidade sao obrigatorios' });
    }

    const searchResult = await searchBusinessLeads({ niche, city, state, quantity });
    const rawLeads = searchResult.leads;
    const existingProspects = await fetchProspectsForOwner(ownerUserId);
    const existingKeys = new Set();
    const fastMode = Boolean(process.env.VERCEL);

    for (const prospect of existingProspects) {
      if (prospect.normalized_phone) existingKeys.add(`phone:${prospect.normalized_phone}`);
      if (prospect.normalized_website) existingKeys.add(`website:${prospect.normalized_website}`);
      if (prospect.normalized_business_name) existingKeys.add(`name:${prospect.normalized_business_name}`);
    }

    const insertedProspects = [];

    for (const rawLead of rawLeads) {
      if (insertedProspects.length >= quantity) break;

      const normalizedPhone = normalizePhone(rawLead.phone);
      const normalizedWebsite = normalizeWebsite(rawLead.website);
      const normalizedBusinessName = normalizeBusinessName(rawLead.business_name);

      const dedupeKeys = [
        normalizedPhone ? `phone:${normalizedPhone}` : null,
        normalizedWebsite ? `website:${normalizedWebsite}` : null,
        normalizedBusinessName ? `name:${normalizedBusinessName}` : null
      ].filter(Boolean);

      if (dedupeKeys.some((key) => existingKeys.has(key))) {
        continue;
      }

      const analysis = await analyzeWebsite(rawLead.website, { fastMode });
      const baseProspect = {
        owner_user_id: ownerUserId,
        business_name: rawLead.business_name,
        normalized_business_name: normalizedBusinessName,
        category: cleanNullableString(rawLead.category || niche),
        address: cleanNullableString(rawLead.address),
        city: cleanNullableString(rawLead.city || city),
        state: cleanNullableString(rawLead.state || state),
        phone: cleanNullableString(rawLead.phone),
        normalized_phone: normalizedPhone,
        email: cleanNullableString(rawLead.email),
        website: cleanNullableString(rawLead.website),
        normalized_website: normalizedWebsite,
        google_maps_url: cleanNullableString(rawLead.google_maps_url),
        google_rating: rawLead.google_rating,
        google_reviews: rawLead.google_reviews || 0,
        instagram: cleanNullableString(rawLead.instagram),
        facebook: cleanNullableString(rawLead.facebook),
        website_exists: Boolean(rawLead.website_exists && rawLead.website),
        pagespeed_mobile: analysis.pagespeedMobile,
        pagespeed_desktop: analysis.pagespeedDesktop,
        seo_score: analysis.seoScore,
        website_quality: analysis.websiteQuality,
        problems_found: analysis.problemsFound,
        analysis_report: {
          responsive: analysis.responsive,
          https: analysis.https,
          metaTitle: analysis.metaTitle,
          metaDescription: analysis.metaDescription,
          performance: analysis.performanceScore,
          accessibility: analysis.accessibilityScore,
          bestPractices: analysis.bestPracticesScore
        },
        status: 'Novo'
      };

      const leadScore = calculateLeadScore(baseProspect, analysis, analysis.legacyWebsite);
      baseProspect.lead_score = leadScore;

      const prospectForText = {
        ...baseProspect,
        problems_found: analysis.problemsFound,
        lead_score: leadScore
      };

      baseProspect.diagnostic_summary = await generateDiagnosticSummary(
        prospectForText,
        analysis,
        { fastMode }
      );
      baseProspect.approach_suggestion = await generateApproachSuggestion(
        prospectForText,
        analysis,
        { fastMode }
      );

      const { data, error } = await adminSupabase
        .from('prospects')
        .insert(baseProspect)
        .select()
        .single();

      if (error) {
        if (String(error.message || '').toLowerCase().includes('duplicate')) {
          continue;
        }

        throw error;
      }

      dedupeKeys.forEach((key) => existingKeys.add(key));
      insertedProspects.push(data);
    }

    res.json({
      inserted: insertedProspects,
      total: insertedProspects.length,
      message:
        insertedProspects.length > 0
          ? `${insertedProspects.length} lead(s) novo(s) inserido(s) com sucesso.`
          : 'Nenhum novo lead foi encontrado para os filtros informados.',
      provider: searchResult.provider
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao buscar leads' });
  }
});

router.patch('/prospects/:id', async (req, res) => {
  try {
    const ownerUserId = await resolveOwnerUserId(req.authUser);
    const prospectId = Number(req.params.id);
    const payload = {};

    if (req.body.status && STATUS_OPTIONS.includes(req.body.status)) {
      payload.status = req.body.status;
    }

    if (req.body.last_contact_date !== undefined) {
      payload.last_contact_date = req.body.last_contact_date || null;
    }

    if (req.body.approach_suggestion !== undefined) {
      payload.approach_suggestion = cleanNullableString(req.body.approach_suggestion);
    }

    if (req.body.diagnostic_summary !== undefined) {
      payload.diagnostic_summary = cleanNullableString(req.body.diagnostic_summary);
    }

    if (req.body.problems_found !== undefined) {
      payload.problems_found = Array.isArray(req.body.problems_found) ? req.body.problems_found : [];
    }

    if (req.body.folder_name !== undefined) {
      const { data: currentProspect, error: currentError } = await adminSupabase
        .from('prospects')
        .select('analysis_report')
        .eq('id', prospectId)
        .eq('owner_user_id', ownerUserId)
        .single();

      if (currentError) throw currentError;

      payload.analysis_report = mergeAnalysisReport(currentProspect?.analysis_report, {
        folderName: cleanNullableString(req.body.folder_name)
      });
    }

    const { data, error } = await adminSupabase
      .from('prospects')
      .update(payload)
      .eq('id', prospectId)
      .eq('owner_user_id', ownerUserId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao atualizar lead' });
  }
});

router.post('/prospects/:id/add-to-crm', async (req, res) => {
  try {
    const ownerUserId = await resolveOwnerUserId(req.authUser);
    const prospectId = Number(req.params.id);

    const { data: existingHistory, error: historyError } = await adminSupabase
      .from('prospect_contact_history')
      .select('id')
      .eq('owner_user_id', ownerUserId)
      .eq('prospect_id', prospectId)
      .eq('channel', 'crm')
      .limit(1);

    if (historyError) throw historyError;

    if ((existingHistory || []).length > 0) {
      return res.status(409).json({ error: 'Lead ja enviado para o CRM' });
    }

    const { data: currentProspect, error: currentError } = await adminSupabase
      .from('prospects')
      .select('analysis_report')
      .eq('id', prospectId)
      .eq('owner_user_id', ownerUserId)
      .single();

    if (currentError) throw currentError;

    const { data, error } = await adminSupabase
      .from('prospects')
      .update({
        status: 'Interessado',
        last_contact_date: new Date().toISOString(),
        analysis_report: mergeAnalysisReport(currentProspect?.analysis_report, {
          crmSent: true,
          crmSentAt: new Date().toISOString()
        })
      })
      .eq('id', prospectId)
      .eq('owner_user_id', ownerUserId)
      .select()
      .single();

    if (error) throw error;

    await insertContactHistory(ownerUserId, prospectId, {
      channel: 'crm',
      message: 'Lead marcado como adicionado ao CRM',
      recipient: data.email || data.phone || data.business_name,
      metadata: { action: 'add_to_crm' }
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao adicionar lead ao CRM' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const ownerUserId = await resolveOwnerUserId(req.authUser);
    await hydrateIntegrationConfig(ownerUserId);
    const currentSettings = await fetchSettingsForOwner(ownerUserId);
    const payload = {
      whatsapp_template: cleanNullableString(req.body.whatsapp_template) || currentSettings.whatsapp_template,
      email_subject: cleanNullableString(req.body.email_subject) || currentSettings.email_subject,
      email_body_html: cleanNullableString(req.body.email_body_html) || currentSettings.email_body_html,
      sender_name: cleanNullableString(req.body.sender_name) || currentSettings.sender_name
    };

    const { data, error } = await adminSupabase
      .from('prospecting_settings')
      .update(payload)
      .eq('id', currentSettings.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao salvar configuracoes' });
  }
});

router.post('/whatsapp/register', async (req, res) => {
  try {
    const ownerUserId = await resolveOwnerUserId(req.authUser);
    const prospectIds = Array.isArray(req.body.prospect_ids) ? req.body.prospect_ids : [];
    const template = cleanNullableString(req.body.template);

    if (prospectIds.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos um lead' });
    }

    const { data: prospects, error } = await adminSupabase
      .from('prospects')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .in('id', prospectIds);

    if (error) throw error;

    const links = [];
    for (const prospect of prospects || []) {
      const message = interpolateTemplate(template || req.body.default_template || '', prospect);
      const phone = normalizePhone(prospect.phone);

      if (!phone) {
        continue;
      }

      await insertContactHistory(ownerUserId, prospect.id, {
        channel: 'whatsapp',
        message,
        recipient: phone,
        delivery_status: 'registrado',
        metadata: { mode: prospectIds.length > 1 ? 'massa' : 'individual' }
      });

      await adminSupabase
        .from('prospects')
        .update({
          status: 'Contato Enviado',
          last_contact_date: new Date().toISOString()
        })
        .eq('id', prospect.id);

      links.push({
        prospect_id: prospect.id,
        business_name: prospect.business_name,
        url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      });
    }

    res.json({ links });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao registrar envio de WhatsApp' });
  }
});

router.post('/email/send', async (req, res) => {
  try {
    const ownerUserId = await resolveOwnerUserId(req.authUser);
    await hydrateIntegrationConfig(ownerUserId);
    const prospectIds = Array.isArray(req.body.prospect_ids) ? req.body.prospect_ids : [];
    const subjectTemplate = cleanNullableString(req.body.subject);
    const bodyTemplate = cleanNullableString(req.body.body_html);

    if (prospectIds.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos um lead' });
    }

    const transport = createEmailTransport();
    const settings = await fetchSettingsForOwner(ownerUserId);

    const { data: prospects, error } = await adminSupabase
      .from('prospects')
      .select('*')
      .eq('owner_user_id', ownerUserId)
      .in('id', prospectIds);

    if (error) throw error;

    const sent = [];
    for (const prospect of prospects || []) {
      if (!prospect.email) {
        continue;
      }

      const subject = interpolateTemplate(subjectTemplate || settings.email_subject, prospect);
      const html = interpolateTemplate(bodyTemplate || settings.email_body_html, prospect);

      await transport.sendMail({
        from: `"${settings.sender_name || 'Kaizen'}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
        to: prospect.email,
        subject,
        html
      });

      await insertContactHistory(ownerUserId, prospect.id, {
        channel: 'email',
        subject,
        message: html,
        recipient: prospect.email,
        delivery_status: 'enviado',
        metadata: { mode: prospectIds.length > 1 ? 'massa' : 'individual' }
      });

      await adminSupabase
        .from('prospects')
        .update({
          status: 'Contato Enviado',
          last_contact_date: new Date().toISOString()
        })
        .eq('id', prospect.id);

      sent.push({ id: prospect.id, email: prospect.email, subject });
    }

    res.json({ sent });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao enviar emails' });
  }
});

module.exports = router;
