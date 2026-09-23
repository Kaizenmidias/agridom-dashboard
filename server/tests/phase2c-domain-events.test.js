const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { EVENT_CONTRACTS, dispatchDomainEvent, sanitizePayload, validateEventInput } = require('../services/domain-events');

const prospection = fs.readFileSync(path.join(__dirname, '../routes/prospection.js'), 'utf8');
const commercial = fs.readFileSync(path.join(__dirname, '../routes/commercial-entities.js'), 'utf8');
const dispatcher = fs.readFileSync(path.join(__dirname, '../services/domain-events.js'), 'utf8');

test('domain event contracts cover the Phase 2C event catalog', () => {
  for (const type of ['lead.created', 'lead.updated', 'lead.status_changed', 'lead.pipeline_stage_changed', 'lead.tag_added', 'lead.tag_removed', 'lead.assigned', 'activity.created', 'activity.completed']) {
    assert.ok(EVENT_CONTRACTS[type]);
  }
  assert.equal(validateEventInput({ type: 'lead.status_changed', entityType: 'lead', entityId: 1, payload: { leadId: 1, oldStatus: 'Novo', newStatus: 'Qualificado' } }).entityType, 'lead');
  assert.throws(() => validateEventInput({ type: 'lead.status_changed', entityType: 'lead', entityId: 1, payload: { leadId: 1 } }), /incompleto/);
});

test('event payload sanitization removes sensitive keys without serializing request objects', () => {
  const payload = sanitizePayload({ leadId: 1, nested: { token: 'secret', safe: true }, authorization: 'Bearer x', headers: { Authorization: 'x' } });
  assert.deepEqual(payload, { leadId: 1, nested: { safe: true }, headers: {} });
  assert.doesNotMatch(dispatcher, /console\.log\([^)]*payload/);
});

test('dispatcher persists UUID, actor, correlation and causation on an external connection', async () => {
  const calls = [];
  let insertParams;
  const connection = {
    async execute(sql, params) {
      calls.push({ sql, params });
      if (sql.startsWith('SELECT * FROM automation_events WHERE idempotency_key')) return [[]];
      if (sql.startsWith('INSERT INTO automation_events')) { insertParams = params; return [{ insertId: 9 }]; }
      return [[{ id: 9, event_uuid: insertParams?.[0], event_type: 'lead.created', entity_type: 'lead', entity_id: '7', actor_user_id: 3, payload: '{"leadId":7}', correlation_id: insertParams?.[7], causation_id: insertParams?.[8], occurred_at: '2026-09-23 12:00:00' }]];
    },
  };
  const event = await dispatchDomainEvent({ type: 'lead.created', entityType: 'lead', entityId: 7, actorUserId: 3, payload: { leadId: 7 }, correlationId: '123e4567-e89b-12d3-a456-426614174000', causationId: '123e4567-e89b-12d3-a456-426614174001' }, { connection });
  assert.equal(event.id, 9);
  assert.match(event.event_uuid, /^[0-9a-f-]{36}$/i);
  assert.equal(calls.filter((call) => call.sql.startsWith('INSERT INTO automation_events')).length, 1);
  assert.equal(calls.find((call) => call.sql.startsWith('INSERT INTO automation_events')).params[7], '123e4567-e89b-12d3-a456-426614174000');
});

test('commercial write paths dispatch events through an existing MySQL connection', () => {
  assert.match(prospection, /dispatchDomainEvent\(\{[\s\S]*type: 'lead\.created'/);
  assert.match(prospection, /type: 'lead\.status_changed'/);
  assert.match(prospection, /type: 'lead\.assigned'/);
  assert.match(prospection, /type: 'lead\.updated'/);
  assert.match(prospection, /\{ connection \}/);
  assert.match(commercial, /type: 'lead\.pipeline_stage_changed'/);
  assert.match(commercial, /type: 'lead\.tag_added'/);
  assert.match(commercial, /type: 'lead\.tag_removed'/);
  assert.match(commercial, /type: 'activity\.created'/);
  assert.match(commercial, /type: 'activity\.completed'/);
  assert.match(commercial, /SELECT \* FROM prospect_pipeline_positions[\s\S]*FOR UPDATE/);
});

test('Phase 2C never creates runs, steps or jobs as an event side effect', () => {
  assert.doesNotMatch(dispatcher, /INSERT INTO automation_(runs|run_steps|jobs)/i);
  assert.doesNotMatch(prospection, /INSERT INTO automation_(runs|run_steps|jobs)/i);
  assert.doesNotMatch(commercial, /INSERT INTO automation_(runs|run_steps|jobs)/i);
});

test('event audit route is protected, paginated and exposes detail endpoint', () => {
  const routeFile = fs.readFileSync(path.join(__dirname, '../routes/domain-events.js'), 'utf8');
  assert.match(routeFile, /authenticateToken/);
  assert.match(routeFile, /requireCommercialAdmin/);
  assert.match(routeFile, /page_size/);
  assert.match(routeFile, /router\.get\('\/:id'/);
});
