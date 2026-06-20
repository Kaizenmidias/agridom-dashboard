const {
  authenticateAndResolveOwnerUserId,
  fetchStoredIntegrationConfig,
  readJsonBody,
  sanitizeIntegrationConfigForClient,
  saveIntegrationConfig,
  sendJson,
} = require('./_shared');

module.exports = async function handler(req, res) {
  try {
    const ownerUserId = await authenticateAndResolveOwnerUserId(req);

    if (req.method === 'GET') {
      const config = await fetchStoredIntegrationConfig(ownerUserId);
      return sendJson(res, 200, sanitizeIntegrationConfigForClient(config));
    }

    if (req.method === 'PUT') {
      const body = await readJsonBody(req);
      const config = await saveIntegrationConfig(ownerUserId, body || {});
      return sendJson(res, 200, sanitizeIntegrationConfigForClient(config));
    }

    return sendJson(res, 405, { error: 'Metodo nao permitido' });
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      error: error.message || 'Erro ao processar integracoes',
    });
  }
};
