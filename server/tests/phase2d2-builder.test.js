const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateAutomationDefinition } = require('../services/automation-definition-validator');
const { STEP_TYPES } = require('../services/automation-catalog');

const builder = fs.readFileSync(path.join(__dirname, '../../src/components/automations/AutomationBuilder.tsx'), 'utf8');
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
});

test('2D.2 exposes draft update and keeps actions internal', () => {
  assert.match(routes, /patch\('\/:id\/versions\/:versionId'/);
  assert.doesNotMatch(builder, /whatsapp\.send|email\.send/);
});
