const test = require('node:test');
const assert = require('node:assert/strict');
const script = require('../scripts/reconcile-automation-cadence-jitter');

function fixture({ messages = 0, changed = false, definitionAccountId = 1 } = {}) {
  const state = { attempts: new Map([[127, 7], [128, 7], [109, 7], [137, 1]]), updates: [] };
  const connection = {
    calls: [],
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    execute: async (query, params = []) => {
      const sql = String(query); connection.calls.push({ sql, params });
      if (sql.includes('FROM communication_messages')) return [[{ total: messages, evidence: messages }]];
      if (sql.includes('FROM automation_jobs') && sql.includes('JOIN automation_runs')) {
        const id = Number(params[0]); const expected = script.ALLOWED_JOBS.get(id);
        if (!expected) return [[]];
        return [[{ job_id: id, automation_run_id: expected.runId, run_step_id: null, job_type: 'engine.bootstrap', job_status: changed ? 'completed' : 'pending', attempts: state.attempts.get(id), max_attempts: 8, execute_at: expected.executeAt, available_at: expected.executeAt, last_error: 'ENGINE_ERROR:EVOLUTION_UNAVAILABLE', run_id: expected.runId, automation_id: 15, entity_id: expected.leadId, run_status: 'queued', current_step_key: 'send', step_id: id + 1000, step_key: 'send', step_status: 'queued', output: JSON.stringify({ cadence: { scheduled_at: expected.scheduledAt } }), definition: JSON.stringify({ steps: [{ id: 'send', config: { accountId: definitionAccountId } }] }) }]];
      }
      if (/UPDATE automation_jobs\s+SET attempts =/.test(sql)) { state.attempts.set(Number(params[0]), 6); state.updates.push(Number(params[0])); return [{ affectedRows: 1 }]; }
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  return { state, pool: { getConnection: async () => connection } };
}

test('cadence jitter reconciliation is explicit, dry-run by default and does not write', async () => {
  assert.deepEqual(script.parseArgs(['--automation-id=15', '--account-id=1', '--job-ids=127,128']), { automationId: 15, accountId: 1, jobIds: [127, 128], apply: false });
  const fixtureData = fixture();
  const result = await script.main(['--automation-id=15', '--account-id=1', '--job-ids=127,128'], fixtureData);
  assert.equal(result.eligible, 2);
  assert.deepEqual(fixtureData.state.updates, []);
});

test('apply restores only eligible incident jobs and leaves queue/cadence untouched', async () => {
  const fixtureData = fixture();
  const result = await script.main(['--automation-id=15', '--account-id=1', '--job-ids=127,128', '--apply'], fixtureData);
  assert.deepEqual(result.reconciled.map((item) => item.classification), ['reconciled', 'reconciled']);
  assert.deepEqual(fixtureData.state.updates, [127, 128]);
  assert.equal(fixtureData.state.attempts.get(127), 6);
  assert.equal(fixtureData.state.attempts.get(128), 6);
  assert.equal(fixtureData.state.attempts.get(109), 7);
  assert.equal(fixtureData.state.attempts.get(137), 1);
  assert.equal(fixtureData.state.updates.some((id) => id === 109 || id === 137), false);
  assert.equal(fixtureData.connection?.providerCalls || 0, 0);
  const second = await script.main(['--automation-id=15', '--account-id=1', '--job-ids=127,128', '--apply'], fixtureData);
  assert.deepEqual(second.reconciled.map((item) => item.classification), ['blocked', 'blocked']);
});

test('reconciliation blocks communication evidence and changed jobs idempotently', async () => {
  const withMessage = fixture({ messages: 1 });
  assert.equal((await script.main(['--automation-id=15', '--account-id=1', '--job-ids=127', '--apply'], withMessage)).reconciled[0].classification, 'blocked');
  assert.deepEqual(withMessage.state.updates, []);
  const changed = fixture({ changed: true });
  assert.equal((await script.main(['--automation-id=15', '--account-id=1', '--job-ids=128', '--apply'], changed)).reconciled[0].classification, 'blocked');
  assert.deepEqual(changed.state.updates, []);
});

test('reconciliation reads the real bootstrap step by current_step_key and still blocks another account', async () => {
  const valid = fixture();
  const validResult = await script.main(['--automation-id=15', '--account-id=1', '--job-ids=127'], valid);
  assert.equal(validResult.decisions[0].classification, 'eligible');
  const mismatch = fixture({ definitionAccountId: 2 });
  const mismatchResult = await script.main(['--automation-id=15', '--account-id=1', '--job-ids=127'], mismatch);
  assert.equal(mismatchResult.decisions[0].classification, 'blocked');
  assert.equal(mismatchResult.decisions[0].reason, 'account_mismatch');
});

test('reconciliation accepts only the two explicit incident jobs', () => {
  assert.throws(() => script.parseArgs(['--automation-id=15', '--account-id=1', '--job-ids=109']), /somente 127,128/);
});
