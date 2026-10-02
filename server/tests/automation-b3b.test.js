const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const builder = fs.readFileSync(path.join(__dirname, '../../src/components/automations/AutomationBuilder.tsx'), 'utf8');
const catalog = fs.readFileSync(path.join(__dirname, '../../src/components/automations/action-catalog.ts'), 'utf8');

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
