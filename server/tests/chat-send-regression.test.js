const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EvolutionWhatsAppProvider, providerError } = require('../services/evolution-whatsapp-provider');
const { sniffMime } = require('../services/chat-media');
const { extractInbound } = require('../services/whatsapp-service');
const { getMediaRange, validateMedia, resolveStoragePath } = require('../services/chat-media');

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

test('inbound multimedia extraction covers media, caption, quote and unknown messages', () => {
  const types = [['imageMessage', 'image'], ['audioMessage', 'audio'], ['videoMessage', 'video'], ['documentMessage', 'document'], ['stickerMessage', 'sticker']];
  for (const [key, expected] of types) {
    const media = { mimetype: expected === 'image' ? 'image/jpeg' : 'application/octet-stream', caption: expected === 'image' ? 'Legenda' : undefined, fileLength: '12' };
    const parsed = extractInbound({ data: { key: { id: `${expected}-1`, remoteJid: '5511999999999@s.whatsapp.net', fromMe: false }, message: { [key]: media }, messageTimestamp: 1710000000 } });
    assert.equal(parsed.messageType, expected);
    assert.equal(parsed.media.size, 12);
    if (expected === 'image') assert.equal(parsed.text, 'Legenda');
  }
  const quoted = extractInbound({ data: { key: { id: 'text-1', remoteJid: '5511999999999@s.whatsapp.net' }, message: { extendedTextMessage: { text: 'Resposta', contextInfo: { stanzaId: 'quoted-1', participant: '5511888888888@s.whatsapp.net', quotedMessage: { conversation: 'Original' } } } } } });
  assert.equal(quoted.messageType, 'text');
  assert.equal(quoted.quoted.externalMessageId, 'quoted-1');
  assert.equal(quoted.quoted.text, 'Original');
  assert.equal(extractInbound({ data: { key: { id: 'unknown-1', remoteJid: '5511999999999@s.whatsapp.net' }, message: { pollCreationMessage: { name: 'Pesquisa' } } } }).messageType, 'unknown');
});

test('chat media protects ranges and generated storage paths', () => {
  assert.deepEqual(getMediaRange('bytes=10-19', 100), { start: 10, end: 19 });
  assert.deepEqual(getMediaRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.equal(getMediaRange('bytes=100-101', 100), 'invalid');
  assert.throws(() => resolveStoragePath('../secrets.txt'), /Arquivo de midia invalido/);
  assert.throws(() => validateMedia('image', 'application/pdf', 10), /Formato de arquivo/);
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
