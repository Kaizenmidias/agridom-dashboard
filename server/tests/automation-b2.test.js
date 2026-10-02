const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateEventInput } = require('../services/domain-events');
const { validateAutomationDefinition } = require('../services/automation-definition-validator');
const { buildAutomationContext, matchAutomationsForEvent, processOneEvent, claimNextJob, completeBootstrapJob } = require('../services/automation-engine');
const { executeAction } = require('../services/automation/action-executor');
const { ACTION_CATALOG } = require('../services/automation-catalog');
const { LEAD_REQUIRED_ACTIONS, isExecutable } = require('../services/automation/action-registry');

const webhookDefinition = (steps = [{ id: 'finish', type: 'finish', config: {}, next: null }], webhookEndpointId = 27) => ({
  schemaVersion: 1,
  trigger: { type: 'webhook.received', config: { webhookEndpointId }, next: steps[0]?.id || null },
  steps,
});

test('B.2 aceita evento webhook generico sem contrato de Lead', () => {
  const result = validateEventInput({ type: 'webhook.received', entityType: 'webhook_endpoint', entityId: '27', payload: {} });
  assert.equal(result.entityType, 'webhook_endpoint');
  assert.equal(result.entityId, '27');
});

test('B.2 context lead deriva somente de entity_type lead', () => {
  const lead = buildAutomationContext({ automation_id: 4, owner_user_id: 7, entity_type: 'lead', entity_id: '42', correlation_id: null, event_uuid: null, lineage_depth: 0 }, { automation_run_id: 10 }, 'finish', 'job:1');
  assert.equal(lead.leadId, 42);
  assert.equal('webhookEndpointId' in lead, false);

  const webhook = buildAutomationContext({ automation_id: 4, owner_user_id: 7, entity_type: 'webhook_endpoint', entity_id: '27', correlation_id: null, event_uuid: null, lineage_depth: 0 }, { automation_run_id: 11 }, 'finish', 'job:2');
  assert.equal(webhook.webhookEndpointId, 27);
  assert.equal('leadId' in webhook, false);
});

test('B.2 nunca transforma endpoint em lead e rejeita entity id invalido', () => {
  const engine = require('../services/automation-engine');
  assert.throws(() => engine.buildAutomationContext({ automation_id: 4, owner_user_id: 7, entity_type: 'webhook_endpoint', entity_id: '27.5' }, { automation_run_id: 11 }, 'finish', 'job:2'), /INVALID_AUTOMATION_ENTITY_ID/);
  assert.throws(() => engine.buildAutomationContext({ automation_id: 4, owner_user_id: 7, entity_type: 'webhook_endpoint', entity_id: '0' }, { automation_run_id: 11 }, 'finish', 'job:2'), /INVALID_AUTOMATION_ENTITY_ID/);
});

test('B.2 validator exige endpoint e rejeita condition/action Lead-dependent', () => {
  const missing = validateAutomationDefinition(webhookDefinition([], null));
  assert.equal(missing.valid, false);
  assert.ok(missing.errors.some((item) => item.code === 'MISSING_WEBHOOK_ENDPOINT'));

  const condition = validateAutomationDefinition(webhookDefinition([{ id: 'condition', type: 'condition', config: { field: 'status', operator: 'equals', value: 'Novo' }, next: null }]));
  assert.ok(condition.errors.some((item) => item.code === 'WEBHOOK_CONDITION_REQUIRES_LEAD'));

  const action = validateAutomationDefinition(webhookDefinition([{ id: 'notify', type: 'action', config: { actionType: 'notification.create', title: 'Aviso', message: 'Teste' }, next: null }]));
  assert.ok(action.errors.some((item) => item.code === 'WEBHOOK_ACTION_REQUIRES_LEAD'));
});

test('B.2 permite fluxo webhook somente com finish', () => {
  const result = validateAutomationDefinition(webhookDefinition());
  assert.equal(result.valid, true);
});

test('B.2 runtime recusa action Lead-dependent sem leadId', async () => {
  await assert.rejects(executeAction({ execute: async () => { throw new Error('database access should not occur'); } }, 'lead.add_note', { note: 'x' }, { ownerUserId: 7 }), /ACTION_REQUIRES_LEAD/);
});

test('B.2 matcher possui isolamento estrutural por endpoint, owner e estado ativo', async () => {
  let sql = '';
  const connection = { execute: async (query) => { sql = query; return [[]]; } };
  await matchAutomationsForEvent(connection, { event_type: 'webhook.received', entity_type: 'webhook_endpoint', entity_id: '27', payload: {}, lineage_depth: 0, source_automation_id: null });
  assert.match(sql, /automation_webhook_active/);
  assert.match(sql, /automation_webhook_endpoints/);
  assert.match(sql, /owner_user_id = a\.owner_user_id/);
  assert.match(sql, /whe\.enabled = 1/);
  assert.match(sql, /whe\.revoked_at IS NULL/);
  assert.match(sql, /webhookEndpointId/);
});

