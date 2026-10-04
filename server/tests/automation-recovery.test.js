const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BACKOFF_MS, RECOVERY_BATCH_LIMIT, isKnownPermanentError, isKnownTransientError, recoverAutomationJobs } = require('../services/automation-engine');

test('recovery classifica falhas transitorias e permanentes conhecidas', () => {
  for (const code of ['EVOLUTION_UNAVAILABLE', 'EVOLUTION_TIMEOUT', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED']) assert.equal(isKnownTransientError(`ENGINE_ERROR:${code}`), true);
  for (const code of ['HTTP_400', 'HTTP_401', 'HTTP_403', 'EVOLUTION_AUTH_FAILED', 'INVALID_WAIT', 'WHATSAPP_ACCOUNT_REQUIRED']) assert.equal(isKnownPermanentError(code), true);
  assert.equal(isKnownPermanentError('ER_NO_SUCH_TABLE'), false);
});

test('retry usa oito slots de backoff persistido', () => {
  assert.deepEqual(BACKOFF_MS, [5000, 30000, 120000, 300000, 900000, 1800000, 3600000, 7200000]);
  assert.equal(RECOVERY_BATCH_LIMIT, 20);
});

test('dry-run do recovery nao altera jobs e informa elegibilidade', async () => {
  const calls = [];
  const connection = { execute: async (sql, params) => { calls.push({ sql, params }); return [/SELECT aj\.id/.test(sql) ? [{ id: 9, automation_run_id: 4, attempts: 3, max_attempts: 8, last_error: 'ENGINE_ERROR:EVOLUTION_UNAVAILABLE', status: 'failed', run_status: 'failed', run_step_id: 10, error_code: 'EVOLUTION_UNAVAILABLE', error_message: 'ENGINE_ERROR:EVOLUTION_UNAVAILABLE' }] : []]; } };
  const result = await recoverAutomationJobs({ connection, apply: false });
  assert.equal(result.length, 1);
  assert.equal(result[0].eligible, true);
  assert.equal(calls.filter((call) => /^\s*(UPDATE|INSERT)/i.test(call.sql)).length, 0);
});

test('recovery respeita limite e ignora erro desconhecido', async () => {
  let selectedLimit;
  const connection = { execute: async (sql, params) => { if (/SELECT aj\.id/.test(sql)) { selectedLimit = params[0]; return [[{ id: 1, automation_run_id: 2, attempts: 1, max_attempts: 8, last_error: 'ENGINE_ERROR:UNKNOWN', status: 'failed', run_status: 'failed', run_step_id: null, error_code: 'UNKNOWN', error_message: 'ENGINE_ERROR:UNKNOWN' }]]; } return [[]]; } };
  const result = await recoverAutomationJobs({ connection, limit: 100, apply: true });
  assert.equal(selectedLimit, 20);
  assert.equal(result[0].eligible, false);
});

const missingStepRow = (overrides = {}) => ({
  automation_run_id: 65, automation_id: 15, entity_type: 'lead', entity_id: '29', current_step_key: 'action_1',
  error_code: 'EVOLUTION_UNAVAILABLE', error_message: 'ENGINE_ERROR:EVOLUTION_UNAVAILABLE',
  definition: JSON.stringify({ steps: [{ id: 'action_1', type: 'action', config: { actionType: 'whatsapp.send' } }] }),
  run_step_id: 501, step_key: 'action_1', step_type: 'action', step_status: 'queued', output: null, ...overrides,
});

function missingJobConnection({ candidates = [missingStepRow()], messages = [], applyCalls = [] } = {}) {
  return {
    calls: applyCalls,
    execute: async (sql, params) => {
      if (/SELECT aj\.id/.test(sql)) return [[]];
      if (/FROM automation_runs ar/.test(sql)) return [candidates.slice(0, params[0])];
      if (/FROM communication_messages/.test(sql)) return [messages];
      applyCalls.push({ sql, params });
      return [{ insertId: 1 }];
    },
  };
}

test('missing_step_job detecta run transitorio com step queued sem job', async () => {
  const [decision] = await recoverAutomationJobs({ connection: missingJobConnection(), apply: false });
  assert.equal(decision.recoveryType, 'missing_step_job');
  assert.equal(decision.eligible, true);
  assert.equal(decision.idempotencyKey, 'run:65:step:action_1');
});

test('missing_step_job nao recupera step inexistente ou invalido', async () => {
  const [decision] = await recoverAutomationJobs({ connection: missingJobConnection({ candidates: [missingStepRow({ definition: JSON.stringify({ steps: [] }) })] }), apply: false });
  assert.equal(decision.eligible, false);
  assert.equal(decision.reason, 'unknown_or_invalid_step');
});

test('missing_step_job nao recria quando a mensagem foi enviada ou esta ambigua', async () => {
  const sent = missingJobConnection({ messages: [{ id: 1, status: 'sent' }] });
  assert.equal((await recoverAutomationJobs({ connection: sent, apply: false }))[0].reason, 'communication_already_sent');
  const ambiguous = missingJobConnection({ messages: [{ id: 1, status: 'sending' }] });
  assert.equal((await recoverAutomationJobs({ connection: ambiguous, apply: false }))[0].reason, 'communication_state_ambiguous');
});

test('apply de missing_step_job cria um unico job idempotente e reabre run/step', async () => {
  const connection = missingJobConnection();
  const result = await recoverAutomationJobs({ connection, apply: true });
  assert.equal(result[0].eligible, true);
  const inserts = connection.calls.filter((call) => /INSERT INTO automation_jobs/.test(call.sql));
  assert.equal(inserts.length, 1);
  assert.match(inserts[0].sql, /ON DUPLICATE KEY UPDATE/);
  assert.equal(inserts[0].params.at(-1), 'run:65:step:action_1');
});

test('dry-run nao executa escrita e respeita o limite do batch', async () => {
  const calls = [];
  const candidates = Array.from({ length: 25 }, (_, index) => missingStepRow({ automation_run_id: index + 1, run_step_id: index + 100 }));
  const result = await recoverAutomationJobs({ connection: missingJobConnection({ candidates, applyCalls: calls }), limit: 20, apply: false });
  assert.equal(result.length, 20);
  assert.equal(calls.length, 0);
});

test('script administrativo carrega env por NODE_ENV e nao imprime segredo', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'reconcile-automation-retries.js'), 'utf8');
  assert.match(source, /NODE_ENV === 'production'/);
  assert.match(source, /\.env\.production/);
  assert.match(source, /mode: options\.apply \? 'apply' : 'dry-run'/);
  assert.doesNotMatch(source, /password|apiKey|Authorization/i);
});
