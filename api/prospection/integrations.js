const app = require('../../server/server');

module.exports = async function handler(req, res) {
  const queryIndex = typeof req.url === 'string' ? req.url.indexOf('?') : -1;
  const query = queryIndex >= 0 ? req.url.slice(queryIndex) : '';

  req.url = `/api/prospection/integrations${query}`;
  return app(req, res);
};
