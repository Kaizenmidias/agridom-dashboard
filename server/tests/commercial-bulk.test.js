const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');

test('Leads bulk actions use an explicit endpoint and preserve domain events', () => {
  const route = read('server', 'routes', 'prospection.js');
  const service = read('src', 'services', 'leads', 'lead-service.ts');
  const page = read('src', 'pages', 'commercial', 'LeadsPage.tsx');
  assert.match(route, /router\.post\('\/prospects\/bulk-action'/);
  assert.match(route, /lead\.status_changed/);
  assert.match(route, /lead\.assigned/);
  assert.match(route, /validateAssignedUser/);
  assert.match(route, /INSERT IGNORE INTO lead_folder_members/);
  assert.match(service, /prospection\/prospects\/bulk-action/);
  assert.match(page, /applyBulkLeadAction/);
  assert.match(page, /exportSelectedLeads/);
});

test('Lead folder deletion protects automation references and preserves leads', () => {
  const route = read('server', 'routes', 'prospection.js');
  const page = read('src', 'pages', 'commercial', 'LeadsPage.tsx');
  assert.match(route, /JSON_EXTRACT\(av\.definition/);
  assert.match(route, /Esta lista esta sendo usada/);
  assert.match(route, /DELETE FROM lead_folder_members/);
  assert.match(route, /DELETE FROM lead_folders/);
  assert.doesNotMatch(route, /DELETE FROM prospects WHERE.*folder/);
  assert.match(page, /handleDeleteFolder/);
});

test('WhatsApp cadence is presented as Disparo WhatsApp without a new technical action type', () => {
  const catalog = read('src', 'components', 'automations', 'action-catalog.ts');
  const engine = read('server', 'services', 'automation-engine.js');
  assert.match(catalog, /id: "whatsapp\.send",\s+name: "Disparo WhatsApp"/);
  assert.match(engine, /automation_whatsapp_cadence/);
  assert.match(engine, /SELECT next_available_at.*FOR UPDATE/);
  assert.match(engine, /persistedSlot/);
});
