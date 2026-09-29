const test = require('node:test');
const assert = require('node:assert/strict');
const { PROVIDER_ERRORS, classifyProviderFailure } = require('../services/ai-provider');

test('classifica erros de autenticação, permissão e modelo do provedor', () => {
  assert.equal(classifyProviderFailure(401), PROVIDER_ERRORS.invalidCredential);
  assert.equal(classifyProviderFailure(403), PROVIDER_ERRORS.forbidden);
  assert.equal(classifyProviderFailure(404), PROVIDER_ERRORS.modelUnavailable);
  assert.equal(classifyProviderFailure(400), PROVIDER_ERRORS.invalidRequest);
});

test('separa rate limit de quota excedida', () => {
  assert.equal(classifyProviderFailure(429, { error: { type: 'rate_limit_error' } }), PROVIDER_ERRORS.rateLimit);
  assert.equal(classifyProviderFailure(429, { error: { code: 'insufficient_quota' } }), PROVIDER_ERRORS.quotaExceeded);
  assert.equal(classifyProviderFailure(403, { error: { message: 'billing quota exceeded' } }), PROVIDER_ERRORS.quotaExceeded);
});

test('classifica indisponibilidade e falha desconhecida', () => {
  assert.equal(classifyProviderFailure(503), PROVIDER_ERRORS.unavailable);
  assert.equal(classifyProviderFailure(418), PROVIDER_ERRORS.failed);
});
