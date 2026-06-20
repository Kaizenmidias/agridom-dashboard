module.exports = async function handler(req, res) {
  try {
    const app = require('../../server/server');
    const queryIndex = typeof req.url === 'string' ? req.url.indexOf('?') : -1;
    const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';

    req.url = `/api/prospection/integrations${query}`;
    return app(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'vercel_api_bootstrap_failed',
      message: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'production' ? undefined : (error instanceof Error ? error.stack : undefined),
    }));
  }
};
