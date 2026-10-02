const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const express = require('express');
const http = require('node:http');
const { tokenHash } = require('../services/automation-webhook-repository');
const { acceptAutomationWebhook, hashInboundToken, TOKEN_PATTERN } = require('../services/automation-webhook-ingress');
const payload = require('../services/automation-webhook-payload');
const limiter = require('../services/automation-webhook-rate-limit');
const { publicError } = require('../routes/automation-webhooks');
const { automationWebhooksRouter } = require('../routes/automation-webhooks');

const rawToken = 'A'.repeat(43);
const endpoint = { id: 27, automation_id: 9, owner_user_id: 1, enabled: 1, revoked_at: null, automation_status: 'active' };

async function requestRouter({ contentType = 'application/json', body = '{}', token } = {}) {
  const app = express();
  app.use('/api/webhooks/automations', automationWebhooksRouter);
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    return await new Promise((resolve, reject) => {
      const request = http.request({ hostname: '127.0.0.1', port, path: '/api/webhooks/automations', method: 'POST', headers: { 'Content-Type': contentType, ...(token === undefined ? {} : { 'X-Webhook-Token': token }), 'Content-Length': Buffer.byteLength(body) } }, (response) => {
        let output = '';
        response.on('data', (chunk) => { output += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, body: output }));
      });
      request.on('error', reject);
      request.end(body);
    });
  } finally { await new Promise((resolve) => server.close(resolve)); }
}

function installPoolMock({ endpointRow = endpoint, dispatchError = null, commitError = null } = {}) {
  const database = require('../config/database');
  const pool = database.getPool();
  const original = pool.getConnection;
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => { calls.push('commit'); if (commitError) throw commitError; },
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
    execute: async (sql, params) => {
      calls.push([String(sql), params]);
      if (String(sql).includes('automation_webhook_endpoints')) return [[endpointRow].filter(Boolean)];
      if (dispatchError && String(sql).includes('automation_events')) throw dispatchError;
      return [{ insertId: 1 }, []];
    },
  };
  pool.getConnection = async () => connection;
  return { pool, calls, restore: () => { pool.getConnection = original; } };
}

test('B.1B valida o formato exato do token B.1A e usa SHA-256', () => {
  assert.match(rawToken, TOKEN_PATTERN);
  assert.equal(hashInboundToken(rawToken), tokenHash(rawToken));
  assert.equal(hashInboundToken('A'.repeat(42)), null);
  assert.equal(hashInboundToken(`${rawToken},other`), null);
  assert.equal(hashInboundToken(''), null);
  assert.equal(hashInboundToken(`${rawToken}=`), null);
  assert.equal(hashInboundToken(` ${rawToken}`), null);
  assert.equal(hashInboundToken(`${rawToken} `), null);
  assert.equal(hashInboundToken(`${rawToken.slice(0, 42)}!`), null);
});

test('B.1B sanitiza secrets, bloqueia prototype pollution e aplica limites', () => {
  const result = payload.sanitizeWebhookPayload({ Password: 'secret', 'X-API-Key': 'key', nested: { Cookie: 'cookie', ok: 'yes' } });
  assert.equal(result.Password, payload.REDACTED);
  assert.equal(result['X-API-Key'], payload.REDACTED);
  assert.equal(result.nested.Cookie, payload.REDACTED);
  assert.equal(result.nested.ok, 'yes');
  for (const key of ['__proto__', 'prototype', 'constructor']) {
    assert.throws(() => payload.sanitizeWebhookPayload(JSON.parse(`{"nested":{"${key}": {}}}`)), /WEBHOOK_PAYLOAD_INVALID/);
  }
  assert.throws(() => payload.sanitizeWebhookPayload({ value: 'x'.repeat(payload.MAX_STRING_LENGTH + 1) }), /WEBHOOK_PAYLOAD_LIMIT/);
  assert.throws(() => payload.sanitizeWebhookPayload({ items: Array.from({ length: payload.MAX_ARRAY_LENGTH + 1 }, () => 1) }), /WEBHOOK_PAYLOAD_LIMIT/);
  assert.throws(() => payload.sanitizeWebhookPayload(Object.fromEntries(Array.from({ length: payload.MAX_PROPERTIES + 1 }, (_, index) => [`key${index}`, index]))), /WEBHOOK_PAYLOAD_LIMIT/);
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => payload.sanitizeWebhookPayload(cycle), /WEBHOOK_PAYLOAD_INVALID/);
});

