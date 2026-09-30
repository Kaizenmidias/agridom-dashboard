const test = require('node:test');
const assert = require('node:assert/strict');
const { actorInput, budgetReached, candidateBudget, processCandidates, targetReached } = require('../services/prospecting-service');

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
  const payload = actorInput({ searchTerms: 'contabilidade', city: 'Salvador', state: 'BA', quantity: 100 });
  assert.equal(payload.maxCrawledPlacesPerSearch, 200);
  assert.equal(payload.locationQuery, 'Salvador, BA');
  assert.equal('location' in payload, false);
});

test('processa novo, duplicado, inválido e preserva contadores/resultados', async () => {
  const db = connectionMock();
  const items = [candidate('Novo', '5511999990001'), candidate('Duplicado', '5511999990001'), candidate('SemTelefone', null)];
  const result = await processCandidates(db, job, {}, items);
  assert.equal(result.processedCount, 3);
  assert.equal(result.foundCount, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.invalidCount, 1);
  assert.equal(db.prospects.size, 1);
  const resultInserts = db.calls.filter((call) => call.sql.includes('INSERT INTO prospecting_results'));
  assert.equal(resultInserts.length, 3);
  assert.equal(resultInserts[0].params[1], 1);
  assert.equal(resultInserts[1].params[1], 1);
  assert.match(resultInserts[2].sql, /VALUES \(UUID\(\), \?, NULL/);
  assert.match(resultInserts[2].sql, /invalid_no_phone/);
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
