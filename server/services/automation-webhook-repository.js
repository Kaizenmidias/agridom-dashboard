const crypto = require('node:crypto');
const { getPool } = require('../config/database');
const { AutomationError } = require('./automation-repository');

const tokenHash = (token) => crypto.createHash('sha256').update(token, 'utf8').digest('hex');
const generateToken = () => crypto.randomBytes(32).toString('base64url');

const safeEndpoint = (row) => ({
  id: Number(row.id),
  automationId: Number(row.automation_id),
  enabled: Boolean(row.enabled),
  revoked: Boolean(row.revoked_at),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

async function withTransaction(work) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function ownedAutomation(connection, userId, automationId) {
  const [rows] = await connection.execute(
    'SELECT id, owner_user_id, status FROM automations WHERE id = ? AND owner_user_id = ? FOR UPDATE',
    [automationId, userId]
  );
  return rows[0] || null;
}

async function currentEndpoint(connection, automationId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT id, automation_id, owner_user_id, enabled, revoked_at, created_at, updated_at
     FROM automation_webhook_endpoints
     WHERE automation_id = ? AND revoked_at IS NULL
     LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [automationId]
  );
  return rows[0] || null;
}

async function createWebhookEndpoint(userId, automationId) {
  return withTransaction(async (connection) => {
    const automation = await ownedAutomation(connection, userId, automationId);
    if (!automation) throw new AutomationError(404, 'Automacao nao encontrada.');
    if (automation.status === 'archived') throw new AutomationError(409, 'Automacao arquivada nao aceita endpoint.');
    const existing = await currentEndpoint(connection, automationId, true);
    if (existing) return { created: false, endpoint: safeEndpoint(existing), token: null };

    const token = generateToken();
    let result;
    try {
      [result] = await connection.execute(
        `INSERT INTO automation_webhook_endpoints (automation_id, owner_user_id, token_hash)
         VALUES (?, ?, ?)`,
        [automationId, userId, tokenHash(token)]
      );
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        throw new AutomationError(409, 'Endpoint de webhook ja existe.');
      }
      throw new AutomationError(500, 'Nao foi possivel criar o endpoint de webhook.');
    }
    const endpoint = { id: Number(result.insertId), automation_id: automationId, enabled: 1, revoked_at: null };
    return { created: true, endpoint: safeEndpoint(endpoint), token };
  });
}

async function getWebhookEndpoint(userId, automationId) {
  const [rows] = await getPool().execute(
    `SELECT e.id, e.automation_id, e.enabled, e.revoked_at, e.created_at, e.updated_at
     FROM automation_webhook_endpoints e
     JOIN automations a ON a.id = e.automation_id
     WHERE e.automation_id = ? AND a.owner_user_id = ?
     ORDER BY e.id DESC LIMIT 1`,
    [automationId, userId]
  );
  return rows[0] ? safeEndpoint(rows[0]) : { exists: false };
}

async function regenerateWebhookEndpoint(userId, automationId) {
  return withTransaction(async (connection) => {
    const automation = await ownedAutomation(connection, userId, automationId);
    if (!automation) throw new AutomationError(404, 'Automacao nao encontrada.');
    if (automation.status === 'archived') throw new AutomationError(409, 'Automacao arquivada nao aceita regeneracao de endpoint.');
    const endpoint = await currentEndpoint(connection, automationId, true);
    if (!endpoint) throw new AutomationError(409, 'Endpoint de webhook nao encontrado ou revogado.');
    const token = generateToken();
    try {
      await connection.execute(
        'UPDATE automation_webhook_endpoints SET token_hash = ?, enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [tokenHash(token), endpoint.id]
      );
    } catch {
      throw new AutomationError(500, 'Nao foi possivel regenerar o endpoint de webhook.');
    }
    return { endpoint: { ...safeEndpoint(endpoint), enabled: true, revoked: false }, token };
  });
}

async function revokeWebhookEndpoint(userId, automationId) {
  return withTransaction(async (connection) => {
    const automation = await ownedAutomation(connection, userId, automationId);
    if (!automation) throw new AutomationError(404, 'Automacao nao encontrada.');
    const endpoint = await currentEndpoint(connection, automationId, true);
    if (!endpoint) return { revoked: false };
    await connection.execute(
      'UPDATE automation_webhook_endpoints SET enabled = 0, revoked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [endpoint.id]
    );
    return { revoked: true };
  });
}

module.exports = { tokenHash, generateToken, safeEndpoint, createWebhookEndpoint, getWebhookEndpoint, regenerateWebhookEndpoint, revokeWebhookEndpoint };
