const { getPool } = require('../config/database');
const { fetchHtml } = require('./website-enrichment-ssrf');
const { parsePage } = require('./website-enrichment-parser');

const MAX_PAGES = 5;
const MAX_ATTEMPTS = 2;
const STALE_PROCESSING_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8000;
const TOTAL_TIMEOUT_MS = 30000;
const safeError = (error) => {
  const code = String(error?.code || '');
  if (code === 'ENRICHMENT_TIMEOUT' || code === 'ETIMEDOUT') return 'REQUEST_TIMEOUT';
  if (code === 'ENRICHMENT_SSRF_BLOCKED') return 'SSRF_BLOCKED';
  if (code === 'ENRICHMENT_SIZE_LIMIT') return 'TOO_LARGE';
  if (code === 'ENRICHMENT_NON_HTML') return 'INVALID_CONTENT_TYPE';
  if (code === 'ENRICHMENT_HTTP_ERROR') return `HTTP_${String(error.message || '').match(/HTTP (\d{3})/)?.[1] || 'ERROR'}`;
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return 'DNS_ERROR';
  if (/^(ECONN|EHOST|ENET|EPIPE|ECONNRESET)/.test(code)) return 'CONNECTION_ERROR';
  if (/^(CERT|DEPTH|ERR_TLS|UNABLE_TO_VERIFY)/.test(code)) return 'TLS_ERROR';
  return code.startsWith('ENRICHMENT_') ? code.replace(/^ENRICHMENT_/, '') : 'CONNECTION_ERROR';
};
const websiteUrl = (value) => { const raw = String(value || '').trim(); return raw ? (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`) : null; };
const isBlank = (value) => value == null || String(value).trim() === '';
const normalizePageUrl = (value, base) => { try { const url = new URL(value, base); if (!['http:', 'https:'].includes(url.protocol)) return null; url.hash = ''; for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid']) url.searchParams.delete(key); return url.toString(); } catch { return null; } };

function isUsefulLink(value, baseUrl) {
  try { const url = new URL(value, baseUrl); if (url.origin !== new URL(baseUrl).origin || !['http:', 'https:'].includes(url.protocol)) return false; if (/\.(pdf|zip|docx?|xlsx?|png|jpe?g|gif|webp|svg)(?:$|\?)/i.test(url.pathname)) return false; return /(contato|contact|fale[-_]?conosco|sobre|quem[-_]?somos|a[-_]?empresa|about)/i.test(url.pathname); } catch { return false; }
}

async function crawlWebsite(url, options = {}) {
  const started = Date.now();
  const pages = []; const visited = new Set(); const queue = [{ url: normalizePageUrl(url), priority: 0 }];
  while (queue.length && pages.length < (options.maxPages || MAX_PAGES)) {
    const remaining = (options.totalTimeoutMs || TOTAL_TIMEOUT_MS) - (Date.now() - started); if (remaining <= 0) throw Object.assign(new Error('Tempo total do enriquecimento excedido.'), { code: 'ENRICHMENT_TIMEOUT' });
    queue.sort((left, right) => left.priority - right.priority);
    const current = queue.shift().url; if (!current || visited.has(current)) continue; visited.add(current);
    let response;
    try { response = await (options.fetchHtml || fetchHtml)(current, { timeoutMs: Math.min(options.timeoutMs || REQUEST_TIMEOUT_MS, remaining), maxBytes: options.maxBytes }); }
    catch (error) { if (pages.length) { pages.partialError = error; break; } throw error; }
    const page = { ...parsePage(response.html, response.url, { responseTimeMs: response.responseTimeMs, headers: response.headers }), url: response.url };
    pages.push(page);
    for (const link of page.links) { const normalized = normalizePageUrl(link, response.url); if (normalized && !visited.has(normalized) && !queue.some((item) => item.url === normalized)) queue.push({ url: normalized, priority: isUsefulLink(normalized, response.url) ? 0 : 1 }); }
    queue.sort((left, right) => left.priority - right.priority); queue.splice(50);
  }
  return pages;
}

function mergeResults(pages) {
  const merged = { email: null, instagram: null, linkedin: null, address: null, phone: null, businessName: null };
  for (const page of pages) for (const key of Object.keys(merged)) if (!merged[key] && page.fields[key]) merged[key] = page.fields[key];
  const imageOpportunity = pages[0]?.diagnostic?.opportunities?.find((opportunity) => /^\d+ imagens sem atributo alt$/i.test(opportunity));
  const diagnostic = pages.reduce((result, page) => ({
    technology: { ...result.technology, ...page.diagnostic.technology },
    seo: result.seo || page.diagnostic.seo,
    marketing: { ...result.marketing, ...page.diagnostic.marketing },
    mobile: result.mobile || page.diagnostic.mobile,
    security: { ...result.security, ...page.diagnostic.security, headers: { ...result.security.headers, ...page.diagnostic.security.headers } },
    performance: { ...(result.performance || {}), responseTimeMs: result.performance?.responseTimeMs == null ? page.diagnostic.performance.responseTimeMs : result.performance.responseTimeMs, htmlSizeBytes: (result.performance?.htmlSizeBytes || 0) + page.diagnostic.performance.htmlSizeBytes, scriptCount: (result.performance?.scriptCount || 0) + page.diagnostic.performance.scriptCount, stylesheetCount: (result.performance?.stylesheetCount || 0) + page.diagnostic.performance.stylesheetCount, imageCount: (result.performance?.imageCount || 0) + page.diagnostic.performance.imageCount },
    opportunities: [...new Set([...(result.opportunities || []), ...page.diagnostic.opportunities.filter((opportunity) => !/^\d+ imagens sem atributo alt$/i.test(opportunity))])],
  }), { technology: {}, seo: null, marketing: {}, mobile: null, security: { headers: {} }, performance: {}, opportunities: [] });
  if (imageOpportunity) diagnostic.opportunities.push(imageOpportunity);
  diagnostic.homepage = pages[0]?.diagnostic || null;
  diagnostic.seoAggregate = { pagesAnalyzed: pages.length, imageCount: pages.reduce((sum, page) => sum + Number(page.diagnostic.seo?.imageCount || 0), 0), imagesWithoutAlt: pages.reduce((sum, page) => sum + Number(page.diagnostic.seo?.imagesWithoutAlt || 0), 0), pagesWithoutTitle: pages.filter((page) => !page.diagnostic.seo?.titlePresent).length, pagesWithoutMetaDescription: pages.filter((page) => !page.diagnostic.seo?.metaDescriptionPresent).length, pagesWithoutH1: pages.filter((page) => !page.diagnostic.seo?.h1Count).length, pagesWithMultipleH1: pages.filter((page) => Number(page.diagnostic.seo?.h1Count || 0) > 1).length, internalLinks: pages.reduce((sum, page) => sum + Number(page.diagnostic.seo?.internalLinks || 0), 0), externalLinks: pages.reduce((sum, page) => sum + Number(page.diagnostic.seo?.externalLinks || 0), 0) };
  diagnostic.limitations = { analysisType: 'static_html', maxPages: pages.length, javascriptOnlyContentMayBeMissed: true, missingMeansNotDetectedOnAnalyzedPages: true, performanceMeasured: false };
  return { fields: merged, diagnostic: { ...diagnostic, opportunities: [...new Set(diagnostic.opportunities)], pagesAnalyzed: pages.length, partialError: pages.partialError ? { code: pages.partialError.code || 'ENRICHMENT_PARTIAL', message: safeError(pages.partialError) } : null } };
}

async function scheduleWebsiteEnrichment({ connection = getPool(), prospectId, ownerUserId, website }) {
  const url = websiteUrl(website);
  if (!prospectId || !url) return { scheduled: false };
  try {
    const [result] = await connection.execute(`INSERT INTO lead_website_enrichments (prospect_id, owner_user_id, website_url, status, available_at) VALUES (?, ?, ?, 'pending', CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE prospect_id = prospect_id`, [prospectId, ownerUserId ?? null, url]);
    return { scheduled: Number(result.affectedRows || 0) > 0, status: 'pending' };
  } catch (error) { console.error('[Enrichment] schedule failed:', { code: error?.code || 'UNEXPECTED', message: safeError(error) }); return { scheduled: false, status: 'failed' }; }
}

async function claimNextEnrichment({ connection, workerId = 'website-enricher' } = {}) {
  if (!connection) throw new Error('Uma conexão transacional é obrigatória para reservar o enriquecimento.');
  await connection.beginTransaction();
  try {
    await connection.execute(`UPDATE lead_website_enrichments SET status = 'failed', last_error = 'Limite de tentativas atingida apos job stale.', updated_at = CURRENT_TIMESTAMP WHERE status = 'processing' AND started_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE) AND attempt_count >= ?`, [MAX_ATTEMPTS]);
    const [rows] = await connection.execute(`SELECT e.*, p.email, p.phone, p.website, p.address, p.instagram, p.business_name, p.analysis_report FROM lead_website_enrichments e JOIN prospects p ON p.id = e.prospect_id WHERE ((e.status IN ('pending', 'failed') AND e.attempt_count < ? AND e.available_at <= CURRENT_TIMESTAMP) OR (e.status = 'processing' AND e.started_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE) AND e.attempt_count < ?)) ORDER BY e.id LIMIT 1 FOR UPDATE`, [MAX_ATTEMPTS, MAX_ATTEMPTS]);
    if (!rows[0]) { await connection.rollback(); return null; }
    const row = rows[0];
    await connection.execute(`UPDATE lead_website_enrichments SET status = 'processing', attempt_count = attempt_count + 1, started_at = CURRENT_TIMESTAMP, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [row.id]);
    await connection.commit();
    return { ...row, workerId, attempt_count: Number(row.attempt_count) + 1 };
  } catch (error) { await connection.rollback(); throw error; }
}

