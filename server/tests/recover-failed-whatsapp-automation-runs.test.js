const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'scripts', 'recover-failed-whatsapp-automation-runs.js');
const recovery = require(scriptPath);
const source = fs.readFileSync(scriptPath, 'utf8');

const row = (overrides = {}) => ({ run_id: 50, entity_id: 14, run_status: 'failed', job_status: 'failed', error_code: 'EVOLUTION_UNAVAILABLE', last_error: 'ENGINE_ERROR:EVOLUTION_UNAVAILABLE', current_step_key: 'send', ...overrides });
const safeState = (overrides = {}) => ({ jobs: [], activeJobs: [], runMessages: {}, leadMessages: {}, step: { id: 501, step_key: 'send', step_type: 'action' }, recoveryKey: 'run:50:step:send:recovery:1', generation: 1, ...overrides });

test('recovery requires automation filter, defaults to dry-run and bounds limit', () => {
  assert.deepEqual(recovery.parseArgs(['--automation-id=15']), { automationId: 15, limit: 25, apply: false });
  assert.deepEqual(recovery.parseArgs(['--automation-id=15', '--apply', '--limit=5']), { automationId: 15, limit: 5, apply: true });
  assert.throws(() => recovery.parseArgs([]), /automation-id/);
  assert.throws(() => recovery.parseArgs(['--automation-id=15', '--limit=0']), /entre 1 e 100/);
});

test('EVOLUTION_UNAVAILABLE without evidence is eligible', () => {
  assert.equal(recovery.classify(row(), safeState()).classification, 'eligible');
});

test('ambiguous, unsupported and invalid states fail closed', () => {
  assert.equal(recovery.classify(row({ error_code: 'EVOLUTION_REQUEST_FAILED', last_error: 'ENGINE_ERROR:EVOLUTION_REQUEST_FAILED' }), safeState()).classification, 'ambiguous');
  assert.equal(recovery.classify(row({ error_code: 'HTTP_400', last_error: 'ENGINE_ERROR:HTTP_400' }), safeState()).classification, 'ambiguous');
  assert.equal(recovery.classify(row({ run_status: 'queued' }), safeState()).classification, 'invalid_state');
  assert.equal(recovery.classify(row({ current_step_key: null }), safeState({ step: null })).classification, 'invalid_state');
});

test('sent, delivered, read, provider id and external id block recovery', () => {
  for (const state of [
    safeState({ runMessages: { confirmed: 1 } }),
    safeState({ leadMessages: { confirmed: 1 } }),
    safeState({ runMessages: { identified: 1 } }),
    safeState({ leadMessages: { identified: 1 } }),
  ]) assert.equal(recovery.classify(row(), state).classification, 'already_sent');
});

test('pending or processing job blocks duplicate recovery', () => {
  assert.equal(recovery.classify(row(), safeState({ activeJobs: [{ id: 1, status: 'pending' }] })).classification, 'already_pending');
  assert.equal(recovery.classify(row(), safeState({ activeJobs: [{ id: 2, status: 'processing' }] })).classification, 'already_pending');
  assert.equal(recovery.classify(row(), safeState({ activeJobs: [{ id: 3, status: 'pending' }] })).classification, 'already_pending');
});

test('failed and cancelled recovery history does not block the next deterministic generation', () => {
  const state = safeState({ jobs: [
    { id: 10, status: 'failed', idempotency_key: 'run:50:step:send' },
    { id: 11, status: 'failed', idempotency_key: 'run:50:step:send:recovery:1' },
    { id: 12, status: 'cancelled', idempotency_key: 'run:50:step:send:recovery:2' },
  ], recoveryKey: 'run:50:step:send:recovery:3', generation: 3 });
  assert.equal(recovery.classify(row(), state).classification, 'eligible');
  assert.equal(state.recoveryKey, 'run:50:step:send:recovery:3');
});

test('recovery works by run and ignores duplicate failed history', () => {
  const result = recovery.classify(row({ failed_job_id: 8 }), safeState());
  assert.equal(result.runId, 50);
  assert.equal(result.classification, 'eligible');
});

