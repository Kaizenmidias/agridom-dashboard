const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EvolutionWhatsAppProvider, providerError } = require('../services/evolution-whatsapp-provider');
const { sniffMime } = require('../services/chat-media');

const root = path.resolve(__dirname, '../..');
const routeSource = fs.readFileSync(path.join(root, 'server/routes/conversations.js'), 'utf8');
const providerSource = fs.readFileSync(path.join(root, 'server/services/evolution-whatsapp-provider.js'), 'utf8');
const serviceSource = fs.readFileSync(path.join(root, 'server/services/whatsapp-service.js'), 'utf8');
const webhookSource = fs.readFileSync(path.join(root, 'server/routes/webhooks.js'), 'utf8');

test('chat send exposes a safe diagnostic code while preserving the retry contract', () => {
  assert.match(routeSource, /responseStatus = error\?\.retryable === false \? 409 : 502/);
  assert.match(routeSource, /res\.status\(responseStatus\)\.json\(\{ error: error\?\.publicMessage .* code: errorCode \}\)/);
  assert.match(routeSource, /conversationId: Number\(conversation\.id\)/);
  assert.match(routeSource, /communicationAccountId: Number\(conversation\.communication_account_id\)/);
  assert.match(routeSource, /providerStatus: error\?\.providerStatus/);
  assert.doesNotMatch(routeSource, /console\.error\([^\n]*text/);
  assert.doesNotMatch(routeSource, /console\.error\([^\n]*apiKey/);
});

test('Evolution provider sends the v2 text payload and never exposes credentials in errors', async () => {
  const provider = new EvolutionWhatsAppProvider({ baseUrl: 'https://evolution.example.com', apiKey: 'secret-key' });
  let captured;
  provider.request = async (method, requestPath, body) => { captured = { method, requestPath, body }; return { key: { id: 'provider-message-1' } }; };
  const result = await provider.sendText('kaizen-main', '5513999998888@s.whatsapp.net', 'Ola');
  assert.deepEqual(captured, { method: 'POST', requestPath: '/message/sendText/kaizen-main', body: { number: '5513999998888@s.whatsapp.net', text: 'Ola', linkPreview: false } });
  assert.equal(result.externalMessageId, 'provider-message-1');

  const error = providerError('API Key da Evolution recusada.', 'EVOLUTION_AUTH_FAILED', false, { status: 401, response: { data: { message: 'secret-key rejected' } } });
  assert.equal(error.code, 'EVOLUTION_AUTH_FAILED');
  assert.equal(error.providerStatus, 401);
  assert.doesNotMatch(error.providerDetail, /secret-key/);
});

test('chat media validates signatures instead of trusting only the browser MIME', () => {
  assert.equal(sniffMime(Buffer.from('%PDF-1.7')), 'application/pdf');
  assert.equal(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffMime(Buffer.from('not-a-known-media')), null);
});

test('chat send keeps the explicit guards for missing conversation, text and connection', () => {
  assert.match(routeSource, /if \(!conversation\) return res\.status\(404\)/);
  assert.match(routeSource, /requestedType === 'text' && \(!text \|\| text\.length > 10000\)/);
  assert.match(routeSource, /ca\.status AS account_status/);
  assert.match(serviceSource, /account\.account_status \?\? account\.status/);
  assert.match(webhookSource, /sanitizeWebhookData/);
  assert.match(providerSource, /EVOLUTION_AUTH_FAILED/);
  assert.match(providerSource, /EVOLUTION_UNAVAILABLE/);
});
