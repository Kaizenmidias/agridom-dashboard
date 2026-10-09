const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const provider = require('../services/evolution-whatsapp-provider');

const root = path.resolve(__dirname, '../..');

test('reconexao QR extrai identidade confirmada sem inventar numero pela instancia', () => {
  assert.deepEqual(provider.extractIdentityCandidate({ instance: { ownerJid: '5511999999999@s.whatsapp.net', profileName: 'Kaizen' } }), {
    phoneNumber: '5511999999999',
    displayName: 'Kaizen',
  });
  assert.deepEqual(provider.extractIdentityCandidate({ instance: { instanceName: 'Kaizen-Comercial', state: 'open' } }), {
    phoneNumber: null,
    displayName: null,
  });
});

test('reconexao QR preserva instancia existente e evita operacoes destrutivas', () => {
  const route = fs.readFileSync(path.join(root, 'server/routes/whatsapp.js'), 'utf8');
  const qrRoute = route.slice(route.indexOf("router.get('/accounts/:id/qr'"), route.indexOf("router.get('/accounts/:id/status'"));
  assert.match(qrRoute, /provider\.status\(account\.external_instance_id\)/);
  assert.match(qrRoute, /provider\.connect\(account\.external_instance_id\)/);
  assert.match(route, /GET_LOCK/);
  assert.match(qrRoute, /qrRecentlyRequested/);
  assert.match(qrRoute, /Instancia Evolution nao encontrada/);
  assert.doesNotMatch(qrRoute, /createInstance|logout|DELETE|SET\s+archived_at|status\s*=\s*'archived'/i);
});

test('reconexao QR sincroniza telefone confirmado e preserva nome personalizado', () => {
  const route = fs.readFileSync(path.join(root, 'server/routes/whatsapp.js'), 'utf8');
  assert.match(route, /phone_number = COALESCE\(\?, phone_number\)/);
  assert.match(route, /display_name = COALESCE\(display_name, \?\)/);
  assert.match(route, /resolveConfirmedIdentity\(provider, rows\[0\], result\)/);
  assert.match(route, /provider\.fetchInstance\(account\.external_instance_id\)/);
});

test('reconexao QR no frontend expõe ação dedicada e encerra polling ao conectar', () => {
  const ui = fs.readFileSync(path.join(root, 'src/components/integrations/WhatsAppIntegrationPanel.tsx'), 'utf8');
  assert.match(ui, /Reconectar QR Code/);
  assert.match(ui, /Escaneie o QR Code com o WhatsApp para reconectar este número/);
  assert.match(ui, /setQrOpen\(false\)/);
  assert.match(ui, /window\.setInterval\(\(\) => \{ void refreshAccount\(qrAccount\); \}, 4000\)/);
});

test('reconexao QR nao expoe credenciais ou payload bruto ao frontend', () => {
  const api = fs.readFileSync(path.join(root, 'src/api/whatsapp.ts'), 'utf8');
  const ui = fs.readFileSync(path.join(root, 'src/components/integrations/WhatsAppIntegrationPanel.tsx'), 'utf8');
  assert.doesNotMatch(api, /secret_ciphertext|secret_iv|secret_auth_tag/i);
  assert.doesNotMatch(ui, /secret_ciphertext|secret_iv|auth_tag/i);
});
