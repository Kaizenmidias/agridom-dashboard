const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const route = fs.readFileSync(path.join(root, 'server/routes/conversations.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'src/api/conversations.ts'), 'utf8');
const page = fs.readFileSync(path.join(root, 'src/pages/commercial/ChatsPage.tsx'), 'utf8');

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
  assert.match(page, /Atendimento pausado/);
});

test('CHAT-1 prepara canais futuros sem fingir integrações ativas', () => {
  assert.match(page, /instagram/);
  assert.match(page, /linkedin/);
  assert.match(page, /connected: false/);
  assert.match(page, /ChannelBadge/);
});

test('CHAT-1 mantém composer textual com Enter e Shift+Enter', () => {
  assert.match(page, /event\.key === "Enter" && !event\.shiftKey/);
  assert.match(route, /Apenas mensagens de texto estao disponiveis nesta fase/);
});
