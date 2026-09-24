const express = require('express');
const crypto = require('node:crypto');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess, requireCommercialAdmin } = require('../middleware/commercial-access');
const { getPool } = require('../config/database');
const { encryptSecret, decryptSecret } = require('../services/integration-crypto');
const { EvolutionWhatsAppProvider, validateBaseUrl } = require('../services/evolution-whatsapp-provider');
const { extractInbound, loadEvolutionConfig } = require('../services/whatsapp-service');
const { generateWebhookSecret } = require('../services/whatsapp-webhook-auth');

const router = express.Router();
const admin = [authenticateToken, requireCommercialAccess, requireCommercialAdmin];
const limits = new Map();
const allowed = (key, ms = 5000) => { const now = Date.now(); const previous = limits.get(key) || 0; if (now - previous < ms) return false; limits.set(key, now); return true; };
const parseJson = (value, fallback = {}) => { if (value && typeof value === 'object') return value; try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; } };
const publicConfig = (row) => { const metadata = parseJson(row?.configuration_metadata); return { provider: 'evolution', status: row?.status || 'not_configured', configured: Boolean(row?.secret_ciphertext && metadata.baseUrl), metadata: { baseUrl: metadata.baseUrl || '', timeout: metadata.timeout || 15000, apiKeyMasked: row?.secret_ciphertext ? '********' : '' }, lastTestedAt: row?.last_tested_at || null, lastError: row?.last_error || null }; };
const publicAccount = (row) => ({ id: Number(row.id), name: row.name, channel: row.channel, provider: row.provider, externalInstanceId: row.external_instance_id, phoneNumber: row.phone_number, displayName: row.display_name, status: row.status, autoCreateLeads: Boolean(row.auto_create_leads), lastConnectedAt: row.last_connected_at, lastDisconnectedAt: row.last_disconnected_at, createdAt: row.created_at, updatedAt: row.updated_at });
function resolveEvolutionCredential(rawApiKey, current) {
  const apiKey = String(rawApiKey || '').trim();
  const stored = current ? decryptSecret(current) : null;
  const resolvedApiKey = apiKey || stored?.apiKey;
  if (!resolvedApiKey) return null;
  const webhookSecret = stored?.webhookSecret || generateWebhookSecret();
  return { apiKey: resolvedApiKey, webhookSecret, envelope: encryptSecret({ apiKey: resolvedApiKey, webhookSecret }) };
}

