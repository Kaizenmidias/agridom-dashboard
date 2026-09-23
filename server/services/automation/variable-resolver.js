const ALLOWED_VARIABLES = Object.freeze(new Set([
  'lead.name', 'lead.first_name', 'lead.company', 'lead.phone', 'lead.email',
  'owner.name', 'owner.email', 'assignee.name', 'assignee.email',
  'pipeline.name', 'pipeline.stage', 'stage.name',
]));

function resolveVariable(path, context) {
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

module.exports = { ALLOWED_VARIABLES, resolveVariable, resolveTemplate, resolveConfig };