test('B.2 matcher comportamental isola endpoint, owner, enabled, revoked e configuracao', async () => {
  const fixtures = [
    { automation_id: 1, owner_user_id: 7, automation_version_id: 11, definition: { trigger: { type: 'webhook.received', config: { webhookEndpointId: 10 } } }, endpoint_id: 10, endpoint_owner: 7, enabled: 1, revoked_at: null },
    { automation_id: 2, owner_user_id: 7, automation_version_id: 12, definition: { trigger: { type: 'webhook.received', config: { webhookEndpointId: 20 } } }, endpoint_id: 20, endpoint_owner: 7, enabled: 1, revoked_at: null },
    { automation_id: 3, owner_user_id: 7, automation_version_id: 13, definition: { trigger: { type: 'webhook.received', config: { webhookEndpointId: 10 } } }, endpoint_id: 10, endpoint_owner: 8, enabled: 1, revoked_at: null },
    { automation_id: 4, owner_user_id: 7, automation_version_id: 14, definition: { trigger: { type: 'webhook.received', config: { webhookEndpointId: 30 } } }, endpoint_id: 30, endpoint_owner: 7, enabled: 0, revoked_at: null },
    { automation_id: 5, owner_user_id: 7, automation_version_id: 15, definition: { trigger: { type: 'webhook.received', config: { webhookEndpointId: 40 } } }, endpoint_id: 40, endpoint_owner: 7, enabled: 1, revoked_at: '2026-10-02 10:00:00' },
    { automation_id: 6, owner_user_id: 7, automation_version_id: 16, definition: { trigger: { type: 'webhook.received', config: { webhookEndpointId: 50 } } }, endpoint_id: null, endpoint_owner: null, enabled: null, revoked_at: null },
    { automation_id: 7, owner_user_id: 7, automation_version_id: 17, definition: { trigger: { type: 'webhook.received', config: { webhookEndpointId: 60 } } }, endpoint_id: 60, endpoint_owner: 7, enabled: 1, revoked_at: null },
  ];
  const connection = { execute: async (query, params) => {
    const eventType = params[0];
    const entityType = params[7];
    const entityId = String(params[8]);
    const rows = fixtures.filter((row) => eventType === 'webhook.received'
      && entityType === 'webhook_endpoint'
      && row.endpoint_id !== null
      && String(row.endpoint_id) === entityId
      && row.endpoint_owner === row.owner_user_id
      && row.enabled === 1
      && row.revoked_at === null
      && Number(row.definition.trigger.config.webhookEndpointId) === Number(row.endpoint_id))
      .map((row) => ({ automation_id: row.automation_id, automation_version_id: row.automation_version_id, definition: JSON.stringify(row.definition) }));
    return [rows];
  } };

  const endpoint10 = await matchAutomationsForEvent(connection, { event_type: 'webhook.received', entity_type: 'webhook_endpoint', entity_id: '10', payload: {}, lineage_depth: 0, source_automation_id: null });
  assert.deepEqual(endpoint10.map((row) => row.automation_id), [1]);
  assert.deepEqual((await matchAutomationsForEvent(connection, { event_type: 'webhook.received', entity_type: 'webhook_endpoint', entity_id: '20', payload: {}, lineage_depth: 0, source_automation_id: null })).map((row) => row.automation_id), [2]);
  assert.equal((await matchAutomationsForEvent(connection, { event_type: 'webhook.received', entity_type: 'webhook_endpoint', entity_id: '30', payload: {}, lineage_depth: 0, source_automation_id: null })).length, 0);
  assert.equal((await matchAutomationsForEvent(connection, { event_type: 'webhook.received', entity_type: 'webhook_endpoint', entity_id: '40', payload: {}, lineage_depth: 0, source_automation_id: null })).length, 0);
  assert.equal((await matchAutomationsForEvent(connection, { event_type: 'webhook.received', entity_type: 'webhook_endpoint', entity_id: '50', payload: {}, lineage_depth: 0, source_automation_id: null })).length, 0);
  assert.deepEqual((await matchAutomationsForEvent(connection, { event_type: 'webhook.received', entity_type: 'webhook_endpoint', entity_id: '60', payload: {}, lineage_depth: 0, source_automation_id: null })).map((row) => row.automation_id), [7]);
});

