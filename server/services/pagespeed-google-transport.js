const https = require('node:https');

const GOOGLE_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

function validateRequestUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw Object.assign(new Error('PageSpeed endpoint is invalid.'), { code: 'PAGESPEED_TRANSPORT_INVALID_ENDPOINT' }); }
  if (url.protocol !== 'https:' || url.hostname !== 'www.googleapis.com' || (url.port && url.port !== '443') || url.username || url.password || url.pathname !== '/pagespeedonline/v5/runPagespeed') {
    throw Object.assign(new Error('PageSpeed endpoint is not allowed.'), { code: 'PAGESPEED_TRANSPORT_INVALID_ENDPOINT' });
  }
  return url;
}

function safeError(code, message) { return Object.assign(new Error(message), { code }); }

function requestPageSpeed({ url, method = 'GET', timeoutMs = 30000, maxBytes = 1024 * 1024, headers = {}, redirect = 'error', request = https.request } = {}) {
  const endpoint = validateRequestUrl(url);
  if (method !== 'GET') return Promise.reject(safeError('PAGESPEED_TRANSPORT_METHOD_NOT_ALLOWED', 'PageSpeed transport only supports GET.'));
  if (redirect !== 'error') return Promise.reject(safeError('PAGESPEED_TRANSPORT_REDIRECTS_DISABLED', 'PageSpeed redirects are disabled.'));
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(maxBytes) || maxBytes <= 0) return Promise.reject(safeError('PAGESPEED_TRANSPORT_OPTIONS_INVALID', 'PageSpeed transport limits are invalid.'));

  return new Promise((resolve, reject) => {
    let settled = false;
    let total = 0;
    const chunks = [];
    const finishError = (error) => { if (!settled) { settled = true; reject(error); } };
    const req = request({ protocol: endpoint.protocol, hostname: endpoint.hostname, port: endpoint.port || 443, path: `${endpoint.pathname}${endpoint.search}`, method, headers: { accept: 'application/json', ...headers }, timeout: timeoutMs }, (response) => {
      response.on('data', (chunk) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > maxBytes) {
          req.destroy();
          finishError(safeError('PAGESPEED_RESPONSE_TOO_LARGE', 'PageSpeed response exceeded the size limit.'));
          return;
        }
        chunks.push(buffer);
      });
      response.on('end', () => {
        if (settled) return;
        settled = true;
        resolve({ statusCode: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) });
      });
      response.on('error', () => finishError(safeError('PAGESPEED_NETWORK_ERROR', 'PageSpeed response failed.')));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); finishError(safeError('PAGESPEED_TIMEOUT', 'PageSpeed request timed out.')); });
    req.on('error', (error) => finishError(safeError(error?.code === 'ETIMEDOUT' ? 'PAGESPEED_TIMEOUT' : 'PAGESPEED_NETWORK_ERROR', error?.code === 'ETIMEDOUT' ? 'PageSpeed request timed out.' : 'PageSpeed request failed.')));
    req.end();
  });
}

module.exports = { GOOGLE_ENDPOINT, requestPageSpeed, validateRequestUrl };