test('B.1B aplica boundaries determinísticos do sanitizador', () => {
  const nested = (depth) => {
    let value = 'ok';
    for (let index = 0; index < depth; index += 1) value = { child: value };
    return value;
  };
  assert.doesNotThrow(() => payload.sanitizeWebhookPayload(nested(payload.MAX_DEPTH)));
  assert.throws(() => payload.sanitizeWebhookPayload(nested(payload.MAX_DEPTH + 1)), /WEBHOOK_PAYLOAD_LIMIT/);
  assert.doesNotThrow(() => payload.sanitizeWebhookPayload(Object.fromEntries(Array.from({ length: payload.MAX_PROPERTIES }, (_, index) => [`key${index}`, index]))));
  assert.doesNotThrow(() => payload.sanitizeWebhookPayload({ value: 'x'.repeat(payload.MAX_STRING_LENGTH) }));
  assert.doesNotThrow(() => payload.sanitizeWebhookPayload({ items: Array.from({ length: payload.MAX_ARRAY_LENGTH }, () => 1) }));
});

test('B.1B limiter usa bucket global para desconhecidos e bucket por hash para validos', () => {
  limiter.resetForTests();
  for (let index = 0; index < 20; index += 1) assert.equal(limiter.allowUnknown(1000), true);
  assert.equal(limiter.allowUnknown(1000), false);
  limiter.resetForTests();
  assert.equal(limiter.allowUnknown(1000), true);
  limiter.refundUnknown(1000);
  for (let index = 0; index < 20; index += 1) assert.equal(limiter.allowUnknown(1000), true);
  assert.equal(limiter.allowUnknown(1000), false);
  limiter.resetForTests();
  for (let index = 0; index < 10; index += 1) assert.equal(limiter.allowValid(`hash-${index}`, 1000), true);
  for (let index = 0; index < 9; index += 1) assert.equal(limiter.allowValid('hash-0', 1000), true);
  assert.equal(limiter.allowValid('hash-0', 1000), false);
  assert.equal(limiter.allowValid('hash-new', 1000 + limiter.TTL_MS + 1), true);
});

test('B.1B reserva o bucket desconhecido antes do lookup de token com formato válido', async () => {
  limiter.resetForTests();
  const mock = installPoolMock({ endpointRow: null });
  try {
    for (let index = 0; index < 20; index += 1) {
      await assert.rejects(() => acceptAutomationWebhook({ rawToken: `${String.fromCharCode(66 + index)}${'A'.repeat(42)}`, body: {} }), /WEBHOOK_NOT_FOUND/);
    }
    await assert.rejects(() => acceptAutomationWebhook({ rawToken: 'Z'.repeat(43), body: {} }), { publicStatus: 429 });
    assert.equal(mock.calls.filter((entry) => Array.isArray(entry)).length, 20);
  } finally { mock.restore(); }
});

test('B.1B aceita evento válido em transação e não persiste raw token', async () => {
  limiter.resetForTests();
  const mock = installPoolMock();
  const originalDispatch = require('../services/domain-events').dispatchDomainEvent;
  try {
    const result = await acceptAutomationWebhook({ rawToken, body: { ownerUserId: 999, ok: true }, now: new Date('2026-10-02T12:00:00Z') });
    assert.deepEqual(result, { accepted: true });
    assert.deepEqual(mock.calls.slice(0, 2), ['begin', [mock.calls[1][0], [tokenHash(rawToken)]]]);
    assert.equal(mock.calls.includes('commit'), true);
    assert.equal(mock.calls.includes('release'), true);
    assert.equal(mock.calls.some((entry) => Array.isArray(entry) && JSON.stringify(entry).includes(rawToken)), false);
    assert.equal(originalDispatch !== undefined, true);
  } finally { mock.restore(); }
});

