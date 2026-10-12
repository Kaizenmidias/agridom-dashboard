const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { AutomationError, retryRun, classifyRetryEligibility } = require('../services/automation-repository');

function fakePool({ run = {}, messages = [], retryRuns = [], failOnInsert = false } = {}) {
  const calls = [];
  const state = { rollback: 0, commit: 0 };
  let insertId = 900;
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { state.commit += 1; },
    rollback: async () => { state.rollback += 1; },
    release: () => {},
    execute: async (sql, params) => {
      calls.push({ sql, params });
      if (/SELECT ar\.\*, a\.owner_user_id/.test(sql)) return [[run]];
      if (/FROM communication_messages/.test(sql)) return [messages];
      if (/FROM automation_runs/.test(sql)) return [retryRuns];
      if (/INSERT INTO automation_runs/.test(sql)) {
        if (failOnInsert) throw Object.assign(new Error('duplicate key'), { code: 'ER_DUP_ENTRY' });
        return [{ insertId: insertId++ }];
      }
      if (/INSERT INTO automation_jobs/.test(sql)) return [{ insertId: insertId++ }];
      return [[]];
    },
  };
  return { calls, state, getConnection: async () => connection };
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

test('retry faz rollback quando a criacao da nova execucao falha', async () => {
  const pool = fakePool({
    failOnInsert: true,
    run: { id: 10, automation_id: 4, automation_version_id: 7, event_id: 2, entity_type: 'lead', entity_id: 81, status: 'failed', error_code: 'WHATSAPP_ACCOUNT_NOT_CONNECTED' },
  });
  await assert.rejects(() => retryRun(1, 10, { pool }), /tentativa equivalente/);
  assert.equal(pool.state.rollback, 1);
  assert.equal(pool.state.commit, 0);
});

test('retry converte conflito de unicidade em erro controlado', async () => {
  const pool = fakePool({
    failOnInsert: true,
    run: { id: 10, automation_id: 4, automation_version_id: 7, event_id: 2, entity_type: 'lead', entity_id: 81, status: 'failed', error_code: 'WHATSAPP_ACCOUNT_NOT_CONNECTED' },
  });
  await assert.rejects(() => retryRun(1, 10, { pool }), (error) => error instanceof AutomationError && error.status === 409);
});

test('retry de manual_retry permite uma nova tentativa apos falha anterior', async () => {
  const pool = fakePool({
    run: { id: 12, automation_id: 4, automation_version_id: 7, event_id: 2, entity_type: 'lead', entity_id: 81, status: 'failed', execution_kind: 'manual_retry', error_code: 'WHATSAPP_ACCOUNT_NOT_CONNECTED' },
    retryRuns: [{ id: 11, status: 'failed' }],
  });
  const result = await retryRun(1, 12, { pool });
  assert.deepEqual(result, { runId: 900, jobId: 901, retryOf: 12, status: 'queued' });
  const runInsert = pool.calls.find((item) => /INSERT INTO automation_runs/.test(item.sql));
  assert.match(runInsert.sql, /execution_kind/);
  assert.equal(runInsert.params.at(-1), 'manual-retry:12:2');
});

test('interface de execucoes exibe lead, telefone e retry somente para failed', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pages', 'commercial', 'AutomationRunsPage.tsx'), 'utf8');
  const api = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'services', 'automations.ts'), 'utf8');
  assert.match(page, /leadLabel\(run\)/);
  assert.match(page, /formatPhone\(run\.lead_phone\)/);
  assert.match(page, /run\.status === "failed"/);
  assert.match(page, /Tentar novamente/);
  assert.doesNotMatch(page, /window\.confirm/);
  assert.match(page, /setRetrying\(run\.id\)/);
  assert.match(api, /retryRun/);
});
