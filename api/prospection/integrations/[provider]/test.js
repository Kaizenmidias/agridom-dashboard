const app = require('../../../../server/server');

module.exports = async function handler(req, res) {
  const rawUrl = typeof req.url === 'string' ? req.url : '';
  const queryIndex = rawUrl.indexOf('?');
  const query = queryIndex >= 0 ? rawUrl.slice(queryIndex) : '';
  const pathname = (queryIndex >= 0 ? rawUrl.slice(0, queryIndex) : rawUrl) || '';
  const segments = pathname.split('/').filter(Boolean);
  const provider = segments.length >= 2 ? segments[segments.length - 2] : '';

  req.url = `/api/prospection/integrations/${provider}/test${query}`;
  return app(req, res);
};
