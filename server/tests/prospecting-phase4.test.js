const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const route = fs.readFileSync(path.join(__dirname, '..', 'routes', 'prospecting.js'), 'utf8');
const service = fs.readFileSync(path.join(__dirname, '..', 'services', 'prospecting-service.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pages', 'commercial', 'ProspectingPage.tsx'), 'utf8');

test('job valida ownership e persiste destination_folder_id quando uma lista é selecionada', () => {
  assert.match(route, /destinationFolderId/);
  assert.match(route, /FROM lead_folders WHERE id = \? AND owner_user_id = \?/);
  assert.match(route, /destination_folder_id/);
  assert.match(route, /await connection\.commit\(\)/);
});

test('worker usa a lista persistida e só cria membership para prospect novo', () => {
  assert.match(service, /job\.destination_folder_id/);
  assert.match(service, /result\.created && job\.destination_folder_id != null/);
  assert.match(service, /INSERT IGNORE INTO lead_folder_members/);
  assert.match(service, /membershipCreated/);
});

test('evento de pasta ocorre depois do commit e somente para membership nova', () => {
  const commitIndex = service.indexOf('await connection.commit();');
  const eventIndex = service.indexOf("type: 'lead.added_to_folder'");
  assert.ok(commitIndex >= 0 && eventIndex > commitIndex);
  assert.match(service, /membershipCreated\) \{/);
});

test('frontend exige lista e envia destinationFolderId selecionado', () => {
  assert.match(page, /leadFoldersAPI\.list\(\)/);
  assert.doesNotMatch(page, /<SelectItem value="none">Sem lista<\/SelectItem>/);
  assert.match(page, /destinationFolderId/);
  assert.match(page, /destinationFolderId \}/);
  assert.match(page, /destinationFolderId == null/);
  assert.match(page, /Selecione uma lista/);
});

test('Fase 4 não adiciona chamada real de provider', () => {
  assert.doesNotMatch(page, /fetch\(.*apify/i);
  assert.doesNotMatch(service, /Evolution|sendWhatsApp/i);
});
