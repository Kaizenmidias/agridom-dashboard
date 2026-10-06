const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AutomationError, retryRun } = require('../services/automation-repository');

function fakePool({ run = {}, messages = [], retryRuns = [] } = {}) {
  const calls = [];
  let insertId = 900;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (sql, params) => {
      calls.push({ sql, params });
      if (/SELECT ar\.\*, a\.owner_user_id/.test(sql)) return [[run]];
      if (/FROM communication_messages/.test(sql)) return [messages];
      if (/FROM automation_runs/.test(sql)) return [retryRuns];
      if (/INSERT INTO automation_runs/.test(sql)) return [{ insertId: insertId++ }];
      if (/INSERT INTO automation_jobs/.test(sql)) return [{ insertId: insertId++ }];
      return [[]];
    },
  };
  return { calls, getConnection: async () => connection };
}

test('retry cria nova execucao e job usando a configuracao original', async () => {
  const pool = fakePool({ run: { id: 10, automation_id: 4, automation_version_id: 7, event_id: 2, entity_type: 'lead', entity_id: 81, status: 'failed', error_code: 'EVOLUTION_UNAVAILABLE' } });
  const result = await retryRun(1, 10, { pool });
  assert.deepEqual(result, { runId: 900, jobId: 901, retryOf: 10, status: 'queued' });
  const runInsert = pool.calls.find((item) => /INSERT INTO automation_runs/.test(item.sql));
  assert.equal(runInsert.params.slice(0, 5).join(','), '4,7,2,lead,81');
});

test('retry rejeita execucao nao failed, comunicacao ambigua e retry ativo', async () => {
  await assert.rejects(() => retryRun(1, 10, { pool: fakePool({ run: { id: 10, status: 'completed' } }) }), (error) => error instanceof AutomationError && error.status === 409);
  await assert.rejects(() => retryRun(1, 10, { pool: fakePool({ run: { id: 10, status: 'failed' }, messages: [{ id: 1, status: 'sending' }] }) }), (error) => error instanceof AutomationError && error.status === 409);
  await assert.rejects(() => retryRun(1, 10, { pool: fakePool({ run: { id: 10, status: 'failed' }, retryRuns: [{ id: 11, status: 'running' }] }) }), (error) => error instanceof AutomationError && error.status === 409);
});

test('interface de execucoes exibe lead, telefone e retry somente para failed', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pages', 'commercial', 'AutomationRunsPage.tsx'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'services', 'automations.ts'), 'utf8');
  assert.match(page, /leadLabel\(run\)/);
  assert.match(page, /formatPhone\(run\.lead_phone\)/);
  assert.match(page, /run\.status === "failed"/);
  assert.match(page, /Tentar novamente/);
  assert.match(api, /retryRun/);
});
