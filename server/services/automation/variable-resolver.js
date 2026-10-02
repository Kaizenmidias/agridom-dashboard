const ALLOWED_VARIABLES = Object.freeze(new Set([
  'lead.name', 'lead.first_name', 'lead.company', 'lead.phone', 'lead.email',
  'owner.name', 'owner.email', 'assignee.name', 'assignee.email',
  'pipeline.name', 'pipeline.stage', 'stage.name',
]));
const MAX_WEBHOOK_PATH_DEPTH = 8;
const FORBIDDEN_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function isWebhookPath(path) {
  if (path !== 'webhook.body' && !path.startsWith('webhook.body.')) return false;
  const segments = path.split('.').slice(2);
  return segments.length <= MAX_WEBHOOK_PATH_DEPTH && segments.every((segment) => segment && !/^\d+$/.test(segment) && !FORBIDDEN_SEGMENTS.has(segment));
}

function resolveWebhookPath(path, context) {
  if (!isWebhookPath(path)) throw new Error(`UNKNOWN_VARIABLE:${path}`);
  const segments = path.split('.').slice(2);
  if (!segments.length) return '';
  let current = context.webhook?.body;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object' || Array.isArray(current) || !Object.prototype.hasOwnProperty.call(current, segment)) return '';
    current = current[segment];
  }
  if (current === null || typeof current === 'object') return '';
  return current == null ? '' : String(current);
}

function resolveVariable(path, context) {
  if (path === 'webhook.body' || path.startsWith('webhook.body.')) return resolveWebhookPath(path, context);
  if (!ALLOWED_VARIABLES.has(path)) throw new Error(`UNKNOWN_VARIABLE:${path}`);
  const [namespace, field] = path.split('.');
  const source = context[namespace] || {};
  return source[field] == null ? '' : String(source[field]);
}

function resolveTemplate(value, context) {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, path) => resolveVariable(path, context));
}

function resolveConfig(value, context) {
  if (Array.isArray(value)) return value.map((item) => resolveConfig(item, context));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolveConfig(child, context)]));
  return resolveTemplate(value, context);
}

module.exports = { ALLOWED_VARIABLES, MAX_WEBHOOK_PATH_DEPTH, resolveVariable, resolveTemplate, resolveConfig };
