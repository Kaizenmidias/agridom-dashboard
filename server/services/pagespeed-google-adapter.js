const { normalizePageSpeedResponse } = require('./pagespeed-performance');

const FIELD_METRICS = {
  lcpMs: 'LARGEST_CONTENTFUL_PAINT_MS',
  inpMs: 'INTERACTION_TO_NEXT_PAINT',
  cls: 'CUMULATIVE_LAYOUT_SHIFT_SCORE',
};

const finiteNonNegative = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

function fieldMetric(metrics, id) {
  const metric = metrics?.[id];
  return finiteNonNegative(metric?.percentile);
}

function adaptField(experience) {
  const metrics = experience?.metrics;
  if (!metrics || typeof metrics !== 'object') return null;
  const field = {
    lcpMs: fieldMetric(metrics, FIELD_METRICS.lcpMs),
    inpMs: fieldMetric(metrics, FIELD_METRICS.inpMs),
    cls: fieldMetric(metrics, FIELD_METRICS.cls),
  };
  return Object.values(field).some((value) => value !== null) ? field : null;
}

function runtimeError(error) {
  const code = String(error?.code || 'LIGHTHOUSE_RUNTIME_ERROR').replace(/[^A-Z0-9_:-]/gi, '').slice(0, 80);
  return Object.assign(new Error('PageSpeed Lighthouse runtime error.'), { code: 'PAGESPEED_LIGHTHOUSE_RUNTIME_ERROR', providerCode: code || 'LIGHTHOUSE_RUNTIME_ERROR' });
}

function adaptGooglePageSpeedResponse(payload, strategy = 'mobile') {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return normalizePageSpeedResponse(payload, strategy);
  const lighthouse = payload.lighthouseResult;
  if (lighthouse?.runtimeError) throw runtimeError(lighthouse.runtimeError);
  const urlField = adaptField(payload.loadingExperience);
  const originField = adaptField(payload.originLoadingExperience);
  const field = urlField || originField;
  return normalizePageSpeedResponse({
    lighthouseResult: lighthouse,
    field: field ? { available: true, source: urlField ? 'url' : 'origin', ...field } : null,
  }, strategy);
}

module.exports = { FIELD_METRICS, adaptGooglePageSpeedResponse };
