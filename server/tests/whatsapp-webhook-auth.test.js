const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EvolutionWhatsAppProvider } = require('../services/evolution-whatsapp-provider');
const { WEBHOOK_SECRET_HEADER, generateWebhookSecret, hasWebhookSecret } = require('../services/whatsapp-webhook-auth');

const root = path.resolve(__dirname, '../..');

test('webhook Evolution usa segredo dedicado com comparação timing-safe', () => {
  const secret = generateWebhookSecret();
  assert.equal(secret.length > 20, true);
  assert.equal(hasWebhookSecret(secret, secret), true);
  assert.equal(hasWebhookSecret('wrong-secret', secret), false);
  assert.equal(hasWebhookSecret('', secret), false);
  assert.equal(WEBHOOK_SECRET_HEADER, 'x-kaizen-webhook-secret');
});

test('Evolution configura header próprio no webhook sem reutilizar a API Key administrativa', async () => {
  const provider = new EvolutionWhatsAppProvider({ baseUrl: 'https://evolution.example.com', apiKey: 'admin-key' });
  let request;
  provider.request = async (method, url, data) => { request = { method, url, data }; return { ok: true }; };
  await provider.setWebhook('Kaizen-Comercial', { url: 'https://crm.example.com/api/webhooks/evolution', secret: 'webhook-secret' });
  assert.deepEqual(request, {
    method: 'POST',
    url: '/webhook/set/Kaizen-Comercial',
    data: {
      webhook: {
        enabled: true,
        url: 'https://crm.example.com/api/webhooks/evolution',
        byEvents: false,
        base64: false,
        headers: { 'x-kaizen-webhook-secret': 'webhook-secret' },
        events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE'],
      },
    },
  });
});

test('criação de instância usa os campos oficiais de webhook da Evolution', async () => {
  const provider = new EvolutionWhatsAppProvider({ baseUrl: 'https://evolution.example.com', apiKey: 'admin-key' });
  let request;
  provider.request = async (method, url, data) => { request = { method, url, data }; return { instance: { instanceName: 'Kaizen-Comercial', status: 'close' } }; };
  await provider.createInstance({ instanceName: 'Kaizen-Comercial', webhookUrl: 'https://crm.example.com/api/webhooks/evolution', webhookSecret: 'webhook-secret' });
  assert.deepEqual(request.data.webhookUrl, 'https://crm.example.com/api/webhooks/evolution');
  assert.deepEqual(request.data.webhookEvents, ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE']);
});

test('rota do webhook não aceita a API Key global como credencial de entrada', () => {
  const route = fs.readFileSync(path.join(root, 'server/routes/webhooks.js'), 'utf8');
  assert.match(route, /hasWebhookSecret\(readWebhookSecret\(req\)/);
  assert.doesNotMatch(route, /req\.get\(['"]apikey/);
  assert.doesNotMatch(route, /secret\?\.apiKey/);
  assert.doesNotMatch(route, /console\.(log|info).*secret|console\.(log|info).*payload/);
});

test('sincronização de conta existente usa endpoint próprio e não recria a instância', () => {
  const route = fs.readFileSync(path.join(root, 'server/routes/whatsapp.js'), 'utf8');
  assert.match(route, /router\.post\('\/accounts\/\:id\/webhook\/sync'/);
  assert.match(route, /provider\.setWebhook\(account\.external_instance_id/);
  assert.doesNotMatch(route, /sync[\s\S]{0,500}createInstance/);
});
