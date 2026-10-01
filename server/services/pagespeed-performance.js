const { getPool } = require('../config/database');

const STRATEGIES = new Set(['mobile']);
const STATUSES = new Set(['pending', 'processing', 'completed', 'partial', 'failed']);
const MAX_ATTEMPTS = 2;
const CACHE_DAYS = 14;
const RETRY_DELAY_MINUTES = 5;
const MAX_OPPORTUNITIES = 12;
// Deliberately empty until versioned provider fixtures confirm the exact audit contract.
const OPPORTUNITY_IDS = new Set();

const finiteNumber = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const nonNegative = (value) => { const number = finiteNumber(value); return number != null && number >= 0 ? number : null; };
const metric = (value) => nonNegative(value);
const text = (value) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;

function normalizeScore(value) {
  const number = finiteNumber(value);
  if (number == null) return null;
  return number >= 0 && number <= 1 ? Math.round(number * 100) : null;
}

function auditValue(audits, id) {
  const audit = audits?.[id];
  return audit && typeof audit === 'object' ? audit : null;
}

function auditMetric(audits, id) {
  const audit = auditValue(audits, id);
  return metric(audit?.numericValue);
}

function normalizeField(field) {
  // This receives the internal adapter contract, not raw loadingExperience data.
  const data = field && typeof field === 'object' ? field : {};
  const source = data.source === 'url' || data.source === 'origin' ? data.source : null;
  return {
    available: data.available === true && source !== null,
    source: data.available === true ? source : null,
    lcpMs: metric(data.lcpMs),
    inpMs: metric(data.inpMs),
    cls: nonNegative(data.cls),
  };
}

function normalizeOpportunities(audits) {
  if (!audits || typeof audits !== 'object') return [];
  return Object.entries(audits).filter(([id]) => OPPORTUNITY_IDS.has(id)).slice(0, MAX_OPPORTUNITIES).map(([id, value]) => ({
    id,
    title: text(value?.title) || id,
    description: text(value?.description),
    savingsMs: nonNegative(value?.details?.overallSavingsMs),
    savingsBytes: nonNegative(value?.details?.overallSavingsBytes),
  }));
}

function normalizePageSpeedResponse(payload, strategy = 'mobile') {
  if (!STRATEGIES.has(strategy)) throw Object.assign(new Error('Unsupported PageSpeed strategy.'), { code: 'PAGESPEED_STRATEGY_INVALID' });
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { strategy, score: null, lab: null, field: normalizeField(null), opportunities: [], status: 'failed' };
  if (payload.runtimeError && typeof payload.runtimeError === 'object') return { strategy, score: null, lab: null, field: normalizeField(null), opportunities: [], status: 'failed' };
  const categories = payload.lighthouseResult?.categories || payload.categories || {};
  const audits = payload.lighthouseResult?.audits || payload.audits || {};
  const lab = {
    fcpMs: auditMetric(audits, 'first-contentful-paint'),
    lcpMs: auditMetric(audits, 'largest-contentful-paint'),
    cls: auditMetric(audits, 'cumulative-layout-shift'),
    speedIndexMs: auditMetric(audits, 'speed-index'),
    tbtMs: auditMetric(audits, 'total-blocking-time'),
    ttfbMs: auditMetric(audits, 'server-response-time'),
  };
  const hasLab = Object.values(lab).some((value) => value !== null);
  const field = normalizeField(payload.field || payload.loadingExperience || null);
  const result = { strategy, score: normalizeScore(categories.performance?.score ?? payload.score), lab: hasLab ? lab : null, field, opportunities: normalizeOpportunities(audits), status: hasLab || normalizeScore(categories.performance?.score ?? payload.score) !== null ? 'completed' : 'failed' };
  return result;
}

function normalizeWebsiteUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https?:\/\//i.test(raw)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    return url.toString();
  } catch { return null; }
}

function refreshDate(days = CACHE_DAYS) { return new Date(Date.now() + days * 24 * 60 * 60 * 1000); }

async function schedulePageSpeedAnalysis({ connection = getPool(), prospectId, ownerUserId, website, strategy = 'mobile' }) {
  const url = normalizeWebsiteUrl(website);
  if (!Number.isSafeInteger(Number(prospectId)) || Number(prospectId) <= 0) return { scheduled: false, reason: 'invalid_prospect' };
  if (!Number.isSafeInteger(Number(ownerUserId)) || Number(ownerUserId) <= 0) return { scheduled: false, reason: 'invalid_owner' };
  if (!url) return { scheduled: false, reason: 'invalid_url' };
  if (!STRATEGIES.has(strategy)) return { scheduled: false, reason: 'invalid_strategy' };
  const db = typeof connection.getConnection === 'function' ? await connection.getConnection() : connection;
  const ownsConnection = db !== connection;
  if (ownsConnection) await db.beginTransaction();
  try {
    const [prospect] = await db.execute('SELECT id, owner_user_id FROM prospects WHERE id = ? AND owner_user_id = ? LIMIT 1 FOR UPDATE', [prospectId, ownerUserId]);
    if (!prospect[0]) { if (ownsConnection) await db.rollback(); return { scheduled: false, reason: 'not_owned' }; }
    const [existing] = await db.execute('SELECT id, status, refresh_after FROM lead_pagespeed_analyses WHERE prospect_id = ? AND strategy = ? FOR UPDATE', [prospectId, strategy]);
    if (existing[0]?.refresh_after && new Date(existing[0].refresh_after).getTime() > Date.now() && existing[0].status === 'completed') { if (ownsConnection) await db.commit(); return { scheduled: false, reason: 'cache_valid', id: existing[0].id }; }
    if (existing[0]?.status === 'processing' || existing[0]?.status === 'pending') { if (ownsConnection) await db.commit(); return { scheduled: false, reason: 'already_queued', id: existing[0].id }; }
    const [result] = await db.execute(`INSERT INTO lead_pagespeed_analyses (prospect_id, owner_user_id, website_url, strategy, status, available_at) VALUES (?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE website_url = VALUES(website_url), status = 'pending', attempt_count = 0, available_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP`, [prospectId, prospect[0].owner_user_id, url, strategy]);
    if (ownsConnection) await db.commit();
    return { scheduled: Number(result.affectedRows || 0) > 0, status: 'pending', id: result.insertId || existing[0]?.id || null };
  } catch (error) { if (ownsConnection) await db.rollback(); throw error; } finally { if (ownsConnection) db.release(); }
}

