const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { normalizeUrl } = require('./website-diagnostic-service');
const { validateUrl } = require('./website-enrichment-ssrf');

const TTL_MS = 10 * 60 * 1000;
const RATE_LIMIT_MS = 5 * 60 * 1000;
const MAX_CONCURRENT = 1;
const DEFAULT_TIMEOUT_MS = 60_000;
const jobs = new Map();
const lastStartedByUser = new Map();
let activeCount = 0;

const finite = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const nonNegative = (value) => { const number = finite(value); return number != null && number >= 0 ? number : null; };
const text = (value) => typeof value === 'string' && value.trim() ? value.trim().slice(0, 500) : null;
const audit = (audits, id) => audits?.[id] && typeof audits[id] === 'object' ? audits[id] : null;
const auditMetric = (audits, id) => nonNegative(audit(audits, id)?.numericValue);
const safeErrorCode = (value) => String(value || 'LIGHTHOUSE_PROCESS_FAILED').replace(/[^A-Z0-9_:-]/gi, '').slice(0, 80) || 'LIGHTHOUSE_PROCESS_FAILED';

function normalizeLighthouseResult(payload, strategy = 'mobile') {
  if (strategy !== 'mobile') throw Object.assign(new Error('Only mobile Lighthouse is currently supported.'), { code: 'LIGHTHOUSE_STRATEGY_INVALID' });
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return failedPerformance('LIGHTHOUSE_INVALID_RESULT', strategy);
  if (payload.runtimeError) return failedPerformance('LIGHTHOUSE_RUNTIME_ERROR', strategy);
  const audits = payload.audits || {};
  const categories = payload.categories || {};
  const lab = { fcpMs: auditMetric(audits, 'first-contentful-paint'), lcpMs: auditMetric(audits, 'largest-contentful-paint'), cls: nonNegative(auditMetric(audits, 'cumulative-layout-shift')), speedIndexMs: auditMetric(audits, 'speed-index'), tbtMs: auditMetric(audits, 'total-blocking-time'), ttfbMs: auditMetric(audits, 'server-response-time') };
  const score = finite(categories.performance?.score) == null ? null : Math.round(categories.performance.score * 100);
  const opportunities = Object.entries(audits).filter(([, value]) => value?.details?.type === 'opportunity' || value?.details?.overallSavingsMs != null || value?.details?.overallSavingsBytes != null).slice(0, 12).map(([id, value]) => ({ id, title: text(value.title) || id, description: text(value.description), savingsMs: nonNegative(value.details?.overallSavingsMs), savingsBytes: nonNegative(value.details?.overallSavingsBytes) }));
  const hasLab = Object.values(lab).some((value) => value !== null);
  if (!hasLab && score === null) return failedPerformance('LIGHTHOUSE_INVALID_RESULT', strategy);
  return { status: 'completed', score, strategy, source: 'lighthouse_local', analyzedAt: new Date().toISOString(), lab, field: null, opportunities, errorCode: null };
}

function failedPerformance(errorCode, strategy = 'mobile') { return { status: 'failed', score: null, strategy, source: null, analyzedAt: null, lab: null, field: null, opportunities: [], errorCode: safeErrorCode(errorCode) }; }

function sanitizeError(error) { return safeErrorCode(error?.code || error?.name) || 'LIGHTHOUSE_PROCESS_FAILED'; }

