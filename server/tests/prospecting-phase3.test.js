const test = require('node:test');
const assert = require('node:assert/strict');
const { actorInput, apifySearch, budgetReached, candidateBudget, processCandidates, targetReached } = require('../services/prospecting-service');
const { encryptSecret } = require('../services/integration-crypto');

function connectionMock({ failOn = null } = {}) {
  const calls = [];
  const prospects = new Map();
  let nextId = 1;
  let transactions = 0;
  return {
    calls,
    prospects,
    get transactions() { return transactions; },
    async beginTransaction() { transactions += 1; },
    async commit() {},
    async rollback() {},
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (failOn && sql.includes(failOn)) throw new Error('unexpected persistence failure');
      if (sql.includes('SELECT * FROM prospects WHERE normalized_phone')) {
        const row = prospects.get(params[0]);
        return [row ? [row] : []];
      }
      if (sql.startsWith('INSERT INTO prospects')) {
        const row = { id: nextId++, normalized_phone: params[9], business_name: params[2] };
        prospects.set(params[9], row);
        return [{ insertId: row.id }];
      }
      if (sql.includes('SELECT * FROM prospects WHERE id')) return [[{ id: params[0] }]];
      return [{ affectedRows: 1 }];
    },
  };
}

const job = { id: 'job-1', created_by: 9, requested_quantity: 2 };
const candidate = (title, phone) => ({ title, categoryName: 'Servicos', phoneNumber: phone, totalScore: 4.8, reviewsCount: 10, url: `https://maps.example/${title}`, website: `https://${title}.example` });

test('candidateBudget dobra a meta e o payload Compass usa locationQuery', () => {
  assert.equal(candidateBudget(50), 100);
  const payload = actorInput({ searchTerms: 'contabilidade', locationQuery: 'Salvador, BA', quantity: 100 });
  assert.equal(payload.maxCrawledPlacesPerSearch, 200);
  assert.equal(payload.locationQuery, 'Salvador, BA, Brasil');
  assert.equal('location' in payload, false);
});

test('apifySearch devolve todos os itens do fetch mockado sem truncamento', async () => {
  const items = Array.from({ length: 100 }, (_, index) => ({ title: `Lead ${index}` }));
  let requestedUrl = '';
  let requestedBody = null;
  process.env.INTEGRATION_ENCRYPTION_KEY = 'offline-test-key';
  const secret = encryptSecret({ token: 'offline-test-token' });
  const result = await apifySearch(
    { searchTerms: 'contabilidade', locationQuery: 'São Paulo, SP', quantity: 50 },
    { configuration_metadata: { googleMapsActorId: 'compass/crawler-google-places' }, secret_ciphertext: secret.ciphertext, secret_iv: secret.iv, secret_auth_tag: secret.authTag },
    async (url, options) => {
      requestedUrl = url;
      requestedBody = JSON.parse(options.body);
      return { ok: true, async json() { return items; } };
    },
  );
  assert.equal(result.length, 100);
  assert.match(requestedUrl, /run-sync-get-dataset-items\?token=/);
  assert.doesNotMatch(requestedUrl, /limit=/);
  assert.deepEqual(requestedBody, { searchStringsArray: ['contabilidade'], locationQuery: 'São Paulo, SP, Brasil', maxCrawledPlacesPerSearch: 100, language: 'pt-BR' });
});

