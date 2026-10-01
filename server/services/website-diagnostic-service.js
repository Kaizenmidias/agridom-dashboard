const { crawlWebsite, mergeResults, websiteUrl } = require('./website-enrichment-service');
const { validateUrl, fetchHtml } = require('./website-enrichment-ssrf');
const { buildDiagnosticResult } = require('./website-diagnostic-rules');

const DIAGNOSTIC_TIMEOUT_MS = 22000;
const normalizeUrl = (value) => { const url = new URL(websiteUrl(value)); url.hash = ''; return url.toString(); };
async function inspectAuxiliary(normalizedUrl, timeoutMs = 2000) {
  const base = new URL(normalizedUrl);
  const inspect = async (path) => { try { const result = await fetchHtml(new URL(path, base).toString(), { allowNonHtml: true, maxBytes: 64 * 1024, timeoutMs }); return { status: 'detected', evidence: result.html.slice(0, 500) }; } catch (error) { return ['ENRICHMENT_HTTP_ERROR', 'ENRICHMENT_NON_HTML'].includes(error?.code) ? { status: 'not_detected' } : { status: 'unavailable' }; } };
  const [robots, sitemap] = await Promise.all([inspect('/robots.txt'), inspect('/sitemap.xml')]);
  return { robots: { status: robots.status, sitemapReference: robots.evidence ? /sitemap:/i.test(robots.evidence) : false }, sitemap: { status: sitemap.status } };
}
async function analyzeDiagnostic({ url, crawl = crawlWebsite, fetchAuxiliary = inspectAuxiliary, validate = validateUrl, timeoutMs = DIAGNOSTIC_TIMEOUT_MS } = {}) {
  const normalizedUrl = normalizeUrl(url); const startedAt = Date.now();
  const timeout = new Promise((_resolve, reject) => setTimeout(() => reject(Object.assign(new Error('A análise excedeu o tempo limite.'), { code: 'DIAGNOSTIC_TIMEOUT' })), timeoutMs));
  const work = (async () => { await validate(normalizedUrl); const merged = mergeResults(await crawl(normalizedUrl, { maxPages: 5, timeoutMs: 5000, totalTimeoutMs: 16000 })); if (!merged.diagnostic?.pagesAnalyzed) throw Object.assign(new Error('Nenhum conteúdo analisável foi encontrado.'), { code: 'DIAGNOSTIC_NO_RESULT' }); merged.diagnostic.infrastructure = await fetchAuxiliary(normalizedUrl, Math.max(1000, DIAGNOSTIC_TIMEOUT_MS - (Date.now() - startedAt))); return buildDiagnosticResult(merged, { domain: new URL(normalizedUrl).hostname }); })();
  return Promise.race([work, timeout]);
}
module.exports = { DIAGNOSTIC_TIMEOUT_MS, analyzeDiagnostic, normalizeUrl };
