const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

test('DISPAROS-2D usa o serviço WhatsApp existente e mantém o worker sem Evolution', () => {
  const executor = read('server', 'services', 'broadcast-campaign-worker.js');
  const service = read('server', 'services', 'whatsapp-service.js');
  assert.match(executor, /sendWhatsAppContent/);
  assert.match(executor, /broadcast:\$\{row\.campaign_id\}:\$\{row\.recipient_id\}/);
  assert.match(service, /idempotency_key = \?/);
  assert.doesNotMatch(read('server', 'worker.js'), /sendWhatsApp|EvolutionWhatsAppProvider|sendText/);
});

test('DISPAROS-2D resolve somente variáveis allowlistadas e não executa código', () => {
  const { resolveCampaignTemplate } = require('../services/broadcast-campaign-worker');
  assert.equal(resolveCampaignTemplate('Olá {{primeiro_nome}} {{empresa}}', { primeiro_nome: 'Ana', empresa: 'Kaizen' }), 'Olá Ana Kaizen');
  assert.equal(resolveCampaignTemplate('{{email}} {{nome}}', { email: 'ana@example.com' }), 'ana@example.com ');
  assert.throws(() => resolveCampaignTemplate('{{eval}}', {}), /INVALID_TEMPLATE_VARIABLE/);
  assert.equal(resolveCampaignTemplate('{{nome}}', {}), '');
});

test('DISPAROS-2D protege o contrato de receipts e mídia não validada', () => {
  const service = read('server', 'services', 'whatsapp-service.js');
  const executor = read('server', 'services', 'broadcast-campaign-worker.js');
  assert.match(service, /broadcast_campaign_recipients/);
  assert.match(service, /WHEN \? = 'read'/);
  assert.match(executor, /CAMPAIGN_MEDIA_NOT_AVAILABLE/);
  assert.match(executor, /recipient_phone/);
});
