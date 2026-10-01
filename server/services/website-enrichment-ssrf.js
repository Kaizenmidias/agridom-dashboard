const dns = require('node:dns').promises;
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');

const MAX_REDIRECTS = 3;
const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal', 'metadata.google.internal.']);

function createPinnedLookup(validated) {
  return (_hostname, options, callback) => {
    if (options?.all) callback(null, [{ address: validated.address, family: validated.family }]);
    else callback(null, validated.address, validated.family);
  };
}

function ipv4Blocked(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 169 && parts[1] === 254 || parts[0] === 192 && parts[1] === 168 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31 || parts[0] === 0;
}

function ipv6Blocked(ip) {
  const normalized = ip.toLowerCase();
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb');
}

function isBlockedAddress(ip) {
  const mapped = String(ip).match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return ipv4Blocked(mapped[1]);
  return net.isIPv4(ip) ? ipv4Blocked(ip) : net.isIPv6(ip) ? ipv6Blocked(ip) : true;
}

async function validateUrl(value, { resolve = dns.lookup } = {}) {
  let url;
  try { url = new URL(value); } catch { throw Object.assign(new Error('URL do website invalida.'), { code: 'ENRICHMENT_INVALID_URL' }); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw Object.assign(new Error('URL bloqueada pelo protocolo de seguranca.'), { code: 'ENRICHMENT_URL_BLOCKED' });
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.localhost') || hostname.endsWith('.internal')) throw Object.assign(new Error('Host interno bloqueado.'), { code: 'ENRICHMENT_SSRF_BLOCKED' });
  const answers = net.isIP(hostname) ? [{ address: hostname, family: net.isIPv4(hostname) ? 4 : 6 }] : await resolve(hostname, { all: true, verbatim: true });
  const addresses = Array.isArray(answers) ? answers.map((item) => item.address) : [answers.address];
  if (!addresses.length || addresses.some(isBlockedAddress)) throw Object.assign(new Error('Destino privado bloqueado.'), { code: 'ENRICHMENT_SSRF_BLOCKED' });
  return { url, address: addresses[0], family: net.isIPv4(addresses[0]) ? 4 : 6 };
}

async function fetchHtml(value, options = {}) {
  const resolve = options.resolve || dns.lookup;
  const maxRedirects = options.maxRedirects ?? MAX_REDIRECTS;
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  const timeoutMs = options.timeoutMs ?? 8000;
  let current = String(value);
  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const validated = await validateUrl(current, { resolve });
    const url = validated.url;
    const requestStarted = Date.now();
    const client = url.protocol === 'https:' ? https : http;
    const requestOptions = { method: 'GET', lookup: createPinnedLookup(validated), servername: url.hostname, rejectUnauthorized: true, headers: { host: url.hostname, 'user-agent': 'KaizenCRM-Enricher/1.0', accept: 'text/html,application/xhtml+xml' } };
    const response = options.request ? await Promise.race([options.request({ url, validated, timeoutMs, requestOptions }), new Promise((_resolve, reject) => setTimeout(() => reject(Object.assign(new Error('Tempo limite excedido.'), { code: 'ENRICHMENT_TIMEOUT' })), timeoutMs))]) : await new Promise((resolveResponse, reject) => {
      const request = (options.requestClient || client).request(url, requestOptions, resolveResponse);
      request.setTimeout(timeoutMs, () => { request.destroy(Object.assign(new Error('Tempo limite excedido.'), { code: 'ENRICHMENT_TIMEOUT' })); });
      request.on('error', reject);
      request.end();
    }).catch((error) => { throw Object.assign(new Error(error?.code === 'ENRICHMENT_TIMEOUT' ? 'Tempo limite excedido.' : 'Falha ao acessar website.'), { code: error?.code || 'ENRICHMENT_NETWORK_ERROR' }); });
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (redirects === maxRedirects || !location) throw Object.assign(new Error('Limite de redirects excedido.'), { code: 'ENRICHMENT_REDIRECT_LIMIT' });
      current = new URL(location, url).toString();
      continue;
    }
    if (response.statusCode < 200 || response.statusCode >= 300) throw Object.assign(new Error(`Website respondeu HTTP ${response.statusCode}.`), { code: 'ENRICHMENT_HTTP_ERROR' });
    if (!options.allowNonHtml && !String(response.headers['content-type'] || '').toLowerCase().includes('text/html')) { response.destroy(); throw Object.assign(new Error('Website nao retornou HTML.'), { code: 'ENRICHMENT_NON_HTML' }); }
    const chunks = []; let total = 0;
    for await (const chunk of response) { total += chunk.length; if (total > maxBytes) { response.destroy(); throw Object.assign(new Error('HTML excedeu o limite de tamanho.'), { code: 'ENRICHMENT_SIZE_LIMIT' }); } chunks.push(chunk); }
    return { url: url.toString(), html: Buffer.concat(chunks).toString('utf8'), responseTimeMs: Date.now() - requestStarted, headers: response.headers };
  }
  throw Object.assign(new Error('Limite de redirects excedido.'), { code: 'ENRICHMENT_REDIRECT_LIMIT' });
}

module.exports = { MAX_REDIRECTS, createPinnedLookup, fetchHtml, isBlockedAddress, validateUrl };