async function persistEnrichment({ connection = getPool(), job, result }) {
  let report = {}; let reportIsSafe = true;
  try {
    if (typeof job.analysis_report === 'string' && job.analysis_report.trim()) {
      const parsed = JSON.parse(job.analysis_report);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) reportIsSafe = false;
      else report = parsed;
    } else if (job.analysis_report && typeof job.analysis_report === 'object' && !Array.isArray(job.analysis_report)) report = job.analysis_report;
    else if (job.analysis_report != null && job.analysis_report !== '') reportIsSafe = false;
  } catch { reportIsSafe = false; }
  const fields = result.fields;
  const nextReport = { ...report };
  const canPersistLinkedin = reportIsSafe && isBlank(report.linkedin) && !isBlank(fields.linkedin);
  if (canPersistLinkedin) nextReport.linkedin = fields.linkedin;
  const updates = [fields.email && isBlank(job.email) ? 'email = ?' : null, fields.phone && isBlank(job.phone) ? 'phone = ?' : null, fields.address && isBlank(job.address) ? 'address = ?' : null, fields.instagram && isBlank(job.instagram) ? 'instagram = ?' : null, fields.businessName && isBlank(job.business_name) ? 'business_name = ?' : null, canPersistLinkedin ? 'analysis_report = ?' : null].filter(Boolean);
  const params = []; if (fields.email && isBlank(job.email)) params.push(fields.email); if (fields.phone && isBlank(job.phone)) params.push(fields.phone); if (fields.address && isBlank(job.address)) params.push(fields.address); if (fields.instagram && isBlank(job.instagram)) params.push(fields.instagram); if (fields.businessName && isBlank(job.business_name)) params.push(fields.businessName); if (canPersistLinkedin) params.push(JSON.stringify(nextReport));
  if (updates.length) { params.push(job.prospect_id); await connection.execute(`UPDATE prospects SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, params); }
  const status = result.diagnostic.pagesAnalyzed > 0 ? (result.diagnostic.partialError ? 'partial' : 'completed') : 'failed';
  await connection.execute(`UPDATE lead_website_enrichments SET status = ?, completed_at = CURRENT_TIMESTAMP, diagnostic_payload = ?, last_error = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, JSON.stringify(result.diagnostic), job.id]);
  return status;
}

