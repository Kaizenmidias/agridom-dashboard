const { getPool } = require('../config/database');
const { parseEvent } = require('./domain-events');

function parsePage(value, fallback, max) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, max) : fallback;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 19).replace('T', ' ');
}

async function listDomainEvents(filters = {}) {
  const page = parsePage(filters.page, 1, 1000000);
  const pageSize = parsePage(filters.pageSize, 25, 100);
  const conditions = [];
  const params = [];
  if (filters.eventType) { conditions.push('ae.event_type = ?'); params.push(String(filters.eventType)); }
  if (filters.entityType) { conditions.push('ae.entity_type = ?'); params.push(String(filters.entityType)); }
  if (filters.entityId) { conditions.push('ae.entity_id = ?'); params.push(String(filters.entityId)); }
  if (filters.correlationId) { conditions.push('ae.correlation_id = ?'); params.push(String(filters.correlationId)); }
  const from = parseDate(filters.from); if (from) { conditions.push('ae.occurred_at >= ?'); params.push(from); }
  const to = parseDate(filters.to); if (to) { conditions.push('ae.occurred_at <= ?'); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const pool = getPool();
  const [countRows] = await pool.execute(`SELECT COUNT(*) AS total FROM automation_events ae ${where}`, params);
  const [rows] = await pool.execute(
    `SELECT ae.id, ae.event_uuid, ae.event_type, ae.entity_type, ae.entity_id, ae.actor_user_id,
            ae.correlation_id, ae.causation_id, ae.occurred_at, ae.created_at, u.name AS actor_name
     FROM automation_events ae LEFT JOIN users u ON u.id = ae.actor_user_id
     ${where} ORDER BY ae.occurred_at DESC, ae.id DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  return { events: rows.map(parseEvent), pagination: { page, pageSize, total: Number(countRows[0]?.total || 0), totalPages: Math.ceil(Number(countRows[0]?.total || 0) / pageSize) } };
}

async function getDomainEvent(id) {
  const [rows] = await getPool().execute(
    `SELECT ae.*, u.name AS actor_name FROM automation_events ae LEFT JOIN users u ON u.id = ae.actor_user_id WHERE ae.id = ? LIMIT 1`,
    [id]
  );
  return parseEvent(rows[0]);
}

module.exports = { listDomainEvents, getDomainEvent };
