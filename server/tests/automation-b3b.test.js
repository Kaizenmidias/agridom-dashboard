const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const builder = fs.readFileSync(path.join(__dirname, '../../src/components/automations/AutomationBuilder.tsx'), 'utf8');
const catalog = fs.readFileSync(path.join(__dirname, '../../src/components/automations/action-catalog.ts'), 'utf8');
const triggerConfigPromise = import('../../src/services/automations-trigger-config.mjs');

test('B.3B centraliza compatibilidade Lead no catalogo e desabilita actions Webhook', () => {
  assert.match(catalog, /actionRequiresLead/);
  assert.match(builder, /webhookFlow && actionRequiresLead\(item\.id\)/);
  assert.match(builder, /disabled=\{disabled\}/);
  assert.match(builder, /Esta ação precisa de um Lead/);
});

test('B.3B preserva nodes incompatíveis e reconcilia ao trocar o trigger', () => {
  assert.match(builder, /compatibilityError/);
  assert.match(builder, /markWebhookCompatibility/);
  assert.match(builder, /Condições para dados de Webhook/);
  assert.match(builder, /Este tipo de condição ainda não pode ser usado/);
});

test('B.3B protege readOnly e usa AlertDialog para regeneração', () => {
  assert.match(builder, /inspectorReadOnly/);
  assert.match(builder, /disabled=\{inspectorReadOnly\}/);
  assert.match(builder, /<AlertDialog/);
  assert.match(builder, /AlertDialogAction/);
  assert.doesNotMatch(builder, /if \(\!window\.confirm\("Gerar um novo token/);
});

test('B.3B carrega o endpoint somente no Inspector e mantém token fora da definition', () => {
  assert.equal((builder.match(/automationsAPI\.getWebhookEndpoint\(/g) || []).length, 1);
  assert.match(builder, /webhookEndpointId/);
  assert.match(builder, /setRawToken\(result\.token\)/);
  assert.doesNotMatch(builder, /localStorage\.setItem\([^\n]*token/);
});

test('B.3B preserva o trigger da definition e a configuracao da lista ao serializar', () => {
  assert.match(builder, /trigger\?\.config\.triggerType \|\| triggerType \|\| UNCONFIGURED_TRIGGER/);
  assert.match(builder, /triggerConfigForType/);
  assert.match(builder, /triggerType: value, \.\.\.triggerConfigForType\(value, node\.config\)/);
  assert.match(builder, /triggerConfigForType\(value, node\.config\)/);
});

test('B.3B mantém os três contratos de trigger no builder', () => {
  assert.match(builder, /lead\.created/);
  assert.match(builder, /lead\.added_to_folder/);
  assert.match(builder, /webhook\.received/);
  assert.match(builder, /webhookEndpointId/);
});

test('B.3B round-trip comportamental preserva cada contrato de trigger', () => {
  return triggerConfigPromise.then((triggerConfig) => {
  const roundTrip = (type, config, nextType = type) => triggerConfig.triggerConfigForType(nextType, triggerConfig.triggerConfigForType(type, config));
  assert.deepEqual(roundTrip('lead.created', {}), {});
  assert.deepEqual(roundTrip('lead.added_to_folder', { folderId: 123 }), { folderId: 123 });
  assert.deepEqual(roundTrip('webhook.received', { webhookEndpointId: 55 }), { webhookEndpointId: 55 });
  });
});

test('B.3B descarta configuracao incompatível em todas as trocas de trigger', () => {
  return triggerConfigPromise.then((triggerConfig) => {
  const config = triggerConfig.triggerConfigForType;
  assert.deepEqual(config('lead.added_to_folder', { webhookEndpointId: 55, folderId: 123 }), { folderId: 123 });
  assert.deepEqual(config('webhook.received', { folderId: 123, webhookEndpointId: 55 }), { webhookEndpointId: 55 });
  assert.deepEqual(config('lead.created', { folderId: 123, webhookEndpointId: 55 }), {});
  assert.deepEqual(config('__unconfigured__', { folderId: 123, webhookEndpointId: 55 }), {});
  });
});

test('B.3B troca de lista e precedencia da definition sao deterministicas', () => {
  return triggerConfigPromise.then((triggerConfig) => {
  assert.deepEqual(configForFolder(triggerConfig, 10, 20), { folderId: 20 });
  assert.equal(triggerConfig.triggerTypeFromDefinition({ trigger: { type: 'lead.added_to_folder' } }, '__unconfigured__'), 'lead.added_to_folder');
  assert.equal(triggerConfig.triggerTypeFromDefinition({ trigger: { type: 'webhook.received' } }, 'lead.created'), 'webhook.received');
  assert.equal(triggerConfig.triggerTypeFromDefinition({ trigger: { type: '__unconfigured__' } }, 'lead.created'), 'lead.created');
  assert.equal(triggerConfig.triggerTypeFromDefinition({}, undefined), '__unconfigured__');
  });
});

function configForFolder(triggerConfig, previous, next) {
  return triggerConfig.triggerConfigForType('lead.added_to_folder', { folderId: next || previous });
}
