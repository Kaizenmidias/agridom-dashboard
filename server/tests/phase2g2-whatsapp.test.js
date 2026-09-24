const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'database/migrations/20260923_phase_2g2_whatsapp_core.sql'), 'utf8');
const provider = require('../services/evolution-whatsapp-provider');
const whatsapp = require('../services/whatsapp-service');
const catalog = require('../services/automation-catalog');

test('2G.2 normaliza telefone sem apagar o identificador externo JID', () => {
  assert.equal(whatsapp.normalizePhone('+55 (13) 99999-8888'), '5513999998888');
  assert.equal(whatsapp.normalizePhone('13999998888@s.whatsapp.net'), '5513999998888');
  const parsed = whatsapp.extractInbound({ data: { key: { remoteJid: '5513999998888@s.whatsapp.net', id: 'wamid-1', fromMe: false }, message: { conversation: 'Ola' }, pushName: 'Contato' } });
  assert.equal(parsed.phone, '5513999998888');
  assert.equal(parsed.remoteJid, '5513999998888@s.whatsapp.net');
  assert.equal(parsed.text, 'Ola');
});

test('2G.2 provider valida URL e normaliza estados sem depender da Evolution real', () => {
  assert.equal(provider.validateBaseUrl('https://evolution.example.com/'), 'https://evolution.example.com');
  assert.equal(provider.normalizeState('open'), 'connected');
  assert.equal(provider.normalizeState('close'), 'disconnected');
  assert.throws(() => provider.validateBaseUrl('file:///tmp/secret'), /URL base/);
});

test('2G.2 migration cria contas, conversas, webhook deduplicado e evolui mensagens', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS communication_accounts/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS conversations/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS communication_webhook_events/i);
  assert.match(migration, /uq_communication_external_message/i);
  assert.match(migration, /communication_account_id/i);
  assert.doesNotMatch(migration, /20260923_phase_2g1_email_communication/i);
});

test('2G.2 WhatsApp send existe na engine e eventos de mensagem usam contrato de dominio', () => {
  assert.ok(catalog.ACTION_CATALOG.find((item) => item.id === 'whatsapp.send'));
  const events = require('../services/domain-events').EVENT_CONTRACTS;
  assert.deepEqual(events['message.received'], ['conversationId', 'messageId']);
  assert.deepEqual(events['message.sent'], ['conversationId', 'messageId']);
});

test('2G.2 webhook e provider nao expõem credenciais no frontend ou logs', () => {
  const route = fs.readFileSync(path.join(root, 'server/routes/webhooks.js'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'src/components/integrations/WhatsAppIntegrationPanel.tsx'), 'utf8');
  assert.match(route, /apikey/);
  assert.doesNotMatch(route, /console\.(log|info).*payload/);
  assert.doesNotMatch(ui, /secret_ciphertext|secret_iv|auth_tag/);
});
