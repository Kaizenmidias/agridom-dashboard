module.exports = async function handler(req, res) {
  try {
    const app = require('../../server/server');
    req.url = '/api/prospection/search';
    return app(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'vercel_prospection_search_failed',
      message: error instanceof Error ? error.message : String(error),
    }));
  }
};