test('dry-run audits only read queries and changes nothing', async () => {
  const queries = [];
  const connection = {
    execute: async (sql) => {
      queries.push(sql);
      if (sql.includes('SELECT ar.id AS run_id')) return [[row()]];
      if (sql.includes('status IN (\'pending\', \'processing\')')) return [[]];
      if (sql.includes('SELECT id, status, idempotency_key, run_step_id')) return [[]];
      if (sql.includes('FROM communication_messages WHERE automation_run_id')) return [[{}]];
      if (sql.includes("WHERE lead_id = ?")) return [[{}]];
      if (sql.includes('FROM automation_run_steps')) return [[{ id: 501, step_key: 'send', step_type: 'action' }]];
      throw new Error(`unexpected query: ${sql}`);
    },
    release: () => {},
  };
  const result = await recovery.main(['--automation-id=15'], { pool: { getConnection: async () => connection } });
  assert.equal(result.counts.eligible, 1);
  assert.ok(queries.every((query) => /^SELECT/.test(query)));
  assert.equal(queries.some((query) => /^(INSERT|UPDATE|DELETE)\b/i.test(query.trim())), false);
});

test('apply creates one pending engine step and remains idempotent on a second run', async () => {
  let recoveryExists = false;
  let inserted = 0;
  let committed = 0;
  const connection = {
    beginTransaction: async () => {}, rollback: async () => {}, commit: async () => { committed += 1; }, release: () => {},
    execute: async (sql, params = []) => {
      if (sql.includes('SELECT ar.id AS run_id')) return [[row()]];
      if (sql.includes('status IN (\'pending\', \'processing\')')) return [[]];
      if (sql.includes('SELECT id, status, idempotency_key, run_step_id')) return [recoveryExists ? [{ id: 600, status: 'pending', idempotency_key: 'run:50:step:send:recovery:1' }] : []];
      if (sql.includes('FROM communication_messages WHERE automation_run_id')) return [[{}]];
      if (sql.includes("WHERE lead_id = ?")) return [[{}]];
      if (sql.includes('FROM automation_run_steps')) return [[{ id: 501, step_key: 'send', step_type: 'action' }]];
      if (sql.includes('FROM automation_runs ar')) return [[row()]];
      if (sql.startsWith('INSERT INTO automation_jobs')) { recoveryExists = true; inserted += 1; return [{ insertId: 600 }]; }
      if (sql.startsWith('UPDATE ')) return [{ affectedRows: 1 }];
      throw new Error(`unexpected query: ${sql}`);
    },
  };
  const dependencies = { pool: { getConnection: async () => connection } };
  const first = await recovery.main(['--automation-id=15', '--apply'], dependencies);
  const second = await recovery.main(['--automation-id=15', '--apply'], dependencies);
  assert.equal(first.recovered[0].classification, 'recovered');
  assert.equal(second.recovered.length, 0);
  assert.equal(inserted, 1);
  assert.equal(committed, 1);
});

test('recovery is finite, does not execute jobs, providers or unrelated batches', () => {
  assert.doesNotMatch(source, /processJobBatch|completeBootstrapJob|processBroadcastBatch|processProspectingBatch|processWebsiteEnrichmentBatch/);
  assert.doesNotMatch(source, /sendWhatsApp|sendText|processPendingWhatsAppEvents|Apify/);
  assert.doesNotMatch(source, /while\s*\(|setInterval|setTimeout/);
  assert.match(source, /automation_id = \?/);
  assert.match(source, /FOR UPDATE/);
  assert.match(source, /ON DUPLICATE KEY UPDATE/);
});

test('recovery creates a normal pending engine.step without artificial past scheduling', () => {
  assert.match(source, /'engine\.step'/);
  assert.match(source, /UTC_TIMESTAMP\(\), UTC_TIMESTAMP\(\)/);
  assert.doesNotMatch(source, /DATE_SUB|INTERVAL .* PAST/i);
});