async function persistEvolutionCredential(connection, current) {
  const credential = resolveEvolutionCredential('', current);
  if (!credential) return null;
  if (!credential.envelope || credential.webhookSecret === decryptSecret(current)?.webhookSecret) return credential;
  await connection.execute('UPDATE integration_providers SET secret_ciphertext = ?, secret_iv = ?, secret_auth_tag = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [credential.envelope.ciphertext, credential.envelope.iv, credential.envelope.authTag, current.id]);
  return credential;
}

router.get('/config', ...admin, async (_req, res) => {
  try { const [rows] = await getPool().execute("SELECT * FROM integration_providers WHERE provider = 'evolution' LIMIT 1"); res.json(rows[0] ? publicConfig(rows[0]) : publicConfig(null)); }
  catch { res.status(500).json({ error: 'Nao foi possivel carregar a integracao WhatsApp.' }); }
});

router.put('/config', ...admin, async (req, res) => {
  try {
    const baseUrl = validateBaseUrl(req.body?.baseUrl);
    const connection = await getPool().getConnection();
    try {
      const [currentRows] = await connection.execute("SELECT * FROM integration_providers WHERE provider = 'evolution' LIMIT 1");
      const current = currentRows[0];
      const credential = resolveEvolutionCredential(req.body?.apiKey, current);
      if (!credential) return res.status(400).json({ error: 'API Key da Evolution e obrigatoria.' });
       await connection.execute(`INSERT INTO integration_providers (provider, display_name, status, configuration_metadata, secret_ciphertext, secret_iv, secret_auth_tag) VALUES ('evolution', 'WhatsApp / Evolution API', 'configured', ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE status = 'configured', configuration_metadata = VALUES(configuration_metadata), secret_ciphertext = VALUES(secret_ciphertext), secret_iv = VALUES(secret_iv), secret_auth_tag = VALUES(secret_auth_tag), updated_at = CURRENT_TIMESTAMP`, [JSON.stringify({ baseUrl, timeout: Math.min(Math.max(Number(req.body?.timeout || 15000), 3000), 30000) }), credential.envelope?.ciphertext || current?.secret_ciphertext || null, credential.envelope?.iv || current?.secret_iv || null, credential.envelope?.authTag || current?.secret_auth_tag || null]);
      const [rows] = await connection.execute("SELECT * FROM integration_providers WHERE provider = 'evolution' LIMIT 1");
      res.json(publicConfig(rows[0]));
    } finally { connection.release(); }
  } catch (error) {
    if (error?.code === 'INTEGRATION_ENCRYPTION_KEY_MISSING') return res.status(500).json({ error: 'Servidor sem INTEGRATION_ENCRYPTION_KEY configurada.' });
    if (error?.code === 'ERR_OSSL_BAD_DECRYPT') return res.status(500).json({ error: 'A credencial Evolution armazenada nao pode ser descriptografada. Verifique a INTEGRATION_ENCRYPTION_KEY do servidor.' });
    res.status(400).json({ error: error?.publicMessage || error?.message || 'Nao foi possivel salvar a integracao WhatsApp.' });
  }
});

router.post('/config/test-connection', ...admin, async (_req, res) => {
  if (!allowed(`${_req.userId}:wa-config-test`, 10000)) return res.status(429).json({ error: 'Aguarde alguns segundos antes de testar novamente.' });
  try {
    const [rows] = await getPool().execute("SELECT * FROM integration_providers WHERE provider = 'evolution' LIMIT 1");
    if (!rows[0]) return res.status(409).json({ error: 'Configure a Evolution API antes de testar.' });
    const { provider } = await loadEvolutionConfig(getPool(), { integration_provider_id: rows[0].id });
    await provider.request('GET', '/instance/fetchInstances');
    await getPool().execute("UPDATE integration_providers SET status = 'connected', last_tested_at = UTC_TIMESTAMP(), last_test_status = 'success', last_error = NULL WHERE id = ?", [rows[0].id]);
    res.json({ success: true, message: 'Conexao com a Evolution realizada com sucesso.' });
  } catch (error) { res.status(400).json({ error: error?.publicMessage || 'Nao foi possivel conectar a Evolution.' }); }
});

router.get('/accounts', ...admin, async (_req, res) => {
  try { const [rows] = await getPool().execute("SELECT * FROM communication_accounts WHERE channel = 'whatsapp' AND archived_at IS NULL ORDER BY name"); res.json({ accounts: rows.map(publicAccount) }); }
  catch { res.status(500).json({ error: 'Nao foi possivel carregar os numeros WhatsApp.' }); }
});

router.post('/accounts', ...admin, async (req, res) => {
  if (!allowed(`${req.userId}:wa-account-create`, 1500)) return res.status(429).json({ error: 'Aguarde antes de criar outra conexao.' });
  const name = String(req.body?.name || '').trim();
  const instanceName = String(req.body?.instanceName || name).trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100);
  if (!name || !instanceName) return res.status(400).json({ error: 'Nome da conexao e obrigatorio.' });
  try {
    const [configRows] = await getPool().execute("SELECT * FROM integration_providers WHERE provider = 'evolution' LIMIT 1");
    if (!configRows[0]) return res.status(409).json({ error: 'Configure a Evolution API antes de conectar um numero.' });
     const connection = await getPool().getConnection();
     let credential;
     try { credential = await persistEvolutionCredential(connection, configRows[0]); } finally { connection.release(); }
     const { provider } = await loadEvolutionConfig(getPool(), { integration_provider_id: configRows[0].id });
     const publicApiUrl = process.env.PUBLIC_API_URL || process.env.BACKEND_URL || '';
     const webhookUrl = publicApiUrl ? `${publicApiUrl.replace(/\/$/, '')}/api/webhooks/evolution` : undefined;
     const created = await provider.createInstance({ instanceName, webhookUrl });
     if (webhookUrl && credential?.webhookSecret) await provider.setWebhook(created.externalInstanceId || instanceName, { url: webhookUrl, secret: credential.webhookSecret });
    const [result] = await getPool().execute(`INSERT INTO communication_accounts (channel, provider, name, external_instance_id, status, integration_provider_id, owner_user_id, auto_create_leads, metadata) VALUES ('whatsapp', 'evolution', ?, ?, 'pending', ?, ?, ?, ?)` , [name, created.externalInstanceId || instanceName, configRows[0].id, req.userId, req.body?.autoCreateLeads === false ? 0 : 1, JSON.stringify({ providerVersion: 'v2', webhookConfigured: Boolean(webhookUrl) })]);
    const [rows] = await getPool().execute('SELECT * FROM communication_accounts WHERE id = ?', [result.insertId]);
    res.status(201).json({ account: publicAccount(rows[0]) });
  } catch (error) { res.status(400).json({ error: error?.publicMessage || 'Nao foi possivel criar a instancia WhatsApp.' }); }
});

