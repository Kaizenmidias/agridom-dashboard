const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { resolveVariable, resolveConfig } = require('../services/automation/variable-resolver');
const { validateAutomationDefinition } = require('../services/automation-definition-validator');
const { buildAutomationContext } = require('../services/automation-engine');
const { publishVersion, transitionAutomation } = require('../services/automation-repository');

const webhookContext = {
  webhook: {
    body: { name: 'Cliente', customer: { email: 'cliente@example.test' }, scalar: 7, flag: true, nil: null },
    contentType: 'application/json',
    receivedAt: '2026-10-02T12:00:00.000Z',
  },
};

test('B.3A resolve webhook body supports nested own properties and scalar values', () => {
  assert.equal(resolveVariable('webhook.body.name', webhookContext), 'Cliente');
  assert.equal(resolveVariable('webhook.body.customer.email', webhookContext), 'cliente@example.test');
  assert.equal(resolveVariable('webhook.body.scalar', webhookContext), '7');
  assert.equal(resolveVariable('webhook.body.flag', webhookContext), 'true');
  assert.equal(resolveVariable('webhook.body.nil', webhookContext), '');
  assert.equal(resolveVariable('webhook.body.customer.missing', webhookContext), '');
  assert.equal(resolveVariable('webhook.body.customer', webhookContext), '');
  assert.equal(resolveVariable('webhook.body', webhookContext), '');
  assert.equal(resolveConfig({ message: '{{webhook.body.customer.email}}' }, webhookContext).message, 'cliente@example.test');
});

test('B.3A resolver blocks prototype traversal, arrays and excessive depth', () => {
  for (const path of ['webhook.body.items.0.name', 'webhook.body.__proto__.x', 'webhook.body.prototype.x', 'webhook.body.constructor.x']) {
    assert.throws(() => resolveVariable(path, webhookContext), /UNKNOWN_VARIABLE/);
  }
  const deep = { webhook: { body: {} } };
  let current = deep.webhook.body;
  for (let index = 0; index < 8; index += 1) { current.child = {}; current = current.child; }
  current.value = 'too-deep';
  assert.throws(() => resolveVariable('webhook.body.child.child.child.child.child.child.child.child.value', deep), /UNKNOWN_VARIABLE/);
  const inherited = Object.create({ email: 'inherited@example.test' });
  inherited.customer = Object.create({ email: 'inherited@example.test' });
  assert.equal(resolveVariable('webhook.body.customer.email', { webhook: { body: inherited } }), '');
});

test('B.3A validator allows webhook body only for webhook trigger', () => {
  const base = { schemaVersion: 1, trigger: { type: 'webhook.received', config: { webhookEndpointId: 27 }, next: 'finish_1' }, steps: [{ id: 'finish_1', type: 'finish', config: {} }] };
  assert.equal(validateAutomationDefinition({ ...base, steps: [{ ...base.steps[0], config: { note: '{{webhook.body.customer.email}}' } }] }).valid, true);
  assert.equal(validateAutomationDefinition({ ...base, steps: [{ ...base.steps[0], config: { note: '{{webhook.headers.authorization}}' } }] }).valid, false);
  assert.equal(validateAutomationDefinition({ ...base, steps: [{ ...base.steps[0], config: { note: '{{webhook.body.items.0.name}}' } }] }).valid, false);
  assert.equal(validateAutomationDefinition({ ...base, trigger: { ...base.trigger, type: 'lead.created' }, steps: [{ ...base.steps[0], config: { note: '{{webhook.body.email}}' } }] }).valid, false);
  assert.equal(validateAutomationDefinition({ ...base, trigger: { ...base.trigger, config: {} } }).valid, false);
});

test('B.3A drafts may select webhook before endpoint configuration, but publish validation remains strict', () => {
  const definition = { schemaVersion: 1, trigger: { type: 'webhook.received', config: {}, next: 'finish_1' }, steps: [{ id: 'finish_1', type: 'finish', config: {} }] };
  assert.equal(validateAutomationDefinition(definition, { allowIncompleteWebhookTrigger: true }).valid, true);
  assert.equal(validateAutomationDefinition(definition, { requireSteps: true }).valid, false);
});

