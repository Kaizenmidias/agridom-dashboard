const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { encryptSecret, decryptSecret } = require('../services/integration-crypto');
const { resolveEvolutionCredential } = require('../routes/whatsapp');

const routeSource = fs.readFileSync(path.resolve(__dirname, '../routes/whatsapp.js'), 'utf8');

test('Evolution config treats encryptSecret result as an envelope', () => {
  const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = 'phase-2g2-regression-key';
  try {
    const credential = resolveEvolutionCredential('evolution-api-key', null);
    assert.equal(credential.apiKey, 'evolution-api-key');
    assert.ok(credential.envelope.ciphertext);
    assert.ok(credential.envelope.iv);
    assert.ok(credential.envelope.authTag);
    assert.equal(credential.envelope.apiKey, undefined);
    assert.deepEqual(decryptSecret({ secret_ciphertext: credential.envelope.ciphertext, secret_iv: credential.envelope.iv, secret_auth_tag: credential.envelope.authTag }), { apiKey: 'evolution-api-key' });
  } finally {
    if (previous === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = previous;
  }
});

test('Evolution config preserves an existing encrypted credential when API Key is empty', () => {
  const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = 'phase-2g2-preserve-key';
  try {
    const envelope = encryptSecret({ apiKey: 'existing-evolution-key' });
    const credential = resolveEvolutionCredential('', { secret_ciphertext: envelope.ciphertext, secret_iv: envelope.iv, secret_auth_tag: envelope.authTag });
    assert.equal(credential.apiKey, 'existing-evolution-key');
    assert.equal(credential.envelope, null);
    assert.equal(resolveEvolutionCredential('', null), null);
  } finally {
    if (previous === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = previous;
  }
});

test('WhatsApp config regression keeps secrets out of public responses and temporary debug', () => {
  assert.match(routeSource, /apiKeyMasked/);
  assert.doesNotMatch(routeSource, /WA CONFIG DEBUG/);
  assert.doesNotMatch(routeSource, /bodyKeys|apiKeyLength|console\.(log|info).*apiKey/);
  assert.match(routeSource, /credential\.envelope\?\.ciphertext/);
  assert.match(routeSource, /Servidor sem INTEGRATION_ENCRYPTION_KEY configurada/);
});
