const { getPool } = require('../config/database');
const { decryptSecret } = require('./integration-crypto');
const { normalizeIntegrationMetadata } = require('./integration-metadata');
const { createOrFindProspect } = require('./prospect-service');
const { dispatchDomainEvent } = require('./domain-events');

const MIN_PROSPECTING_REQUESTED_QUANTITY = 1;
const MAX_PROSPECTING_REQUESTED_QUANTITY = 100;
const PROSPECTING_CANDIDATE_MULTIPLIER = 2;
const MAX_CANDIDATE_BUDGET = MAX_PROSPECTING_REQUESTED_QUANTITY * PROSPECTING_CANDIDATE_MULTIPLIER;

const digits = (value) => String(value || '').replace(/\D/g, '');
const phone = (value) => {
  const raw = digits(value);
  if (!raw) return null;
  if (raw.length === 10 || raw.length === 11) return `55${raw}`;
  return raw;
};
const website = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
};
const text = (value) => String(value || '').trim() || null;
const safePayload = (value) => JSON.stringify(value).slice(0, 100000);

function actorInput(parameters) {
  const searchTerm = String(parameters.searchTerms || '').trim();
  const quantity = validateRequestedQuantity(parameters.quantity);
  const locationQuery = [parameters.city, parameters.state].filter(Boolean).join(', ');
  const input = {
    searchStringsArray: [searchTerm],
    maxCrawledPlacesPerSearch: candidateBudget(quantity),
  };
  if (locationQuery) input.locationQuery = locationQuery;
  return input;
}

function candidateBudget(requestedQuantity) {
  return validateRequestedQuantity(requestedQuantity) * PROSPECTING_CANDIDATE_MULTIPLIER;
}

function validateRequestedQuantity(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < MIN_PROSPECTING_REQUESTED_QUANTITY || value > MAX_PROSPECTING_REQUESTED_QUANTITY) {
    const error = new Error(`A quantidade deve ser um inteiro entre ${MIN_PROSPECTING_REQUESTED_QUANTITY} e ${MAX_PROSPECTING_REQUESTED_QUANTITY}.`);
    error.code = 'PROSPECTING_QUANTITY_INVALID';
    error.minimum = MIN_PROSPECTING_REQUESTED_QUANTITY;
    error.maximum = MAX_PROSPECTING_REQUESTED_QUANTITY;
    throw error;
  }
  return value;
}

function targetReached(foundCount, requestedQuantity) {
  return foundCount >= requestedQuantity;
}

function budgetReached(processedCount, foundCount, requestedQuantity) {
  return processedCount >= candidateBudget(requestedQuantity) && foundCount < requestedQuantity;
}

