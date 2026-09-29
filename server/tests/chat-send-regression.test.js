const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EvolutionWhatsAppProvider, providerError } = require('../services/evolution-whatsapp-provider');
const { sniffMime } = require('../services/chat-media');
const { extractInbound, extractDeliveryStatus, normalizePhone, resolveWhatsAppDestination } = require('../services/whatsapp-service');
const { getMediaRange, validateMedia, resolveStoragePath } = require('../services/chat-media');

const root = path.resolve(__dirname, '../..');
const routeSource = fs.readFileSync(path.join(root, 'server/routes/conversations.js'), 'utf8');
const providerSource = fs.readFileSync(path.join(root, 'server/services/evolution-whatsapp-provider.js'), 'utf8');
const serviceSource = fs.readFileSync(path.join(root, 'server/services/whatsapp-service.js'), 'utf8');
const webhookSource = fs.readFileSync(path.join(root, 'server/routes/webhooks.js'), 'utf8');
const chatMessageSource = fs.readFileSync(path.join(root, 'src/components/commercial/ChatMessage.tsx'), 'utf8');
const chatsPageSource = fs.readFileSync(path.join(root, 'src/pages/commercial/ChatsPage.tsx'), 'utf8');
const composerSource = fs.readFileSync(path.join(root, 'src/components/commercial/MessageComposer.tsx'), 'utf8');
const indexCss = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');

test('chat send exposes a safe diagnostic code while preserving the retry contract', () => {
  assert.match(routeSource, /isForeignKeyError = error\?\.code === 'ER_NO_REFERENCED_ROW_2'/);
  assert.match(routeSource, /responseStatus = isForeignKeyError \? 500 : error\?\.retryable === false \? 409 : 502/);
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
  assert.equal(error.providerMessage, 'REDACTED rejected');
});

test('Evolution 400 diagnostics extract object, nested and string response bodies safely', () => {
  const cases = [
    { data: { status: 400, error: 'Bad Request', message: ['destination invalid'] }, message: 'destination invalid' },
    { data: { response: { message: ['invalid number'] } }, message: 'invalid number' },
    { data: 'Bad Request', message: 'Bad Request' },
  ];
  for (const item of cases) {
    const error = providerError('A Evolution recusou a operacao.', 'EVOLUTION_REQUEST_FAILED', false, { status: 400, response: { data: item.data }, config: { method: 'post', url: 'https://evolution.example.com/message/sendText/instance-1', data: { number: '5511999999999', text: 'Ola', linkPreview: false } } });
    assert.equal(error.providerStatus, 400);
    assert.match(error.providerMessage, new RegExp(item.message));
    assert.deepEqual(error.providerRequestShape, { endpoint: '/message/sendText/instance-1', payloadKeys: ['linkPreview', 'number', 'text'], hasNumber: true, numberLength: 13, numberCountryPrefix: '55', hasText: true, textLength: 3, instancePresent: true });
  }
});

test('Evolution diagnostics redact credential-like response content', () => {
  const error = providerError('A Evolution recusou a operacao.', 'EVOLUTION_REQUEST_FAILED', false, { status: 400, response: { data: { message: 'apikey=abc token=xyz authorization=Bearer secret password=pass credential=cred' } } });
  assert.doesNotMatch(error.providerMessage, /abc|xyz|Bearer|secret|pass|cred/);
  assert.match(error.providerMessage, /REDACTED/);
});

test('Evolution provider builds the v2 media payload without a data URL prefix', async () => {
  const provider = new EvolutionWhatsAppProvider({ baseUrl: 'https://evolution.example.com', apiKey: 'secret-key' });
  let captured;
  provider.request = async (method, requestPath, body) => { captured = { method, requestPath, body }; return { key: { id: 'image-1' } }; };
  await provider.sendMedia('kaizen-main', { number: '5513999998888', mediaType: 'image', mimeType: 'image/jpeg', media: 'aGVsbG8=', filename: 'foto.jpg', caption: 'Legenda' });
  assert.deepEqual(captured, { method: 'POST', requestPath: '/message/sendMedia/kaizen-main', body: { number: '5513999998888', mediatype: 'image', mimetype: 'image/jpeg', media: 'aGVsbG8=', fileName: 'foto.jpg', caption: 'Legenda', quoted: undefined } });
});