test('B.3A context preserves sanitized webhook payload across wait continuation without lead', () => {
  const current = { automation_id: 9, owner_user_id: 1, entity_type: 'webhook_endpoint', entity_id: '27', correlation_id: null, event_uuid: 'event-1', event_type: 'webhook.received', payload: JSON.stringify({ webhook: webhookContext.webhook }), lineage_depth: 0 };
  const first = buildAutomationContext(current, { automation_run_id: 601 }, 'wait_1', 'run:601:step:wait_1', JSON.parse(current.payload));
  const resumed = buildAutomationContext(current, { automation_run_id: 601 }, 'finish_1', 'run:601:step:finish_1', JSON.parse(current.payload));
  assert.equal(first.leadId, undefined);
  assert.equal(first.webhookEndpointId, 27);
  assert.equal(resolveVariable('webhook.body.customer.email', first), 'cliente@example.test');
  assert.equal(resolveVariable('webhook.body.customer.email', resumed), 'cliente@example.test');
  assert.equal(first.webhook.contentType, 'application/json');
  assert.equal(first.webhook.receivedAt, '2026-10-02T12:00:00.000Z');
  assert.equal(JSON.stringify(first).includes('token'), false);
  assert.equal(JSON.stringify(first).includes('headers'), false);
});

test('B.3A repository publish/activate validation requires active owned endpoint linkage', () => {
  const source = fs.readFileSync(require.resolve('../services/automation-repository'), 'utf8');
  assert.match(source, /automation_webhook_active/);
  assert.match(source, /e\.automation_id = \?/);
  assert.match(source, /e\.owner_user_id = \?/);
  assert.match(source, /e\.enabled = 1/);
  assert.match(source, /e\.revoked_at IS NULL/);
  assert.match(source, /validateDefinitionWebhookEndpoint\(connection, automation/);
});

function installRepositoryMock({ endpoint = {}, automationStatus = 'paused', versionStatus = 'draft' } = {}) {
  const database = require('../config/database');
  const pool = database.getPool();
  const original = pool.getConnection;
  const calls = [];
  const automation = { id: 9, owner_user_id: 1, status: automationStatus, active_version_id: 22, active_version_number: 1 };
  const definition = { schemaVersion: 1, trigger: { type: 'webhook.received', config: { webhookEndpointId: 27 }, next: 'finish_1' }, steps: [{ id: 'finish_1', type: 'finish', config: {} }] };
  const connection = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
    execute: async (sql) => {
      const query = String(sql);
      calls.push(query);
      if (query.includes('FROM automations a')) return [[automation]];
      if (query.includes('SELECT * FROM automation_versions')) return [[{ id: 22, automation_id: 9, version_number: 1, status: versionStatus, definition }]];
      if (query.includes('SELECT e.id')) return [endpoint.id ? [{ id: endpoint.id }] : []];
      return [{ insertId: 1, affectedRows: 1 }, []];
    },
  };
  pool.getConnection = async () => connection;
  return { calls, restore: () => { pool.getConnection = original; } };
}

const endpointCases = [
  ['válido', { id: 27 }],
  ['inexistente', {}],
  ['automation mismatch', { id: 27, automation_id: 88 }],
  ['owner mismatch', { id: 27, owner_user_id: 88 }],
  ['disabled', { id: 27, enabled: 0 }],
  ['revoked', { id: 27, revoked_at: '2026-10-02T00:00:00Z' }],
  ['active ausente', { id: 0 }],
  ['active mismatch', { id: 0, active_endpoint_id: 99 }],
];

test('B.3A publishVersion executa validação semântica antes da publicação', async () => {
  for (const [label, endpoint] of endpointCases) {
    const mock = installRepositoryMock({ endpoint: endpoint.id && endpoint.enabled !== 0 && !endpoint.revoked_at && endpoint.automation_id !== 88 && endpoint.owner_user_id !== 88 ? { id: 27 } : {} });
    try {
      if (label === 'válido') {
        const result = await publishVersion(1, 9, 22);
        assert.equal(result.status, 'active');
        assert.equal(mock.calls.some((query) => query.includes("SET status = 'published'")), true);
      } else {
        await assert.rejects(() => publishVersion(1, 9, 22));
        assert.equal(mock.calls.some((query) => query.includes("SET status = 'published'")), false, label);
      }
    } finally { mock.restore(); }
  }
});

