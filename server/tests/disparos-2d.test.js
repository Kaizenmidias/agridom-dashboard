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

test('DISPAROS preserva a etapa e a causa segura de falhas antes do HTTP', () => {
  const worker = require('../services/broadcast-campaign-worker');
  const error = Object.assign(new Error('credencial invalida'), { code: 'EVOLUTION_CREDENTIAL_DECRYPT_FAILED', stage: 'decrypt' });
  assert.deepEqual(worker.safeWorkerError(error), { name: 'Error', code: 'EVOLUTION_CREDENTIAL_DECRYPT_FAILED', stage: 'decrypt', message: 'EVOLUTION_CREDENTIAL_DECRYPT_FAILED', providerStatus: null, providerOperation: null, providerMessage: null, undefinedIndexes: null, parameterCount: null });
  assert.match(read('server', 'services', 'whatsapp-service.js'), /stage: 'decrypt'/);
  assert.match(read('server', 'services', 'whatsapp-service.js'), /stage: 'configuration'/);
  assert.match(read('server', 'services', 'whatsapp-service.js'), /stage: 'persistence'/);
});

test('DISPAROS identifica o nome do bind indefinido sem registrar valores', () => {
  const { assertNoUndefinedBindings } = require('../services/whatsapp-service');
  assert.throws(() => assertNoUndefinedBindings('loadEvolutionConfig', { integrationProviderId: undefined }, { campaignId: 13, recipientId: 23, communicationAccountId: 1 }), (error) => {
    assert.equal(error.code, 'BROADCAST_SQL_BIND_UNDEFINED');
    assert.equal(error.stage, 'persistence');
    assert.deepEqual(error.bindingFields, ['integrationProviderId']);
    return true;
  });
});

test('database guard reports only undefined indexes and preserves caller stack', () => {
  const { DatabaseUndefinedBindError, assertNoUndefinedExecuteParams } = require('../config/database');
  assert.throws(() => assertNoUndefinedExecuteParams([1, undefined, null]), (error) => {
    assert.ok(error instanceof DatabaseUndefinedBindError);
    assert.deepEqual(error.undefinedIndexes, [1]);
    assert.equal(error.parameterCount, 3);
    assert.match(error.stack, /assertNoUndefinedExecuteParams/);
    return true;
  });
});
