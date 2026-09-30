const { getPool } = require('../config/database');
const { decryptSecret } = require('./integration-crypto');

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
  const input = {
    searchTerms: [String(parameters.searchTerms || '').trim()],
    maxItems: Math.min(Math.max(Number(parameters.quantity) || 20, 1), 150),
  };
  return input;
}

async function apifySearch(parameters, config) {
  const token = decryptSecret(config)?.token;
  const metadata = JSON.parse(config.configuration_metadata || '{}');
  const actorId = String(metadata.googleMapsActorId || '').trim().replace('/', '~');
  if (!token) throw Object.assign(new Error('Configure a integracao Apify em Administracao > Integracoes.'), { code: 'APIFY_NOT_CONFIGURED' });
  if (!actorId) throw Object.assign(new Error('Configure o Actor do Google Maps na integracao Apify.'), { code: 'APIFY_ACTOR_NOT_CONFIGURED' });
  const timeout = Math.min(Math.max(Number(metadata.timeoutMinutes || 10), 1), 30) * 60 * 1000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(actorInput(parameters)), signal: controller.signal });
    if (!response.ok) {
      const status = response.status === 401 ? 'Token da Apify invalido.' : response.status === 404 ? 'Actor do Google Maps nao encontrado.' : 'A Apify recusou a execucao do Actor.';
      throw Object.assign(new Error(status), { code: response.status === 401 ? 'APIFY_INVALID_TOKEN' : 'APIFY_PROVIDER_ERROR' });
    }
    const items = await response.json();
    if (!Array.isArray(items)) throw Object.assign(new Error('Resposta invalida do dataset da Apify.'), { code: 'APIFY_INVALID_DATASET' });
    return items;
  } catch (error) {
    if (error.name === 'AbortError') throw Object.assign(new Error('Tempo limite excedido na consulta da Apify.'), { code: 'APIFY_TIMEOUT' });
    throw error;
  } finally { clearTimeout(timer); }
}

function normalize(item) {
  const normalizedPhone = phone(item.phoneNumber || item.phone || item.telephone);
  const normalizedWebsite = website(item.website || item.url);
  return { company_name: text(item.title || item.name || item.businessName) || 'Empresa sem nome', category: text(item.categoryName || item.category), address: text(item.address || item.street), city: text(item.city), state: text(item.state), phone: text(item.phoneNumber || item.phone || item.telephone), normalized_phone: normalizedPhone, website: text(item.website || item.url), normalized_website_domain: normalizedWebsite, rating: item.totalScore == null && item.rating == null ? null : Number(item.totalScore ?? item.rating), review_count: item.reviewsCount == null && item.reviewCount == null ? null : Number(item.reviewsCount ?? item.reviewCount), raw_payload: safePayload(item) };
}

async function recordEvent(connection, jobId, eventType, message) {
  await connection.execute('INSERT INTO prospecting_job_events (job_id, event_type, message, metadata) VALUES (?, ?, ?, ?)', [jobId, eventType, message, JSON.stringify({})]);
}

async function processProspectingJob(jobId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [jobs] = await connection.execute('SELECT * FROM prospecting_jobs WHERE id = ? FOR UPDATE', [jobId]);
    const job = jobs[0];
    if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) { await connection.rollback(); return; }
    await connection.execute("UPDATE prospecting_jobs SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), integration_provider = 'apify' WHERE id = ?", [jobId]);
    await recordEvent(connection, jobId, 'job_started', 'Busca iniciada.');
    await connection.commit();
    const [configs] = await getPool().execute("SELECT * FROM integration_providers WHERE provider = 'apify' LIMIT 1");
    if (!configs[0]?.secret_ciphertext) throw Object.assign(new Error('Configure a integracao Apify em Administracao > Integracoes.'), { code: 'APIFY_NOT_CONFIGURED' });
    const parameters = JSON.parse(job.search_parameters || '{}');
    const items = await apifySearch(parameters, configs[0]);
    const dedup = new Set();
    let duplicates = 0;
    const connection2 = await getPool().getConnection();
    try {
      await connection2.beginTransaction();
      const minimumRating = parameters.minimumRating == null ? null : Number(parameters.minimumRating);
      for (const item of items.filter((candidate) => minimumRating == null || Number(candidate.totalScore ?? candidate.rating ?? 0) >= minimumRating).slice(0, Number(job.requested_quantity))) {
        const row = normalize(item);
        const key = row.normalized_phone || row.normalized_website_domain || row.company_name.toLowerCase();
        if (dedup.has(key)) { duplicates += 1; continue; }
        dedup.add(key);
        const [existing] = await connection2.execute('SELECT id FROM prospects WHERE owner_user_id = ? AND ((normalized_phone IS NOT NULL AND normalized_phone = ?) OR (normalized_website IS NOT NULL AND normalized_website = ?)) LIMIT 1', [job.created_by, row.normalized_phone, row.normalized_website_domain]);
        const status = existing[0] ? 'duplicate' : 'new';
        await connection2.execute(`INSERT INTO prospecting_results (id, job_id, source, company_name, category, address, city, state, phone, normalized_phone, website, normalized_website_domain, rating, review_count, whatsapp_status, duplicate_status, raw_payload) VALUES (UUID(), ?, 'google_maps', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'not_checked', ?, ?)`, [jobId, row.company_name, row.category, row.address, row.city, row.state, row.phone, row.normalized_phone, row.website, row.normalized_website_domain, row.rating, row.review_count, status, row.raw_payload]);
      }
      await connection2.execute('UPDATE prospecting_jobs SET status = \'completed\', processed_count = ?, found_count = ?, duplicate_count = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [dedup.size, dedup.size, duplicates, jobId]);
      await recordEvent(connection2, jobId, 'job_completed', 'Busca concluida.');
      await connection2.commit();
    } finally { connection2.release(); }
  } catch (error) {
    await connection.rollback().catch(() => {});
    await getPool().execute("UPDATE prospecting_jobs SET status = 'failed', failed_at = CURRENT_TIMESTAMP, error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [String(error.message || 'Falha na prospeccao').slice(0, 500), jobId]).catch(() => {});
  } finally { connection.release(); }
}

async function processProspectingBatch(limit = 2) {
  const [jobs] = await getPool().execute("SELECT id FROM prospecting_jobs WHERE status IN ('queued', 'pending') ORDER BY created_at LIMIT ?", [limit]);
  for (const job of jobs) await processProspectingJob(job.id);
  return jobs.length;
}

module.exports = { actorInput, normalize, processProspectingBatch, processProspectingJob };
