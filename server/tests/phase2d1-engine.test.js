const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BACKOFF_MS, createRunAndJob, matchAutomationsForEvent } = require('../services/automation-engine');

const migration = fs.readFileSync(path.join(__dirname, '../../database/migrations/20260923_phase_2d1_engine_worker.sql'), 'utf8');
const worker = fs.readFileSync(path.join(__dirname, '../worker.js'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, '../services/automation-engine.js'), 'utf8');

test('2D.1 migration adds persistent event state and run idempotency without destructive SQL', () => {
  assert.match(migration, /engine_status ENUM\('pending', 'processing', 'processed', 'failed'\)/);
  assert.match(migration, /engine_locked_at/);
  assert.match(migration, /engine_processed_at/);
  assert.match(migration, /uq_automation_run_event_automation_version/);
  assert.match(migration, /idx_automation_events_engine_pending/);
  assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM|DROP\s+COLUMN|ALTER\s+DATABASE/i);
});

test('matcher uses only active automation and its exact active version trigger', async () => {
  let sql = '';
  const connection = { execute: async (query) => { sql = query; return [[{ automation_id: 4, automation_version_id: 12, definition: '{"schemaVersion":1,"trigger":{"type":"lead.created"},"steps":[]}' }]]; } };
  const matches = await matchAutomationsForEvent(connection, { event_type: 'lead.created' });
  assert.equal(matches[0].automation_id, 4);
  assert.equal(matches[0].automation_version_id, 12);
  assert.match(sql, /a\.status = 'active'/);
  assert.match(sql, /a\.active_version_id/);
  assert.match(sql, /JSON_UNQUOTE\(JSON_EXTRACT\(av\.definition, '\$\.trigger\.type'\)\)/);
});

test('run and bootstrap job creation is idempotent at the database boundary', async () => {
  const calls = [];
  const connection = { execute: async (sql, params) => { calls.push({ sql, params }); return [{ insertId: calls.length === 1 ? 21 : 31 }]; } };
  const result = await createRunAndJob(connection, { id: 8, entity_type: 'lead', entity_id: '42', correlation_id: '123e4567-e89b-12d3-a456-426614174000' }, { automation_id: 4, automation_version_id: 12 });
  assert.deepEqual(result, { runId: 21, jobId: 31, runKey: 'event:8:automation:4:version:12', jobKey: 'run:21:bootstrap' });
  assert.match(calls[0].sql, /ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID\(id\)/);
  assert.match(calls[1].sql, /engine\.bootstrap/);
});

test('retry policy is finite and worker is a background process without an HTTP listener', () => {
  assert.deepEqual(BACKOFF_MS, [5000, 30000, 120000]);
  assert.match(engine, /FOR UPDATE SKIP LOCKED/);
  assert.match(engine, /max_attempts/);
  assert.match(engine, /automation_run_steps/);
  assert.match(engine, /bootstrap\/no-op/);
  assert.doesNotMatch(worker, /app\.listen\(/);
  assert.match(worker, /SIGTERM/);
  assert.match(worker, /closeConnection/);
});

test('bootstrap processor has no CRM action writes', () => {
  assert.doesNotMatch(engine, /UPDATE prospects|INSERT INTO prospect_labels|INSERT INTO lead_activities|INSERT INTO internal_notifications/i);
  assert.doesNotMatch(engine, /whatsapp|email\.send|lead\.add_tag|lead\.assign_user/i);
});
