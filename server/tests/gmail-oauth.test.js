const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { encryptSecret } = require('../services/integration-crypto');
const oauth = require('../services/gmail-oauth');
const repository = require('../services/gmail-oauth-repository');

const env = { GOOGLE_GMAIL_CLIENT_ID: 'client-id', GOOGLE_GMAIL_CLIENT_SECRET: 'client-secret', GOOGLE_GMAIL_REDIRECT_URI: 'https://crm.example.test/api/integrations/gmail/oauth/callback' };
const response = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

test('authorization URL uses PKCE, state and only justified Gmail scopes', () => {
  const pkce = oauth.createPkce();
  const url = new URL(oauth.buildAuthorizationUrl({ state: 'safe-state', challenge: pkce.challenge, env }));
  assert.equal(url.searchParams.get('client_id'), 'client-id');
  assert.equal(url.searchParams.get('state'), 'safe-state');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.match(url.searchParams.get('scope'), /gmail\.send/);
  assert.match(url.searchParams.get('scope'), /openid/);
  assert.match(url.searchParams.get('scope'), /email/);
});

test('token exchange and identity validation never expose token fields in application result', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => { calls.push({ url, options }); return url.includes('/token') ? response({ access_token: 'access-token', refresh_token: 'refresh-token', expires_in: 3600 }) : response({ sub: 'google-sub', email: 'shared@example.test', email_verified: true, name: 'Shared' }); };
  const tokens = await oauth.exchangeCode({ code: 'authorization-code', codeVerifier: 'verifier', fetchImpl, env });
  const identity = await oauth.identifyAccount(tokens.access_token, { fetchImpl, allowedEmail: 'shared@example.test' });
  assert.equal(identity.email, 'shared@example.test');
  assert.equal(calls[0].options.body.includes('authorization-code'), true);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer access-token');
});

test('identity mismatch and missing refresh token are rejected', async () => {
  await assert.rejects(() => oauth.identifyAccount('access-token', { fetchImpl: async () => response({ sub: 'x', email: 'other@example.test', email_verified: true }), allowedEmail: 'shared@example.test' }), { code: 'GMAIL_IDENTITY_NOT_ALLOWED' });
  await assert.rejects(() => oauth.exchangeCode({ code: 'code', codeVerifier: 'verifier', fetchImpl: async () => response({ access_token: 'access-only' }), env }).then((tokens) => { if (!tokens.refresh_token) throw Object.assign(new Error('missing'), { code: 'GMAIL_REFRESH_TOKEN_MISSING' }); }), { code: 'GMAIL_REFRESH_TOKEN_MISSING' });
});

test('refresh token is decrypted only for backend revocation and is never public', () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = 'test-only-key';
  const envelope = encryptSecret({ refreshToken: 'refresh-token' });
  const row = { refresh_token_ciphertext: envelope.ciphertext, refresh_token_iv: envelope.iv, refresh_token_auth_tag: envelope.authTag };
  assert.equal(oauth.decryptRefreshToken(row), 'refresh-token');
  const foundation = fs.readFileSync(path.join(__dirname, '../services/gmail-connection-foundation.js'), 'utf8');
  assert.doesNotMatch(foundation, /refreshToken\s*:/);
});

test('OAuth state consumption is atomic and rejects replay at the SQL boundary', () => {
  const source = fs.readFileSync(path.join(__dirname, '../services/gmail-oauth-repository.js'), 'utf8');
  assert.match(source, /consumed_at IS NULL/);
  assert.match(source, /expires_at > UTC_TIMESTAMP/);
  assert.match(source, /affectedRows/);
  assert.match(source, /GMAIL_OAUTH_STATE_INVALID/);
  assert.match(source, /pending_scope_key = NULL/);
  assert.match(source, /GMAIL_OAUTH_ALREADY_PENDING/);
  assert.match(source, /GMAIL_OAUTH_STALE/);
  assert.match(source, /GET_LOCK/);
  assert.match(source, /RELEASE_LOCK/);
  assert.match(source, /expires_at <= UTC_TIMESTAMP/);
});

