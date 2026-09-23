const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateAutomationDefinition } = require('../services/automation-definition-validator');
const { TRIGGER_TYPES, STEP_TYPES, ACTION_TYPES } = require('../services/automation-catalog');

const migration = fs.readFileSync(path.join(__dirname, '../../database/migrations/20260923_phase_2b_automation_foundation.sql'), 'utf8');
const validDefinition = { schemaVersion: 1, trigger: { type: 'lead.created', config: {} }, steps: [{ id: 'notify', type: 'action', config: { actionType: 'notification.create' }, next: null }] };

test('Phase 2B catalogs expose the supported native contract', () => {
  assert.ok(TRIGGER_TYPES.includes('lead.created'));
  assert.ok(STEP_TYPES.includes('condition'));
  assert.ok(ACTION_TYPES.includes('whatsapp.send'));
});

test('definition validator accepts a valid definition and rejects malformed references', () => {
  assert.equal(validateAutomationDefinition(validDefinition).valid, true);
  const result = validateAutomationDefinition({ ...validDefinition, steps: [{ ...validDefinition.steps[0], next: 'missing' }] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'UNKNOWN_STEP_REFERENCE'));
});

test('definition validator protects publication contract and secrets', () => {
  assert.ok(validateAutomationDefinition({ ...validDefinition, steps: [] }, { requireSteps: true }).errors.some((item) => item.code === 'EMPTY_STEPS'));
  assert.ok(validateAutomationDefinition({ ...validDefinition, trigger: { type: 'unknown', config: {} } }).errors.some((item) => item.code === 'UNKNOWN_TRIGGER'));
  assert.ok(validateAutomationDefinition({ ...validDefinition, steps: [{ id: 'notify', type: 'action', config: { actionType: 'email.send', token: 'x' } }] }).errors.some((item) => item.code === 'SECRET_NOT_ALLOWED'));
  assert.equal(validateAutomationDefinition('{invalid').valid, false);
});

test('Phase 2B migration is additive, rerunnable and indexed for idempotency', () => {
  for (const table of ['automations', 'automation_versions', 'automation_events', 'automation_runs', 'automation_run_steps', 'automation_jobs', 'automation_audit_logs']) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(migration, /UNIQUE KEY uq_automation_event_idempotency/);
  assert.match(migration, /UNIQUE KEY uq_automation_run_idempotency/);
  assert.match(migration, /UNIQUE KEY uq_automation_job_idempotency/);
  assert.match(migration, /fk_automation_active_version/);
  assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM|DROP\s+COLUMN/i);
});

test('automation API is mounted with authentication and commercial access guards', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../routes/automations.js'), 'utf8');
  const server = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  for (const endpoint of ['versions', 'publish', 'pause', 'activate', 'archive', 'runs']) assert.match(routes, new RegExp(endpoint));
  assert.match(routes, /authenticateToken/);
  assert.match(routes, /requireCommercialAccess/);
  assert.match(server, /app\.use\('\/api\/automations'/);
});