test('B.3A activate revalida endpoint e nunca ativa estado inválido', async () => {
  for (const [label, endpoint] of endpointCases) {
    const mock = installRepositoryMock({ endpoint: endpoint.id && endpoint.enabled !== 0 && !endpoint.revoked_at && endpoint.automation_id !== 88 && endpoint.owner_user_id !== 88 ? { id: 27 } : {}, automationStatus: 'paused', versionStatus: 'published' });
    try {
      if (label === 'válido') {
        const result = await transitionAutomation(1, 9, 'activate');
        assert.equal(result.status, 'active');
        assert.equal(mock.calls.some((query) => query.includes("SET status = 'active'")), true);
      } else {
        await assert.rejects(() => transitionAutomation(1, 9, 'activate'));
        assert.equal(mock.calls.some((query) => query.includes("SET status = 'active'")), false, label);
      }
    } finally { mock.restore(); }
  }
});

test('B.3A publish válido seguido de revogação impede activate', async () => {
  let endpointAvailable = true;
  const database = require('../config/database');
  const pool = database.getPool();
  const original = pool.getConnection;
  const calls = [];
  const connection = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    execute: async (sql) => {
      const query = String(sql); calls.push(query);
      if (query.includes('FROM automations a')) return [[{ id: 9, owner_user_id: 1, status: 'paused', active_version_id: 22, active_version_number: 1 }]];
      if (query.includes('SELECT * FROM automation_versions')) return [[{ id: 22, automation_id: 9, version_number: 1, status: calls.some((item) => item.includes("SET status = 'published'")) ? 'published' : 'draft', definition: { schemaVersion: 1, trigger: { type: 'webhook.received', config: { webhookEndpointId: 27 }, next: 'finish_1' }, steps: [{ id: 'finish_1', type: 'finish', config: {} }] } }]];
      if (query.includes('SELECT e.id')) return [endpointAvailable ? [{ id: 27 }] : []];
      return [{ insertId: 1, affectedRows: 1 }, []];
    },
  };
  pool.getConnection = async () => connection;
  try {
    await publishVersion(1, 9, 22);
    endpointAvailable = false;
    await assert.rejects(() => transitionAutomation(1, 9, 'activate'));
    assert.equal(calls.some((query) => query.includes("SET status = 'active'")), false);
  } finally { pool.getConnection = original; }
});

test('B.3A dois eventos da mesma automação preservam payload por event_id após Wait', () => {
  const makeCurrent = (eventId, endpointId, email) => ({ automation_id: 9, owner_user_id: 1, entity_type: 'webhook_endpoint', entity_id: String(endpointId), event_id: eventId, event_type: 'webhook.received', event_uuid: `event-${eventId}`, payload: JSON.stringify({ webhook: { body: { customer: { email } }, contentType: 'application/json', receivedAt: '2026-10-02T12:00:00Z' } }), lineage_depth: 0 });
  const resume = (current) => {
    const payload = JSON.parse(current.payload);
    return buildAutomationContext(current, { automation_run_id: current.event_id }, 'finish_1', `run:${current.event_id}:step:finish_1`, payload);
  };
  const runA = resume(makeCurrent(101, 27, 'a@example.test'));
  const runB = resume(makeCurrent(102, 28, 'b@example.test'));
  assert.equal(resolveVariable('webhook.body.customer.email', runA), 'a@example.test');
  assert.equal(resolveVariable('webhook.body.customer.email', runB), 'b@example.test');
  assert.equal(runA.leadId, undefined);
  assert.equal(runB.leadId, undefined);
  assert.equal(runA.webhookEndpointId, 27);
  assert.equal(runB.webhookEndpointId, 28);
  assert.equal(JSON.stringify(runA).includes('token'), false);
  assert.equal(JSON.stringify(runB).includes('headers'), false);
});