async function executeLighthouse({ url, strategy = 'mobile', timeoutMs = DEFAULT_TIMEOUT_MS, executable = 'lighthouse', spawnFn = spawn, validate = validateUrl } = {}) {
  if (strategy !== 'mobile') throw Object.assign(new Error('Only mobile Lighthouse is currently supported.'), { code: 'LIGHTHOUSE_STRATEGY_INVALID' });
  const normalized = normalizeUrl(url);
  await validate(normalized);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kaizen-lighthouse-'));
  const output = path.join(tempDir, 'result.json');
  let child;
  let timer;
  let settled = false;
  const cleanup = async () => { if (timer) clearTimeout(timer); await fs.rm(tempDir, { recursive: true, force: true }); };
  try {
    const args = [normalized, '--quiet', '--output=json', `--output-path=${output}`, '--only-categories=performance', '--form-factor=mobile', '--screenEmulation.mobile=true'];
    child = spawnFn(executable, args, { shell: false, windowsHide: true });
    const result = await new Promise((resolve, reject) => {
      const finish = (error, value) => { if (settled) return; settled = true; error ? reject(error) : resolve(value); };
      timer = setTimeout(() => { child.kill('SIGTERM'); setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 3000); finish(Object.assign(new Error('Lighthouse timed out.'), { code: 'LIGHTHOUSE_TIMEOUT' })); }, timeoutMs);
      child.once('error', (error) => finish(Object.assign(new Error('Lighthouse process failed.'), { code: error?.code === 'ENOENT' ? 'LIGHTHOUSE_UNAVAILABLE' : 'LIGHTHOUSE_PROCESS_FAILED' })));
      child.once('exit', async (code) => { if (code !== 0) return finish(Object.assign(new Error('Lighthouse exited with an error.'), { code: 'LIGHTHOUSE_PROCESS_FAILED' })); try { resolve(JSON.parse(await fs.readFile(output, 'utf8'))); } catch { finish(Object.assign(new Error('Lighthouse returned invalid JSON.'), { code: 'LIGHTHOUSE_INVALID_RESULT' })); } });
    });
    return normalizeLighthouseResult(result, strategy);
  } finally { await cleanup(); }
}

function publicJob(job) { return { token: job.token, status: job.status, createdAt: job.createdAt, expiresAt: job.expiresAt, result: job.status === 'completed' ? job.result : null, errorCode: job.status === 'failed' ? job.errorCode : null }; }
function purgeExpired(now = Date.now()) { for (const [token, job] of jobs) if (job.expiresAt <= now) jobs.delete(token); for (const [userId, startedAt] of lastStartedByUser) if (now - startedAt >= RATE_LIMIT_MS) lastStartedByUser.delete(userId); }

function createPerformanceJob({ ownerUserId, url, strategy = 'mobile', executor = executeLighthouse, now = Date.now() } = {}) {
  purgeExpired(now);
  if (!Number.isSafeInteger(Number(ownerUserId)) || Number(ownerUserId) <= 0) return { error: 'LIGHTHOUSE_OWNER_INVALID' };
  if (strategy !== 'mobile') return { error: 'LIGHTHOUSE_STRATEGY_INVALID' };
  let normalized; try { normalized = normalizeUrl(url); } catch { return { error: 'LIGHTHOUSE_INVALID_URL' }; }
  const userKey = String(ownerUserId);
  if (lastStartedByUser.has(userKey)) return { error: 'LIGHTHOUSE_RATE_LIMITED' };
  if (activeCount >= MAX_CONCURRENT) return { error: 'LIGHTHOUSE_BUSY' };
  const token = crypto.randomBytes(32).toString('hex');
  const job = { token, ownerUserId: Number(ownerUserId), url: normalized, strategy, status: 'pending', createdAt: new Date(now).toISOString(), expiresAt: now + TTL_MS, result: null, errorCode: null };
  jobs.set(token, job); lastStartedByUser.set(userKey, now); activeCount += 1;
  Promise.resolve().then(() => { job.status = 'processing'; return executor({ url: normalized, strategy }); }).then((result) => { job.status = result.status === 'completed' ? 'completed' : 'failed'; job.result = result.status === 'completed' ? result : null; job.errorCode = result.status === 'completed' ? null : result.errorCode; }).catch((error) => { job.status = 'failed'; job.errorCode = sanitizeError(error); }).finally(() => { activeCount -= 1; });
  return { job: publicJob(job) };
}

function getPerformanceJob({ token, ownerUserId, now = Date.now() } = {}) { purgeExpired(now); const job = jobs.get(String(token)); if (!job || job.ownerUserId !== Number(ownerUserId)) return null; return publicJob(job); }
function resetPerformanceJobs() { jobs.clear(); lastStartedByUser.clear(); activeCount = 0; }

module.exports = { DEFAULT_TIMEOUT_MS, MAX_CONCURRENT, RATE_LIMIT_MS, TTL_MS, executeLighthouse, normalizeLighthouseResult, createPerformanceJob, getPerformanceJob, purgeExpired, resetPerformanceJobs };
