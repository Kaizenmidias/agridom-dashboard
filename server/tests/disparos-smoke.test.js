const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('DISPAROS smoke usa a mesma API de contas conectadas do módulo WhatsApp', () => {
  const page = read('src', 'pages', 'commercial', 'BroadcastPage.tsx');
  assert.match(page, /whatsappAPI\.listAccounts\(\)/);
  assert.match(page, /account\.status === "connected"/);
  assert.doesNotMatch(page, /api\/whatsapp\/accounts|whatsapp\/accounts/);
  assert.match(page, /id: account\.id/);
});

test('DISPAROS mantém start protegido por conta WhatsApp pronta', () => {
  const worker = read('server', 'services', 'broadcast-campaign-worker.js');
  const route = read('server', 'routes', 'broadcast-campaigns.js');
  assert.match(route, /router\.post\('\/:id\/start'/);
  assert.match(worker, /WHATSAPP_ACCOUNT_NOT_READY/);
  assert.match(worker, /account_status !== 'connected'/);
  assert.doesNotMatch(worker, /apiKey|secret_ciphertext/);
});

test('DISPAROS expõe apenas os segmentos reais já usados pela tela de Leads', () => {
  const route = read('server', 'routes', 'broadcast-campaigns.js');
  assert.match(route, /audience\/folders/);
  for (const id of ['todos-os-leads', 'novos', 'qualificados', 'sem-site', 'follow-up', 'convertidos', 'arquivados']) assert.match(route, new RegExp(id));
  assert.match(route, /p\.owner_user_id = \?/);
  assert.match(route, /with_phone/);
});
