const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { normalizeField, normalizeLab, normalizeOpportunities, normalizeScore, publicPageSpeedResponse } = require('../services/pagespeed-response');

const route = fs.readFileSync(path.join(__dirname, '..', 'routes', 'prospection.js'), 'utf8');

test('PageSpeed response normalizes a complete public record', () => {
  const result = publicPageSpeedResponse(123, { prospect_id: 123, website_url: 'https://empresa.test/', strategy: 'mobile', status: 'completed', score: 0, analyzed_at: '2026-10-01T12:00:00.000Z', refresh_after: null, lab_payload: JSON.stringify({ fcpMs: 0, lcpMs: 4100, cls: 0.06, speedIndexMs: 3800, tbtMs: 420, ttfbMs: 800, secret: 'hidden' }), field_payload: { available: true, source: 'origin', lcpMs: 0, inpMs: 180, cls: 0 }, opportunities_payload: [] });
  assert.equal(result.performance.score, 0);
  assert.equal(result.performance.lab.fcpMs, 0);
  assert.equal(result.performance.field.source, 'origin');
  assert.equal(Object.hasOwn(result.performance.lab, 'secret'), false);
});

test('PageSpeed response handles invalid JSON, values and unknown status safely', () => {
  const result = publicPageSpeedResponse(4, { website_url: 'https://empresa.test/', strategy: 'desktop', status: 'mystery', score: '100', lab_payload: '{bad', field_payload: [], opportunities_payload: {} });
  assert.equal(result.performance.status, 'unknown');
  assert.equal(result.performance.score, null);
  assert.equal(result.performance.lab, null);
  assert.equal(result.performance.field, null);
  assert.deepEqual(result.performance.opportunities, []);
  assert.deepEqual(publicPageSpeedResponse(4, null), { prospectId: 4, performance: null });
});

test('PageSpeed normalizers preserve zero and reject unsupported shapes', () => {
  assert.deepEqual(normalizeLab({ fcpMs: 0, lcpMs: -1 }), { fcpMs: 0, lcpMs: null, cls: null, speedIndexMs: null, tbtMs: null, ttfbMs: null });
  assert.deepEqual(normalizeLab('[]'), null);
  assert.deepEqual(normalizeField({ available: false, source: 'invalid', lcpMs: 0 }), { available: false, source: null, lcpMs: 0, inpMs: null, cls: null });
  assert.deepEqual(normalizeField({ available: 'false' }), null);
  assert.equal(normalizeScore(100), 100);
  assert.equal(normalizeScore(101), null);
  assert.deepEqual(normalizeOpportunities(JSON.stringify({ title: 'nope' })), []);
});

test('PageSpeed route is protected, owned, read-only and excludes internal columns', () => {
  const segment = route.slice(route.indexOf("router.get('/prospects/:id/website-performance'"), route.indexOf("router.patch('/prospects/:id'"));
  assert.match(route, /router\.use\(authenticateToken\)/);
  assert.match(route, /router\.use\(requireCommercialAccess\)/);
  assert.match(segment, /p\.id = \? AND p\.owner_user_id = \?/);
  assert.match(segment, /a\.strategy = 'mobile'/);
  assert.doesNotMatch(segment, /last_error|attempt_count|available_at|started_at/);
  assert.doesNotMatch(segment, /INSERT|UPDATE|DELETE|schedulePageSpeed|runGooglePageSpeed/);
});
