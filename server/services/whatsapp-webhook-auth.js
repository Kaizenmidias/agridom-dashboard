const crypto = require('node:crypto');

const WEBHOOK_SECRET_HEADER = 'x-kaizen-webhook-secret';

function generateWebhookSecret() {
  return crypto.randomBytes(32).toString('base64url');
}

function hasWebhookSecret(supplied, expected) {
  const received = Buffer.from(String(supplied || ''), 'utf8');
  const configured = Buffer.from(String(expected || ''), 'utf8');
  return received.length > 0 && received.length === configured.length && crypto.timingSafeEqual(received, configured);
}

function readWebhookSecret(req) {
  return req.get(WEBHOOK_SECRET_HEADER) || '';
}

module.exports = { WEBHOOK_SECRET_HEADER, generateWebhookSecret, hasWebhookSecret, readWebhookSecret };
