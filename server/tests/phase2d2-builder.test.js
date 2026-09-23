const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateAutomationDefinition } = require('../services/automation-definition-validator');
const { ACTION_CATALOG, ACTION_TYPES, STEP_TYPES } = require('../services/automation-catalog');

const builder = fs.readFileSync(path.join(__dirname, '../../src/components/automations/AutomationBuilder.tsx'), 'utf8');
const repository = fs.readFileSync(path.join(__dirname, '../services/automation-repository.js'), 'utf8');
const routes = fs.readFileSync(path.join(__dirname, '../routes/automations.js'), 'utf8');

test('2D.2 accepts terminal finish nodes and unit-based waits', () => {
  assert.ok(STEP_TYPES.includes('finish'));
  const result = validateAutomationDefinition({
    schemaVersion: 1,
    trigger: { type: 'lead.created', config: {} },
    steps: [
      { id: 'wait_1', type: 'wait', config: { amount: 2, unit: 'hours' }, next: 'finish_1' },
      { id: 'finish_1', type: 'finish', config: {}, next: null },
    ],
  });
  assert.equal(result.valid, true);
});

test('2D.2 builder keeps the semantic definition separate from visual coordinates', () => {
  assert.match(builder, /builderToDefinition/);
  assert.match(builder, /schemaVersion: 1/);
  assert.match(builder, /steps:\s*nodes\s*\.filter/);
  assert.match(builder, /style=\{\{ left: node\.x, top: node\.y \}\}/);
  assert.match(builder, /Minimapa do fluxo/);
  assert.match(builder, /canvasDragRef/);
});

test('2D.2 exposes draft update and keeps actions internal', () => {
  assert.match(routes, /patch\('\/:id\/versions\/:versionId'/);
  assert.match(builder, /requires_integration/);
});

test('2D.2 action catalog separates executable, integration and future actions', () => {
  assert.ok(ACTION_CATALOG.some((item) => item.id === 'whatsapp.send_message' && item.availability === 'requires_integration'));
  assert.ok(ACTION_CATALOG.some((item) => item.id === 'lead.add_tag' && item.availability === 'available'));
  assert.ok(ACTION_TYPES.includes('instagram.send_direct'));
  const blocked = validateAutomationDefinition({ schemaVersion: 1, trigger: { type: 'lead.created', config: {} }, steps: [{ id: 'send', type: 'action', config: { actionType: 'whatsapp.send_message' }, next: null }] }, { requireSteps: true, requireExecutableActions: true });
  assert.equal(blocked.valid, false);
  assert.ok(blocked.errors.some((item) => item.code === 'ACTION_NOT_EXECUTABLE'));
});

test('2D.2 validates variable tokens against the supported variable catalog', () => {
  const valid = validateAutomationDefinition({ schemaVersion: 1, trigger: { type: 'lead.created', config: {} }, steps: [{ id: 'message', type: 'action', config: { actionType: 'email.send', message: 'Ola {{lead.name}}' }, next: null }] });
  const invalid = validateAutomationDefinition({ schemaVersion: 1, trigger: { type: 'lead.created', config: {} }, steps: [{ id: 'message', type: 'action', config: { actionType: 'email.send', message: 'Ola {{lead.secret_value}}' }, next: null }] });
  assert.equal(valid.valid, true);
  assert.ok(invalid.errors.some((item) => item.code === 'UNKNOWN_VARIABLE'));
});

test('2E.1.1 exposes a free-form graph editor with implicit terminals', () => {
  assert.match(builder, /@xyflow\/react/);
  assert.match(builder, /ReactFlowProvider/);
  assert.match(builder, /onConnect/);
  assert.match(builder, /onReconnect/);
  assert.match(builder, /screenToFlowPosition/);
  assert.match(builder, /Canvas vazio/);
  assert.match(builder, /layout:/);
  assert.doesNotMatch(builder, /type === "finish".*toolButton/);
});

test('2E.1.2 auto-draft saves before publish and uses the concurrency lock', () => {
  assert.match(builder, /automationsAPI\.createVersion/);
  assert.match(builder, /publishCurrent/);
  assert.match(builder, /onPublish\(latest, versionId\)/);
  assert.match(repository, /ownedAutomation\(connection, automationId, userId, true\)/);
  assert.match(repository, /status = 'draft'.*LIMIT 1 FOR UPDATE/s);
});
