const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const route = fs.readFileSync(path.join(__dirname, '..', 'routes', 'prospecting.js'), 'utf8');
const page = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'pages', 'commercial', 'ProspectingPage.tsx'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'api', 'prospecting.ts'), 'utf8');

test('API de resultados retorna somente novos com prospect_id', () => {
  assert.match(route, /duplicate_status = 'new'/);
  assert.match(route, /pr\.prospect_id IS NOT NULL/);
  assert.match(route, /JOIN prospects p/);
  assert.match(route, /JOIN prospecting_jobs j ON j\.id = pr\.job_id/);
  assert.match(route, /j\.created_by = \?/);
});

test('Adicionar à lista valida lista, prospect e ownership', () => {
  assert.match(route, /router\.post\('\/imports'/);
  assert.match(route, /lead_folders WHERE id = \? AND owner_user_id = \?/);
  assert.match(route, /p\.owner_user_id = \?/);
  assert.match(route, /INSERT IGNORE INTO lead_folder_members/);
  assert.doesNotMatch(route.slice(route.indexOf("router.post('/imports'")), /INSERT INTO prospects/);
});

test('resultado legado sem prospect_id é rejeitado sem recriação silenciosa', () => {
  const imports = route.slice(route.indexOf("router.post('/imports'"));
  assert.match(imports, /pr\.prospect_id IS NOT NULL/);
  assert.match(imports, /nao sao novos ou nao possuem prospect associado/);
});

test('frontend seleciona somente novos exibíveis e envia folderId', () => {
  assert.match(page, /item\.duplicateStatus === "new" && item\.prospectId != null/);
  assert.match(page, /folderId: options\.folderId/);
  assert.match(page, /Adicionar à lista/);
  assert.match(page, /\[25, 50, 75, 100, 150\]/);
});

test('mapeamento da API preserva contadores completos e prospectId', () => {
  assert.match(api, /processed_count/);
  assert.match(api, /duplicate_count/);
  assert.match(api, /invalid_count/);
  assert.match(api, /prospectId: row\.prospectId \?\? row\.prospect_id/);
});

test('eventos de membership são emitidos somente após commit', () => {
  const imports = route.slice(route.indexOf("router.post('/imports'"));
  assert.ok(imports.indexOf('await connection.commit();') < imports.indexOf("type: 'lead.added_to_folder'"));
  assert.match(imports, /affectedRows/);
});
