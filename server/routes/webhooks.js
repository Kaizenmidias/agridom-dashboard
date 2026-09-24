const express = require('express');
const crypto = require('node:crypto');
const { getPool } = require('../config/database');
const { decryptSecret } = require('../services/integration-crypto');
const { extractInbound } = require('../services/whatsapp-service');
const { hasWebhookSecret, readWebhookSecret } = require('../services/whatsapp-webhook-auth');

const router = express.Router();
const hit = new Map();
router.post('/evolution', async (req, res) => {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  if (now - (hit.get(ip) || 0) < 100) return res.status(429).json({ error: 'Webhook temporariamente limitado.' });
  hit.set(ip, now);
  const payload = req.body && typeof req.body === 'object' ? req.body : null;
  if (!payload) return res.status(400).json({ error: 'Payload JSON invalido.' });
  const instance = String(payload.instance || payload.data?.instance || payload.data?.instanceName || '').trim();
  if (!instance) return res.status(400).json({ error: 'Instancia Evolution ausente.' });
  try {
    const [accounts] = await getPool().execute("SELECT ca.*, ip.secret_ciphertext, ip.secret_iv, ip.secret_auth_tag FROM communication_accounts ca JOIN integration_providers ip ON ip.id = ca.integration_provider_id WHERE ca.external_instance_id = ? AND ca.archived_at IS NULL LIMIT 1", [instance]);
    const account = accounts[0];
    if (!account) return res.status(404).json({ error: 'Instancia Evolution nao reconhecida.' });
    const secret = decryptSecret(account);
    if (!hasWebhookSecret(readWebhookSecret(req), secret?.webhookSecret)) return res.status(401).json({ error: 'Webhook nao autorizado.' });
    const parsed = extractInbound(payload);
    const eventId = parsed.externalMessageId || crypto.createHash('sha256').update(JSON.stringify({ instance, event: payload.event || payload.type || 'unknown', data: payload.data || payload })).digest('hex');
    const eventType = String(payload.event || payload.type || 'unknown').slice(0, 80);
    const minimalPayload = { event: eventType, instance, data: payload.data || payload };
    const [result] = await getPool().execute(`INSERT INTO communication_webhook_events (communication_account_id, external_event_id, event_type, payload) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`, [account.id, eventId, eventType, JSON.stringify(minimalPayload)]);
    res.status(202).json({ accepted: true, duplicate: !result.insertId, eventId });
  } catch (error) { res.status(400).json({ error: error?.publicMessage || 'Nao foi possivel aceitar o webhook.' }); }
});

module.exports = router;
