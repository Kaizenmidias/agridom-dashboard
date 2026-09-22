const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const getQuery = (req) => req.app.locals.query;

const authenticateRequest = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token nao fornecido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalido' });
  }
};

router.use(authenticateRequest);

router.get('/integrations', async (req, res) => {
  const result = await getQuery(req)('SELECT provider, display_name, status, configuration_metadata FROM integration_providers ORDER BY display_name');
  res.json({
    integrations: (result.rows || []).map((row) => ({
      provider: row.provider,
      displayName: row.display_name,
      configured: row.status === 'configured',
      status: row.status,
      metadata: row.configuration_metadata || {},
    })),
  });
});

router.put('/integrations/:provider', async (req, res) => {
  const metadata = req.body?.metadata || {};
  await getQuery(req)(
    `INSERT INTO integration_providers (provider, display_name, status, configuration_metadata)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE status = VALUES(status), configuration_metadata = VALUES(configuration_metadata), updated_at = CURRENT_TIMESTAMP`,
    [req.params.provider, req.params.provider, 'configured', JSON.stringify(metadata)]
  );
  res.json({ provider: req.params.provider, configured: true, metadata });
});

router.post('/integrations/:provider/test', async (req, res) => {
  res.json({ success: true, message: `Integracao ${req.params.provider} registrada.` });
});

router.get('/cnaes', async (req, res) => {
  const search = `%${String(req.query.query || '').trim()}%`;
  const result = await getQuery(req)(
    `SELECT id, code, formatted_code AS formattedCode, description, section
     FROM cnae_codes
     WHERE code LIKE ? OR formatted_code LIKE ? OR description LIKE ?
     ORDER BY description
     LIMIT 20`,
    [search, search, search]
  );
  res.json({ items: result.rows || [] });
});

router.get('/cities', async (req, res) => {
  const state = String(req.query.state || '');
  if (!state) return res.json({ items: [] });
  const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${encodeURIComponent(state)}/municipios`);
  const data = await response.json();
  res.json({ items: (Array.isArray(data) ? data : []).map((city) => ({ id: String(city.id), name: String(city.nome), state })) });
});

router.post('/jobs', async (req, res) => {
  const { randomUUID } = require('crypto');
  const id = randomUUID();
  const quantity = Number(req.body?.quantity || req.body?.requestedQuantity || 20);
  await getQuery(req)(
    `INSERT INTO prospecting_jobs (id, source, status, search_parameters, requested_quantity, created_by)
     VALUES (?, ?, 'queued', ?, ?, ?)`,
    [id, req.body?.source || 'google_maps', JSON.stringify(req.body || {}), quantity, req.userId]
  );
  const result = await getQuery(req)('SELECT * FROM prospecting_jobs WHERE id = ?', [id]);
  res.status(201).json(result.rows[0]);
});

router.post('/jobs/:id/start', async (req, res) => {
  await getQuery(req)("UPDATE prospecting_jobs SET status = 'completed', started_at = CURRENT_TIMESTAMP, completed_at = CURRENT_TIMESTAMP WHERE id = ? AND created_by = ?", [req.params.id, req.userId]);
  const result = await getQuery(req)('SELECT * FROM prospecting_jobs WHERE id = ? AND created_by = ?', [req.params.id, req.userId]);
  if (!result.rows?.length) return res.status(404).json({ error: 'Job nao encontrado' });
  res.json(result.rows[0]);
});

router.get('/jobs/:id', async (req, res) => {
  const query = getQuery(req);
  const job = await query('SELECT * FROM prospecting_jobs WHERE id = ? AND created_by = ?', [req.params.id, req.userId]);
  if (!job.rows?.length) return res.status(404).json({ error: 'Job nao encontrado' });
  const events = await query('SELECT * FROM prospecting_job_events WHERE job_id = ? ORDER BY created_at', [req.params.id]);
  res.json({ job: job.rows[0], events: events.rows || [] });
});

router.post('/jobs/:id/cancel', async (req, res) => {
  await getQuery(req)("UPDATE prospecting_jobs SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND created_by = ?", [req.params.id, req.userId]);
  const result = await getQuery(req)('SELECT * FROM prospecting_jobs WHERE id = ? AND created_by = ?', [req.params.id, req.userId]);
  if (!result.rows?.length) return res.status(404).json({ error: 'Job nao encontrado' });
  res.json(result.rows[0]);
});

router.get('/jobs/:id/results', async (req, res) => {
  const result = await getQuery(req)('SELECT * FROM prospecting_results WHERE job_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json({ items: result.rows || [] });
});

router.post('/imports', async (req, res) => {
  res.json({ imported: 0, skippedDuplicates: 0, failed: 0, message: 'Importacao direta ainda nao configurada.' });
});

router.get('/history', async (req, res) => {
  const result = await getQuery(req)('SELECT * FROM prospecting_jobs WHERE created_by = ? ORDER BY created_at DESC LIMIT 20', [req.userId]);
  res.json({ items: result.rows || [] });
});

module.exports = router;
