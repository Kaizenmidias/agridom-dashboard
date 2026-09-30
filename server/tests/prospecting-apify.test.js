const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { actorInput, normalize } = require('../services/prospecting-service');
const { testApifyActor } = require('../services/apify-integration-test');
const { normalizeIntegrationMetadata } = require('../services/integration-metadata');

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

test('PROSPECCAO identifica com seguranca a causa da falha de teste da Apify', async () => {
  const token = 'secret-token-value';
  await assert.rejects(
    testApifyActor({ token, actorId: 'compass~crawler-google-places', fetchImpl: async () => ({ ok: false, status: 404, text: async () => JSON.stringify({ message: 'Actor not found' }) }) }),
    (error) => {
      assert.equal(error.code, 'APIFY_ACTOR_NOT_FOUND');
      assert.equal(error.status, 404);
      assert.equal(error.providerStatus, 404);
      assert.doesNotMatch(error.message, /secret-token-value/);
      assert.doesNotMatch(error.providerMessage, /secret-token-value/);
      return true;
    },
  );
  await assert.rejects(
    testApifyActor({ token, actorId: 'compass~crawler-google-places', fetchImpl: async () => { throw Object.assign(new Error('socket timeout'), { code: 'ETIMEDOUT' }); } }),
    (error) => error.code === 'APIFY_NETWORK_ERROR' && error.status === 502 && !error.message.includes(token),
  );
});

test('PROSPECCAO preserva o Actor no diagnóstico mesmo quando a falha ocorre fora do provider', () => {
  const route = read('server', 'routes', 'prospecting.js');
  assert.match(route, /let actorId = null/);
  assert.match(route, /actorId = String\(metadata\.googleMapsActorId \|\| ''\)\.trim\(\)/);
  assert.match(route, /error\?\.actorId \|\| actorId/);
  assert.match(route, /error\?\.providerMessage \|\| error\?\.message/);
});

test('PROSPECCAO normaliza metadata do MySQL como objeto, JSON, nula e rejeita JSON invalido', () => {
  const metadata = { googleMapsActorId: 'compass/crawler-google-places' };
  assert.deepEqual(normalizeIntegrationMetadata(metadata), metadata);
  assert.deepEqual(normalizeIntegrationMetadata(JSON.stringify(metadata)), metadata);
  assert.deepEqual(normalizeIntegrationMetadata(null), {});
  assert.throws(() => normalizeIntegrationMetadata('{invalid'), { code: 'INTEGRATION_METADATA_INVALID' });
  assert.equal(normalizeIntegrationMetadata(metadata).googleMapsActorId, 'compass/crawler-google-places');
});

test('PROSPECCAO usa a mesma normalizacao no GET, teste e worker', () => {
  const route = read('server', 'routes', 'prospecting.js');
  const service = read('server', 'services', 'prospecting-service.js');
  assert.match(route, /normalizeIntegrationMetadata\(row\.configuration_metadata\)/);
  assert.match(route, /normalizeIntegrationMetadata\(rows\[0\]\.configuration_metadata\)/);
  assert.match(service, /normalizeIntegrationMetadata\(config\.configuration_metadata\)/);
});

test('PROSPECCAO permanece processavel quando outro ciclo do worker falha', () => {
  const worker = read('server', 'worker.js');
  const page = read('src', 'pages', 'commercial', 'ProspectingPage.tsx');
  assert.match(worker, /Automation event cycle failed/);
  assert.match(worker, /Automation job cycle failed/);
  assert.match(worker, /processProspectingBatch/);
  assert.match(page, /attempt < 90/);
  assert.match(page, /excedeu o tempo limite de processamento/);
});
