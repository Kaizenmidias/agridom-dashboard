const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { getPool } = require('../config/database');
const {
  tokenHash,
  generateToken,
  createWebhookEndpoint,
  getWebhookEndpoint,
  regenerateWebhookEndpoint,
  revokeWebhookEndpoint,
} = require('../services/automation-webhook-repository');

function fakeDatabase() {
  const state = {
    automation: { id: 4, owner_user_id: 7, status: 'draft' },
    endpoints: [],
    nextId: 20,
    forceDuplicate: false,
    forceInsertError: false,
    forceUpdateError: false,
    params: [],
    commits: 0,
    rollbacks: 0,
  };
  const connection = {
    async beginTransaction() {},
    async commit() { state.commits += 1; },
    async rollback() { state.rollbacks += 1; },
    release() {},
    async execute(sql, params = []) {
      state.params.push({ sql, params });
      if (sql.includes('FROM automations WHERE id = ? AND owner_user_id = ?')) return [state.automation.owner_user_id === Number(params[1]) ? [state.automation] : []];
      if (sql.includes('FROM automation_webhook_endpoints') && sql.includes('revoked_at IS NULL')) {
        const endpoint = state.endpoints.find((item) => !item.revoked_at);
        return [endpoint ? [{ ...endpoint }] : []];
      }
      if (sql.startsWith('SELECT e.id, e.automation_id')) {
        const endpoint = [...state.endpoints].sort((a, b) => b.id - a.id)[0];
        return [endpoint ? [{ ...endpoint }] : []];
      }
      if (sql.startsWith('INSERT INTO automation_webhook_endpoints')) {
        if (state.forceDuplicate) {
          const error = new Error('Duplicate entry contains a secret token');
          error.code = 'ER_DUP_ENTRY';
          throw error;
        }
        if (state.forceInsertError) throw new Error('insert failed with secret token');
        const endpoint = { id: state.nextId++, automation_id: params[0], owner_user_id: params[1], token_hash: params[2], enabled: 1, revoked_at: null };
        state.endpoints.push(endpoint);
        return [{ insertId: endpoint.id }];
      }
      if (sql.startsWith('UPDATE automation_webhook_endpoints SET token_hash')) {
        if (state.forceUpdateError) throw new Error('update failed with secret token');
        const endpoint = state.endpoints.find((item) => item.id === Number(params[1]));
        endpoint.token_hash = params[0];
        endpoint.enabled = 1;
        return [{ affectedRows: 1 }];
      }
      if (sql.startsWith('UPDATE automation_webhook_endpoints SET enabled = 0')) {
        const endpoint = state.endpoints.find((item) => item.id === Number(params[0]));
        endpoint.enabled = 0;
        endpoint.revoked_at = '2026-10-02 12:00:00';
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected webhook SQL: ${sql}`);
    },
  };
  const pool = getPool();
  const originalGetConnection = pool.getConnection;
  const originalExecute = pool.execute;
  pool.getConnection = async () => connection;
  pool.execute = connection.execute.bind(connection);
  return { state, restore: () => { pool.getConnection = originalGetConnection; pool.execute = originalExecute; } };
}

test('B.1A gera token de alta entropia e armazena apenas SHA-256', () => {
  const first = generateToken();
  const second = generateToken();
  assert.equal(Buffer.from(first, 'base64url').length, 32);
  assert.equal(Buffer.from(second, 'base64url').length, 32);
  assert.notEqual(first, second);
  assert.equal(tokenHash(first), crypto.createHash('sha256').update(first).digest('hex'));
  assert.equal(tokenHash(first).length, 64);
});

test('B.1A cria endpoint próprio, deriva ownership e retorna token uma única vez', async () => {
  const db = fakeDatabase();
  try {
    const result = await createWebhookEndpoint(7, 4);
    assert.equal(result.created, true);
    assert.equal(result.endpoint.automationId, 4);
    assert.equal(result.token.length > 40, true);
    assert.equal(db.state.params.find((call) => call.sql.startsWith('INSERT INTO'))?.params[1], 7);
    assert.equal(db.state.params.find((call) => call.sql.startsWith('INSERT INTO'))?.params[2], tokenHash(result.token));
    assert.equal(db.state.endpoints[0].token_hash, tokenHash(result.token));
    assert.notEqual(db.state.endpoints[0].token_hash, result.token);
    const duplicate = await createWebhookEndpoint(7, 4);
    assert.equal(duplicate.created, false);
    assert.equal(duplicate.token, null);
    assert.equal(db.state.nextId, 21);
  } finally {
    db.restore();
  }
});

test('B.1A rejeita automação de outro owner sem criar endpoint', async () => {
  const db = fakeDatabase();
  db.state.automation.owner_user_id = 99;
  try {
    await assert.rejects(createWebhookEndpoint(7, 4), (error) => error.status === 404);
    assert.equal(db.state.endpoints.length, 0);
  } finally {
    db.restore();
  }
});

test('B.1A GET retorna somente metadata e regeneração mantém ID e troca hash', async () => {
  const db = fakeDatabase();
  try {
    const created = await createWebhookEndpoint(7, 4);
    const oldHash = db.state.endpoints[0].token_hash;
    const metadata = await getWebhookEndpoint(7, 4);
    assert.equal(metadata.id, created.endpoint.id);
    assert.equal('token' in metadata, false);
    assert.equal('token_hash' in metadata, false);
    const regenerated = await regenerateWebhookEndpoint(7, 4);
    assert.equal(regenerated.endpoint.id, created.endpoint.id);
    assert.notEqual(db.state.endpoints[0].token_hash, oldHash);
    assert.equal(db.state.endpoints[0].token_hash, tokenHash(regenerated.token));
    assert.notEqual(regenerated.token, created.token);
    assert.equal('token_hash' in regenerated.endpoint, false);
  } finally {
    db.restore();
  }
});

test('B.1A revoga endpoint sem alterar a automação e impede regeneração', async () => {
  const db = fakeDatabase();
  try {
    await createWebhookEndpoint(7, 4);
    const result = await revokeWebhookEndpoint(7, 4);
    assert.equal(result.revoked, true);
    assert.equal(db.state.endpoints[0].enabled, 0);
    assert.ok(db.state.endpoints[0].revoked_at);
    assert.equal(db.state.automation.status, 'draft');
    await assert.rejects(regenerateWebhookEndpoint(7, 4), (error) => error.status === 409);
  } finally {
    db.restore();
  }
});

test('B.1A bloqueia criação e regeneração para automacao arquivada', async () => {
  const db = fakeDatabase();
  try {
    db.state.automation.status = 'archived';
    await assert.rejects(createWebhookEndpoint(7, 4), (error) => error.status === 409);
    assert.equal(db.state.endpoints.length, 0);

    db.state.automation.status = 'draft';
    await createWebhookEndpoint(7, 4);
    db.state.automation.status = 'archived';
    const previousHash = db.state.endpoints[0].token_hash;
    await assert.rejects(regenerateWebhookEndpoint(7, 4), (error) => error.status === 409);
    assert.equal(db.state.endpoints[0].token_hash, previousHash);
  } finally {
    db.restore();
  }
});

test('B.1A permite novo endpoint depois da revogacao e preserva o historico', async () => {
  const db = fakeDatabase();
  try {
    const first = await createWebhookEndpoint(7, 4);
    await revokeWebhookEndpoint(7, 4);
    const second = await createWebhookEndpoint(7, 4);
    assert.equal(db.state.endpoints.length, 2);
    assert.notEqual(second.endpoint.id, first.endpoint.id);
    assert.notEqual(second.token, first.token);
    assert.equal(db.state.endpoints[0].enabled, 0);
    assert.ok(db.state.endpoints[0].revoked_at);
    assert.equal(db.state.endpoints[1].enabled, 1);
    assert.equal(db.state.endpoints[1].revoked_at, null);
  } finally {
    db.restore();
  }
});

test('B.1A segunda revogacao e idempotente', async () => {
  const db = fakeDatabase();
  try {
    await createWebhookEndpoint(7, 4);
    assert.deepEqual((await revokeWebhookEndpoint(7, 4)), { revoked: true });
    assert.deepEqual((await revokeWebhookEndpoint(7, 4)), { revoked: false });
    assert.equal(db.state.endpoints[0].enabled, 0);
  } finally {
    db.restore();
  }
});

test('B.1A converte colisao de chave em erro controlado sem segredos', async () => {
  const db = fakeDatabase();
  try {
    db.state.forceDuplicate = true;
    await assert.rejects(createWebhookEndpoint(7, 4), (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.message.includes('secret'), false);
      assert.equal(error.message.includes('token'), false);
      assert.equal(error.message.includes('INSERT'), false);
      return true;
    });
  } finally {
    db.restore();
  }
});

test('B.1A sanitiza falha de persistencia sem expor token, hash ou SQL', async () => {
  const db = fakeDatabase();
  try {
    db.state.forceInsertError = true;
    await assert.rejects(createWebhookEndpoint(7, 4), (error) => {
      assert.equal(error.status, 500);
      assert.equal(error.message.includes('secret'), false);
      assert.equal(error.message.includes('INSERT'), false);
      return true;
    });
  } finally {
    db.restore();
  }
});

test('B.1A sanitiza falha de regeneracao sem expor token, hash ou SQL', async () => {
  const db = fakeDatabase();
  try {
    await createWebhookEndpoint(7, 4);
    db.state.forceUpdateError = true;
    await assert.rejects(regenerateWebhookEndpoint(7, 4), (error) => {
      assert.equal(error.status, 500);
      assert.equal(error.message.includes('secret'), false);
      assert.equal(error.message.includes('UPDATE'), false);
      return true;
    });
  } finally {
    db.restore();
  }
});

test('B.1A migration remove endpoint ao excluir automacao por CASCADE', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', '..', 'database', 'migrations', '20261002_automation_webhook_endpoints.sql'), 'utf8');
  assert.match(migration, /FOREIGN KEY \(automation_id\) REFERENCES automations\(id\) ON DELETE CASCADE/);
  assert.doesNotMatch(migration, /FOREIGN KEY \(automation_id\)[^\n]+ON DELETE RESTRICT/);
  assert.match(migration, /UNIQUE KEY uq_automation_webhook_active_automation/);
  assert.match(migration, /CASE WHEN revoked_at IS NULL THEN automation_id ELSE NULL END/);
});

test('B.1A serializa ownership e endpoint ativo com locks transacionais', () => {
  const repository = fs.readFileSync(path.join(__dirname, '..', 'services', 'automation-webhook-repository.js'), 'utf8');
  assert.match(repository, /FROM automations WHERE id = \? AND owner_user_id = \? FOR UPDATE/);
  assert.match(repository, /revoked_at IS NULL[\s\S]*FOR UPDATE/);
});

test('B.1A mantém somente rotas administrativas e não cria endpoint inbound público', () => {
  const routes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'automations.js'), 'utf8');
  assert.match(routes, /:id\/webhook-endpoint/);
  assert.doesNotMatch(routes, /webhooks\/automations\/:token/);
});