test('WhatsApp destination resolution accepts phones and never treats a LID as a phone', () => {
  assert.equal(normalizePhone('5511999999999'), '5511999999999');
  assert.equal(normalizePhone('5511999999999@s.whatsapp.net'), '5511999999999');
  assert.equal(normalizePhone('(11) 99999-9999'), '5511999999999');
  assert.equal(normalizePhone('+14155552671'), '14155552671');
  assert.equal(normalizePhone('12345678901234567890@lid'), null);
  assert.equal(resolveWhatsAppDestination({ recipient: '12345678901234567890@lid', lead: { phone: '11999999999' } }), '5511999999999');
  assert.throws(() => resolveWhatsAppDestination({ recipient: '12345678901234567890@lid' }), /WHATSAPP_DESTINATION_UNRESOLVED/);
  assert.throws(() => resolveWhatsAppDestination({ recipient: '' }), /WHATSAPP_DESTINATION_UNRESOLVED/);
});

test('inbound extraction prefers a verified alternate phone JID over a LID', () => {
  const parsed = extractInbound({ data: { key: { id: 'lid-message', remoteJid: '12345678901234567890@lid', remoteJidAlt: '5511999999999@s.whatsapp.net', fromMe: false }, message: { conversation: 'Ola' } } });
  assert.equal(parsed.phone, '5511999999999');
  assert.equal(parsed.participantAlt, '5511999999999@s.whatsapp.net');
});

