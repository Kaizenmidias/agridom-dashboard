const crypto = require('node:crypto');
const { getPool } = require('../config/database');
const { dispatchDomainEvent } = require('./domain-events');
const { findInboundEndpoint } = require('./automation-webhook-repository');
const { allowUnknown, allowValid, refundUnknown } = require('./automation-webhook-rate-limit');
const { sanitizeWebhookPayload } = require('./automation-webhook-payload');

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function hashInboundToken(rawToken) {
  if (typeof rawToken !== 'string' || !TOKEN_PATTERN.test(rawToken)) return null;
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

function notFoundError() { return Object.assign(new Error('WEBHOOK_NOT_FOUND'), { code: 'WEBHOOK_NOT_FOUND', publicStatus: 404 }); }

async function acceptAutomationWebhook({ rawToken, body, contentType = 'application/json', now = new Date() } = {}) {
  const hash = hashInboundToken(rawToken);
  if (!hash) {
    if (!allowUnknown()) throw Object.assign(new Error('RATE_LIMITED'), { publicStatus: 429 });
    throw notFoundError();
  }
  if (!allowUnknown()) throw Object.assign(new Error('RATE_LIMITED'), { publicStatus: 429 });
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const endpoint = await findInboundEndpoint(connection, hash);
    if (!endpoint) {
      await connection.rollback();
      throw notFoundError();
    }
    refundUnknown();
    if (!allowValid(hash)) {
      await connection.rollback();
      throw Object.assign(new Error('RATE_LIMITED'), { publicStatus: 429 });
    }
    const sanitizedBody = sanitizeWebhookPayload(body);
    await dispatchDomainEvent({
      type: 'webhook.received', entityType: 'webhook_endpoint', entityId: String(endpoint.id),
      payload: { webhook: { body: sanitizedBody, contentType, receivedAt: now.toISOString() } },
      actorUserId: null, correlationId: null, causationId: null, sourceAutomationId: null,
      lineageDepth: 0, idempotencyKey: null,
    }, { connection, suppressLog: true });
    await connection.commit();
    return { accepted: true };
  } catch (error) {
    if (error?.code !== 'WEBHOOK_NOT_FOUND' && error?.publicStatus !== 429) await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

module.exports = { TOKEN_PATTERN, acceptAutomationWebhook, hashInboundToken };
