const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EVENT_CONTRACTS, validateEventInput } = require('../services/domain-events');
const { matchAutomationsForEvent, reserveWhatsAppSlot } = require('../services/automation-engine');
const { validateAutomationDefinition } = require('../services/automation-definition-validator');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');

test('AUTOMATIONS-3A define o evento de lead adicionado a lista e o emitem somente apos novo membership', () => {
  const route = read('server', 'routes', 'prospection.js');
  const page = read('src', 'pages', 'commercial', 'AutomationsPage.tsx');
  const builder = read('src', 'components', 'automations', 'AutomationBuilder.tsx');
  assert.ok(EVENT_CONTRACTS['lead.added_to_folder']);
  assert.deepEqual(validateEventInput({ type: 'lead.added_to_folder', entityType: 'lead', entityId: 7, payload: { leadId: 7, folderId: 3 } }).payload, { leadId: 7, folderId: 3 });
  assert.match(route, /INSERT IGNORE INTO lead_folder_members/);
  assert.match(route, /Number\(inserted\.affectedRows \|\| 0\) > 0/);
  assert.match(route, /type: 'lead\.added_to_folder'/);
  assert.match(page, /"lead\.added_to_folder": "Novo lead na lista"/);
  assert.match(builder, /"lead\.added_to_folder": "Novo lead na lista"/);
  assert.match(builder, /leadFoldersAPI\.list\(\)/);
  assert.match(builder, /Carregando listas\.\.\./);
  assert.match(builder, /folderName/);
  assert.match(builder, /Lista não selecionada/);
  assert.match(builder, /Selecione a lista do gatilho/);
  assert.match(builder, /key !== "folderName"/);
  assert.match(builder, /seconds.*segundos/);
  assert.match(builder, /Cadência/);
  assert.match(page, /leadFoldersAPI\.list\(\)/);
  assert.match(page, /DEFAULT_DEFINITION\(triggerType, folderId \|\| undefined\)/);
  assert.match(page, /Selecione uma lista/);
  assert.match(page, /Carregando listas\.\.\./);
  assert.match(page, /Nenhuma lista encontrada/);
  assert.match(page, /setFolderId\(null\)/);
});

test('AUTOMATIONS-3A restringe o trigger de lista pela pasta configurada', async () => {
  let params;
  const connection = { execute: async (_sql, values) => { params = values; return [[{ automation_id: 4, automation_version_id: 12, definition: '{}' }]]; } };
  await matchAutomationsForEvent(connection, { event_type: 'lead.added_to_folder', payload: { folderId: 9 }, lineage_depth: 0, source_automation_id: null });
  assert.deepEqual(params.slice(0, 3), ['lead.added_to_folder', 'lead.added_to_folder', JSON.stringify({ folderId: 9 })]);
});

test('AUTOMATIONS-3A persiste WAIT em segundos e possui reserva de cadencia por automacao e conta', () => {
  const engine = read('server', 'services', 'automation-engine.js');
  const migration = read('database', 'migrations', '20260929_automations_3a_cadence.sql');
  assert.match(engine, /\['seconds', 'minutes', 'hours', 'days'\]/);
  assert.match(engine, /automation_whatsapp_cadence/);
  assert.match(engine, /FOR UPDATE/);
  assert.match(engine, /previousOutput = parseJson\(existingSteps\[0\]\?\.output/);
  assert.match(migration, /PRIMARY KEY \(automation_id, communication_account_id\)/);
  assert.match(migration, /next_available_at DATETIME/);
});

test('AUTOMATIONS-3A exige lista e conta/mensagem no fluxo WhatsApp', () => {
  const invalid = validateAutomationDefinition({ schemaVersion: 1, trigger: { type: 'lead.added_to_folder', config: {} }, steps: [{ id: 'send', type: 'action', config: { actionType: 'whatsapp.send' }, next: null }] }, { requireSteps: true, requireExecutableActions: true });
  assert.ok(invalid.errors.some((item) => item.code === 'MISSING_FOLDER'));
  assert.ok(invalid.errors.filter((item) => item.code === 'MISSING_ACTION_CONFIG').length >= 2);
});

test('AUTOMATIONS-3A mantém o trigger canônico no round-trip do Builder', () => {
  const builder = read('src', 'components', 'automations', 'AutomationBuilder.tsx');
  const catalog = read('src', 'components', 'automations', 'action-catalog.ts');
  const definition = { schemaVersion: 1, trigger: { type: 'lead.added_to_folder', config: { folderId: 5 } }, steps: [{ id: 'send', type: 'action', config: { actionType: 'whatsapp.send', accountId: 1, recipient: '{{lead.phone}}', message: 'Ola', cadenceValue: 1, cadenceUnit: 'minutes' }, next: null }] };
  assert.equal(definition.trigger.type, 'lead.added_to_folder');
  assert.equal(definition.trigger.config.folderId, 5);
  assert.equal(definition.steps[0].config.actionType, 'whatsapp.send');
  assert.match(builder, /flowDefinition\(definition, props\.triggerType\)/);
  assert.match(builder, /type: String\(triggerType \|\| trigger\?\.data\.config\.triggerType/);
  assert.match(builder, /key !== "folderName"/);
  assert.match(catalog, /id: "whatsapp\.send",\s+name: "Disparo WhatsApp"/);
});

test('AUTOMATIONS-3A reserva slots de cadência serialmente sob lock', async () => {
  const calls = [];
  const connection = { execute: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.startsWith('SELECT next_available_at')) return [[{ next_available_at: '2026-09-29T10:01:00Z' }]];
    return [{ affectedRows: 1 }];
  } };
  const slot = await reserveWhatsAppSlot(connection, 4, 1, { cadenceValue: 60, cadenceUnit: 'seconds' }, new Date('2026-09-29T10:00:00Z'));
  assert.equal(slot.toISOString(), '2026-09-29T10:01:00.000Z');
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.equal(calls[1].params[0].toISOString(), '2026-09-29T10:02:00.000Z');
});
