const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EVENT_CONTRACTS, validateEventInput } = require('../services/domain-events');
const { matchAutomationsForEvent, reserveWhatsAppSlot } = require('../services/automation-engine');
const { validateAutomationDefinition } = require('../services/automation-definition-validator');
const { UNCONFIGURED_TRIGGER } = require('../services/automation-catalog');
const automationRepository = require('../services/automation-repository');
const { getPool } = require('../config/database');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');

function repositoryDatabase() {
  const state = {
    automation: { id: 1, owner_user_id: 7, name: 'Automacao teste', status: 'draft', trigger_type: UNCONFIGURED_TRIGGER, active_version_id: null, active_version_number: null },
    versions: [],
    nextVersionId: 10,
    calls: [],
  };
  const connection = {
    async beginTransaction() { state.calls.push('begin'); },
    async commit() { state.calls.push('commit'); },
    async rollback() { state.calls.push('rollback'); },
    release() {},
    async execute(sql, params = []) {
      state.calls.push({ sql, params });
      if (sql.startsWith('SELECT a.*, av.version_number')) return [[{ ...state.automation, active_version_number: state.automation.active_version_number }]];
      if (sql.startsWith('SELECT id, version_number FROM automation_versions')) return [state.versions.filter((version) => version.status === 'draft').map(({ id, version_number }) => ({ id, version_number }))];
      if (sql.startsWith('SELECT id, version_number, status FROM automation_versions')) return [state.versions.filter((version) => version.id === Number(params[0]) && version.automation_id === Number(params[1])).map(({ id, version_number, status }) => ({ id, version_number, status }))];
      if (sql.includes('COALESCE(MAX(version_number)')) return [[{ next_version: Math.max(0, ...state.versions.map((version) => version.version_number)) + 1 }]];
      if (sql.startsWith('UPDATE automation_versions SET definition = ?')) {
        const version = state.versions.find((entry) => entry.id === Number(params[1]));
        if (version) version.definition = JSON.parse(params[0]);
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('SELECT * FROM automation_versions WHERE id = ? AND automation_id = ?')) {
        return [state.versions.filter((version) => version.id === Number(params[0]) && version.automation_id === Number(params[1])).map((version) => ({ ...version }))];
      }
      if (sql.startsWith('INSERT INTO automations')) return [{ insertId: state.automation.id }];
      if (sql.startsWith('INSERT INTO automation_versions')) {
        const initial = sql.includes('VALUES (?, 1,');
        const version = { id: state.nextVersionId++, automation_id: Number(params[0]), version_number: initial ? 1 : Number(params[1]), status: 'draft', definition: JSON.parse(initial ? params[1] : params[2]) };
        state.versions.push(version);
        return [{ insertId: version.id }];
      }
      if (sql.startsWith('INSERT INTO automation_audit_logs')) return [{ affectedRows: 1 }];
      if (sql.startsWith('UPDATE automations SET trigger_type = ?')) {
        state.automation.trigger_type = params[0];
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("UPDATE automation_versions SET status = 'superseded'")) {
        state.versions.filter((version) => version.automation_id === Number(params[0]) && version.status === 'published').forEach((version) => { version.status = 'superseded'; });
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("UPDATE automation_versions SET status = 'published'")) {
        const version = state.versions.find((entry) => entry.id === Number(params[0]));
        if (version) version.status = 'published';
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('UPDATE automations SET active_version_id')) {
        state.automation.active_version_id = Number(params[0]);
        state.automation.active_version_number = state.versions.find((version) => version.id === Number(params[0]))?.version_number || state.versions[0]?.version_number || null;
        state.automation.trigger_type = params[1];
        state.automation.status = 'active';
        return [{ affectedRows: 1 }];
      }
      if (sql.includes("UPDATE automations SET status = 'active', trigger_type = ?")) {
        state.automation.status = 'active';
        state.automation.trigger_type = params[0];
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected repository SQL: ${sql}`);
    },
  };
  const pool = getPool();
  const originalGetConnection = pool.getConnection;
  pool.getConnection = async () => connection;
  return { state, restore: () => { pool.getConnection = originalGetConnection; } };
}

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
  assert.match(builder, /triggerConfigForType/);
  assert.match(builder, /seconds.*segundos/);
  assert.match(builder, /Cadência/);
  assert.match(page, /UNCONFIGURED_TRIGGER = "__unconfigured__"/);
  assert.match(page, /definition: DEFAULT_DEFINITION\(\)/);
  assert.doesNotMatch(page, /<Label>Quando<\/Label>/);
  assert.doesNotMatch(page, /leadFoldersAPI|<Select|if \(false\)/);
});

test('AUTOMATIONS-3A restringe o trigger de lista pela pasta configurada', async () => {
  let params;
  const connection = { execute: async (_sql, values) => { params = values; return [[{ automation_id: 4, automation_version_id: 12, definition: '{}' }]]; } };
  await matchAutomationsForEvent(connection, { event_type: 'lead.added_to_folder', payload: { folderId: 9 }, lineage_depth: 0, source_automation_id: null });
  assert.deepEqual(params.slice(0, 3), ['lead.added_to_folder', 'lead.added_to_folder', JSON.stringify({ folderId: 9 })]);
});

test('AUTOMATIONS-3A matching real aceita trigger publicado e não aceita sentinel', async () => {
  let activeDefinition = { trigger: { type: 'lead.created' } };
  const connection = {
    execute: async (sql, params) => {
      assert.match(sql, /JSON_UNQUOTE\(JSON_EXTRACT\(av\.definition, '\$\.trigger\.type'\)\)/);
      return activeDefinition.trigger.type === params[0]
        ? [[{ automation_id: 4, automation_version_id: 12, definition: JSON.stringify(activeDefinition) }]]
        : [[]];
    },
  };
  const event = { event_type: 'lead.created', payload: {}, lineage_depth: 0, source_automation_id: null };
  assert.equal((await matchAutomationsForEvent(connection, event)).length, 1);
  activeDefinition = { trigger: { type: UNCONFIGURED_TRIGGER } };
  assert.equal((await matchAutomationsForEvent(connection, event)).length, 0);
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

test('AUTOMATIONS-3A mantém sentinel apenas em rascunho e rejeita definições não executáveis', () => {
  const draft = validateAutomationDefinition({ schemaVersion: 1, trigger: { type: UNCONFIGURED_TRIGGER, config: {} }, steps: [] }, { allowUnconfiguredTrigger: true });
  assert.equal(draft.valid, true);
  assert.equal(validateAutomationDefinition(draft.definition, { requireSteps: true }).valid, false);
  assert.equal(validateAutomationDefinition({ schemaVersion: 1, trigger: { config: {} }, steps: [] }, { requireSteps: true }).valid, false);
  assert.equal(validateAutomationDefinition({ schemaVersion: 1, trigger: { type: 'trigger.unknown', config: {} }, steps: [] }, { requireSteps: true }).valid, false);
});

test('AUTOMATIONS-3A exercita criação, salvamento, publicação e ativação pelo repository real', async () => {
  const db = repositoryDatabase();
  try {
    const draftDefinition = { schemaVersion: 1, trigger: { type: UNCONFIGURED_TRIGGER, config: {}, next: null }, steps: [] };
    const created = await automationRepository.createAutomation({ ownerUserId: 7, userId: 7, name: 'Automacao teste', definition: draftDefinition });
    assert.equal(created.automationId, 1);
    assert.equal(db.state.automation.status, 'draft');
    assert.equal(db.state.automation.trigger_type, UNCONFIGURED_TRIGGER);
    assert.equal(db.state.versions[0].status, 'draft');

    const executableDefinition = { schemaVersion: 1, trigger: { type: 'lead.created', config: {}, next: 'notify' }, steps: [{ id: 'notify', type: 'action', config: { actionType: 'notification.create', title: 'Novo lead', message: 'Contato recebido' }, next: null }] };
    const version = await automationRepository.updateDraftVersion(7, 1, 10, executableDefinition);
    assert.equal(version.definition.trigger.type, 'lead.created');
    assert.equal(db.state.automation.trigger_type, 'lead.created');
    await automationRepository.publishVersion(7, 1, 10);
    assert.equal(db.state.versions[0].status, 'published');
    assert.equal(db.state.versions[0].version_number, 1);
    assert.equal(db.state.automation.active_version_id, 10);
    assert.equal(db.state.automation.active_version_number, 1);
    db.state.automation.status = 'paused';
    await automationRepository.transitionAutomation(7, 1, 'activate');
    assert.equal(db.state.automation.status, 'active');
    assert.equal(db.state.automation.trigger_type, 'lead.created');
    assert.ok(db.state.calls.includes('commit'));
  } finally {
    db.restore();
  }
});

test('AUTOMATIONS-3A rejeita payload legado divergente no caminho real de criação', async () => {
  const db = repositoryDatabase();
  try {
    await assert.rejects(
      automationRepository.createAutomation({
        ownerUserId: 7,
        userId: 7,
        name: 'Payload legado',
        triggerType: 'lead.updated',
        definition: { schemaVersion: 1, trigger: { type: 'lead.created', config: {} }, steps: [] },
      }),
      (error) => error.status === 400,
    );
    assert.equal(db.state.automation.trigger_type, UNCONFIGURED_TRIGGER);
  } finally {
    db.restore();
  }
});

test('AUTOMATIONS-3A rejeita publicação sentinel e ativação direta inválida sem atualizar status', async () => {
  const db = repositoryDatabase();
  try {
    await automationRepository.createAutomation({ ownerUserId: 7, userId: 7, name: 'Sentinel', definition: { schemaVersion: 1, trigger: { type: UNCONFIGURED_TRIGGER, config: {} }, steps: [] } });
    await assert.rejects(automationRepository.publishVersion(7, 1, 10), (error) => error.status === 400);
    assert.equal(db.state.versions[0].status, 'draft');
    db.state.automation.active_version_id = 10;
    db.state.automation.active_version_number = 1;
    db.state.automation.status = 'paused';
    await assert.rejects(automationRepository.transitionAutomation(7, 1, 'activate'), (error) => error.status === 409);
    assert.equal(db.state.automation.status, 'paused');
    assert.equal(db.state.calls.includes('commit'), true);
  } finally {
    db.restore();
  }
});

test('AUTOMATIONS-3A protege ativação direta revalidando versão publicada e sincronizando o trigger canônico', () => {
  const repository = read('server', 'services', 'automation-repository.js');
  assert.match(repository, /SELECT \* FROM automation_versions WHERE id = \? AND automation_id = \? FOR UPDATE/);
  assert.match(repository, /activeVersion\.status !== 'published'/);
  assert.match(repository, /validateAutomationDefinition\(activeVersion\.definition, \{ requireSteps: true, requireExecutableActions: true \}\)/);
  assert.match(repository, /SET status = 'active', trigger_type = \?/);
  assert.match(repository, /validation\.definition\.trigger\.type === UNCONFIGURED_TRIGGER/);
});

test('AUTOMATIONS-3A mantém o trigger canônico no round-trip do Builder', () => {
  const builder = read('src', 'components', 'automations', 'AutomationBuilder.tsx');
  const catalog = read('src', 'components', 'automations', 'action-catalog.ts');
  const definition = { schemaVersion: 1, trigger: { type: 'lead.added_to_folder', config: { folderId: 5 } }, steps: [{ id: 'send', type: 'action', config: { actionType: 'whatsapp.send', accountId: 1, recipient: '{{lead.phone}}', message: 'Ola', cadenceValue: 1, cadenceUnit: 'minutes' }, next: null }] };
  assert.equal(definition.trigger.type, 'lead.added_to_folder');
  assert.equal(definition.trigger.config.folderId, 5);
  assert.equal(definition.steps[0].config.actionType, 'whatsapp.send');
  assert.match(builder, /flowDefinition\(definition, props\.triggerType\)/);
  assert.match(builder, /type: String\(trigger\?\.data\.config\.triggerType \|\| triggerType \|\| UNCONFIGURED_TRIGGER/);
  assert.doesNotMatch(builder, /triggerType \|\| trigger\?\.config\.triggerType \|\| "lead\.created"/);
  assert.doesNotMatch(builder, /trigger\?\.data\.config\.triggerType \|\| "lead\.created"/);
  assert.match(builder, /Gatilho não configurado/);
  assert.match(builder, /triggerConfigForType/);
  assert.match(catalog, /id: "whatsapp\.send",\s+name: "Disparo WhatsApp"/);
});

test('AUTOMATIONS-3A reserva slots de cadência serialmente sob lock', async () => {
  const calls = [];
  const connection = { execute: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('UNIX_TIMESTAMP(next_available_at)')) return [[{ next_available_epoch: Math.floor(new Date('2026-09-29T10:01:00Z').getTime() / 1000) }]];
    return [{ affectedRows: 1 }];
  } };
  const slot = await reserveWhatsAppSlot(connection, 4, 1, { cadenceValue: 60, cadenceUnit: 'seconds' }, new Date('2026-09-29T10:00:00Z'));
  assert.equal(slot.toISOString(), '2026-09-29T10:01:00.000Z');
  assert.match(calls[1].sql, /FOR UPDATE/);
  assert.equal(calls[2].params[0].toISOString(), '2026-09-29T10:02:00.000Z');
});

test('AUTOMATIONS-3A inicializa a fila antes do FOR UPDATE para eliminar a corrida da primeira reserva', () => {
  const engine = read('server', 'services', 'automation-engine.js');
  assert.match(engine, /INSERT IGNORE INTO automation_whatsapp_cadence/);
  assert.match(engine, /SELECT UNIX_TIMESTAMP\(next_available_at\).*FOR UPDATE/);
  assert.match(engine, /UPDATE automation_whatsapp_cadence SET next_available_at/);
  assert.ok(engine.indexOf('INSERT IGNORE INTO automation_whatsapp_cadence') < engine.indexOf('SELECT UNIX_TIMESTAMP(next_available_at)'));
});

test('AUTOMATIONS-3A persiste a cadencia padrao ao criar ou selecionar WhatsApp sem alterar legado', () => {
  const builder = read('src', 'components', 'automations', 'AutomationBuilder.tsx');
  assert.match(builder, /const defaultActionConfig = \(actionId\?\: string\)/);
  assert.match(builder, /actionId === "whatsapp\.send"[\s\S]*cadenceValue: 1, cadenceUnit: "minutes"/);
  assert.match(builder, /patch\.config\?\.actionType === "whatsapp\.send"[\s\S]*patch\.config\.cadenceValue === undefined/);
  assert.match(builder, /type === "action" \? defaultActionConfig\(actionId\)/);
  assert.match(builder, /config: node\.data\.config/);
});