async function apifySearch(parameters, config) {
  const token = decryptSecret(config)?.token;
  const metadata = normalizeIntegrationMetadata(config.configuration_metadata);
  const configuredActorId = String(metadata.googleMapsActorId || '').trim();
  const actorId = configuredActorId.replace('/', '~');
  if (!token) throw Object.assign(new Error('Configure a integracao Apify em Administracao > Integracoes.'), { code: 'APIFY_NOT_CONFIGURED' });
  if (!actorId) throw Object.assign(new Error('Configure o Actor do Google Maps na integracao Apify.'), { code: 'APIFY_ACTOR_NOT_CONFIGURED' });
  const timeout = Math.min(Math.max(Number(metadata.timeoutMinutes || 10), 1), 30) * 60 * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(actorInput(parameters)), signal: controller.signal });
    if (!response.ok) {
      const body = await response.text();
      let payload = {};
      try { payload = JSON.parse(body); } catch { /* resposta nao JSON */ }
      const status = response.status === 400 ? 'A Apify rejeitou os parametros da busca.' : response.status === 401 ? 'Token da Apify invalido.' : response.status === 403 ? 'Token da Apify sem acesso ao Actor.' : response.status === 404 ? 'Actor do Google Maps nao encontrado.' : response.status === 429 ? 'Limite de requisicoes da Apify atingido.' : response.status >= 500 ? 'Apify indisponivel no momento.' : 'A Apify recusou a execucao do Actor.';
      const code = response.status === 400 ? 'APIFY_INPUT_INVALID' : response.status === 401 ? 'APIFY_AUTH_FAILED' : response.status === 403 ? 'APIFY_ACTOR_FORBIDDEN' : response.status === 404 ? 'APIFY_ACTOR_NOT_FOUND' : response.status === 429 ? 'APIFY_RATE_LIMITED' : response.status >= 500 ? 'APIFY_PROVIDER_ERROR' : 'APIFY_PROVIDER_ERROR';
      throw Object.assign(new Error(status), { code, actorId: configuredActorId, providerStatus: response.status, providerErrorType: payload?.type || payload?.errorType || null, providerErrorCode: payload?.code || payload?.errorCode || null, providerMessage: String(payload?.error?.message || payload?.message || body).replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]').replace(/token[=:]\s*[^\s,]+/gi, 'token=[redacted]').slice(0, 240), timeout: false });
    }
    const items = await response.json();
    if (!Array.isArray(items)) throw Object.assign(new Error('Resposta invalida do dataset da Apify.'), { code: 'APIFY_INVALID_DATASET' });
    return items;
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('Tempo limite excedido na consulta da Apify.'), { code: 'APIFY_TIMEOUT', actorId: configuredActorId, providerStatus: null, timeout: true });
    if (!error.code) throw Object.assign(new Error('Nao foi possivel conectar a Apify.'), { code: 'APIFY_NETWORK_ERROR', actorId: configuredActorId, providerStatus: null, providerErrorType: error.name || 'NetworkError', providerMessage: String(error.message || '').slice(0, 240), timeout: false });
    throw error;
  } finally { clearTimeout(timer); }
}

function normalize(item) {
  const normalizedPhone = phone(item.phoneNumber || item.phone || item.phoneUnformatted || item.telephone);
  const normalizedWebsite = website(item.website || item.url);
  const social = item.socialMedia || item.socialProfiles || {};
  return {
    company_name: text(item.title || item.businessName || item.name || item.placeName),
    category: text(item.categoryName || item.category || (Array.isArray(item.categories) ? item.categories[0] : null)),
    address: text(item.address || item.street), city: text(item.city), state: text(item.state),
    phone: text(item.phoneNumber || item.phone || item.phoneUnformatted || item.internationalPhone || item.telephone), normalized_phone: normalizedPhone,
    email: text(item.email || (Array.isArray(item.emails) ? item.emails[0] : null)),
    website: text(item.website), normalized_website_domain: website(item.website),
    instagram_url: text(item.instagram || item.instagramUrl || social.instagram || social.instagrams?.[0]),
    google_maps_url: text(item.url || item.googleMapsUrl), place_id: text(item.placeId),
    rating: item.totalScore == null && item.rating == null ? null : Number(item.totalScore ?? item.rating),
    review_count: item.reviewsCount == null && item.totalReviews == null && item.reviewCount == null ? null : Number(item.reviewsCount ?? item.totalReviews ?? item.reviewCount),
    raw_payload: safePayload(item),
  };
}

async function recordEvent(connection, jobId, eventType, message) {
  await connection.execute('INSERT INTO prospecting_job_events (job_id, event_type, message, metadata) VALUES (?, ?, ?, ?)', [jobId, eventType, message, JSON.stringify({})]);
}

