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

test('2G.2 provider extrai identidade confirmada sem inventar numero pela instancia', () => {
  assert.deepEqual(provider.extractIdentityCandidate({ instance: { ownerJid: '5511999999999@s.whatsapp.net', profileName: 'Kaizen' } }), {
    phoneNumber: '5511999999999',
    displayName: 'Kaizen',
  });
  assert.deepEqual(provider.extractIdentityCandidate({ instance: { instanceName: 'Kaizen-Comercial', state: 'open' } }), {
    phoneNumber: null,
    displayName: null,
  });
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

function leadConnection(existing = null) {
  const calls = [];
  let inserted = false;
  return {
    calls,
    get inserted() { return inserted; },
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT GET_LOCK') || sql.startsWith('SELECT RELEASE_LOCK')) return [[{ locked: 1 }]];
      if (sql.startsWith('SELECT * FROM prospects WHERE normalized_phone')) return [[existing].filter(Boolean)];
      if (sql.startsWith('INSERT INTO prospects')) { inserted = true; return [{ insertId: 901 }]; }
      if (sql.startsWith('SELECT * FROM prospects WHERE id')) return [[{ id: 901, business_name: params[0] }]];
      if (sql.startsWith('INSERT INTO automation_events')) return [{ insertId: 1 }];
      return [{ affectedRows: 1 }];
    },
  };
}

test('2G.2 webhook inbound cria lead novo usando identidade remota quando autorizado', async () => {
  const connection = leadConnection();
  const lead = await whatsapp.resolveWebhookLead(connection, { owner_user_id: 1, auto_create_leads: 1 }, {
    isGroup: false, fromMe: false, phone: '5513999998888', pushName: 'Contato remoto',
  });
  assert.equal(connection.inserted, true);
  const insert = connection.calls.find((call) => call.sql.startsWith('INSERT INTO prospects'));
  assert.equal(insert.params[1], 'Contato remoto');
  assert.equal(lead.id, 901);
});

test('2G.2 webhook inbound respeita auto_create_leads desativado', async () => {
  const connection = leadConnection();
  const lead = await whatsapp.resolveWebhookLead(connection, { owner_user_id: 1, auto_create_leads: 0 }, {
    isGroup: false, fromMe: false, phone: '5513999998888', pushName: 'Contato remoto',
  });
  assert.equal(lead, null);
  assert.equal(connection.inserted, false);
});

test('2G.2 webhook outbound desconhecido nao cria lead nem usa pushName da conta', async () => {
  const connection = leadConnection();
  const lead = await whatsapp.resolveWebhookLead(connection, { owner_user_id: 1, auto_create_leads: 1 }, {
    isGroup: false, fromMe: true, phone: '5571999999999', pushName: 'Lucas - Kaizen Midias',
  });
  assert.equal(lead, null);
  assert.equal(connection.inserted, false);
  assert.equal(connection.calls.some((call) => call.sql.startsWith('SELECT GET_LOCK')), false);
});

test('2G.2 webhook outbound conhecido vincula lead existente sem alterar seu nome', async () => {
  const existing = { id: 77, business_name: 'Empresa remota', phone: '5571999999999' };
  const connection = leadConnection(existing);
  const lead = await whatsapp.resolveWebhookLead(connection, { owner_user_id: 1, auto_create_leads: 1 }, {
    isGroup: false, fromMe: true, phone: '5571999999999', pushName: 'Lucas - Kaizen Midias',
  });
  assert.deepEqual(lead, existing);
  assert.equal(connection.inserted, false);
});

test('2G.2 mensagens de grupo nao procuram nem criam leads individuais', async () => {
  const connection = leadConnection();
  const lead = await whatsapp.resolveWebhookLead(connection, { owner_user_id: 1, auto_create_leads: 1 }, {
    isGroup: true, fromMe: false, phone: '5513999998888', pushName: 'Participante',
  });
  assert.equal(lead, null);
  assert.equal(connection.calls.length, 0);
});

test('2G.2 conversa e mensagem outbound preservam telefone remoto mesmo sem lead', () => {
  const source = fs.readFileSync(path.join(root, 'server/services/whatsapp-service.js'), 'utf8');
  assert.match(source, /getOrCreateConversation\(connection, account, parsed\.remoteJid, lead\?\.id \|\| null/);
  assert.match(source, /remotePhone: parsed\.phone/);
  assert.match(source, /lead\?\.phone \|\| remotePhone \|\| ''/);
});

test('2G.2 origem do prospect usa WhatsApp sem forcar Google Maps', () => {
  const adapter = fs.readFileSync(path.join(root, 'src/services/leads/lead-adapter.ts'), 'utf8');
  const leadTypes = fs.readFileSync(path.join(root, 'src/types/lead.ts'), 'utf8');
  assert.match(adapter, /normalized\.includes\("whatsapp"\)/);
  assert.match(adapter, /report\.source \|\| report\.origem \|\| prospect\.origin \|\| "manual"/);
  assert.doesNotMatch(adapter, /report\.source \|\| report\.origem \|\| "google_maps"/);
  assert.match(leadTypes, /\| "whatsapp"/);
});

test('2G.2 webhook e provider nao expõem credenciais no frontend ou logs', () => {
  const route = fs.readFileSync(path.join(root, 'server/routes/webhooks.js'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'src/components/integrations/WhatsAppIntegrationPanel.tsx'), 'utf8');
  assert.match(route, /hasWebhookSecret\(readWebhookSecret\(req\)/);
  assert.doesNotMatch(route, /console\.(log|info).*payload/);
  assert.doesNotMatch(ui, /secret_ciphertext|secret_iv|auth_tag/);
});
