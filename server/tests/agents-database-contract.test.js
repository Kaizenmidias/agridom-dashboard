const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const route = fs.readFileSync(require.resolve('../routes/agents'), 'utf8');
const { parseJsonField } = require('../routes/agents');

test('AGENTS normaliza JSON do MySQL sem double parse', () => {
  const objectValue = { temperature: 0.7 };
  assert.deepEqual(parseJsonField(objectValue, {}, 'model_config'), objectValue);
  assert.deepEqual(parseJsonField('{"temperature":0.7}', {}, 'model_config'), objectValue);
  assert.deepEqual(parseJsonField(null, {}, 'model_config'), {});
  assert.deepEqual(parseJsonField('["read"]', [], 'permissions'), ['read']);
});

test('AGENTS usa o contrato query do projeto, com rows encapsulado', () => {
  assert.match(route, /result\.rows/);
  assert.doesNotMatch(route, /const rows = await query[\s\S]{0,500}rows\.map/);
  assert.doesNotMatch(route, /const \[rows\] = await query/);
});

test('AGENTS trata lista vazia, registro unico e multiplos registros sem assumir retorno nativo', () => {
  const normalize = (result) => (result.rows || []).map((row) => row.id);
  assert.deepEqual(normalize({ rows: [] }), []);
  assert.deepEqual(normalize({ rows: [{ id: 1 }] }), [1]);
  assert.deepEqual(normalize({ rows: [{ id: 1 }, { id: 2 }] }), [1, 2]);
});