async function persistCandidate(connection, job, item, counters) {
  const row = normalize(item);
  counters.processedCount += 1;
  if (!row.normalized_phone) {
    counters.invalidCount += 1;
    await connection.execute(
      `INSERT INTO prospecting_results (id, job_id, prospect_id, source, company_name, category, address, city, state, phone, normalized_phone, website, normalized_website_domain, rating, review_count, whatsapp_status, duplicate_status, raw_payload)
       VALUES (UUID(), ?, NULL, 'google_maps', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_checked', 'invalid_no_phone', ?)`,
      [job.id, row.company_name, row.category, row.address, row.city, row.state, row.phone, row.normalized_phone, row.website, row.normalized_website_domain, row.rating, row.review_count, row.raw_payload],
    );
    return row;
  }

  const result = await createOrFindProspect({
    ownerUserId: job.created_by,
    businessName: row.company_name,
    category: row.category,
    address: row.address,
    city: row.city,
    state: row.state,
    phone: row.phone,
    email: row.email,
    website: row.website,
    analysisReport: {
      source: 'google_maps',
      google_maps_url: row.google_maps_url,
      google_rating: row.rating,
      google_reviews: row.review_count,
      instagram: row.instagram_url,
      place_id: row.place_id,
    },
  }, { connection });
  const duplicateStatus = result.created ? 'new' : 'duplicate';
  if (result.created) counters.foundCount += 1;
  else counters.duplicateCount += 1;
  const resultInsert = await connection.execute(
    `INSERT INTO prospecting_results (id, job_id, prospect_id, source, company_name, category, address, city, state, phone, normalized_phone, website, normalized_website_domain, rating, review_count, whatsapp_status, duplicate_status, raw_payload)
     VALUES (UUID(), ?, ?, 'google_maps', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_checked', ?, ?)`,
    [job.id, result.prospect.id, row.company_name, row.category, row.address, row.city, row.state, row.phone, row.normalized_phone, row.website, row.normalized_website_domain, row.rating, row.review_count, duplicateStatus, row.raw_payload],
  );
  let membershipCreated = false;
  if (result.created && job.destination_folder_id != null) {
    const [membership] = await connection.execute('INSERT IGNORE INTO lead_folder_members (folder_id, prospect_id) VALUES (?, ?)', [job.destination_folder_id, result.prospect.id]);
    membershipCreated = Number(membership.affectedRows || 0) > 0;
  }
  return { row, membershipCreated, prospectId: result.prospect.id };
}

