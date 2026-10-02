const net = require('node:net');
const { isBlockedAddress, validateUrl } = require('./website-enrichment-ssrf');
const { adaptGooglePageSpeedResponse } = require('./pagespeed-google-adapter');

const GOOGLE_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const PAGE_SPEED_TIMEOUT_MS = 90_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

const errorWith = (code, classification, message, statusCode = null, providerCode = null) => Object.assign(new Error(message), { code, classification, statusCode, providerCode });
const safeProviderCode = (value) => String(value || '').replace(/[^A-Z0-9_.:-]/gi, '').slice(0, 80) || null;

function classifyStatus(statusCode, body) {
  if (statusCode >= 300 && statusCode < 400) return ['PAGESPEED_INVALID_RESPONSE', 'invalid_response'];
  if (statusCode === 400) return ['PAGESPEED_INVALID_REQUEST', 'invalid_url'];
  if (statusCode === 401) return ['PAGESPEED_UNAUTHORIZED', 'configuration'];
  if (statusCode === 403) return ['PAGESPEED_FORBIDDEN', 'configuration'];
  if (statusCode === 404) return ['PAGESPEED_INVALID_RESPONSE', 'invalid_response'];
  if (statusCode === 408) return ['PAGESPEED_TIMEOUT', 'transient'];
  if (statusCode === 429) return ['PAGESPEED_QUOTA', 'quota'];
  if (statusCode >= 500 && statusCode <= 599) return ['PAGESPEED_PROVIDER_ERROR', 'transient'];
  return ['PAGESPEED_HTTP_ERROR', 'invalid_response'];
}

function providerErrorFrom(error) {
  if (error?.code === 'PAGESPEED_LIGHTHOUSE_RUNTIME_ERROR') return errorWith(error.code, 'invalid_response', 'PageSpeed Lighthouse runtime error.', null, safeProviderCode(error.providerCode));
  if (error?.code === 'ENRICHMENT_INVALID_URL' || error?.code === 'ENRICHMENT_URL_BLOCKED' || error?.code === 'ENRICHMENT_SSRF_BLOCKED') return errorWith('PAGESPEED_URL_BLOCKED', 'invalid_url', 'PageSpeed website URL rejected.');
  if (error?.code === 'PAGESPEED_TIMEOUT' || error?.code === 'ETIMEDOUT') return errorWith('PAGESPEED_TIMEOUT', 'transient', 'PageSpeed request timed out.');
  if (error?.code === 'PAGESPEED_RESPONSE_TOO_LARGE') return errorWith(error.code, 'invalid_response', 'PageSpeed response exceeded the size limit.');
  if (error?.code === 'PAGESPEED_INVALID_RESPONSE') return errorWith(error.code, 'invalid_response', 'PageSpeed response was invalid.');
  return errorWith('PAGESPEED_NETWORK_ERROR', 'transient', 'PageSpeed request failed.');
}

async function runGooglePageSpeed({ url, strategy = 'mobile', apiKey, transport, resolve } = {}) {
  if (strategy !== 'mobile') throw errorWith('PAGESPEED_STRATEGY_INVALID', 'invalid_response', 'Only mobile PageSpeed analysis is supported.');
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw errorWith('PAGESPEED_API_KEY_MISSING', 'configuration', 'PageSpeed API key is not configured.');
  if (typeof transport !== 'function') throw errorWith('PAGESPEED_TRANSPORT_REQUIRED', 'configuration', 'PageSpeed transport must be injected.');
  let validated;
  try {
    const candidate = new URL(url);
    const literalHost = candidate.hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(literalHost) && isBlockedAddress(literalHost)) throw Object.assign(new Error('Blocked destination.'), { code: 'ENRICHMENT_SSRF_BLOCKED' });
    validated = await validateUrl(url, { resolve });
  } catch (error) { throw providerErrorFrom(error); }
  const requestUrl = new URL(GOOGLE_ENDPOINT);
  requestUrl.searchParams.set('url', validated.url.toString());
  requestUrl.searchParams.set('strategy', strategy);
  requestUrl.searchParams.set('category', 'performance');
  requestUrl.searchParams.set('key', apiKey.trim());
  let response;
  try {
    response = await transport({ url: requestUrl.toString(), method: 'GET', timeoutMs: PAGE_SPEED_TIMEOUT_MS, maxBytes: MAX_RESPONSE_BYTES, headers: { accept: 'application/json' }, redirect: 'error' });
  } catch (error) { throw providerErrorFrom(error); }
  const statusCode = Number(response?.statusCode ?? response?.status);
  const body = typeof response?.body === 'string' ? response.body : Buffer.isBuffer(response?.body) ? response.body.toString('utf8') : null;
  if (!Number.isInteger(statusCode)) throw errorWith('PAGESPEED_INVALID_RESPONSE', 'invalid_response', 'PageSpeed response status was invalid.');
  if (body != null && Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) throw errorWith('PAGESPEED_RESPONSE_TOO_LARGE', 'invalid_response', 'PageSpeed response exceeded the size limit.');
  if (statusCode < 200 || statusCode >= 300) {
    let providerCode = null;
    try { providerCode = safeProviderCode(JSON.parse(body || '{}')?.error?.status || JSON.parse(body || '{}')?.error?.reason); } catch { /* body is intentionally ignored */ }
    const [code, classification] = classifyStatus(statusCode, body);
    throw errorWith(code, classification, `PageSpeed request returned HTTP ${statusCode}.`, statusCode, providerCode);
  }
  let payload;
  try { payload = JSON.parse(body || ''); } catch { throw errorWith('PAGESPEED_INVALID_RESPONSE', 'invalid_response', 'PageSpeed response was not valid JSON.', statusCode); }
  try {
    const normalized = adaptGooglePageSpeedResponse(payload, strategy);
    if (!normalized || normalized.status === 'failed') throw errorWith('PAGESPEED_INVALID_RESPONSE', 'invalid_response', 'PageSpeed response contained no usable result.', statusCode);
    return { strategy: normalized.strategy, score: normalized.score, lab: normalized.lab, field: normalized.field, opportunities: normalized.opportunities };
  } catch (error) {
    if (error?.classification) throw error;
    throw providerErrorFrom(error);
  }
}

module.exports = { GOOGLE_ENDPOINT, MAX_RESPONSE_BYTES, PAGE_SPEED_TIMEOUT_MS, runGooglePageSpeed };
