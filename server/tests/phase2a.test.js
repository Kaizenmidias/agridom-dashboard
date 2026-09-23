const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.join(__dirname, '..', '..', 'database', 'migrations', '20260922_phase_2a_commercial_entities.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');

test('migration da Fase 2A contem todas as entidades comerciais', () => {
  for (const entity of [
    'pipeline_definitions',
    'pipeline_stages',
    'prospect_pipeline_positions',
    'lead_labels',
    'prospect_labels',
    'lead_activities',
    'internal_notifications',
    'assigned_user_id',
  ]) assert.match(migration, new RegExp(entity));
});

test('migration da Fase 2A nao contem operacoes destrutivas de dados', () => {
  assert.doesNotMatch(migration, /\bTRUNCATE\b/i);
  assert.doesNotMatch(migration, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(migration, /\bDELETE\s+FROM\s+prospects\b/i);
  assert.doesNotMatch(migration, /\bDROP\s+COLUMN\b/i);
});

test('backfills preservam JSON legado e exigem correspondencia unica de responsavel', () => {
  assert.match(migration, /INSERT IGNORE INTO lead_labels/i);
  assert.match(migration, /INSERT IGNORE INTO prospect_labels/i);
  assert.match(migration, /HAVING COUNT\(\*\) = 1/i);
  assert.doesNotMatch(migration, /SET\s+analysis_report\s*=\s*NULL/i);
});
