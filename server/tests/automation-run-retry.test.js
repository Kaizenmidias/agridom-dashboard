const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AutomationError, retryRun, classifyRetryEligibility } = require('../services/automation-repository');

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
  const pool = fakePool({ run: { id: 10, automation_id: 4, automation_version_id: 7, event_id: 2, entity_type: 'lead', entity_id: 81, status: 'failed', error_code: 'WHATSAPP_ACCOUNT_NOT_CONNECTED' } });
  const result = await retryRun(1, 10, { pool });
  assert.deepEqual(result, { runId: 900, jobId: 901, retryOf: 10, status: 'queued' });
  const runInsert = pool.calls.find((item) => /INSERT INTO automation_runs/.test(item.sql));
  assert.equal(runInsert.params.slice(0, 5).join(','), '4,7,2,lead,81');
});

test('classifica somente falhas comprovadamente anteriores ao provider como seguras', () => {
  assert.equal(classifyRetryEligibility({
    status: 'failed', automation_id: 4, automation_version_id: 7, entity_type: 'lead', entity_id: 81,
    error_code: 'WHATSAPP_ACCOUNT_NOT_CONNECTED',
  }).classification, 'safe_pre_provider');
  assert.equal(classifyRetryEligibility({
    status: 'failed', automation_id: 4, automation_version_id: 7, entity_type: 'lead', entity_id: 81,
    error_code: 'WHATSAPP_ACCOUNT_NOT_CONNECTED', job_status: 'failed', step_status: 'queued', job_attempts: 1,
  }).classification, 'safe_with_persisted_evidence');
});

test('mantem bloqueadas falhas ambiguas, antigas sem diagnostico e contexto invalido', () => {
  const base = { status: 'failed', automation_id: 4, automation_version_id: 7, entity_type: 'lead', entity_id: 81 };
  assert.equal(classifyRetryEligibility({ ...base, error_code: 'EVOLUTION_REQUEST_FAILED' }).classification, 'ambiguous_provider');
  assert.equal(classifyRetryEligibility({ ...base }).classification, 'insufficient_evidence');
  assert.equal(classifyRetryEligibility({ ...base, automation_version_id: null, error_code: 'WHATSAPP_ACCOUNT_NOT_CONNECTED' }).classification, 'invalid_context');
  assert.equal(classifyRetryEligibility({ ...base, status: 'completed' }).classification, 'already_completed');
  assert.equal(classifyRetryEligibility({ ...base, error_code: 'WHATSAPP_ACCOUNT_NOT_CONNECTED', communication_count: 1 }).classification, 'ambiguous_provider');
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
  assert.match(page, /Ações externas.*poderão ser realizadas/);
  assert.match(api, /retryRun/);
});
