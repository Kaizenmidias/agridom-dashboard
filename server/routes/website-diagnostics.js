const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess } = require('../middleware/commercial-access');
const { analyzeDiagnostic, normalizeUrl } = require('../services/website-diagnostic-service');
const { createPerformanceJob, getPerformanceJob } = require('../services/lighthouse-performance');
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
router.post('/performance', (req, res) => {
  const created = createPerformanceJob({ ownerUserId: req.userId, url: req.body?.url, strategy: req.body?.strategy || 'mobile' });
  if (created.error) {
    const status = ['LIGHTHOUSE_BUSY', 'LIGHTHOUSE_RATE_LIMITED'].includes(created.error) ? 429 : 400;
    return res.status(status).json({ code: created.error, error: status === 429 ? 'JÃ¡ existe uma mediÃ§Ã£o de performance em andamento ou muito recente.' : 'Informe uma URL pÃºblica vÃ¡lida e use a estratÃ©gia mobile.' });
  }
  return res.status(202).json(created.job);
});
router.get('/performance/:token', (req, res) => {
  const job = getPerformanceJob({ token: req.params.token, ownerUserId: req.userId });
  if (!job) return res.status(404).json({ code: 'LIGHTHOUSE_JOB_NOT_FOUND', error: 'MediÃ§Ã£o nÃ£o encontrada ou expirada.' });
  return res.json(job);
});
module.exports = router;