function statePool({ lock = 1, pending = [], updates = 0 }) {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
    execute: async (sql, params) => {
      calls.push({ sql, params });
      if (/GET_LOCK/.test(sql)) return [[{ acquired: lock }]];
      if (/RELEASE_LOCK/.test(sql)) return [[{ released: 1 }]];
      if (/SELECT id FROM gmail_oauth_states/.test(sql)) return [pending];
      if (/UPDATE gmail_oauth_states/.test(sql)) return [{ affectedRows: updates }];
      return [{ affectedRows: 1, insertId: 9 }];
    },
  };
  return { calls, getConnection: async () => connection };
}

test('expired OAuth state is invalidated and releases the scope for a new attempt', async () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = 'test-only-key';
  const pool = statePool({ updates: 1 });
  await repository.createOAuthState(pool, { userId: 1, stateHash: 'a'.repeat(64), codeVerifier: 'verifier', expiresAt: new Date() });
  const update = pool.calls.find((call) => call.sql && /UPDATE gmail_oauth_states/.test(call.sql));
  assert.match(update.sql, /pending_scope_key = NULL/);
  assert.match(update.sql, /expires_at <= UTC_TIMESTAMP/);
  assert.ok(pool.calls.includes('commit'));
  assert.ok(pool.calls.includes('release'));
});

test('valid pending state blocks a second attempt without leaving a lock', async () => {
  const pool = statePool({ pending: [{ id: 4 }] });
  await assert.rejects(() => repository.createOAuthState(pool, { userId: 2, stateHash: 'b'.repeat(64), codeVerifier: 'verifier', expiresAt: new Date() }), { code: 'GMAIL_OAUTH_ALREADY_PENDING' });
  assert.ok(pool.calls.some((call) => call.sql && /RELEASE_LOCK/.test(call.sql)));
});

test('scope lock timeout rejects concurrent start without writing a state', async () => {
  const pool = statePool({ lock: 0 });
  await assert.rejects(() => repository.createOAuthState(pool, { userId: 3, stateHash: 'c'.repeat(64), codeVerifier: 'verifier', expiresAt: new Date() }), { code: 'GMAIL_OAUTH_LOCK_TIMEOUT' });
  assert.equal(pool.calls.some((call) => call.sql && /INSERT INTO gmail_oauth_states/.test(call.sql)), false);
});

test('OAuth configuration requires a safe redirect URI', () => {
  assert.throws(() => oauth.oauthConfig({ ...env, NODE_ENV: 'production', GOOGLE_GMAIL_REDIRECT_URI: 'http://crm.example.test/callback' }), { code: 'GMAIL_OAUTH_REDIRECT_INVALID' });
  assert.throws(() => oauth.oauthConfig({ ...env, GOOGLE_GMAIL_REDIRECT_URI: 'http://evil.example.test/callback' }), { code: 'GMAIL_OAUTH_REDIRECT_INVALID' });
  assert.doesNotThrow(() => oauth.oauthConfig({ ...env, GOOGLE_GMAIL_REDIRECT_URI: 'http://localhost:3001/callback' }));
});

test('Gmail routes are isolated from SMTP and protect all mutating operations with admin middleware', () => {
  const source = fs.readFileSync(path.join(__dirname, '../routes/gmail.js'), 'utf8');
  assert.match(source, /router\.get\('\/oauth\/start'/);
  assert.match(source, /router\.get\('\/oauth\/callback'/);
  assert.match(source, /router\.post\('\/disconnect'/);
  assert.match(source, /router\.post\('\/reconnect'/);
  assert.match(source, /authenticateToken, requireCommercialAccess, requireCommercialAdmin/);
  assert.match(source, /locallyDisconnected/);
  assert.match(source, /revocationConfirmed/);
  assert.doesNotMatch(source, /sendMail|nodemailer|smtp/);
});