router.post('/accounts/:id/webhook/sync', ...admin, async (req, res) => {
  try {
    const [accounts] = await getPool().execute("SELECT * FROM communication_accounts WHERE id = ? AND archived_at IS NULL AND provider = 'evolution' LIMIT 1", [req.params.id]);
    const account = accounts[0];
    if (!account) return res.status(404).json({ error: 'Conexao WhatsApp nao encontrada.' });
    const [configRows] = await getPool().execute("SELECT * FROM integration_providers WHERE id = ? AND provider = 'evolution' LIMIT 1", [account.integration_provider_id]);
    if (!configRows[0]) return res.status(409).json({ error: 'Configure a Evolution API antes de sincronizar o webhook.' });
    const connection = await getPool().getConnection();
    let credential;
    try { credential = await persistEvolutionCredential(connection, configRows[0]); } finally { connection.release(); }
    if (!credential) return res.status(409).json({ error: 'Configure a API Key da Evolution antes de sincronizar o webhook.' });
    const { provider } = await loadEvolutionConfig(getPool(), account);
    const publicApiUrl = process.env.PUBLIC_API_URL || process.env.BACKEND_URL || '';
    if (!publicApiUrl) return res.status(409).json({ error: 'PUBLIC_API_URL ou BACKEND_URL nao configurada no servidor.' });
    await provider.setWebhook(account.external_instance_id, { url: `${publicApiUrl.replace(/\/$/, '')}/api/webhooks/evolution`, secret: credential.webhookSecret });
    await getPool().execute("UPDATE communication_accounts SET metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.webhookConfigured', true), updated_at = CURRENT_TIMESTAMP WHERE id = ?", [account.id]);
    res.json({ success: true, account: publicAccount(account) });
  } catch (error) { res.status(400).json({ error: error?.publicMessage || 'Nao foi possivel sincronizar o webhook WhatsApp.' }); }
});

router.get('/accounts/:id/qr', ...admin, async (req, res) => {
  try {
    const [rows] = await getPool().execute("SELECT * FROM communication_accounts WHERE id = ? AND archived_at IS NULL", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Conexao WhatsApp nao encontrada.' });
    const { provider } = await loadEvolutionConfig(getPool(), rows[0]);
    const result = await provider.connect(rows[0].external_instance_id);
    await getPool().execute("UPDATE communication_accounts SET status = 'qr_required', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [rows[0].id]);
    res.json({ status: 'qr_required', qrCode: result.qrCode, pairingCode: result.pairingCode || null });
  } catch (error) { res.status(400).json({ error: error?.publicMessage || 'Nao foi possivel gerar o QR Code.' }); }
});

router.get('/accounts/:id/status', ...admin, async (req, res) => {
  try {
    const [rows] = await getPool().execute("SELECT * FROM communication_accounts WHERE id = ? AND archived_at IS NULL", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Conexao WhatsApp nao encontrada.' });
    const { provider } = await loadEvolutionConfig(getPool(), rows[0]);
    const result = await provider.status(rows[0].external_instance_id);
    const nextStatus = result.status === 'connected' ? 'connected' : result.status === 'disconnected' ? 'disconnected' : 'connecting';
    await getPool().execute(`UPDATE communication_accounts SET status = ?, last_connected_at = IF(? = 'connected', COALESCE(last_connected_at, UTC_TIMESTAMP()), last_connected_at), last_disconnected_at = IF(? = 'disconnected', UTC_TIMESTAMP(), last_disconnected_at), updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [nextStatus, nextStatus, nextStatus, rows[0].id]);
    res.json({ status: nextStatus });
  } catch (error) { res.status(400).json({ error: error?.publicMessage || 'Nao foi possivel consultar o estado WhatsApp.' }); }
});

router.post('/accounts/:id/disconnect', ...admin, async (req, res) => {
  try {
    const [rows] = await getPool().execute("SELECT * FROM communication_accounts WHERE id = ? AND archived_at IS NULL", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Conexao WhatsApp nao encontrada.' });
    const { provider } = await loadEvolutionConfig(getPool(), rows[0]);
    await provider.logout(rows[0].external_instance_id);
    await getPool().execute("UPDATE communication_accounts SET status = 'disconnected', last_disconnected_at = UTC_TIMESTAMP() WHERE id = ?", [rows[0].id]);
    res.json({ success: true, status: 'disconnected' });
  } catch (error) { res.status(400).json({ error: error?.publicMessage || 'Nao foi possivel desconectar o WhatsApp.' }); }
});

router.delete('/accounts/:id', ...admin, async (req, res) => {
  try { const [result] = await getPool().execute("UPDATE communication_accounts SET archived_at = UTC_TIMESTAMP(), status = 'archived' WHERE id = ? AND archived_at IS NULL", [req.params.id]); if (!result.affectedRows) return res.status(404).json({ error: 'Conexao WhatsApp nao encontrada.' }); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'Nao foi possivel arquivar a conexao WhatsApp.' }); }
});

module.exports = router;
module.exports.resolveEvolutionCredential = resolveEvolutionCredential;