test('B.2 rejeita a matriz completa de IDs de endpoint e aceita somente inteiros positivos seguros', () => {
  const invalid = [undefined, null, 0, -1, 1.5, NaN, Infinity, '', ' ', '27', '27abc', {}, [], true, false];
  invalid.forEach((value) => {
    const definition = webhookDefinition();
    definition.trigger.config.webhookEndpointId = value;
    const result = validateAutomationDefinition(definition);
    assert.equal(result.valid, false, `ID deveria ser rejeitado: ${String(value)}`);
  });
  [1, 27, Number.MAX_SAFE_INTEGER].forEach((value) => {
    assert.equal(validateAutomationDefinition(webhookDefinition([], value)).valid, true);
  });
});

test('B.2 endpoint nunca vira Lead no runtime e action Lead-required falha antes da consulta', async () => {
  const context = buildAutomationContext({ automation_id: 4, owner_user_id: 7, entity_type: 'webhook_endpoint', entity_id: '27', correlation_id: null, event_uuid: null, lineage_depth: 0 }, { automation_run_id: 11 }, 'step', 'job:3');
  assert.equal(context.webhookEndpointId, 27);
  assert.equal(context.leadId, undefined);
  let leadQuery = false;
  await assert.rejects(executeAction({ execute: async (query) => { if (String(query).includes('FROM prospects')) leadQuery = true; return [[]]; } }, 'lead.add_note', { note: 'x' }, context), /ACTION_REQUIRES_LEAD/);
  assert.equal(leadQuery, false);
});

test('B.2 regressao Lead continua carregando ownedLead no caminho normal', async () => {
  const calls = [];
  const connection = { execute: async (query) => {
    calls.push(String(query));
    if (String(query).includes('FROM prospects')) return [[{ id: 42, owner_user_id: 7, business_name: 'Lead', assigned_user_id: null }]];
    return [{ insertId: 1, affectedRows: 1 }, []];
  } };
  const result = await executeAction(connection, 'lead.add_note', { note: 'Teste' }, { leadId: 42, ownerUserId: 7, automationId: 1, runId: 2, stepId: 'note', idempotencyKey: 'job:1', lineageDepth: 1 });
  assert.deepEqual(result, { noteCreated: true });
  assert.equal(calls.some((query) => query.includes('FROM prospects')), true);
});

test('B.2 capabilities mantem catalogo, registry e executor coerentes', () => {
  const available = ACTION_CATALOG.filter((item) => item.availability === 'available').map((item) => item.id);
  assert.equal(available.includes('wait.period'), false);
  available.forEach((actionType) => assert.equal(isExecutable(actionType), true));
  LEAD_REQUIRED_ACTIONS.forEach((actionType) => assert.ok(ACTION_CATALOG.some((item) => item.id === actionType && ['available', 'requires_integration'].includes(item.availability)), `${actionType} deve estar no catalogo conhecido`));
  assert.ok(LEAD_REQUIRED_ACTIONS.has('email.send'));
  assert.ok(LEAD_REQUIRED_ACTIONS.has('whatsapp.send'));
});

test('B.2 fluxo webhook wait -> finish permanece lead-less', () => {
  const definition = webhookDefinition([
    { id: 'wait', type: 'wait', config: { amount: 1, unit: 'minutes' }, next: 'finish' },
    { id: 'finish', type: 'finish', config: {}, next: null },
  ]);
  const result = validateAutomationDefinition(definition, { requireSteps: true, requireExecutableActions: true });
  assert.equal(result.valid, true);
  assert.equal(result.definition.trigger.type, 'webhook.received');
  assert.equal(result.definition.steps[0].type, 'wait');
  assert.equal(result.definition.steps[1].type, 'finish');
});

