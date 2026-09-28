const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EvolutionWhatsAppProvider } = require('../services/evolution-whatsapp-provider');
const { extractInbound, extractDeliveryStatus, deliveryUpdates, formatWhatsAppParticipantPhone, participantContractSummary } = require('../services/whatsapp-service');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'database/migrations/20260928_chat_3c_whatsapp_metadata.sql'), 'utf8');
const participantMigration = fs.readFileSync(path.join(root, 'database/migrations/20260928_chat_3c_participant_details.sql'), 'utf8');
const capabilities = fs.readFileSync(path.join(root, 'src/lib/channel-capabilities.ts'), 'utf8');
const chats = fs.readFileSync(path.join(root, 'src/pages/commercial/ChatsPage.tsx'), 'utf8');
const chatMessage = fs.readFileSync(path.join(root, 'src/components/commercial/ChatMessage.tsx'), 'utf8');
const conversationsRoute = fs.readFileSync(path.join(root, 'server/routes/conversations.js'), 'utf8');
const whatsappService = fs.readFileSync(path.join(root, 'server/services/whatsapp-service.js'), 'utf8');

test('CHAT-3C centralizes truthful channel capabilities', () => {
  assert.match(capabilities, /whatsapp:[\s\S]*canSendText: true/);
  assert.match(capabilities, /canUseGroups: true/);
  assert.match(capabilities, /canFetchProfilePicture: true/);
  assert.match(capabilities, /canShowPresence: false/);
  assert.match(capabilities, /canStartVoiceCall: false/);
  assert.match(capabilities, /canReact: false/);
  assert.match(chats, /getChannelCapabilities/);
  assert.match(chatMessage, /capabilities\.canReply/);
  assert.match(chatMessage, /capabilities\.canShowReadReceipts/);
});

test('CHAT-3C provider uses official Evolution 2.3.7 profile and group routes', async () => {
  const provider = new EvolutionWhatsAppProvider({ baseUrl: 'https://evolution.example.com', apiKey: 'test-key' });
  const calls = [];
  provider.request = async (method, requestPath, body) => { calls.push({ method, requestPath, body }); return requestPath.includes('fetchProfilePictureUrl') ? { profilePictureUrl: 'https://cdn.example.com/avatar.jpg' } : requestPath.includes('/participants/') ? [{ id: 'masked' }] : { subject: 'Equipe' }; };
  const profile = await provider.fetchProfilePicture('kaizen-main', '5511000000000');
  const group = await provider.findGroup('kaizen-main', '120000000000@g.us');
  const participants = await provider.findGroupParticipants('kaizen-main', '120000000000@g.us');
  assert.equal(profile.profilePictureUrl, 'https://cdn.example.com/avatar.jpg');
  assert.equal(group.name, 'Equipe');
  assert.deepEqual(calls[0], { method: 'POST', requestPath: '/chat/fetchProfilePictureUrl/kaizen-main', body: { number: '5511000000000' } });
  assert.match(calls[1].requestPath, /^\/group\/findGroupInfos\/kaizen-main\?groupJid=/);
  assert.match(calls[2].requestPath, /^\/group\/participants\/kaizen-main\?groupJid=/);
  assert.deepEqual(participants, [{ id: 'masked' }]);
});

test('CHAT-3C detects groups without deriving a lead phone', () => {
  const parsed = extractInbound({ data: { key: { id: 'group-message-1', remoteJid: '120000000000@g.us', participant: '5511000000000@s.whatsapp.net' }, pushName: 'Participante', message: { conversation: 'Olá, grupo' } } });
  assert.equal(parsed.isGroup, true);
  assert.equal(parsed.remoteJid, '120000000000@g.us');
  assert.equal(parsed.externalSenderId, '5511000000000@s.whatsapp.net');
  assert.match(whatsappService, /const lead = parsed\.isGroup \? null : await findOrCreateLead/);
  assert.match(whatsappService, /senderName: parsed\.isGroup \? parsed\.pushName : null/);
});

