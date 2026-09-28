const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EvolutionWhatsAppProvider } = require('../services/evolution-whatsapp-provider');
const { extractInbound, extractDeliveryStatus } = require('../services/whatsapp-service');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'database/migrations/20260928_chat_3c_whatsapp_metadata.sql'), 'utf8');
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
  provider.request = async (method, requestPath, body) => { calls.push({ method, requestPath, body }); return requestPath.includes('fetchProfilePictureUrl') ? { profilePictureUrl: 'https://cdn.example.com/avatar.jpg' } : { subject: 'Equipe', participants: [{ id: 'masked' }] }; };
  const profile = await provider.fetchProfilePicture('kaizen-main', '5511000000000');
  const group = await provider.findGroup('kaizen-main', '120000000000@g.us');
  assert.equal(profile.profilePictureUrl, 'https://cdn.example.com/avatar.jpg');
  assert.equal(group.name, 'Equipe');
  assert.deepEqual(calls[0], { method: 'POST', requestPath: '/chat/fetchProfilePictureUrl/kaizen-main', body: { number: '5511000000000' } });
  assert.match(calls[1].requestPath, /^\/group\/findGroupInfos\/kaizen-main\?groupJid=/);
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
  for (const label of ['Enviando', 'Enviado', 'Entregue', 'Lido', 'Falha ao enviar']) assert.match(chatMessage, new RegExp(label));
});

test('CHAT-3C avatar cache is bounded, lazy and failure-safe', () => {
  assert.match(conversationsRoute, /PROFILE_TTL_HOURS = 12/);
  assert.match(conversationsRoute, /profile_picture_updated_at < UTC_TIMESTAMP\(\) - INTERVAL/);
  assert.match(conversationsRoute, /profileRefreshes/);
  assert.match(conversationsRoute, /validProfilePictureUrl/);
  assert.match(chats, /if \(!detail\?\.profile_picture_stale\) return/);
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
