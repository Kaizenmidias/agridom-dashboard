const MAX_DEPTH = 8;
const MAX_PROPERTIES = 500;
const MAX_STRING_LENGTH = 4096;
const MAX_ARRAY_LENGTH = 100;
const MAX_BODY_BYTES = 256 * 1024;
const REDACTED = '[redacted]';
const DANGEROUS_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const SENSITIVE_KEYS = new Set(['password', 'passwd', 'authorization', 'cookie', 'set-cookie', 'token', 'access_token', 'refresh_token', 'jwt', 'secret', 'api_key', 'apikey', 'x-api-key', 'x_api_key', 'credentials']);

const normalizedKey = (key) => String(key).trim().toLowerCase().replace(/[\s-]+/g, '_');

function sanitizeWebhookPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('WEBHOOK_PAYLOAD_INVALID');
  let properties = 0;
  const seen = new WeakSet();
  const walk = (current, depth) => {
    if (depth > MAX_DEPTH) throw new Error('WEBHOOK_PAYLOAD_LIMIT');
    if (current === null || typeof current === 'boolean' || typeof current === 'number') return current;
    if (typeof current === 'string') {
      if (current.length > MAX_STRING_LENGTH) throw new Error('WEBHOOK_PAYLOAD_LIMIT');
      return current;
    }
    if (typeof current !== 'object') throw new Error('WEBHOOK_PAYLOAD_INVALID');
    if (seen.has(current)) throw new Error('WEBHOOK_PAYLOAD_INVALID');
    seen.add(current);
    if (Array.isArray(current)) {
      if (current.length > MAX_ARRAY_LENGTH) throw new Error('WEBHOOK_PAYLOAD_LIMIT');
      return current.map((item) => walk(item, depth + 1));
    }
    const result = Object.create(null);
    for (const [key, child] of Object.entries(current)) {
      if (DANGEROUS_KEYS.has(key.toLowerCase())) throw new Error('WEBHOOK_PAYLOAD_INVALID');
      properties += 1;
      if (properties > MAX_PROPERTIES) throw new Error('WEBHOOK_PAYLOAD_LIMIT');
      result[key] = SENSITIVE_KEYS.has(normalizedKey(key)) ? REDACTED : walk(child, depth + 1);
    }
    return result;
  };
  const sanitized = walk(value, 0);
  if (Buffer.byteLength(JSON.stringify(sanitized), 'utf8') > MAX_BODY_BYTES) throw new Error('WEBHOOK_PAYLOAD_LIMIT');
  return sanitized;
}

module.exports = { MAX_ARRAY_LENGTH, MAX_BODY_BYTES, MAX_DEPTH, MAX_PROPERTIES, MAX_STRING_LENGTH, REDACTED, sanitizeWebhookPayload };
