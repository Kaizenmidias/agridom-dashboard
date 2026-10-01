const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess } = require('../middleware/commercial-access');
const { analyzeDiagnostic, normalizeUrl } = require('../services/website-diagnostic-service');
const router = express.Router();
const MAX_CONCURRENT = 2;
const activeUsers = new Set();
let activeCount = 0;
const publicError = (error) => { if (error?.code === 'DIAGNOSTIC_TIMEOUT') return { status: 504, code: error.code, error: 'Não foi possível concluir a análise dentro do tempo limite.' }; if (error?.code === 'ENRICHMENT_SSRF_BLOCKED' || error?.code === 'ENRICHMENT_URL_BLOCKED') return { status: 400, code: 'DIAGNOSTIC_URL_BLOCKED', error: 'O destino informado não pode ser analisado.' }; if (error?.code === 'ENRICHMENT_INVALID_URL' || error?.code === 'DIAGNOSTIC_NO_RESULT') return { status: 400, code: 'DIAGNOSTIC_INVALID_URL', error: 'Informe uma URL pública válida para análise.' }; return { status: 502, code: 'DIAGNOSTIC_UNAVAILABLE', error: 'Não foi possível concluir a análise deste site.' }; };
router.use(authenticateToken, requireCommercialAccess);
router.post('/analyze', async (req, res) => {
  const userKey = String(req.userId);
  if (activeCount >= MAX_CONCURRENT || activeUsers.has(userKey)) return res.status(429).json({ code: 'DIAGNOSTIC_BUSY', error: 'Já existem análises em andamento. Tente novamente em instantes.' });
  try { normalizeUrl(req.body?.url); } catch { return res.status(400).json({ code: 'DIAGNOSTIC_INVALID_URL', error: 'Informe uma URL pública válida para análise.' }); }
  activeCount += 1; activeUsers.add(userKey);
  try { const result = await analyzeDiagnostic({ url: req.body.url }); return res.json({ status: 'completed', result }); }
  catch (error) { const response = publicError(error); return res.status(response.status).json({ code: response.code, error: response.error }); }
  finally { activeCount -= 1; activeUsers.delete(userKey); }
});
module.exports = router;
