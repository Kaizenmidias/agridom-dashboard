const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  GMAIL_CONNECTION_STATUSES,
  assertGmailConnectionStatus,
  publicGmailConnection,
  createStateMaterial,
  assertAdministrativeGmailAccess,
} = require('../services/gmail-connection-foundation');

const migration = fs.readFileSync(path.join(__dirname, '../../database/migrations/20261013_gmail_integration_foundation.sql'), 'utf8');

test('Gmail foundation defines isolated connection and OAuth state tables', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS gmail_connections/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS gmail_oauth_states/);
  assert.match(migration, /uq_gmail_current_scope/);
  assert.match(migration, /current_scope_key VARCHAR\(191\) NULL/);
  assert.match(migration, /chk_gmail_connected_is_current/);
  assert.match(migration, /status <> 'connected' OR current_scope_key = scope_key/);
  assert.match(migration, /status IN \('connecting', 'connected', 'reconnect_required', 'error'\)/);
  assert.match(migration, /uq_gmail_oauth_state_hash/);
  assert.match(migration, /refresh_token_ciphertext/);
  assert.match(migration, /code_verifier_ciphertext/);
  assert.match(migration, /FOREIGN KEY \(connected_by_user_id\)/);
  assert.match(migration, /FOREIGN KEY \(initiated_by_user_id\)/);
  assert.doesNotMatch(migration, /DROP TABLE|TRUNCATE TABLE|DELETE FROM|FOREIGN_KEY_CHECKS/i);
});

test('Gmail connection status accepts only the defined lifecycle states', () => {
  assert.deepEqual(GMAIL_CONNECTION_STATUSES, ['disconnected', 'connecting', 'connected', 'reconnect_required', 'error']);
  for (const status of GMAIL_CONNECTION_STATUSES) assert.equal(assertGmailConnectionStatus(status), status);
  assert.throws(() => assertGmailConnectionStatus('expired'), { code: 'INVALID_GMAIL_CONNECTION_STATUS' });
});

test('public Gmail projection excludes token material and exposes only safe metadata', () => {
  const result = publicGmailConnection({ id: 4, provider: 'google_gmail', email_address: 'shared@example.test', status: 'connected', refresh_token_ciphertext: 'cipher', refresh_token_iv: 'iv', refresh_token_auth_tag: 'tag', google_account_id: 'private-account-id' });
  assert.equal(result.emailAddress, 'shared@example.test');
  assert.equal(result.hasRefreshToken, true);
  assert.equal(result.googleAccountId, undefined);
  assert.equal(result.refreshTokenCiphertext, undefined);
  assert.equal(result.refreshToken, undefined);
});

test('OAuth state material is random and persisted only as a SHA-256 hash', () => {
  const first = createStateMaterial();
  const second = createStateMaterial();
  assert.notEqual(first.state, second.state);
  assert.notEqual(first.stateHash, second.stateHash);
  assert.equal(first.stateHash.length, 64);
});

test('only active administrators can manage Gmail', () => {
  const allowed = { userId: 7, commercialUser: { role: 'admin', is_active: 1, can_access_crm: 1 } };
  assert.equal(assertAdministrativeGmailAccess(allowed), true);
  assert.throws(() => assertAdministrativeGmailAccess({}), { code: 'GMAIL_ADMIN_ACCESS_REQUIRED' });
  assert.throws(() => assertAdministrativeGmailAccess({ ...allowed, commercialUser: { ...allowed.commercialUser, is_active: 0 } }), { code: 'GMAIL_ADMIN_ACCESS_REQUIRED' });
  assert.throws(() => assertAdministrativeGmailAccess({ ...allowed, commercialUser: { ...allowed.commercialUser, can_access_crm: 0 } }), { code: 'GMAIL_ADMIN_ACCESS_REQUIRED' });
  assert.throws(() => assertAdministrativeGmailAccess({ ...allowed, commercialUser: { ...allowed.commercialUser, role: 'user' } }), { code: 'GMAIL_ADMIN_ACCESS_REQUIRED' });
  assert.throws(() => assertAdministrativeGmailAccess({ userId: 7, commercialUser: { role: 'admin', is_active: 1 } }), { code: 'GMAIL_ADMIN_ACCESS_REQUIRED' });
});
