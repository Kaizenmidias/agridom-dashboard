module.exports = async function handler(req, res) {
  try {
    const app = require('../../../../server/server');
    const rawUrl = typeof req.url === 'string' ? req.url : '';
    const pathOnly = rawUrl.split('?')[0] || '';
    const segments = pathOnly.split('/').filter(Boolean);
    const prospectId = segments[segments.length - 2] || '';

    req.url = `/api/prospection/prospects/${prospectId}/add-to-crm`;
    return app(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'vercel_prospect_crm_route_failed',
      message: error instanceof Error ? error.message : String(error),
    }));
  }
};
