const crypto = require('node:crypto');
const { normalizeUrl } = require('./website-diagnostic-service');
const { validateUrl } = require('./website-enrichment-ssrf');
const { runGooglePageSpeed } = require('./pagespeed-google-provider');
const { requestPageSpeed } = require('./pagespeed-google-transport');

const TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_MS = 5 * 60 * 1000;
const MAX_CONCURRENT = 1;
const DEFAULT_TIMEOUT_MS = 30_000;
const jobs = new Map();
const lastStartedByUser = new Map();
let activeCount = 0;

const finite = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const nonNegative = (value) => { const number = finite(value); return number != null && number >= 0 ? number : null; };
const text = (value) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
const audit = (audits, id) => audits?.[id] && typeof audits[id] === 'object' ? audits[id] : null;
const auditMetric = (audits, id) => nonNegative(audit(audits, id)?.numericValue);
const safeErrorCode = (value) => String(value || 'PAGESPEED_REQUEST_FAILED').replace(/[^A-Z0-9_:-]/gi, '').slice(0, 80) || 'PAGESPEED_REQUEST_FAILED';
const AUDIT_CATALOG = { 'render-blocking-resources': ['renderização', ['FCP', 'LCP'], 'Adie recursos não essenciais e mantenha o CSS crítico disponível para a primeira renderização.'], 'unused-javascript': ['javascript', ['TBT', 'LCP'], 'Reduza JavaScript não utilizado e carregue scripts não essenciais somente quando necessário.'], 'unused-css-rules': ['css', ['FCP', 'LCP'], 'Remova CSS não utilizado e evite folhas de estilo desnecessárias no carregamento inicial.'], 'uses-optimized-images': ['imagens', ['LCP'], 'Comprima imagens e utilize dimensões e formatos próximos ao uso real.'], 'uses-responsive-images': ['imagens', ['LCP'], 'Entregue imagens responsivas dimensionadas para o viewport.'], 'uses-text-compression': ['rede', ['FCP', 'LCP'], 'Habilite compressão de texto para reduzir o payload transferido.'], 'uses-long-cache-ttl': ['cache', ['FCP', 'LCP'], 'Configure cache de longa duração para arquivos estáticos versionados.'], 'font-display': ['fontes', ['FCP', 'LCP'], 'Configure font-display para reduzir bloqueios durante o carregamento das fontes.'] };
const auditIsProblematic = (value) => value?.scoreDisplayMode !== 'informative' && (value?.score == null || value.score < 0.9 || nonNegative(value?.details?.overallSavingsMs) > 0 || nonNegative(value?.details?.overallSavingsBytes) > 0);

function normalizePageSpeedInsightsResult(payload, strategy = 'mobile') {
  if (strategy !== 'mobile') throw Object.assign(new Error('Only mobile PageSpeed analysis is currently supported.'), { code: 'PAGESPEED_STRATEGY_INVALID' });
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return failedPerformance('PAGESPEED_INVALID_RESPONSE', strategy);
  if (payload.runtimeError) return failedPerformance('PAGESPEED_INVALID_RESPONSE', strategy);
  const audits = payload.audits || {};
  const categories = payload.categories || {};
  const lab = { fcpMs: auditMetric(audits, 'first-contentful-paint'), lcpMs: auditMetric(audits, 'largest-contentful-paint'), cls: nonNegative(auditMetric(audits, 'cumulative-layout-shift')), speedIndexMs: auditMetric(audits, 'speed-index'), tbtMs: auditMetric(audits, 'total-blocking-time'), ttfbMs: auditMetric(audits, 'server-response-time') };
  const score = finite(categories.performance?.score) == null ? null : Math.round(categories.performance.score * 100);
  const opportunities = [...new Map(Object.entries(audits).filter(([id, value]) => AUDIT_CATALOG[id] && auditIsProblematic(value)).map(([id, value]) => { const [category, affectedMetrics, recommendation] = AUDIT_CATALOG[id]; const scoreValue = finite(value.score); const savingsMs = nonNegative(value.details?.overallSavingsMs); const savingsBytes = nonNegative(value.details?.overallSavingsBytes); const severity = scoreValue != null && scoreValue < 0.5 || (savingsMs != null && savingsMs >= 1000) ? 'high' : scoreValue != null && scoreValue < 0.9 || (savingsMs != null && savingsMs > 0) || (savingsBytes != null && savingsBytes > 0) ? 'medium' : 'recommended'; return [id, { id, auditId: id, title: text(value.title) || id, description: text(value.description), category, affectedMetrics, recommendation, severity, score: scoreValue, displayValue: text(value.displayValue), evidence: text(value.details?.headings?.[0]?.text), savingsMs, savingsBytes }]; })).values()].sort((a, b) => ({ high: 0, medium: 1, recommended: 2 }[a.severity] - { high: 0, medium: 1, recommended: 2 }[b.severity] || (b.savingsMs || 0) - (a.savingsMs || 0) || (b.savingsBytes || 0) - (a.savingsBytes || 0) || a.auditId.localeCompare(b.auditId))).slice(0, 12);
  const hasLab = Object.values(lab).some((value) => value !== null);
  if (!hasLab && score === null) return failedPerformance('PAGESPEED_INVALID_RESPONSE', strategy);
  return { status: 'completed', score, strategy, source: 'pagespeed_insights', analyzedAt: new Date().toISOString(), lab, field: null, opportunities, errorCode: null };
}

