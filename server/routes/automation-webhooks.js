const express = require('express');
const { acceptAutomationWebhook } = require('../services/automation-webhook-ingress');

const router = express.Router();
const jsonParser = express.json({ limit: '256kb', strict: true, type: ['application/json'] });

function publicError(error) {
  if (error?.type === 'entity.too.large' || error?.status === 413) return { status: 413, body: { error: 'Payload muito grande.' } };
  if (error?.type === 'entity.parse.failed') return { status: 400, body: { error: 'JSON invalido.' } };
  if (error?.code === 'WEBHOOK_PAYLOAD_LIMIT') return { status: 400, body: { error: 'Estrutura do payload excede os limites permitidos.' } };
  if (error?.code === 'WEBHOOK_PAYLOAD_INVALID') return { status: 400, body: { error: 'Payload invalido.' } };
  if (error?.publicStatus === 429) return { status: 429, body: { error: 'Webhook temporariamente limitado.' } };
  if (error?.code === 'WEBHOOK_NOT_FOUND') return { status: 404, body: { error: 'Webhook nao encontrado.' } };
  return { status: 500, body: { error: 'Nao foi possivel aceitar o webhook.' } };
}

router.use(jsonParser);
router.post('/', async (req, res) => {
  if (!req.is('application/json')) return res.status(415).json({ error: 'Content-Type nao permitido.' });
  if (!req.body || Array.isArray(req.body) || typeof req.body !== 'object') return res.status(400).json({ error: 'Body JSON deve ser um objeto.' });
  const rawToken = req.headers['x-webhook-token'];
  if (Array.isArray(rawToken) || typeof rawToken !== 'string' || !rawToken) return res.status(404).json({ error: 'Webhook nao encontrado.' });
  try { return res.status(202).json(await acceptAutomationWebhook({ rawToken, body: req.body, contentType: req.get('content-type') || 'application/json' })); } catch (error) { const result = publicError(error); return res.status(result.status).json(result.body); }
});

router.use((error, _req, res, _next) => { const result = publicError(error); res.status(result.status).json(result.body); });

module.exports = { automationWebhooksRouter: router, publicError };
