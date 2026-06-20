module.exports = async function handler(req, res) {
  try {
    const app = require('../server/server');
    req.url = '/api/dashboard/stats';
    return app(req, res);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'vercel_dashboard_stats_top_level_failed',
      message: error instanceof Error ? error.message : String(error),
    }));
  }
};
