const test = require('node:test');
const assert = require('node:assert/strict');
const { BACKOFF_MS, RECOVERY_BATCH_LIMIT, isKnownPermanentError, isKnownTransientError, recoverAutomationJobs } = require('../services/automation-engine');

test('recovery classifica somente falhas transitórias conhecidas', () => {
  for (const code of ['EVOLUTION_UNAVAILABLE', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED']) assert.equal(isKnownTransientError(`ENGINE_ERROR:${code}`), true);
  for (const code of ['HTTP_400', 'EVOLUTION_AUTH_FAILED', 'INVALID_WAIT', 'WHATSAPP_ACCOUNT_REQUIRED']) assert.equal(isKnownPermanentError(code), true);
});

test('retry usa oito slots de backoff persistido', () => {
  assert.equal(BACKOFF_MS.length, 8);
  assert.equal(BACKOFF_MS.at(-1), 7200000);
  assert.equal(RECOVERY_BATCH_LIMIT, 20);
});

test('dry-run do recovery não altera jobs e informa elegibilidade', async () => {
  const calls = [];
  const connection = { execute: async (sql, params) => { calls.push({ sql, params }); return [[{ id: 9, automation_run_id: 4, attempts: 3, max_attempts: 8, last_error: 'ENGINE_ERROR:EVOLUTION_UNAVAILABLE', status: 'failed', run_status: 'failed', run_step_id: 10 }]]; } };
  const result = await recoverAutomationJobs({ connection, apply: false });
  assert.equal(result.length, 1);
  assert.equal(result[0].eligible, true);
  assert.equal(calls.filter((call) => /UPDATE/.test(call.sql)).length, 0);
});

test('recovery respeita limite e ignora erro desconhecido', async () => {
  let selectedLimit;
  const connection = { execute: async (sql, params) => { if (/SELECT/.test(sql)) { selectedLimit = params[0]; return [[{ id: 1, automation_run_id: 2, attempts: 1, max_attempts: 8, last_error: 'ENGINE_ERROR:UNKNOWN', status: 'failed', run_status: 'failed', run_step_id: null }]]; } return [[]]; } };
  const result = await recoverAutomationJobs({ connection, limit: 100, apply: true });
  assert.equal(selectedLimit, 20);
  assert.equal(result[0].eligible, false);
});
