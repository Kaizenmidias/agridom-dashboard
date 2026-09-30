const test = require('node:test');
const assert = require('node:assert/strict');
const { buildInsertValues, createOrFindProspect, isNormalizedPhoneDuplicate } = require('../services/prospect-service');

function fakeDb({ existing = null, insertId = 42, insertError = null } = {}) {
  const calls = [];
  return {
    calls,
    query: async (sql, params) => {
      calls.push({ sql, params });
      if (sql.includes('WHERE normalized_phone')) return { rows: existing ? [existing] : [] };
      if (sql.startsWith('INSERT')) {
        if (insertError) throw insertError;
        return { insertId };
      }
      if (sql.includes('WHERE id = ?')) return { rows: [{ id: insertId, normalized_phone: '5516999999999' }] };
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
}

const input = { ownerUserId: 7, businessName: 'Agência Kaizen', phone: '(16) 99999-9999', email: 'contato@example.com' };

test('cria prospect novo, retorna ID e persiste normalized_phone', async () => {
  const db = fakeDb();
  const result = await createOrFindProspect(input, { query: db.query });
  assert.equal(result.created, true);
  assert.equal(result.prospect.id, 42);
  const insert = db.calls.find((call) => call.sql.startsWith('INSERT'));
  assert.equal(insert.params[9], '16999999999');
});

test('deduplica globalmente sem considerar owner ou pasta', async () => {
  const db = fakeDb({ existing: { id: 99, owner_user_id: 1, normalized_phone: '16999999999' } });
  const result = await createOrFindProspect({ ...input, ownerUserId: 77, folderId: 123 }, { query: db.query });
  assert.deepEqual(result, { prospect: db.calls.length ? result.prospect : null, created: false, duplicate: true });
  assert.equal(result.prospect.id, 99);
  assert.equal(db.calls.filter((call) => call.sql.startsWith('INSERT')).length, 0);
});

test('sem telefone normalizável não cria prospect e retorna motivo explícito', async () => {
  const db = fakeDb();
  const result = await createOrFindProspect({ ...input, phone: '---' }, { query: db.query });
  assert.deepEqual(result, { prospect: null, created: false, duplicate: false, reason: 'missing_normalized_phone' });
  assert.equal(db.calls.length, 0);
});

test('ER_DUP_ENTRY da unique de telefone relê o prospect concorrente', async () => {
  const concurrent = { id: 88, normalized_phone: '16999999999' };
  const db = fakeDb({ insertError: Object.assign(new Error('Duplicate entry for key uq_prospects_normalized_phone'), { code: 'ER_DUP_ENTRY' }) });
  let firstLookup = true;
  const query = async (sql, params) => {
    db.calls.push({ sql, params });
    if (sql.includes('WHERE normalized_phone')) return { rows: firstLookup ? (firstLookup = false, []) : [concurrent] };
    if (sql.startsWith('INSERT')) throw db.query && Object.assign(new Error('Duplicate entry for key uq_prospects_normalized_phone'), { code: 'ER_DUP_ENTRY' });
    throw new Error(`Unexpected SQL: ${sql}`);
  };
  const result = await createOrFindProspect(input, { query });
  assert.equal(result.duplicate, true);
  assert.equal(result.prospect.id, 88);
});

test('ER_DUP_ENTRY não relacionado é propagado', async () => {
  const error = Object.assign(new Error('Duplicate entry for key uq_other'), { code: 'ER_DUP_ENTRY' });
  const db = fakeDb({ insertError: error });
  await assert.rejects(() => createOrFindProspect(input, { query: db.query }), error);
  assert.equal(isNormalizedPhoneDuplicate(error), false);
});

test('campos opcionais ausentes não são inventados e aceita query transacional', async () => {
  const values = buildInsertValues({ ownerUserId: 1, businessName: 'Empresa', phone: '5511999999999' }).values;
  assert.equal(values[10], null);
  assert.equal(values[11], null);
  assert.equal(values[12], null);
  const calls = [];
  const connection = { execute: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('WHERE normalized_phone')) return [[]];
    return [sql.startsWith('INSERT') ? { insertId: 5 } : [{ id: 5 }]];
  } };
  const result = await createOrFindProspect({ ownerUserId: 1, businessName: 'Empresa', phone: '5511999999999' }, { connection });
  assert.equal(result.created, true);
  assert.equal(calls.length, 3);
});

test('serviço não contém chamada Apify', () => {
  const fs = require('node:fs');
  assert.doesNotMatch(fs.readFileSync(require.resolve('../services/prospect-service'), 'utf8'), /apify/i);
});
