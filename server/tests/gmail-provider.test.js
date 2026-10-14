const test = require('node:test');
const assert = require('node:assert/strict');
const { encryptSecret } = require('../services/integration-crypto');
const { encodeMessage, sendGmail } = require('../services/gmail-provider');

test('Gmail provider sends through mocked token refresh and Gmail API without SMTP', async () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = 'gmail-provider-test-key';
  process.env.GOOGLE_GMAIL_CLIENT_ID = 'client-id';
  process.env.GOOGLE_GMAIL_CLIENT_SECRET = 'client-secret';
  process.env.GOOGLE_GMAIL_REDIRECT_URI = 'https://crm.example.test/api/integrations/gmail/oauth/callback';
  const envelope = encryptSecret({ refreshToken: 'refresh-token' });
  const calls = [];
  const pool = { execute: async () => [[{ id: 1, status: 'connected', email_address: 'shared@example.test', refresh_token_ciphertext: envelope.ciphertext, refresh_token_iv: envelope.iv, refresh_token_auth_tag: envelope.authTag }]] };
  const result = await sendGmail(pool, { to: 'recipient@example.test', subject: 'Subject', text: 'Body' }, {
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'access-token' }) };
      return { ok: true, status: 200, json: async () => ({ id: 'gmail-message-id' }) };
    },
  });
  assert.equal(result.provider, 'gmail');
  assert.equal(result.messageId, 'gmail-message-id');
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /gmail\.googleapis\.com\/gmail\/v1\/users\/me\/messages\/send/);
  assert.match(calls[1].options.body, /"raw"/);
  assert.equal(encodeMessage({ to: 'a@example.test', from: 'b@example.test', subject: 'S', text: 'T' }).length > 0, true);
});

test('Gmail provider rejects an unavailable connection before calling Google', async () => {
  let called = false;
  await assert.rejects(() => sendGmail({ execute: async () => [[{ status: 'disconnected' }]] }, { to: 'a@example.test', subject: 'S', text: 'T' }, { fetchImpl: async () => { called = true; } }), { code: 'GMAIL_NOT_CONNECTED' });
  assert.equal(called, false);
});
