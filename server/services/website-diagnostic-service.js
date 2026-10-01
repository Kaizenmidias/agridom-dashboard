const { getPool } = require('../config/database');
const { crawlWebsite, mergeResults, websiteUrl } = require('./website-enrichment-service');
const { validateUrl } = require('./website-enrichment-ssrf');
const { buildDiagnosticResult } = require('./website-diagnostic-rules');

const MAX_ATTEMPTS = 2;
const safeError = (error) => String(error?.code || 'DIAGNOSTIC_ERROR').replace(/[^A-Z0-9_]/gi, '').slice(0, 80) || 'DIAGNOSTIC_ERROR';
const normalizeUrl = (value) => { const url = new URL(websiteUrl(value)); url.hash = ''; return url.toString(); };

async function createDiagnostic({ connection = getPool(), ownerUserId, prospectId = null, url }) {
  const normalizedUrl = normalizeUrl(url);
  const parsed = new URL(normalizedUrl);
  await validateUrl(normalizedUrl);
  if (prospectId) { const [rows] = await connection.execute('SELECT id FROM prospects WHERE id = ? AND owner_user_id = ? LIMIT 1', [prospectId, ownerUserId]); if (!rows[0]) { const error = new Error('Prospect não encontrado.'); error.statusCode = 404; throw error; } }
  const [result] = await connection.execute('INSERT INTO website_diagnostics (owner_user_id, prospect_id, url, normalized_url, domain, status, available_at) VALUES (?, ?, ?, ?, ?, \'pending\', CURRENT_TIMESTAMP)', [ownerUserId, prospectId, String(url).trim(), normalizedUrl, parsed.hostname]);
  return { id: result.insertId, status: 'pending' };
}

function parseRow(row) {
  const json = (value) => { if (!value) return null; try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; } };
  return { ...row, summary: json(row.summary_payload), seo: json(row.seo_payload), performance: json(row.performance_payload), mobile: json(row.mobile_payload), security: json(row.security_payload), technology: json(row.technology_payload), tracking: json(row.tracking_payload), conversion: json(row.conversion_payload), social: json(row.social_payload), gaps: json(row.gaps_payload) || [], recommendations: json(row.recommendations_payload) || [] };
}

async function listDiagnostics({ connection = getPool(), ownerUserId, limit = 50 }) { const [rows] = await connection.execute('SELECT id, prospect_id, url, normalized_url, domain, status, overall_score, pages_analyzed, available_at, started_at, completed_at, last_error, created_at, updated_at FROM website_diagnostics WHERE owner_user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?', [ownerUserId, Math.min(Math.max(Number(limit) || 50, 1), 100)]); return rows; }
async function getDiagnostic({ connection = getPool(), ownerUserId, id }) { const [rows] = await connection.execute('SELECT * FROM website_diagnostics WHERE id = ? AND owner_user_id = ? LIMIT 1', [id, ownerUserId]); return rows[0] ? parseRow(rows[0]) : null; }

async function claimNextDiagnostic({ connection, workerId = 'website-diagnostic' }) {
  await connection.beginTransaction();
  try {
    await connection.execute("UPDATE website_diagnostics SET status='failed', last_error='STALE_ATTEMPTS_EXCEEDED', updated_at=CURRENT_TIMESTAMP WHERE status='processing' AND started_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE) AND attempt_count >= ?", [MAX_ATTEMPTS]);
    const [rows] = await connection.execute("SELECT * FROM website_diagnostics WHERE ((status IN ('pending','failed') AND attempt_count < ? AND available_at <= CURRENT_TIMESTAMP) OR (status='processing' AND started_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE) AND attempt_count < ?)) ORDER BY id LIMIT 1 FOR UPDATE", [MAX_ATTEMPTS, MAX_ATTEMPTS]);
    if (!rows[0]) { await connection.rollback(); return null; }
    await connection.execute("UPDATE website_diagnostics SET status='processing', attempt_count=attempt_count+1, started_at=CURRENT_TIMESTAMP, last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?", [rows[0].id]);
    await connection.commit(); return { ...rows[0], attempt_count: Number(rows[0].attempt_count) + 1, workerId };
  } catch (error) { await connection.rollback(); throw error; }
}

async function processOneDiagnostic({ connection, workerId, crawl = crawlWebsite } = {}) {
  const pool = getPool(); const claim = connection || await pool.getConnection(); let job;
  try { job = await claimNextDiagnostic({ connection: claim, workerId }); } finally { if (!connection) claim.release(); }
  if (!job) return false;
  const persistence = connection || pool;
  try { const merged = mergeResults(await crawl(job.normalized_url, { maxPages: 5 })); const result = buildDiagnosticResult(merged); const status = result.pagesAnalyzed > 0 ? (merged.diagnostic.partialError ? 'partial' : 'completed') : 'failed'; await persistence.execute('UPDATE website_diagnostics SET status=?, overall_score=?, summary_payload=?, seo_payload=?, performance_payload=?, mobile_payload=?, security_payload=?, technology_payload=?, tracking_payload=?, conversion_payload=?, social_payload=?, gaps_payload=?, recommendations_payload=?, pages_analyzed=?, completed_at=CURRENT_TIMESTAMP, last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, result.overallScore, JSON.stringify(result.summary), JSON.stringify(result.seo), JSON.stringify(result.performance), JSON.stringify(result.mobile), JSON.stringify(result.security), JSON.stringify(result.technology), JSON.stringify(result.tracking), JSON.stringify(result.conversion), JSON.stringify(result.social), JSON.stringify(result.gaps), JSON.stringify(result.recommendations), result.pagesAnalyzed, job.id]); return true; }
  catch (error) { const terminal = job.attempt_count >= MAX_ATTEMPTS; await persistence.execute("UPDATE website_diagnostics SET status=?, available_at=DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE), last_error=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", [terminal ? 'failed' : 'pending', safeError(error), job.id]); return true; }
}
async function processWebsiteDiagnosticBatch({ limit = 1, connection, workerId } = {}) { let count = 0; while (count < Math.min(Number(limit) || 1, 1) && await processOneDiagnostic({ connection, workerId })) count += 1; return count; }

module.exports = { MAX_ATTEMPTS, createDiagnostic, getDiagnostic, listDiagnostics, claimNextDiagnostic, processOneDiagnostic, processWebsiteDiagnosticBatch, normalizeUrl, parseRow };
