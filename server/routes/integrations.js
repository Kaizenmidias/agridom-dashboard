const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess, requireCommercialAdmin } = require('../middleware/commercial-access');
const { getPool } = require('../config/database');
const { encryptSecret, decryptSecret } = require('../services/integration-crypto');
const { validateSmtpConfig, verifySmtp, sendSmtp } = require('../services/email-provider');

const router = express.Router();
const lastRequests = new Map();
const rateLimit = (key) => {
  const now = Date.now();
  const previous = lastRequests.get(key) || 0;
  if (now - previous < 10000) return false;
  lastRequests.set(key, now);
  return true;
};

router.use(authenticateToken, requireCommercialAccess, requireCommercialAdmin);

function publicEmail(row) {
  const metadata = typeof row.configuration_metadata === 'object' ? row.configuration_metadata : JSON.parse(row.configuration_metadata || '{}');
  return {
    provider: 'email',
    status: row.status || 'not_configured',
    configured: row.status === 'configured' || row.status === 'connected' || row.status === 'provider_error' || row.status === 'auth_error',
    lastTestedAt: row.last_tested_at,
    lastTestStatus: row.last_test_status,
    lastError: row.last_error,
    metadata: { ...metadata, passwordMasked: row.secret_ciphertext ? '********' : '' },
  };
}

async function getEmailRow(connection) {
  const [rows] = await connection.execute("SELECT * FROM integration_providers WHERE provider = 'smtp' LIMIT 1");
  return rows[0] || null;
}

function bodyConfig(body, secret) {
  return {
    host: body.host,
    port: body.port,
    security: body.security || (body.secure ? 'ssl' : 'starttls'),
    username: body.username,
    password: secret,
    fromName: body.fromName,
    fromEmail: body.fromEmail,
    replyTo: body.replyTo,
  };
}

router.get('/email', async (_req, res) => {
  try {
    const row = await getEmailRow(getPool());
    res.json(row ? publicEmail(row) : { provider: 'email', status: 'not_configured', configured: false, metadata: {} });
  } catch (error) {
    res.status(500).json({ error: 'Nao foi possivel carregar a integracao de e-mail.' });
  }
});

router.put('/email', async (req, res) => {
  try {
    const connection = await getPool().getConnection();
    try {
      const current = await getEmailRow(connection);
      let password = String(req.body?.password || '');
      if (!password && current?.secret_ciphertext) password = decryptSecret(current)?.password || '';
      const config = validateSmtpConfig(bodyConfig(req.body, password));
      const encrypted = req.body?.password ? encryptSecret({ password: config.password }) : current;
      const metadata = { host: config.host, port: config.port, security: req.body.security || (config.secure ? 'ssl' : 'starttls'), username: config.username, fromName: config.fromName, fromEmail: config.fromEmail, replyTo: config.replyTo };
      await connection.execute(
        `INSERT INTO integration_providers (provider, display_name, status, configuration_metadata, secret_ciphertext, secret_iv, secret_auth_tag)
         VALUES ('smtp', 'E-mail', 'configured', ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = 'configured', configuration_metadata = VALUES(configuration_metadata), secret_ciphertext = VALUES(secret_ciphertext), secret_iv = VALUES(secret_iv), secret_auth_tag = VALUES(secret_auth_tag), updated_at = CURRENT_TIMESTAMP`,
        [JSON.stringify(metadata), req.body?.password ? encrypted.ciphertext : current?.secret_ciphertext || null, req.body?.password ? encrypted.iv : current?.secret_iv || null, req.body?.password ? encrypted.authTag : current?.secret_auth_tag || null]
      );
      const row = await getEmailRow(connection);
      res.json(publicEmail(row));
    } finally { connection.release(); }
  } catch (error) {
    const message = error?.code === 'INTEGRATION_ENCRYPTION_KEY_MISSING' ? error.message : error?.publicMessage || 'Nao foi possivel salvar a integracao de e-mail.';
    res.status(400).json({ error: message });
  }
});

router.post('/email/test-connection', async (req, res) => {
  if (!rateLimit(`${req.userId}:email:connection`)) return res.status(429).json({ error: 'Aguarde alguns segundos antes de testar novamente.' });
  try {
    const connection = await getPool().getConnection();
    try {
      const row = await getEmailRow(connection);
      if (!row) return res.status(409).json({ error: 'Configure a integracao de e-mail antes de testar.' });
      const secret = decryptSecret(row);
      const config = validateSmtpConfig({ ...JSON.parse(row.configuration_metadata || '{}'), password: secret?.password });
      await verifySmtp(config);
      await connection.execute("UPDATE integration_providers SET status = 'connected', last_tested_at = UTC_TIMESTAMP(), last_test_status = 'success', last_error = NULL WHERE provider = 'smtp'");
      res.json({ success: true, message: 'Conexao realizada com sucesso.' });
    } finally { connection.release(); }
  } catch (error) {
    const status = error?.code === 'INTEGRATION_ENCRYPTION_KEY_MISSING' ? 500 : 400;
    try { await getPool().execute("UPDATE integration_providers SET status = 'provider_error', last_tested_at = UTC_TIMESTAMP(), last_test_status = 'error', last_error = ? WHERE provider = 'smtp'", [String(error?.publicMessage || 'Falha SMTP').slice(0, 500)]); } catch {}
    res.status(status).json({ error: error?.publicMessage || 'Nao foi possivel conectar ao servidor SMTP.' });
  }
});

router.post('/email/test-send', async (req, res) => {
  if (!rateLimit(`${req.userId}:email:send`)) return res.status(429).json({ error: 'Aguarde alguns segundos antes de enviar outro teste.' });
  try {
    const row = await getEmailRow(getPool());
    if (!row) return res.status(409).json({ error: 'Configure a integracao de e-mail antes de testar.' });
    const secret = decryptSecret(row);
    const config = validateSmtpConfig({ ...JSON.parse(row.configuration_metadata || '{}'), password: secret?.password });
    const result = await sendSmtp(config, { to: req.body?.to, subject: 'Teste de integracao - Kaizen CRM', text: 'Sua integracao de e-mail com o Kaizen CRM esta funcionando.' });
    await getPool().execute("UPDATE integration_providers SET status = 'connected', last_tested_at = UTC_TIMESTAMP(), last_test_status = 'success', last_error = NULL WHERE provider = 'smtp'");
    res.json({ success: true, message: 'E-mail de teste enviado.', messageId: result.messageId });
  } catch (error) {
    res.status(400).json({ error: error?.publicMessage || 'Nao foi possivel enviar o e-mail de teste.' });
  }
});

module.exports = router;
