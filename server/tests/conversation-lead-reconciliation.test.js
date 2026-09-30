const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const whatsapp = fs.readFileSync(path.join(__dirname, '../services/whatsapp-service.js'), 'utf8');
const conversations = fs.readFileSync(path.join(__dirname, '../routes/conversations.js'), 'utf8');
const reconciliation = fs.readFileSync(path.join(__dirname, '../scripts/reconcile-conversation-leads.js'), 'utf8');
const origin = fs.readFileSync(path.join(__dirname, '../scripts/reconcile-prospecting-origin.js'), 'utf8');

test('conversas individuais resolvem prospect por telefone normalizado e owner', () => {
  assert.match(whatsapp, /@\(\?:s\\\.whatsapp\\\.net\|c\\\.us\)/);
  assert.match(whatsapp, /owner_user_id = \? AND normalized_phone = \?/);
  assert.match(whatsapp, /lead_id IS NULL/);
  assert.match(whatsapp, /UPDATE conversations SET lead_id = \?/);
});

test('grupos, conflitos e heurísticas inseguras não são associados', () => {
  assert.match(whatsapp, /if \(!metadata\.isGroup/);
  assert.match(reconciliation, /conversation_type <> 'group'/);
  assert.match(reconciliation, /@g\.us/);
  assert.match(whatsapp, /ON DUPLICATE KEY UPDATE conversation_type/);
  assert.doesNotMatch(whatsapp, /business_name.*normalized_phone.*email/);
});

test('bootstrap continua baseado em lead_id e mensagens agregadas sem N+1', () => {
  const route = fs.readFileSync(path.join(__dirname, '../routes/prospection.js'), 'utf8');
  assert.match(route, /c\.lead_id IS NOT NULL/);
  assert.match(route, /MAX\(COALESCE\(cm\.sent_at, cm\.created_at\)\)/);
  assert.match(route, /GROUP BY c\.lead_id/);
  assert.doesNotMatch(route, /normalized_phone.*conversations|conversations.*normalized_phone/i);
});

test('reconciliações são dry-run por padrão, transacionais e não criam prospects', () => {
  assert.match(reconciliation, /apply: argv\.includes\('--apply'\)/);
  assert.match(reconciliation, /connection\.beginTransaction\(\)/);
  assert.match(reconciliation, /connection\.rollback\(\)/);
  assert.doesNotMatch(reconciliation, /INSERT INTO prospects/);
  assert.doesNotMatch(reconciliation, /Evolution|Apify/i);
  assert.match(origin, /p\.origin IS NULL/);
  assert.match(origin, /SET p\.origin = 'Scraping'/);
  assert.match(origin, /connection\.beginTransaction\(\)/);
  assert.doesNotMatch(origin, /UPDATE prospects p.*origin = 'Manual'/s);
});

test('ownership de leitura e mutação das conversas usa communication_accounts.owner_user_id', () => {
  assert.match(conversations, /ca\.owner_user_id = \?/g);
  assert.match(conversations, /JOIN communication_accounts ca ON ca\.id = c\.communication_account_id/);
  assert.match(conversations, /WHERE c\.id = \? AND ca\.owner_user_id = \?/);
});