async function acquirePageSpeedAnalysis({ connection, workerId = 'pagespeed-worker' } = {}) {
  if (!connection) throw new Error('A transactional connection is required.');
  await connection.beginTransaction();
  try {
    await connection.execute(`UPDATE lead_pagespeed_analyses SET status = 'failed', last_error = 'Stale job exceeded retry limit.', updated_at = CURRENT_TIMESTAMP WHERE status = 'processing' AND started_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE) AND attempt_count >= ?`, [MAX_ATTEMPTS]);
    const [rows] = await connection.execute(`SELECT * FROM lead_pagespeed_analyses WHERE ((status IN ('pending', 'failed') AND attempt_count < ? AND available_at <= CURRENT_TIMESTAMP) OR (status = 'processing' AND started_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE) AND attempt_count < ?)) ORDER BY id LIMIT 1 FOR UPDATE`, [MAX_ATTEMPTS, MAX_ATTEMPTS]);
    if (!rows[0]) { await connection.rollback(); return null; }
    const row = rows[0];
    await connection.execute('UPDATE lead_pagespeed_analyses SET status = \'processing\', attempt_count = attempt_count + 1, started_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [row.id]);
    await connection.commit();
    return { ...row, workerId, attempt_count: Number(row.attempt_count) + 1 };
  } catch (error) { await connection.rollback(); throw error; }
}

async function persistPageSpeedAnalysis({ connection = getPool(), job, normalized }) {
  if (!job || !normalized || !STATUSES.has(normalized.status)) throw new Error('Invalid PageSpeed persistence payload.');
  const analyzedAt = normalized.status === 'completed' || normalized.status === 'partial' ? new Date() : null;
  const refreshAfter = analyzedAt ? refreshDate() : null;
  await connection.execute(`UPDATE lead_pagespeed_analyses SET status = ?, completed_at = ?, analyzed_at = ?, refresh_after = ?, score = ?, lab_payload = ?, field_payload = ?, opportunities_payload = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [normalized.status, analyzedAt, analyzedAt, refreshAfter, normalized.score, normalized.lab ? JSON.stringify(normalized.lab) : null, JSON.stringify(normalized.field), JSON.stringify(normalized.opportunities), job.id]);
  return normalized.status;
}

function sanitizePageSpeedError(error, kind) {
  const code = String(kind || error?.code || 'INVALID_RESPONSE').replace(/[^A-Z0-9_:-]/gi, '').slice(0, 80) || 'INVALID_RESPONSE';
  const raw = typeof error === 'string' ? error : error?.message;
  const message = String(raw || '').replace(/Bearer\s+[^\s]+/gi, 'Bearer [redacted]').replace(/(api[_-]?key|token|authorization|password|secret)[=:]\s*[^\s,]+/gi, '$1=[redacted]').replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/gi, 'https://[redacted]@').replace(/[\r\n\t]+/g, ' ').slice(0, 360);
  return `${code}${message ? `: ${message}` : ''}`.slice(0, 500);
}

async function recordPageSpeedFailure({ connection = getPool(), job, error, kind }) {
  const classification = kind || classifyPageSpeedError(error);
  const retryable = classification === 'transient' && Number(job?.attempt_count || 0) < MAX_ATTEMPTS;
  const delayMinutes = RETRY_DELAY_MINUTES * Math.max(Number(job?.attempt_count || 1), 1);
  const status = retryable ? 'pending' : 'failed';
  await connection.execute(`UPDATE lead_pagespeed_analyses SET status = ?, available_at = ${retryable ? 'DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ? MINUTE)' : 'CURRENT_TIMESTAMP'}, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, retryable ? [status, delayMinutes, sanitizePageSpeedError(error, classification), job.id] : [status, sanitizePageSpeedError(error, classification), job.id]);
  return { status, retryable, delayMinutes, lastError: sanitizePageSpeedError(error, classification) };
}

function classifyPageSpeedError(error) {
  const code = String(error?.code || '');
  if (/TIMEOUT|ETIMEDOUT|ECONNRESET|EAI_AGAIN/.test(code)) return 'transient';
  if (/QUOTA|RATE_LIMIT/.test(code)) return 'quota';
  if (/KEY|AUTH|CONFIG/.test(code)) return 'configuration';
  if (/URL/.test(code)) return 'invalid_url';
  return 'invalid_response';
}

module.exports = { CACHE_DAYS, MAX_ATTEMPTS, acquirePageSpeedAnalysis, classifyPageSpeedError, normalizePageSpeedResponse, normalizeScore, normalizeWebsiteUrl, persistPageSpeedAnalysis, recordPageSpeedFailure, sanitizePageSpeedError, schedulePageSpeedAnalysis };
