const {
  authenticateAndResolveOwnerUserId,
  fetchStoredIntegrationConfig,
  sendJson,
  testIntegration,
} = require('../../_shared');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return sendJson(res, 405, { error: 'Metodo nao permitido' });
    }

    const ownerUserId = await authenticateAndResolveOwnerUserId(req);

    const rawUrl = typeof req.url === 'string' ? req.url : '';
    const pathOnly = rawUrl.split('?')[0] || '';
    const segments = pathOnly.split('/').filter(Boolean);
    const provider = segments.length >= 2 ? segments[segments.length - 2] : '';

    const config = await fetchStoredIntegrationConfig(ownerUserId);
    const result = await testIntegration(provider, config);
    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, error.statusCode || 500, {
      success: false,
      error: error.message || 'Falha ao testar integracao',
    });
  }
};