test('B.1B faz rollback quando dispatch falha', async () => {
  limiter.resetForTests();
  const mock = installPoolMock({ dispatchError: Object.assign(new Error('dispatch failed'), { code: 'DISPATCH_FAILED' }) });
  try {
    await assert.rejects(() => acceptAutomationWebhook({ rawToken, body: {} }), /dispatch failed/);
    assert.equal(mock.calls.includes('rollback'), true);
    assert.equal(mock.calls.includes('release'), true);
    assert.equal(mock.calls.includes('commit'), false);
  } finally { mock.restore(); }
});

test('B.1B falha de lookup faz rollback e release sem commit', async () => {
  limiter.resetForTests();
  const mock = installPoolMock();
  const originalGetConnection = mock.pool.getConnection;
  mock.pool.getConnection = async () => ({
    beginTransaction: async () => mock.calls.push('begin'),
    execute: async () => { throw new Error('lookup failed'); },
    rollback: async () => mock.calls.push('rollback'),
    commit: async () => mock.calls.push('commit'),
    release: () => mock.calls.push('release'),
  });
  try {
    await assert.rejects(() => acceptAutomationWebhook({ rawToken, body: {} }), /lookup failed/);
    assert.equal(mock.calls.includes('rollback'), true);
    assert.equal(mock.calls.includes('release'), true);
    assert.equal(mock.calls.includes('commit'), false);
  } finally { mock.pool.getConnection = originalGetConnection; mock.restore(); }
});

test('B.1B falha de commit nunca retorna 202 e libera a connection', async () => {
  limiter.resetForTests();
  const mock = installPoolMock({ commitError: new Error('commit failed') });
  try {
    await assert.rejects(() => acceptAutomationWebhook({ rawToken, body: {} }), /commit failed/);
    assert.equal(mock.calls.includes('rollback'), true);
    assert.equal(mock.calls.includes('release'), true);
  } finally { mock.restore(); }
});

test('B.1B estados indisponiveis compartilham resposta sem enumeracao', () => {
  for (const error of [Object.assign(new Error(), { code: 'WEBHOOK_NOT_FOUND' }), Object.assign(new Error(), { code: 'WEBHOOK_NOT_FOUND' }), Object.assign(new Error(), { code: 'WEBHOOK_NOT_FOUND' })]) {
    assert.deepEqual(publicError(error), { status: 404, body: { error: 'Webhook nao encontrado.' } });
  }
  const response = publicError(Object.assign(new Error(), { publicStatus: 429 }));
  assert.deepEqual(response, { status: 429, body: { error: 'Webhook temporariamente limitado.' } });
  assert.equal(JSON.stringify(response).includes(rawToken), false);
});

test('B.1B erro de payload excedente e media type possuem contratos seguros', () => {
  assert.equal(publicError(Object.assign(new Error(), { type: 'entity.too.large', status: 413 })).status, 413);
  assert.equal(publicError(Object.assign(new Error(), { type: 'entity.parse.failed' })).status, 400);
  assert.equal(publicError(Object.assign(new Error(), { code: 'WEBHOOK_PAYLOAD_INVALID' })).status, 400);
  assert.equal(publicError(new Error('secret token')).status, 500);
});

test('B.1B rota HTTP aplica parser JSON estrito de 256 KB antes do ingress', async () => {
  const invalidJson = await requestRouter({ body: '{' });
  assert.equal(invalidJson.status, 400);
  const arrayBody = await requestRouter({ body: '[]' });
  assert.equal(arrayBody.status, 400);
  const emptyBody = await requestRouter({ body: '' });
  assert.notEqual(emptyBody.status, 202);
  const wrongType = await requestRouter({ contentType: 'text/plain', body: '{}' });
  assert.equal(wrongType.status, 415);
  const tooLarge = await requestRouter({ body: JSON.stringify({ value: 'x'.repeat(256 * 1024) }) });
  assert.equal(tooLarge.status, 413);
  const missingHeader = await requestRouter({ body: '{}' });
  assert.equal(missingHeader.status, 404);
});
