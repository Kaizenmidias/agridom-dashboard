const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { encryptSecret, decryptSecret } = require('../services/integration-crypto');
const { validateSmtpConfig } = require('../services/email-provider');
const { validateAutomationDefinition } = require('../services/automation-definition-validator');
const catalog = require('../services/automation-catalog');

const migration = fs.readFileSync(path.join(__dirname, '../../database/migrations/20260923_phase_2g1_email_communication.sql'), 'utf8');
const route = fs.readFileSync(path.join(__dirname, '../routes/integrations.js'), 'utf8');
const executor = fs.readFileSync(path.join(__dirname, '../services/automation/action-executor.js'), 'utf8');
const dryRun = fs.readFileSync(path.join(__dirname, '../services/automation/dry-run.js'), 'utf8');

test('2G.1 Nodemailer is already installed and SMTP config is validated', () => {
  assert.equal(require('../../server/package.json').dependencies.nodemailer, '^7.0.6');
  assert.throws(() => validateSmtpConfig({ host: 'https://smtp.example.com', port: 587, username: 'user', password: 'secret', fromEmail: 'from@example.com' }), /Servidor SMTP invalido/);
  assert.throws(() => validateSmtpConfig({ host: 'smtp.example.com', port: 0, username: 'user', password: 'secret', fromEmail: 'from@example.com' }), /Porta SMTP invalida/);
});

test('2G.1 encrypts SMTP secret and never exposes plaintext in ciphertext', () => {
  const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = 'test-only-integration-key';
  const encrypted = encryptSecret({ password: 'smtp-secret' });
  assert.notEqual(encrypted.ciphertext, 'smtp-secret');
  assert.deepEqual(decryptSecret({ secret_ciphertext: encrypted.ciphertext, secret_iv: encrypted.iv, secret_auth_tag: encrypted.authTag }), { password: 'smtp-secret' });
  process.env.INTEGRATION_ENCRYPTION_KEY = previous;
});

test('2G.1 email action is executable and requires subject/message', () => {
  assert.equal(catalog.ACTION_CATALOG.find((item) => item.id === 'email.send')?.availability, 'available');
  const result = validateAutomationDefinition({ schemaVersion: 1, trigger: { type: 'lead.created', config: {} }, steps: [{ id: 'send', type: 'action', config: { actionType: 'email.send' }, next: null }] }, { requireSteps: true, requireExecutableActions: true });
  assert.ok(result.errors.filter((item) => item.code === 'MISSING_ACTION_CONFIG').length >= 2);
});

test('2G.1 API, executor and dry-run keep communication concerns isolated', () => {
  assert.match(route, /router\.use\(authenticateToken, requireCommercialAccess, requireCommercialAdmin\)/);
  assert.match(route, /test-connection/);
  assert.match(route, /test-send/);
  assert.match(executor, /communication_messages/);
  assert.match(executor, /sendSmtp/);
  assert.match(dryRun, /send: false|sent: false/);
  assert.doesNotMatch(dryRun, /sendSmtp\(/);
  assert.match(migration, /communication_messages/);
  assert.match(migration, /secret_ciphertext/);
});