async function processCandidates(connection, job, parameters, items) {
  const requestedQuantity = Math.max(Number(job.requested_quantity) || 0, 0);
  const budget = candidateBudget(requestedQuantity);
  const minimumRating = parameters.minimumRating == null ? null : Number(parameters.minimumRating);
  const candidates = items
    .filter((candidate) => minimumRating == null || Number(candidate.totalScore ?? candidate.rating ?? 0) >= minimumRating)
    .slice(0, budget);
  const counters = { processedCount: 0, foundCount: 0, duplicateCount: 0, invalidCount: 0 };

  for (const item of candidates) {
    await connection.beginTransaction();
    try {
      const candidateResult = await persistCandidate(connection, job, item, counters);
      await connection.execute(
        `UPDATE prospecting_jobs SET processed_count = ?, found_count = ?, duplicate_count = ?, invalid_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [counters.processedCount, counters.foundCount, counters.duplicateCount, counters.invalidCount, job.id],
      );
      await connection.commit();
      if (candidateResult.membershipCreated) {
        await dispatchDomainEvent({
          type: 'lead.added_to_folder',
          entityType: 'lead',
          entityId: candidateResult.prospectId,
          actorUserId: job.created_by,
          payload: { leadId: candidateResult.prospectId, folderId: job.destination_folder_id },
          idempotencyKey: `prospecting-job-folder:${job.id}:${candidateResult.prospectId}:${job.destination_folder_id}`,
        });
      }
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    if (targetReached(counters.foundCount, requestedQuantity)) break;
  }
  return {
    ...counters,
    targetReached: targetReached(counters.foundCount, requestedQuantity),
    budgetReached: budgetReached(counters.processedCount, counters.foundCount, requestedQuantity),
  };
}

async function processProspectingJob(jobId) {
  const connection = await getPool().getConnection();
  let actorId = null;
  try {
    await connection.beginTransaction();
    const [jobs] = await connection.execute('SELECT * FROM prospecting_jobs WHERE id = ? FOR UPDATE', [jobId]);
    const job = jobs[0];
    if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) { await connection.rollback(); return; }
    validateRequestedQuantity(job.requested_quantity);
    console.info('[Prospecting] job claimed', { jobId, status: job.status });
    await connection.execute("UPDATE prospecting_jobs SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), integration_provider = 'apify' WHERE id = ?", [jobId]);
    await recordEvent(connection, jobId, 'job_started', 'Busca iniciada.');
    await connection.commit();
    const [configs] = await getPool().execute("SELECT * FROM integration_providers WHERE provider = 'apify' LIMIT 1");
    if (!configs[0]?.secret_ciphertext) throw Object.assign(new Error('Configure a integracao Apify em Administracao > Integracoes.'), { code: 'APIFY_NOT_CONFIGURED' });
    const integrationMetadata = normalizeIntegrationMetadata(configs[0].configuration_metadata);
    actorId = String(integrationMetadata.googleMapsActorId || '').trim() || null;
    let parameters;
    try {
      parameters = normalizeIntegrationMetadata(job.search_parameters);
    } catch (error) {
      throw Object.assign(new Error('Parametros da busca possuem formato invalido.'), { code: 'PROSPECTING_JOB_PAYLOAD_INVALID', stage: 'job_payload', actorId });
    }
    console.info('[Prospecting] provider run started', { jobId, provider: 'apify' });
    const items = await apifySearch({ ...parameters, quantity: job.requested_quantity }, configs[0]);
    const counters = await processCandidates(connection, job, parameters, items);
    await connection.beginTransaction();
    await connection.execute('UPDATE prospecting_jobs SET status = \'completed\', processed_count = ?, found_count = ?, duplicate_count = ?, invalid_count = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [counters.processedCount, counters.foundCount, counters.duplicateCount, counters.invalidCount, jobId]);
    await recordEvent(connection, jobId, 'job_completed', 'Busca concluida.');
    await connection.commit();
    console.info('[Prospecting] job completed', { jobId, resultCount: counters.foundCount });
  } catch (error) {
    await connection.rollback().catch(() => {});
    await getPool().execute("UPDATE prospecting_jobs SET status = 'failed', failed_at = CURRENT_TIMESTAMP, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [String(error.message || 'Falha na prospeccao').slice(0, 500), jobId]).catch(() => {});
    console.error('[Prospecting] job failed', { jobId, stage: error?.stage || 'provider', provider: 'apify', actorId: error?.actorId || actorId || null, operation: error?.stage === 'job_payload' ? 'deserialize_search_parameters' : 'run_sync_get_dataset_items', errorCode: error?.code || 'UNEXPECTED', errorName: error?.name || 'Error', providerStatus: error?.providerStatus || null, providerErrorType: error?.providerErrorType || null, providerErrorCode: error?.providerErrorCode || null, providerMessage: String(error?.providerMessage || error?.message || '').replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]').replace(/token[=:]\s*[^\s,]+/gi, 'token=[redacted]').slice(0, 240), timeout: Boolean(error?.timeout) });
  } finally { connection.release(); }
}

async function processProspectingBatch(limit = 2) {
  const [jobs] = await getPool().execute("SELECT id FROM prospecting_jobs WHERE status IN ('queued', 'pending') ORDER BY created_at LIMIT ?", [limit]);
  for (const job of jobs) await processProspectingJob(job.id);
  return jobs.length;
}

module.exports = { actorInput, budgetReached, candidateBudget, MAX_CANDIDATE_BUDGET, MAX_PROSPECTING_REQUESTED_QUANTITY, MIN_PROSPECTING_REQUESTED_QUANTITY, normalize, processCandidates, processProspectingBatch, processProspectingJob, targetReached, validateRequestedQuantity };
