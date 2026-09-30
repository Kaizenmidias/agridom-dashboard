const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const route = fs.readFileSync(path.join(__dirname, '../routes/prospection.js'), 'utf8');
const prospecting = fs.readFileSync(path.join(__dirname, '../services/prospecting-service.js'), 'utf8');
const prospectService = require('../services/prospect-service');
const prospectingPage = fs.readFileSync(path.join(__dirname, '../../src/pages/commercial/ProspectingPage.tsx'), 'utf8');
const leadsPage = fs.readFileSync(path.join(__dirname, '../../src/pages/commercial/LeadsPage.tsx'), 'utf8');

test('PROSPECCAO reconhece somente email/email[0], sem enriquecimento inventado', () => {
  const { normalize } = require('../services/prospecting-service');
  assert.equal(normalize({ title: 'Empresa', email: 'contato@empresa.test' }).email, 'contato@empresa.test');
  assert.equal(normalize({ title: 'Empresa', emails: ['financeiro@empresa.test'] }).email, 'financeiro@empresa.test');
  assert.equal(normalize({ title: 'Empresa', website: 'empresa.test' }).email, null);
});

test('PROSPECCAO preserva email existente ao deduplicar e distingue Manual/Scraping', () => {
  const input = prospectService.buildInsertValues({ ownerUserId: 1, businessName: 'Empresa', phone: '5511999999999', email: 'a@b.test', origin: 'Manual' });
  assert.equal(input.values[10], 'a@b.test');
  assert.equal(input.values[16], 'Manual');
  assert.match(prospecting, /origin:\s*'Scraping'/);
  assert.match(route, /origin:\s*'Manual'/);
  assert.match(fs.readFileSync(path.join(__dirname, '../scripts/reprocess-prospecting-results.js'), 'utf8'), /origin:\s*'Scraping'/);
  assert.match(prospectService.createOrFindProspect.toString(), /if \(existing\) return \{ prospect: existing/);
});

test('Leads usa listas reais com fallback e resumo de múltiplas listas', () => {
  assert.match(leadsPage, /lead\.folders\?\.length/);
  assert.match(leadsPage, /Sem lista/);
  assert.match(leadsPage, /lead\.folders\[0\]\.name/);
  assert.match(leadsPage, /lead\.folders\.length > 1/);
  assert.doesNotMatch(leadsPage, /lead\.category \|\| "Sem categoria"/);
  assert.match(route, /lead_folder_members m JOIN lead_folders f/);
  assert.match(route, /JSON_ARRAYAGG\(JSON_OBJECT/);
  assert.match(route, /f\.owner_user_id = \?/);
});

test('Bootstrap agrega listas e último contato em lote, com Chats reais e ownership', () => {
  assert.match(route, /conversations c JOIN communication_messages cm ON cm\.conversation_id = c\.id/);
  assert.match(route, /communication_accounts ca ON ca\.id = c\.communication_account_id/);
  assert.match(route, /c\.lead_id IS NOT NULL AND ca\.owner_user_id = \?/);
  assert.match(route, /MAX\(COALESCE\(cm\.sent_at, cm\.created_at\)\)/);
  assert.match(route, /WHERE p\.owner_user_id = \?/);
  assert.doesNotMatch(route, /SELECT .*FROM conversations.*WHERE .*business_name/i);
  assert.doesNotMatch(route, /SELECT .*FROM communication_messages.*WHERE .*email/i);
});

test('UX de prospecção não expõe validação WhatsApp nem Evolution', () => {
  assert.doesNotMatch(prospectingPage, /onlyValidatedWhatsApp|disabledWhatsApp/);
  assert.doesNotMatch(prospectingPage, /possiveis duplicados para revisar e importar/);
  assert.match(prospectingPage, /Adicionar selecionados à lista/);
  assert.doesNotMatch(prospectingPage, /Evolution|evolution/i);
});
