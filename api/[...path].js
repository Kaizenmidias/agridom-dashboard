module.exports = async function handler(req, res) {
  try {
    const app = require('../server/server');

    if (typeof req.url === 'string' && !req.url.startsWith('/api')) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }

    return app(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'vercel_api_bootstrap_failed',
      message: error instanceof Error ? error.message : String(error),
    }));
  }
};
