const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { actorInput, candidateBudget, MAX_CANDIDATE_BUDGET, MAX_PROSPECTING_REQUESTED_QUANTITY, validateRequestedQuantity } = require('../services/prospecting-service');

const route = fs.readFileSync(path.join(__dirname, '..', 'routes', 'prospecting.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pages', 'commercial', 'ProspectingPage.tsx'), 'utf8');

test('limite centralizado aceita 100 e produz budget 200', () => {
  assert.equal(MAX_PROSPECTING_REQUESTED_QUANTITY, 100);
  assert.equal(MAX_CANDIDATE_BUDGET, 200);
  assert.equal(validateRequestedQuantity(100), 100);
  assert.equal(candidateBudget(100), 200);
});

test('budgets aprovados permanecem 50 -> 100 e 75 -> 150', () => {
  assert.equal(candidateBudget(50), 100);
  assert.equal(candidateBudget(75), 150);
  assert.equal(actorInput({ searchTerms: 'x', quantity: 100 }).maxCrawledPlacesPerSearch, 200);
});

test('valores acima do teto e valores inválidos são rejeitados', () => {
  for (const value of [101, 500, 0, -1, NaN, Infinity, 10.5, '50', null, undefined]) {
    assert.throws(() => validateRequestedQuantity(value), { code: 'PROSPECTING_QUANTITY_INVALID' });
  }
});

test('rota valida antes do INSERT e informa o limite', () => {
  const jobs = route.slice(route.indexOf("router.post('/jobs'"));
  assert.match(jobs, /validateRequestedQuantity\(quantity\)/);
  assert.ok(jobs.indexOf('validateRequestedQuantity(quantity)') < jobs.indexOf('INSERT INTO prospecting_jobs'));
  assert.match(jobs, /quantidade maxima por busca/);
});

test('defesa do service ocorre antes da chamada Apify e o frontend mostra máximo 100', () => {
  const service = fs.readFileSync(path.join(__dirname, '..', 'services', 'prospecting-service.js'), 'utf8');
  assert.ok(service.indexOf('validateRequestedQuantity(job.requested_quantity)') < service.indexOf('apifySearch({'));
  assert.match(page, /MAX_PROSPECTING_REQUESTED_QUANTITY = 100/);
  assert.match(page, /Máximo: \{MAX_PROSPECTING_REQUESTED_QUANTITY\}/);
});

test('reprocessamento histórico não depende da validação de nova coleta', () => {
  const script = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'reprocess-prospecting-results.js'), 'utf8');
  assert.doesNotMatch(script, /validateRequestedQuantity/);
  assert.doesNotMatch(script, /apifySearch|fetch\(/i);
});