test('CHAT-3C maps only real receipt states', () => {
  assert.equal(extractDeliveryStatus({ data: { status: 2 } }), 'sent');
  assert.equal(extractDeliveryStatus({ data: { status: 3 } }), 'delivered');
  assert.equal(extractDeliveryStatus({ data: { status: 4 } }), 'read');
  assert.equal(extractDeliveryStatus({ data: { status: 5 } }), 'failed');
  assert.equal(extractDeliveryStatus({ data: { status: 'unknown' } }), null);
  assert.equal(extractDeliveryStatus({ data: { status: 'SERVER_ACK' } }), 'sent');
  assert.equal(extractDeliveryStatus({ data: { status: 'DELIVERY_ACK' } }), 'delivered');
  assert.deepEqual(deliveryUpdates({ data: { messageId: 'real-id', status: 'READ' } }), [{ externalMessageId: 'real-id', status: 'read' }]);
  for (const label of ['Enviando', 'Enviado', 'Entregue', 'Lido', 'Falha ao enviar']) assert.match(chatMessage, new RegExp(label));
});

test('CHAT-3C avatar cache is bounded, lazy and failure-safe', () => {
  assert.match(conversationsRoute, /PROFILE_TTL_HOURS = 12/);
  assert.match(conversationsRoute, /profile_picture_updated_at < UTC_TIMESTAMP\(\) - INTERVAL/);
  assert.match(conversationsRoute, /profileRefreshes/);
  assert.match(conversationsRoute, /validProfilePictureUrl/);
  assert.match(chats, /refreshProfile\(detail\.id\)/);
  assert.match(chats, /AvatarFallback/);
  assert.doesNotMatch(chats, /apikey|apiKey/);
});

test('CHAT-3C migration is additive and MySQL-compatible', () => {
  for (const column of ['conversation_type', 'display_name', 'profile_picture_url', 'profile_picture_updated_at', 'participant_count', 'sender_name']) assert.match(migration, new RegExp(column));
  assert.match(migration, /CREATE TABLE IF NOT EXISTS conversation_participants/);
  assert.match(migration, /uq_conversation_participant/);
  assert.match(migration, /information_schema\.COLUMNS/);
  assert.doesNotMatch(migration, /ADD COLUMN IF NOT EXISTS/i);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE|DELETE FROM/i);
});

test('CHAT-3C participant details remain safe and presentation-ready', () => {
  assert.equal(formatWhatsAppParticipantPhone('5513999999999@s.whatsapp.net'), '+55 13 99999-9999');
  assert.equal(formatWhatsAppParticipantPhone('447911123456@s.whatsapp.net'), '+447911123456');
  assert.match(participantMigration, /ADD COLUMN phone/);
  assert.match(participantMigration, /ADD COLUMN profile_picture_url/);
  assert.match(conversationsRoute, /fetchProfilePicture\(conversation\.external_instance_id, participant\.externalId\)/);
  assert.match(chats, /Buscar participante/);
  assert.match(chats, /profilePictureUrl/);
  assert.doesNotMatch(chats, /@s\.whatsapp\.net/);
});

test('CHAT-3C preserves explicit PN mappings and does not convert LIDs to phones', () => {
  const lid = participantContractSummary({ id: 'lid-fixture@lid', admin: 'admin' });
  assert.equal(lid.identifierType, 'lid');
  assert.equal(lid.hasPhoneMapping, false);
  const mapped = participantContractSummary({ id: 'lid-fixture@lid', participantAlt: '5513999999999@s.whatsapp.net', name: 'Contato fixture', imgUrl: 'https://cdn.example/avatar' });
  assert.equal(mapped.hasPhoneMapping, true);
  assert.equal(mapped.hasAvatarCandidate, true);
  const parsed = extractInbound({ data: { key: { id: 'group-fixture', remoteJid: 'group-fixture@g.us', participant: 'lid-fixture@lid', participantAlt: '5513999999999@s.whatsapp.net' }, pushName: 'Contato fixture', message: { conversation: 'Mensagem fixture' } } });
  assert.equal(parsed.externalSenderId, '5513999999999@s.whatsapp.net');
  assert.equal(parsed.participantId, 'lid-fixture@lid');
  assert.equal(parsed.participantAlt, '5513999999999@s.whatsapp.net');
  assert.match(whatsappService, /enrichGroupParticipantFromMessage/);
});