test('B.2 engine executa webhook -> wait -> finish sem Lead com persistencia mockada', async () => {
  const database = require('../config/database');
  const pool = database.getPool();
  const originalGetConnection = pool.getConnection;
  const definition = {
    schemaVersion: 1,
    trigger: { type: 'webhook.received', config: { webhookEndpointId: 27 }, next: 'wait' },
    steps: [
      { id: 'wait', type: 'wait', config: { amount: 1, unit: 'minutes' }, next: 'finish' },
      { id: 'finish', type: 'finish', config: {}, next: null },
    ],
  };
  const event = { id: 501, event_type: 'webhook.received', entity_type: 'webhook_endpoint', entity_id: '27', payload: {}, correlation_id: 'corr-1', source_automation_id: null, lineage_depth: 0 };
  const state = { eventPending: true, eventStatus: 'pending', runStatus: 'queued', currentStep: 'wait', nextJob: 'wait', jobId: 701, runId: 601, stepCalls: [] };
  const queries = [];
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (query, params = []) => {
      const sql = String(query);
      queries.push(sql);
      assert.doesNotMatch(sql, /prospects/i, 'fluxo webhook nao pode consultar Lead');
      if (/SELECT \* FROM automation_events/.test(sql)) return [[state.eventPending ? event : undefined]];
      if (/SELECT a\.id AS automation_id/.test(sql)) return [[{ automation_id: 9, automation_version_id: 19, version_number: 1, definition: JSON.stringify(definition) }]];
      if (/INSERT INTO automation_runs/.test(sql)) { state.eventPending = false; return [{ insertId: state.runId }, []]; }
      if (/INSERT INTO automation_jobs/.test(sql) && /engine\.bootstrap/.test(sql)) return [{ insertId: state.jobId }, []];
      if (/SELECT \* FROM automation_jobs/.test(sql)) {
        if (state.nextJob === null) return [[]];
        return [[{ id: state.jobId, automation_run_id: state.runId, status: 'pending', attempts: 0, max_attempts: 3 }]];
      }
      if (/SELECT aj\.\*, ar\.automation_id/.test(sql)) {
        const step = state.nextJob;
        return [[{ id: state.jobId, automation_run_id: state.runId, automation_id: 9, automation_version_id: 19, entity_type: 'webhook_endpoint', entity_id: '27', owner_user_id: 1, current_step_key: step, correlation_id: 'corr-1', definition: JSON.stringify(definition), event_uuid: 'event-501', lineage_depth: 0, run_status: state.runStatus }]];
      }
      if (/SELECT \* FROM automation_run_steps/.test(sql)) return [[]];
      if (/INSERT INTO automation_run_steps/.test(sql)) { state.stepCalls.push(params[1]); return [{ insertId: 801 }, []]; }
      if (/INSERT INTO automation_jobs/.test(sql) && /engine\.step/.test(sql)) { state.nextJob = params[2]; state.jobId += 1; return [{ insertId: state.jobId }, []]; }
      if (/UPDATE automation_runs SET status = 'waiting'/.test(sql)) { state.runStatus = 'waiting'; return [{ affectedRows: 1 }, []]; }
      if (/UPDATE automation_runs SET status = 'completed'/.test(sql)) { state.runStatus = 'completed'; state.nextJob = null; return [{ affectedRows: 1 }, []]; }
      return [{ affectedRows: 1 }, []];
    },
  };

  pool.getConnection = async () => connection;
  try {
    const eventResult = await processOneEvent({ currentWorkerId: 'b2-test' });
    assert.equal(eventResult.matches, 1);
    const waitJob = await claimNextJob({ currentWorkerId: 'b2-test' });
    assert.equal(waitJob.id, 701);
    const waited = await completeBootstrapJob(waitJob, 'b2-test');
    assert.equal(waited.waiting, true);
    assert.equal(state.runStatus, 'waiting');
    assert.equal(state.nextJob, 'finish');
    const finishJob = await claimNextJob({ currentWorkerId: 'b2-test' });
    const finished = await completeBootstrapJob(finishJob, 'b2-test');
    assert.equal(finished.completed, true);
    assert.equal(state.runStatus, 'completed');
    assert.equal(state.stepCalls[0], 'wait');
    assert.equal(state.stepCalls.at(-1), 'finish');
    assert.equal(queries.some((query) => /executeAction|prospects/i.test(query)), false);
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test('B.2 preserva automacoes Lead e protecoes de lineage', () => {
  const engine = fs.readFileSync(path.join(__dirname, '..', 'services', 'automation-engine.js'), 'utf8');
  assert.match(engine, /entityType: String\(current\.entity_type/);
  assert.match(engine, /if \(context\.entityType === 'lead'\) context\.leadId/);
  assert.doesNotMatch(engine, /leadId: Number\(current\.entity_id\)/);
  assert.match(engine, /MAX_LINEAGE_DEPTH/);
});

test('B.2 nao adiciona payload webhook nem endpoint publico', () => {
  const resolver = fs.readFileSync(path.join(__dirname, '..', 'services', 'automation', 'variable-resolver.js'), 'utf8');
  const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'automations.js'), 'utf8');
  assert.doesNotMatch(resolver, /webhook\.body/);
  assert.doesNotMatch(routes, /webhooks\/automations\/:token/);
});

test('B.2 nao cria migration', () => {
  const migrations = fs.readdirSync(path.join(__dirname, '..', '..', 'database', 'migrations'));
  assert.equal(migrations.some((file) => /webhook.*b2|b2.*webhook/i.test(file)), false);
});