async function processOneEnrichment({ connection, workerId, crawl = crawlWebsite } = {}) {
  const pool = getPool();
  const claimConnection = connection || await pool.getConnection();
  let job;
  try { job = await claimNextEnrichment({ connection: claimConnection, workerId }); }
  finally { if (!connection) claimConnection.release(); }
  if (!job) return false;
  const persistenceConnection = connection || pool;
  try { const result = mergeResults(await crawl(job.website_url)); await persistEnrichment({ connection: persistenceConnection, job, result }); return true; }
  catch (error) { const terminal = ['ENRICHMENT_INVALID_URL', 'ENRICHMENT_URL_BLOCKED', 'ENRICHMENT_SSRF_BLOCKED', 'ENRICHMENT_NON_HTML'].includes(error?.code) || job.attempt_count >= MAX_ATTEMPTS; await persistenceConnection.execute(`UPDATE lead_website_enrichments SET status = ?, available_at = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 5 MINUTE), last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [terminal ? 'failed' : 'pending', safeError(error), job.id]); return true; }
}

async function processWebsiteEnrichmentBatch({ limit = 1, connection, workerId } = {}) { let processed = 0; while (processed < Math.min(Number(limit) || 1, 2) && await processOneEnrichment({ connection, workerId })) processed += 1; return processed; }

module.exports = { MAX_ATTEMPTS, MAX_PAGES, claimNextEnrichment, crawlWebsite, mergeResults, normalizePageUrl, persistEnrichment, processOneEnrichment, processWebsiteEnrichmentBatch, scheduleWebsiteEnrichment, websiteUrl };
