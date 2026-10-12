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
  assert.match(migration, /information_schema\.COLUMNS/);
  assert.match(migration, /CREATE PROCEDURE apply_phase_2d1_schema/);
  assert.doesNotMatch(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i);
  assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM|DROP\s+COLUMN|ALTER\s+DATABASE/i);
});

test('retry migration deduplicates normal events while allowing multiple manual retries', () => {
  const retryMigration = fs.readFileSync(path.join(__dirname, '../../database/migrations/20261012_automation_retry_event_uniqueness.sql'), 'utf8');
  assert.match(retryMigration, /DROP INDEX uq_automation_run_event_automation_version/);
  assert.match(retryMigration, /execution_kind ENUM\('event', 'manual_retry'\)/);
  assert.match(retryMigration, /event_dedupe_key VARCHAR\(191\)/);
  assert.match(retryMigration, /execution_kind = 'event'/);
  assert.match(retryMigration, /uq_automation_run_event_dedupe_key/);
  assert.match(retryMigration, /idx_automation_runs_event_id/);
  assert.match(retryMigration, /DECLARE EXIT HANDLER FOR SQLEXCEPTION/);
  assert.match(retryMigration, /GENERATED ALWAYS AS/);
  assert.match(retryMigration, /information_schema\.STATISTICS/);
  assert.doesNotMatch(retryMigration.replace(/^--.*$/gm, ''), /DROP TABLE|TRUNCATE TABLE|DELETE FROM|DROP COLUMN/i);
});

test('nullable dedupe migration backfills legacy events and leaves manual retries null', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../../database/migrations/20261012_automation_retry_event_dedupe_nullable.sql'), 'utf8');
  assert.match(migration, /ADD COLUMN event_dedupe_key VARCHAR\(191\) NULL/);
  assert.match(migration, /SET event_dedupe_key = CONCAT\(event_id/);
  assert.match(migration, /event_id IS NOT NULL/);
  assert.match(migration, /event_dedupe_key <> CONCAT\(event_id/);
  assert.match(migration, /execution_kind = 'manual_retry'[\s\S]*event_dedupe_key IS NOT NULL/);
  assert.match(migration, /execution_kind = 'event'[\s\S]*event_id IS NULL[\s\S]*event_dedupe_key IS NOT NULL/);
  assert.match(migration, /HAVING COUNT\(\*\) > 1/);
  assert.match(migration, /SIGNAL SQLSTATE '45000'/);
  assert.match(migration, /uq_automation_run_event_dedupe_key/);
  assert.match(migration, /dedupe_index_non_unique/);
  assert.match(migration, /dedupe_index_column_count/);
  assert.match(migration, /dedupe_index_sub_part IS NOT NULL/);
  assert.match(migration, /DROP INDEX uq_automation_run_event_automation_version/);
  assert.match(migration, /idx_automation_runs_event_id/);
  assert.match(migration, /REGEXP '\(\^\| \)GENERATED'/);
  assert.match(migration, /definicao incompativel/);
  assert.doesNotMatch(migration, /FOREIGN_KEY_CHECKS/i);
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
  assert.match(calls[0].sql, /event_dedupe_key/);
  assert.equal(calls[0].params.at(-1), '8:4:12');
  assert.match(calls[1].sql, /engine\.bootstrap/);
});

test('retry policy is finite and worker is a background process without an HTTP listener', () => {
  assert.deepEqual(BACKOFF_MS, [5000, 30000, 120000, 300000, 900000, 1800000, 3600000, 7200000]);
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
  assert.match(engine, /executeAction/);
  assert.doesNotMatch(engine, /UPDATE prospects|INSERT INTO prospect_labels|INSERT INTO lead_activities|INSERT INTO internal_notifications/i);
});
