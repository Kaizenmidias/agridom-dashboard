const crypto = require('node:crypto');
const { getPool } = require('../config/database');
const { TRIGGER_TYPES } = require('./automation-catalog');

const EVENT_CONTRACTS = Object.freeze({
  'lead.created': ['leadId'],
  'lead.updated': ['leadId'],
  'lead.status_changed': ['leadId', 'oldStatus', 'newStatus'],
  'lead.pipeline_stage_changed': ['leadId', 'pipelineId', 'oldStageId', 'newStageId'],
  'lead.tag_added': ['leadId', 'labelId'],
  'lead.tag_removed': ['leadId', 'labelId'],
  'lead.assigned': ['leadId', 'oldUserId', 'newUserId'],
  'lead.converted': ['leadId'],
  'activity.created': ['activityId', 'leadId'],
  'activity.completed': ['activityId', 'leadId', 'completedAt'],
});

const FORBIDDEN_KEYS = new Set([
  'password', 'password_hash', 'authorization', 'jwt', 'token', 'secret', 'api_key',
  'access_token', 'refresh_token', 'credential', 'credentials',
]);

class DomainEventError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'DomainEventError';
    this.details = details;
  }
}

function normalizeUuid(value, field) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new DomainEventError(`${field} deve ser um UUID valido.`);
  }
  return text;
}

function sanitizePayload(value) {
  if (Array.isArray(value)) return value.map(sanitizePayload);
  if (!value || typeof value !== 'object') return value;
  return Object.entries(value).reduce((result, [key, child]) => {
    if (!FORBIDDEN_KEYS.has(key.toLowerCase())) result[key] = sanitizePayload(child);
    return result;
  }, {});
}

function validateEventInput(input) {
  if (!input || typeof input !== 'object') throw new DomainEventError('Evento de dominio invalido.');
  if (!TRIGGER_TYPES.includes(input.type)) throw new DomainEventError('Tipo de evento nao reconhecido.', [{ path: 'type' }]);
  const entityType = String(input.entityType || '').trim();
  const entityId = String(input.entityId ?? '').trim();
  if (!entityType || !entityId) throw new DomainEventError('entityType e entityId sao obrigatorios.');
  const payload = sanitizePayload(input.payload || {});
  const missing = (EVENT_CONTRACTS[input.type] || []).filter((key) => payload[key] === undefined);
  if (missing.length) throw new DomainEventError('Payload de evento incompleto.', missing.map((path) => ({ path })));
  return { entityType, entityId, payload };
}

async function findByIdempotency(connection, key) {
  if (!key) return null;
  const [rows] = await connection.execute('SELECT * FROM automation_events WHERE idempotency_key = ? LIMIT 1', [key]);
  return rows[0] || null;
}

function ensureSameIdempotentEvent(existing, input, validated) {
  if (!existing) return;
  if (existing.event_type !== input.type || existing.entity_type !== validated.entityType || String(existing.entity_id) !== String(validated.entityId)) {
    throw new DomainEventError('Idempotency-Key ja foi usada por outro evento.');
  }
}

function parseEvent(row) {
  if (!row) return null;
  let payload = row.payload;
  try { if (typeof payload === 'string') payload = JSON.parse(payload); } catch { payload = {}; }
  return { ...row, id: Number(row.id), actor_user_id: row.actor_user_id === null ? null : Number(row.actor_user_id), payload };
}

async function dispatchDomainEvent(input, options = {}) {
  const connection = options.connection || await getPool().getConnection();
  const ownsConnection = !options.connection;
  try {
    const validated = validateEventInput(input);
    const rawIdempotencyKey = input.idempotencyKey ? String(input.idempotencyKey).trim() : null;
    const payloadFingerprint = crypto.createHash('sha256').update(JSON.stringify(validated.payload)).digest('hex').slice(0, 16);
    const idempotencyKey = rawIdempotencyKey ? `${rawIdempotencyKey}:${input.type}:${validated.entityType}:${validated.entityId}:${payloadFingerprint}`.slice(0, 191) : null;
    const existing = await findByIdempotency(connection, idempotencyKey);
    if (existing) { ensureSameIdempotentEvent(existing, input, validated); return parseEvent(existing); }
    const eventUuid = crypto.randomUUID();
    const correlationId = normalizeUuid(input.correlationId, 'correlationId') || crypto.randomUUID();
    const causationId = normalizeUuid(input.causationId, 'causationId');
    const actorUserId = input.actorUserId === null || input.actorUserId === undefined ? null : Number(input.actorUserId);
    if (actorUserId !== null && (!Number.isSafeInteger(actorUserId) || actorUserId <= 0)) throw new DomainEventError('actorUserId invalido.');
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) throw new DomainEventError('occurredAt invalido.');
    try {
      const [result] = await connection.execute(
        `INSERT INTO automation_events
          (event_uuid, idempotency_key, event_type, entity_type, entity_id, actor_user_id, payload, correlation_id, causation_id, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [eventUuid, idempotencyKey, input.type, validated.entityType, validated.entityId, actorUserId, JSON.stringify(validated.payload), correlationId, causationId, occurredAt.toISOString().slice(0, 19).replace('T', ' ')]
      );
      const [rows] = await connection.execute('SELECT * FROM automation_events WHERE id = ?', [result.insertId]);
      console.info('Domain event persisted:', { type: input.type, event_uuid: eventUuid, entity_type: validated.entityType, entity_id: validated.entityId });
      return parseEvent(rows[0]);
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY' && idempotencyKey) {
        const duplicate = await findByIdempotency(connection, idempotencyKey);
        if (duplicate) { ensureSameIdempotentEvent(duplicate, input, validated); return parseEvent(duplicate); }
      }
      throw error;
    }
  } finally {
    if (ownsConnection) connection.release();
  }
}

function requestEventContext(req) {
  const idempotencyKey = req.get('Idempotency-Key') || null;
  const correlationId = req.get('X-Correlation-Id') || null;
  const causationId = req.get('X-Causation-Id') || null;
  return { idempotencyKey, correlationId, causationId };
}

module.exports = { EVENT_CONTRACTS, DomainEventError, dispatchDomainEvent, requestEventContext, sanitizePayload, validateEventInput, parseEvent };
