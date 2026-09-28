const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const route = fs.readFileSync(path.join(root, 'server/routes/conversations.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/api/conversations.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/pages/commercial/ChatsPage.tsx'), 'utf8');
const composer = fs.readFileSync(path.join(root, 'src/components/commercial/MessageComposer.tsx'), 'utf8');

test('CHAT-1 persiste filtros, busca, leitura e contexto da conversa', () => {
  assert.match(route, /communication_messages sm/);
  assert.match(route, /c\.unread_count > 0/);
  assert.match(route, /router\.patch\('\/:id\/read'/);
  assert.match(route, /router\.get\('\/:id\/activities'/);
  assert.match(api, /markRead/);
  assert.match(api, /activities/);
});

test('CHAT-1 protege a devolução para IA quando não há agente configurado', () => {
  assert.match(route, /Nenhum agente de IA configurado para esta conversa/);
  assert.match(route, /conversation\.ai_agent_id/);
  assert.match(page, /Atendimento humano/);
  assert.match(page, /Nenhum agente de IA configurado/);
  assert.doesNotMatch(page, /Pausar atendimento/);
});

test('CHAT-1 prepara canais futuros sem fingir integrações ativas', () => {
  assert.match(page, /instagram/);
  assert.match(page, /linkedin/);
  assert.match(page, /connected: false/);
  assert.match(page, /ChannelBadge/);
});

test('CHAT-3D inbox persists pin, archive, manual unread, soft delete and stars', () => {
  const route = fs.readFileSync(path.resolve(__dirname, '../routes/conversations.js'), 'utf8');
  const migration = fs.readFileSync(path.resolve(__dirname, '../../database/migrations/20260929_chat_3d_inbox.sql'), 'utf8');
  assert.match(route, /router\.patch\('\/:id\/pin'/);
  assert.match(route, /router\.patch\('\/:id\/archive'/);
  assert.match(route, /router\.patch\('\/:id\/unread'/);
  assert.match(route, /router\.patch\('\/:id\/messages\/:messageId\/star'/);
  assert.match(route, /deletionMode: 'soft_delete'/);
  assert.match(route, /c\.pinned_at IS NULL/);
  assert.match(migration, /pinned_at/);
  assert.match(migration, /manual_unread/);
  assert.match(migration, /starred_at/);
  assert.doesNotMatch(route, /DELETE FROM conversations/);
});

test('CHAT-1 mantém composer textual com Enter e Shift+Enter', () => {
  assert.match(composer, /event\.key === "Enter" && !event\.shiftKey/);
  assert.match(route, /MESSAGE_TYPE_NOT_SUPPORTED/);
});
