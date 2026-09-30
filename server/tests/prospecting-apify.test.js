const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { actorInput, normalize } = require('../services/prospecting-service');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');

test('PROSPECCAO Apify monta o contrato real do Actor e limita a quantidade', () => {
  assert.deepEqual(actorInput({ searchTerms: 'Contabilidade em Salvador', quantity: 50 }), { searchTerms: ['Contabilidade em Salvador'], maxItems: 50 });
  assert.equal(actorInput({ searchTerms: 'x', quantity: 999 }).maxItems, 150);
});

test('PROSPECCAO normaliza dados reais do Google Maps sem inventar enriquecimento', () => {
  const result = normalize({ title: 'Empresa X', categoryName: 'Contabilidade', phoneNumber: '(71) 99999-9999', website: 'https://www.Example.com/site', address: 'Rua A', totalScore: 4.8, reviewsCount: 12 });
  assert.equal(result.company_name, 'Empresa X');
  assert.equal(result.normalized_phone, '5571999999999');
  assert.equal(result.normalized_website_domain, 'example.com');
  assert.equal(result.rating, 4.8);
  assert.equal(result.review_count, 12);
  assert.equal(result.email, undefined);
  assert.equal(result.whatsapp_status, undefined);
});

test('PROSPECCAO usa integracao criptografada e worker persistente para jobs Apify', () => {
  const route = read('server', 'routes', 'prospecting.js');
  const worker = read('server', 'worker.js');
  const service = read('server', 'services', 'prospecting-service.js');
  assert.match(route, /encryptSecret\(\{ token \}\)/);
  assert.match(route, /decryptSecret\(rows\[0\]\)/);
  assert.match(route, /secret_ciphertext/);
  assert.match(service, /run-sync-get-dataset-items/);
  assert.match(service, /prospecting_results/);
  assert.match(service, /duplicate_status/);
  assert.match(worker, /processProspectingBatch/);
});

test('PROSPECCAO preserva o contrato do modal: token em metadata, mascara no nivel publico e save antes do teste', () => {
  const route = read('server', 'routes', 'prospecting.js');
  const page = read('src', 'components', 'integrations', 'IntegrationLibrary.tsx');
  assert.match(route, /const token = String\(metadata\.token \|\| ''\)/);
  assert.match(route, /tokenMasked: row\.secret_ciphertext/);
  assert.match(route, /tokenConfigured: Boolean\(row\.secret_ciphertext\)/);
  assert.match(page, /await prospectingAPI\.saveIntegrationMetadata/);
  assert.match(page, /await prospectingAPI\.testIntegration\(updated\.provider\)/);
  assert.ok(page.indexOf('await prospectingAPI.saveIntegrationMetadata') < page.indexOf('await prospectingAPI.testIntegration(updated.provider)'));
});