function failedPerformance(errorCode, strategy = 'mobile') { return { status: 'failed', score: null, strategy, source: null, analyzedAt: null, lab: null, field: null, opportunities: [], errorCode: safeErrorCode(errorCode) }; }

function sanitizeError(error) { return safeErrorCode(error?.code || error?.name) || 'PAGESPEED_REQUEST_FAILED'; }

async function executePageSpeed({ url, strategy = 'mobile', apiKey = process.env.GOOGLE_PAGESPEED_API_KEY, transport = requestPageSpeed, validate = validateUrl } = {}) {
  if (strategy !== 'mobile') throw Object.assign(new Error('Only mobile PageSpeed analysis is currently supported.'), { code: 'PAGESPEED_STRATEGY_INVALID' });
  const normalized = normalizeUrl(url);
  await validate(normalized);
  const normalizedResult = await runGooglePageSpeed({ url: normalized, strategy, apiKey, transport });
  return { ...normalizedResult, source: 'pagespeed_insights', analyzedAt: new Date().toISOString(), field: null, status: 'completed', errorCode: null };
}

function publicJob(job) { return { token: job.token, status: job.status, createdAt: job.createdAt, expiresAt: job.expiresAt, result: job.status === 'completed' ? job.result : null, errorCode: job.status === 'failed' ? job.errorCode : null }; }
function purgeExpired(now = Date.now()) { for (const [token, job] of jobs) if (job.expiresAt <= now) jobs.delete(token); for (const [userId, startedAt] of lastStartedByUser) if (now - startedAt >= RATE_LIMIT_MS) lastStartedByUser.delete(userId); }

function createPerformanceJob({ ownerUserId, url, strategy = 'mobile', executor = executePageSpeed, executorOptions = {}, now = Date.now() } = {}) {
  purgeExpired(now);
  if (!Number.isSafeInteger(Number(ownerUserId)) || Number(ownerUserId) <= 0) return { error: 'PAGESPEED_OWNER_INVALID' };
  if (strategy !== 'mobile') return { error: 'PAGESPEED_STRATEGY_INVALID' };
  let normalized; try { normalized = normalizeUrl(url); } catch { return { error: 'PAGESPEED_INVALID_URL' }; }
  const userKey = String(ownerUserId);
  const existing = [...jobs.values()].find((job) => job.ownerUserId === Number(ownerUserId) && job.url === normalized && ['pending', 'processing'].includes(job.status));
  if (existing) return { job: publicJob(existing), reused: true };
  const lastStarted = lastStartedByUser.get(userKey);
  if (lastStarted) return { error: 'PERFORMANCE_RATE_LIMIT', retryAfterSeconds: Math.max(1, Math.ceil((lastStarted + RATE_LIMIT_MS - now) / 1000)) };
  if (activeCount >= MAX_CONCURRENT) return { error: 'PERFORMANCE_BUSY' };
  const token = crypto.randomBytes(32).toString('hex');
  const job = { token, ownerUserId: Number(ownerUserId), url: normalized, strategy, status: 'pending', createdAt: new Date(now).toISOString(), expiresAt: now + TTL_MS, result: null, errorCode: null };
  jobs.set(token, job); lastStartedByUser.set(userKey, now); activeCount += 1;
  Promise.resolve().then(() => { job.status = 'processing'; return executor({ url: normalized, strategy, ...executorOptions }); }).then((result) => { job.status = result.status === 'completed' ? 'completed' : 'failed'; job.result = result.status === 'completed' ? result : null; job.errorCode = result.status === 'completed' ? null : result.errorCode; }).catch((error) => { job.status = 'failed'; job.errorCode = sanitizeError(error); }).finally(() => { activeCount -= 1; });
  return { job: publicJob(job) };
}

function getPerformanceJob({ token, ownerUserId, now = Date.now() } = {}) { purgeExpired(now); const job = jobs.get(String(token)); if (!job || job.ownerUserId !== Number(ownerUserId)) return null; return publicJob(job); }
function resetPerformanceJobs() { jobs.clear(); lastStartedByUser.clear(); activeCount = 0; }

module.exports = { DEFAULT_TIMEOUT_MS, MAX_CONCURRENT, RATE_LIMIT_MS, TTL_MS, executePageSpeed, normalizePageSpeedInsightsResult, createPerformanceJob, getPerformanceJob, purgeExpired, resetPerformanceJobs };