test('processa novo, duplicado, inválido e preserva contadores/resultados', async () => {
  const db = connectionMock();
  const items = [candidate('Novo', '5511999990001'), candidate('Duplicado', '5511999990001'), candidate('SemTelefone', null)];
  const result = await processCandidates(db, job, {}, items);
  assert.equal(result.processedCount, 3);
  assert.equal(result.foundCount, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.invalidCount, 1);
  assert.equal(result.providerItemCount, 3);
  assert.equal(result.ratingFilteredCount, 3);
  assert.equal(result.candidateCount, 3);
  assert.equal(db.prospects.size, 1);
  const resultInserts = db.calls.filter((call) => call.sql.includes('INSERT INTO prospecting_results'));
  assert.equal(resultInserts.length, 3);
  assert.equal(resultInserts[0].params[1], 1);
  assert.equal(resultInserts[1].params[1], 1);
  assert.match(resultInserts[2].sql, /VALUES \(UUID\(\), \?, NULL/);
  assert.match(resultInserts[2].sql, /invalid_no_phone/);
});

test('telemetria separa provider, filtro de rating e candidate budget', async () => {
  const makeItems = (count, score = 5) => Array.from({ length: count }, (_, index) => candidate(`Lead${index}`, `551199999${String(index).padStart(4, '0')}`)).map((item) => ({ ...item, totalScore: score }));
  const all = await processCandidates(connectionMock(), { ...job, requested_quantity: 50 }, {}, makeItems(100));
  assert.deepEqual({ provider: all.providerItemCount, filtered: all.ratingFilteredCount, candidates: all.candidateCount }, { provider: 100, filtered: 100, candidates: 100 });

  const filtered = await processCandidates(connectionMock(), { ...job, requested_quantity: 50 }, { minimumRating: 4 }, [...makeItems(20, 5), ...makeItems(80, 3)]);
  assert.deepEqual({ provider: filtered.providerItemCount, filtered: filtered.ratingFilteredCount, candidates: filtered.candidateCount, processed: filtered.processedCount }, { provider: 100, filtered: 20, candidates: 20, processed: 20 });

  const short = await processCandidates(connectionMock(), { ...job, requested_quantity: 50 }, {}, makeItems(20));
  assert.deepEqual({ provider: short.providerItemCount, filtered: short.ratingFilteredCount, candidates: short.candidateCount }, { provider: 20, filtered: 20, candidates: 20 });

  const capped = await processCandidates(connectionMock(), { ...job, requested_quantity: 50 }, {}, makeItems(150));
  assert.equal(capped.providerItemCount, 150);
  assert.equal(capped.candidateCount, 100);
});

test('para ao atingir a meta de novos e não faz nova coleta', async () => {
  const db = connectionMock();
  const result = await processCandidates(db, job, {}, [candidate('A', '5511999990001'), candidate('B', '5511999990002'), candidate('C', '5511999990003')]);
  assert.equal(result.foundCount, 2);
  assert.equal(result.processedCount, 2);
  assert.equal(result.targetReached, true);
});

test('não ultrapassa o candidateBudget e dataset menor termina normalmente', async () => {
  const db = connectionMock();
  const result = await processCandidates(db, { ...job, requested_quantity: 2 }, {}, Array.from({ length: 10 }, (_, index) => candidate(`Lead${index}`, null)));
  assert.equal(result.processedCount, 4);
  assert.equal(result.budgetReached, true);
  const smaller = await processCandidates(connectionMock(), { ...job, requested_quantity: 10 }, {}, [candidate('Only', '5511888888888')]);
  assert.equal(smaller.processedCount, 1);
  assert.equal(smaller.budgetReached, false);
});

test('controles derivados distinguem meta, budget e dataset curto', () => {
  assert.equal(targetReached(50, 50), true);
  assert.equal(targetReached(37, 50), false);
  assert.equal(budgetReached(100, 37, 50), true);
  assert.equal(budgetReached(42, 30, 50), false);
});

test('erro inesperado faz rollback da transação do candidato', async () => {
  const db = connectionMock({ failOn: 'INSERT INTO prospecting_results' });
  await assert.rejects(() => processCandidates(db, job, {}, [candidate('Falha', '5511999990001')]), /unexpected persistence failure/);
  assert.equal(db.transactions, 1);
});

test('o fluxo mantém uma chamada de provider por job e não chama Evolution', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(require.resolve('../services/prospecting-service'), 'utf8');
  assert.equal((source.match(/const items = await apifySearch\(/g) || []).length, 1);
  assert.doesNotMatch(source, /Evolution|sendWhatsApp/i);
});
