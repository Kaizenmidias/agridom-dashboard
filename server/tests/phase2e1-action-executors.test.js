const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ACTION_CATALOG } = require('../services/automation-catalog');
const { validateAutomationDefinition } = require('../services/automation-definition-validator');
const { evaluateCondition } = require('../services/automation/condition-evaluator');
const { resolveTemplate } = require('../services/automation/variable-resolver');

const engine = fs.readFileSync(path.join(__dirname, '../services/automation-engine.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '../../database/migrations/20260923_phase_2e1_action_executors.sql'), 'utf8');

test('2E.1 marks internal actions and wait as executable, external actions as blocked', () => {
  for (const id of ['lead.add_tag', 'lead.remove_tag', 'lead.assign_user', 'lead.update_status', 'lead.update_field', 'lead.move_pipeline_stage', 'activity.create', 'activity.create_task', 'activity.create_call', 'activity.create_follow_up', 'activity.complete', 'notification.create', 'wait.period']) {
    assert.equal(ACTION_CATALOG.find((item) => item.id === id)?.availability, 'available', id);
  }
  assert.equal(ACTION_CATALOG.find((item) => item.id === 'whatsapp.send_message')?.availability, 'requires_integration');
});

test('2E.1 variable resolver is allowlisted and does not evaluate code', () => {
  assert.equal(resolveTemplate('Ola {{lead.name}}', { lead: { name: 'Ana' } }), 'Ola Ana');
  assert.throws(() => resolveTemplate('{{lead.constructor}}', { lead: {} }), /UNKNOWN_VARIABLE/);
});

test('2E.1 condition evaluator follows allowlisted fields and operators', async () => {
  const connection = { execute: async (sql) => sql.includes('SELECT p.*') ? [[{ id: 7, status: 'Novo', phone: '5516999999999' }]] : [[]] };
  const yes = await evaluateCondition(connection, { field: 'phone', operator: 'is_not_empty' }, { leadId: 7, ownerUserId: 3 });
  assert.equal(yes.result, true);
  await assert.rejects(() => evaluateCondition(connection, { field: 'unknown', operator: 'equals', value: 'x' }, { leadId: 7, ownerUserId: 3 }), /INVALID_CONDITION_FIELD/);
});

test('2E.1 publication rejects invalid internal action configuration', () => {
  const result = validateAutomationDefinition({ schemaVersion: 1, trigger: { type: 'lead.created', config: {} }, steps: [{ id: 'tag', type: 'action', config: { actionType: 'lead.add_tag' }, next: null }] }, { requireSteps: true, requireExecutableActions: true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'MISSING_ACTION_CONFIG'));
});

test('2E.1.1 semantic graph contract publishes wait/action terminals without finish', () => {
  const definition = {
    schemaVersion: 1,
    trigger: { type: 'lead.created', config: {}, next: 'wait_1' },
    steps: [
      { id: 'wait_1', type: 'wait', config: { amount: 1, unit: 'minutes' }, next: 'tag_1' },
      { id: 'tag_1', type: 'action', config: { actionType: 'lead.add_tag', labelId: 4 }, next: null },
    ],
    layout: { nodes: { trigger_1: { x: 80, y: 200 }, wait_1: { x: 360, y: 200 }, tag_1: { x: 650, y: 200 } } },
  };
  const result = validateAutomationDefinition(definition, { requireSteps: true, requireExecutableActions: true });
  assert.equal(result.valid, true);
  assert.equal(result.definition.steps.length, 2);
  assert.equal(result.definition.steps[0].next, 'tag_1');
  assert.equal(result.definition.steps[1].next, null);
});

test('2E.1.1 condition branches remain semantic and finish is only legacy-compatible', () => {
  const definition = {
    schemaVersion: 1,
    trigger: { type: 'lead.created', config: {}, next: 'condition_1' },
    steps: [
      { id: 'condition_1', type: 'condition', config: { field: 'phone', operator: 'is_not_empty' }, branches: { yes: 'tag_1', no: 'activity_1' } },
      { id: 'tag_1', type: 'action', config: { actionType: 'lead.add_tag', labelId: 4 }, next: null },
      { id: 'activity_1', type: 'action', config: { actionType: 'activity.create', title: 'Contato' }, next: null },
    ],
  };
  const result = validateAutomationDefinition(definition, { requireSteps: true, requireExecutableActions: true });
  assert.equal(result.valid, true);
  assert.deepEqual(result.definition.steps[0].branches, { yes: 'tag_1', no: 'activity_1' });
  const legacy = validateAutomationDefinition({ ...definition, steps: [...definition.steps.map((step) => ({ ...step, next: step.id === 'tag_1' || step.id === 'activity_1' ? 'finish_1' : step.next })), { id: 'finish_1', type: 'finish', config: {}, next: null }] }, { requireSteps: true, requireExecutableActions: true });
  assert.equal(legacy.valid, true);
});

test('2E.1 migration is additive and supports lineage without IF NOT EXISTS column syntax', () => {
  assert.match(migration, /source_automation_id/);
  assert.match(migration, /lineage_depth/);
  assert.match(migration, /information_schema\.COLUMNS/);
  assert.doesNotMatch(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i);
  assert.match(engine, /FOR UPDATE SKIP LOCKED/);
  assert.match(engine, /status = 'waiting'/);
  assert.match(engine, /MAX_LINEAGE_DEPTH/);
});