test('outbound replies only persist a quoted foreign key when the message belongs to the conversation', () => {
  assert.match(serviceSource, /const resolvedQuotedMessageId = quoted \? Number\(quotedMessageId\) : null/);
  assert.match(serviceSource, /quotedMessageId: resolvedQuotedMessageId/);
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

test('Evolution delivery updates map only known provider states', () => {
  assert.equal(extractDeliveryStatus({ data: { key: { id: 'm1' }, update: { status: 'DELIVERY' } } }), 'delivered');
  assert.equal(extractDeliveryStatus({ data: { key: { id: 'm1' }, status: 'READ' } }), 'read');
  assert.equal(extractDeliveryStatus({ data: { key: { id: 'm1' }, status: 'unknown' } }), null);
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

test('video messages fetch the protected media route with the bearer token and render a video player', () => {
  assert.match(chatMessageSource, /type === "video" \? <video/);
  assert.match(chatMessageSource, /Authorization: `Bearer \$\{token\}`/);
  assert.match(chatMessageSource, /URL\.createObjectURL/);
  assert.match(chatMessageSource, /URL\.revokeObjectURL/);
  assert.match(chatMessageSource, /<video className=.*controls playsInline/);
});

test('chat media types use one authenticated blob URL without JWT query parameters', () => {
  assert.match(chatMessageSource, /useAuthenticatedMediaUrl/);
  assert.match(chatMessageSource, /\["image", "video", "audio", "document", "sticker"\]/);
  assert.match(chatMessageSource, /download=\{message\.media_filename/);
  assert.doesNotMatch(chatMessageSource, /[?&](?:token|jwt)=/i);
  assert.match(chatMessageSource, /useAuthenticatedMediaUrl\(url, protectedMedia/);
  assert.match(chatMessageSource, /src=\{objectUrl \|\| undefined\}/);
});

test('CHAT-3A resolves every profile icon used after removing paused handling', () => {
  assert.match(chatsPageSource, /import \{[^\n]*\bUserRound\b[^\n]*\} from "lucide-react"/);
  assert.doesNotMatch(chatsPageSource, /<Pause\b/);
  assert.match(chatsPageSource, /<UserRound className=/);
});

test('CHAT-3 searches messages inside one authenticated conversation without loading all history', () => {
  assert.match(routeSource, /router\.get\('\/:id\/messages\/search'/);
  assert.match(routeSource, /conversation_id = \? AND body_text LIKE \?/);
  assert.match(routeSource, /LIMIT \?/);
  assert.match(routeSource, /total: Number\(countRows\[0\]\?\.total/);
});

test('CHAT-3B reuses lead budget, normalized labels and paginated shared content', () => {
  assert.match(routeSource, /JSON_EXTRACT\(p\.analysis_report, '\$\.budget'\)/);
  assert.match(routeSource, /prospect_labels pl JOIN lead_labels ll/);
  assert.match(routeSource, /router\.get\('\/:id\/shared'/);
  assert.match(routeSource, /\['media', 'documents', 'links'\]/);
  assert.doesNotMatch(routeSource, /media_storage_path[^\n]*shared/);
});

test('CHAT-3B shared media opens an authenticated keyboard-accessible lightbox', () => {
  assert.match(chatsPageSource, /function SharedMediaViewer/);
  assert.match(chatsPageSource, /useAuthenticatedMediaUrl\(conversationMediaUrl\(conversationId, item\.id\), !cachedUrl/);
  assert.match(chatsPageSource, /event\.key === "Escape"/);
  assert.match(chatsPageSource, /event\.key === "ArrowLeft"/);
  assert.match(chatsPageSource, /event\.key === "ArrowRight"/);
  assert.match(chatsPageSource, /disabled=\{index === 0\}/);
  assert.match(chatsPageSource, /disabled=\{index === total - 1\}/);
  assert.doesNotMatch(chatsPageSource, /[?&](?:token|jwt)=/i);
});

test('CHAT-3A supports safe drag, drop, paste, date separators and sequential uploads', () => {
  assert.match(chatsPageSource, /onDragEnter=/);
  assert.match(chatsPageSource, /onDrop=/);
  assert.match(chatsPageSource, /onPaste=/);
  assert.match(chatsPageSource, /for \(const file of pendingFiles\)/);
  assert.match(chatsPageSource, /dayLabel\(message\.created_at\)/);
  assert.match(chatsPageSource, /Nenhum agente de IA configurado/);
  assert.doesNotMatch(chatsPageSource, /Pausar atendimento/);
});

test('CHAT-3A composer inserts Unicode emoji at the current cursor position', () => {
  assert.match(composerSource, /selectionStart/);
  assert.match(composerSource, /setSelectionRange/);
  assert.match(composerSource, /Adicionar emoji/);
  assert.match(composerSource, /emojiGroups/);
});

test('CHAT-3B expands emoji categories and keeps one visible attachment entry point', () => {
  for (const category of ['Recentes', 'Smileys e pessoas', 'Animais e natureza', 'Comidas e bebidas', 'Atividades', 'Viagens e lugares', 'Objetos', 'Símbolos', 'Bandeiras']) assert.match(composerSource, new RegExp(category));
  assert.match(composerSource, /chat_recent_emojis/);
  assert.match(composerSource, /mediaAccept = .*\.pdf/);
  assert.match(indexCss, /button\[aria-label="Adicionar documento"\][^{]*\{\s*display: none/);
});

test('CHAT-3B renders inbound stickers through authenticated WebP-capable media', () => {
  assert.match(serviceSource, /\['stickerMessage', 'sticker'\]/);
  assert.match(chatMessageSource, /"image", "video", "audio", "document", "sticker"/);
  assert.match(chatMessageSource, /type === "sticker" \? <img src=\{objectUrl/);
});

test('CHAT-3B panel edits shared lead budget and labels without parallel storage', () => {
  assert.match(chatsPageSource, /Valor do orçamento/);
  assert.match(chatsPageSource, /commercialEntitiesAPI\.setLeadLabels/);
  assert.match(chatsPageSource, /Responsável pelo atendimento/);
  assert.match(chatsPageSource, /SharedContentDialog/);
  assert.doesNotMatch(chatsPageSource, /chat_budget|conversation_budget/);
});
