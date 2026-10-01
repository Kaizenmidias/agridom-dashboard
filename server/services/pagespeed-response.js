const STATUSES = new Set(['pending', 'processing', 'completed', 'partial', 'failed']);
const SOURCES = new Set(['url', 'origin']);
const LAB_FIELDS = ['fcpMs', 'lcpMs', 'cls', 'speedIndexMs', 'tbtMs', 'ttfbMs'];
const FIELD_FIELDS = ['available', 'source', 'lcpMs', 'inpMs', 'cls'];

function parseObject(value) {
  if (value == null) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function finiteNonNegative(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null; }

function normalizeLab(value) {
  const parsed = parseObject(value);
  if (!parsed) return null;
  return Object.fromEntries(LAB_FIELDS.map((field) => [field, finiteNonNegative(parsed[field])]));
}

function normalizeField(value) {
  const parsed = parseObject(value);
  if (!parsed || typeof parsed.available !== 'boolean') return null;
  return {
    available: parsed.available,
    source: typeof parsed.source === 'string' && SOURCES.has(parsed.source) ? parsed.source : null,
    lcpMs: finiteNonNegative(parsed.lcpMs),
    inpMs: finiteNonNegative(parsed.inpMs),
    cls: finiteNonNegative(parsed.cls),
  };
}

function normalizeScore(value) { return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null; }

function normalizeOpportunities(value) {
  const parsed = Array.isArray(value) ? value : (() => { try { return typeof value === 'string' ? JSON.parse(value) : null; } catch { return null; } })();
  return Array.isArray(parsed) ? [] : [];
}

function publicPageSpeedPerformance(row) {
  if (!row) return null;
  return {
    websiteUrl: typeof row.website_url === 'string' && row.website_url.trim() ? row.website_url : null,
    strategy: row.strategy === 'mobile' ? 'mobile' : 'mobile',
    status: STATUSES.has(row.status) ? row.status : 'unknown',
    score: normalizeScore(row.score),
    analyzedAt: row.analyzed_at ?? null,
    refreshAfter: row.refresh_after ?? null,
    lab: normalizeLab(row.lab_payload),
    field: normalizeField(row.field_payload),
    opportunities: normalizeOpportunities(row.opportunities_payload),
  };
}

function publicPageSpeedResponse(prospectId, row) { return { prospectId: Number(prospectId), performance: publicPageSpeedPerformance(row) }; }

module.exports = { normalizeField, normalizeLab, normalizeOpportunities, normalizeScore, publicPageSpeedPerformance, publicPageSpeedResponse };
