const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { normalizeDiagnostic } = require('../services/website-enrichment-response');

const route = fs.readFileSync(path.join(__dirname, '../routes/prospection.js'), 'utf8');

test('website enrichment response normalizes object, JSON string and invalid JSON safely', () => {
  const diagnostic = { seo: { titlePresent: true }, pagesAnalyzed: 5 };
  assert.deepEqual(normalizeDiagnostic(diagnostic), diagnostic);
  assert.deepEqual(normalizeDiagnostic(JSON.stringify(diagnostic)), diagnostic);
  assert.equal(normalizeDiagnostic('{invalid'), null);
  assert.equal(normalizeDiagnostic('[]'), null);
});

test('website enrichment endpoint enforces ownership and exposes a minimal read-only contract', () => {
  const endpoint = route.slice(route.indexOf("router.get('/prospects/:id/website-enrichment'"), route.indexOf("router.patch('/prospects/:id'"));
  assert.match(endpoint, /p\.id = \? AND p\.owner_user_id = \?/);
  assert.match(endpoint, /res\.status\(404\)\.json/);
  assert.match(endpoint, /prospectId: Number\(row\.prospect_id\)/);
  assert.match(endpoint, /websiteUrl: row\.website_url/);
  assert.doesNotMatch(endpoint, /last_error/);
  assert.doesNotMatch(endpoint, /attempt_count/);
  assert.doesNotMatch(endpoint, /html|dns|ssrf/i);
  assert.doesNotMatch(endpoint, /INSERT INTO|UPDATE prospects|DELETE FROM/);
});

test('bootstrap remains free of website diagnostic payload', () => {
  const bootstrap = route.slice(route.indexOf("router.get('/bootstrap'"), route.indexOf("router.get('/prospects/:id/website-enrichment'"));
  assert.doesNotMatch(bootstrap, /diagnostic_payload/);
  assert.doesNotMatch(bootstrap, /lead_website_enrichments/);
});

test('valid id parsing follows the existing route pattern', () => {
  assert.match(route, /const prospectId = parseId\(req\.params\.id\)/);
  assert.match(route, /if \(!prospectId\) return res\.status\(400\)/);
});
