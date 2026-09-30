const express = require('express');
const jwt = require('jsonwebtoken');
const { getPool } = require('../config/database');
const { encryptSecret, decryptSecret } = require('../services/integration-crypto');
const { testApifyActor, safeMessage } = require('../services/apify-integration-test');

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
  const result = await getQuery(req)("SELECT provider, display_name, status, configuration_metadata, secret_ciphertext FROM integration_providers ORDER BY display_name");
  res.json({
    integrations: (result.rows || []).map((row) => ({
      provider: row.provider,
      displayName: row.display_name,
      configured: Boolean(row.secret_ciphertext) && ['configured', 'connected', 'provider_error', 'auth_error'].includes(row.status),
      status: row.status,
      tokenMasked: row.secret_ciphertext ? '********' : '',
      metadata: { ...(typeof row.configuration_metadata === 'object' ? row.configuration_metadata : JSON.parse(row.configuration_metadata || '{}')), tokenConfigured: Boolean(row.secret_ciphertext) },
    })),
  });
});

router.put('/integrations/:provider', async (req, res) => {
  if (req.params.provider !== 'apify') return res.status(400).json({ error: 'Integracao nao suportada nesta fase.' });
  const metadata = req.body?.metadata || {};
  const connection = await getPool().getConnection();
  try {
    const [currentRows] = await connection.execute('SELECT * FROM integration_providers WHERE provider = ? LIMIT 1', [req.params.provider]);
    const current = currentRows[0];
    const token = String(metadata.token || '').trim();
    const envelope = token ? encryptSecret({ token }) : null;
    const safeMetadata = { googleMapsActorId: String(metadata.googleMapsActorId || ''), instagramActorId: String(metadata.instagramActorId || ''), timeoutMinutes: Number(metadata.timeoutMinutes || 10), pollIntervalSeconds: Number(metadata.pollIntervalSeconds || 5) };
    await connection.execute(`INSERT INTO integration_providers (provider, display_name, status, configuration_metadata, secret_ciphertext, secret_iv, secret_auth_tag)
      VALUES ('apify', 'Apify', 'configured', ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE status = 'configured', configuration_metadata = VALUES(configuration_metadata), secret_ciphertext = COALESCE(VALUES(secret_ciphertext), secret_ciphertext), secret_iv = COALESCE(VALUES(secret_iv), secret_iv), secret_auth_tag = COALESCE(VALUES(secret_auth_tag), secret_auth_tag), updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify(safeMetadata), envelope?.ciphertext || current?.secret_ciphertext || null, envelope?.iv || current?.secret_iv || null, envelope?.authTag || current?.secret_auth_tag || null]);
    res.json({ provider: 'apify', displayName: 'Apify', configured: Boolean(envelope || current?.secret_ciphertext), status: 'configured', tokenMasked: envelope || current?.secret_ciphertext ? '********' : '', metadata: { ...safeMetadata, tokenConfigured: Boolean(envelope || current?.secret_ciphertext) } });
  } finally { connection.release(); }
});

router.post('/integrations/:provider/test', async (req, res) => {
  if (req.params.provider !== 'apify') return res.status(400).json({ error: 'Integracao nao suportada nesta fase.' });
  const [rows] = await getPool().execute("SELECT * FROM integration_providers WHERE provider = 'apify' LIMIT 1");
  if (!rows[0]?.secret_ciphertext) return res.status(409).json({ error: 'Configure a integracao Apify antes de testar.' });
  try {
    const token = decryptSecret(rows[0])?.token;
    const metadata = JSON.parse(rows[0].configuration_metadata || '{}');
    const actorId = String(metadata.googleMapsActorId || '').replace('/', '~');
    if (!actorId) return res.status(400).json({ error: 'Configure o Actor do Google Maps na integracao Apify.' });
    await testApifyActor({ token, actorId });
    await getPool().execute("UPDATE integration_providers SET status = 'connected', last_tested_at = CURRENT_TIMESTAMP, last_test_status = 'success', last_error = NULL WHERE provider = 'apify'");
    res.json({ success: true, message: 'Conexao com Apify validada.' });
  } catch (error) {
    console.error('[Apify] integration test failed', {
      provider: 'apify', operation: 'actor_metadata', actorId: error?.actorId || undefined,
      error_code: error?.code || 'APIFY_TEST_ERROR', provider_status: error?.providerStatus || null,
      provider_error_type: error?.providerErrorType || null, provider_error_code: error?.providerErrorCode || null,
      provider_message: safeMessage(error?.providerMessage), timeout: Boolean(error?.timeout),
    });
    if (error?.code) {
      await getPool().execute("UPDATE integration_providers SET status = ?, last_tested_at = CURRENT_TIMESTAMP, last_test_status = 'error', last_error = ? WHERE provider = 'apify'", [error.code === 'APIFY_INVALID_TOKEN' ? 'auth_error' : 'provider_error', safeMessage(error.message)]).catch(() => {});
    }
    res.status(error?.status || 502).json({ error: error?.message || 'Nao foi possivel validar a conexao com a Apify.', code: error?.code || 'APIFY_TEST_ERROR' });
  }
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
  await getQuery(req)("UPDATE prospecting_jobs SET status = CASE WHEN status IN ('queued', 'pending') THEN 'queued' ELSE status END, integration_provider = 'apify' WHERE id = ? AND created_by = ?", [req.params.id, req.userId]);
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
