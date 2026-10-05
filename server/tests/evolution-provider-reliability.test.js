const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { EvolutionWhatsAppProvider } = require('../services/evolution-whatsapp-provider');

const response = (status, data = {}) => ({ status, data });
const providerFor = (httpRequest) => new EvolutionWhatsAppProvider({ baseUrl: 'https://evolution.example.test', apiKey: 'test-key', httpRequest });

test('sendText faz um unico POST e nao chama verificacao de numero', async () => {
  const calls = [];
  const provider = providerFor(async (config) => { calls.push(config); return response(200, { key: { id: 'message-1' } }); });
  const result = await provider.sendText('instance-1', '5511999999999', 'Mensagem');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.match(calls[0].url, /\/message\/sendText\/instance-1$/);
  assert.equal(result.externalMessageId, 'message-1');
});

test('2xx sem identificador gera resposta invalida e nao e retryable', async () => {
  const provider = providerFor(async () => response(200, { status: 'success' }));
  await assert.rejects(() => provider.sendText('instance-1', '5511999999999', 'Mensagem'), (error) => error.code === 'EVOLUTION_INVALID_RESPONSE' && error.retryable === false);
});

test('classifica HTTP, transporte e preserva somente diagnostico seguro', async () => {
  const cases = [
    [400, 'EVOLUTION_HTTP_REJECTED', false], [401, 'EVOLUTION_AUTH_FAILED', false], [403, 'EVOLUTION_AUTH_FAILED', false],
    [408, 'EVOLUTION_UNAVAILABLE', true], [429, 'EVOLUTION_UNAVAILABLE', true], [500, 'EVOLUTION_UNAVAILABLE', true],
  ];
  for (const [status, code, retryable] of cases) {
    const provider = providerFor(async () => response(status, { code: 'BAD_REQUEST', message: 'safe diagnostic' }));
    await assert.rejects(() => provider.sendText('instance-1', '5511999999999', 'Mensagem'), (error) => error.code === code && error.retryable === retryable && error.providerStatus === status);
  }
  for (const [transportCode, expected] of [['ECONNABORTED', 'EVOLUTION_TIMEOUT'], ['ETIMEDOUT', 'EVOLUTION_TIMEOUT'], ['ECONNRESET', 'EVOLUTION_CONNECTION_RESET'], ['ECONNREFUSED', 'EVOLUTION_CONNECTION_REFUSED']]) {
    const provider = providerFor(async () => { throw Object.assign(new Error('transport'), { code: transportCode }); });
    await assert.rejects(() => provider.sendText('instance-1', '5511999999999', 'Mensagem privada'), (error) => error.code === expected && error.providerDetail === transportCode);
  }
});

test('timeout, reset, rejeicao e resposta invalida fazem somente uma tentativa', async () => {
  for (const failure of [
    Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }),
    Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
    response(400, { message: 'rejected' }),
    response(200, { ok: true }),
  ]) {
    let calls = 0;
    const provider = providerFor(async () => { calls += 1; if (failure.status) return failure; throw failure; });
    await assert.rejects(() => provider.sendText('instance-1', '5511999999999', 'texto privado'));
    assert.equal(calls, 1);
  }
});

test('diagnostico nao expoe credencial, telefone completo ou mensagem', async () => {
  const provider = providerFor(async () => response(400, { message: 'apikey=test-key phone=5511999999999 texto privado' }));
  await assert.rejects(() => provider.sendText('instance-1', '5511999999999', 'texto privado'), (error) => {
    const serialized = JSON.stringify(error);
    return !serialized.includes('test-key') && !serialized.includes('5511999999999') && !serialized.includes('texto privado');
  });
});

test('webhook aceita rajadas e continua protegido por segredo e deduplicacao persistente', () => {
  const source = fs.readFileSync(require.resolve('../routes/webhooks'), 'utf8');
  assert.doesNotMatch(source, /<\s*100/);
  assert.match(source, /hasWebhookSecret\(readWebhookSecret\(req\)/);
  assert.match(source, /ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID\(id\)/);
});
