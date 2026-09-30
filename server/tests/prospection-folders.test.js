const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');

test('PROSPECCAO importa para uma lista real com transacao, ownership e deduplicacao', () => {
  const route = read('server', 'routes', 'prospection.js');
  const api = read('src', 'api', 'prospection.ts');
  const page = read('src', 'pages', 'ProspeccaoPage.tsx');
  assert.match(route, /router\.post\('\/prospects\/import-to-folder'/);
  assert.match(route, /SELECT id, name FROM lead_folders WHERE id = \? AND owner_user_id = \?/);
  assert.match(route, /SELECT id, analysis_report FROM prospects WHERE owner_user_id = \?/);
  assert.match(route, /INSERT IGNORE INTO lead_folder_members/);
  assert.match(route, /type: 'lead\.added_to_folder'/);
  assert.match(route, /idempotencyKey: `lead-folder:\${folderId}:\${lead\.id}`/);
  assert.match(api, /importToFolder\(prospectIds: number\[\], folderId: number\)/);
  assert.match(page, /leadFoldersAPI\.list\(\)/);
  assert.match(page, /prospectionAPI\.importToFolder/);
});

test('PROSPECCAO preserva o fluxo desacoplado: a importacao apenas emite evento de membership', () => {
  const route = read('server', 'routes', 'prospection.js');
  const importedBlock = route.slice(route.indexOf("router.post('/prospects/import-to-folder'"), route.indexOf("router.put('/settings'"));
  assert.doesNotMatch(importedBlock, /automation\/runs|whatsapp|Evolution/i);
  assert.match(importedBlock, /added_to_folder/);
});

test('PROSPECCAO oferece selecao persistente e page sizes na tabela, sem lista no formulario de busca', () => {
  const page = read('src', 'pages', 'ProspeccaoPage.tsx');
  const searchSection = page.slice(page.indexOf('<CardTitle>Buscar Leads</CardTitle>'), page.indexOf('<Tabs defaultValue="leads"'));
  assert.doesNotMatch(searchSection, /destination-folder|Lista de destino/);
  assert.match(page, /const \[pageSize, setPageSize\] = useState\(50\)/);
  assert.match(page, /\[25, 50, 75, 100, 150\]/);
  assert.match(page, /selectedIds\.includes\(prospect\.id\)/);
  assert.match(page, /bulkAction === 'crm'/);
  assert.match(page, /prospectionAPI\.importToFolder\(selectedProspects\.map/);
});
