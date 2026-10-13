const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../../src');
const panel = fs.readFileSync(path.join(root, 'components/integrations/GmailIntegrationPanel.tsx'), 'utf8');
const api = fs.readFileSync(path.join(root, 'api/gmail-integrations.ts'), 'utf8');
const library = fs.readFileSync(path.join(root, 'components/integrations/IntegrationLibrary.tsx'), 'utf8');

test('Gmail card is mounted in the existing integrations page without replacing SMTP', () => {
  assert.match(library, /GmailIntegrationPanel/);
  assert.match(library, /activeIntegration\.provider === "smtp"/);
});

test('Gmail UI uses backend status and never stores or renders tokens', () => {
  assert.match(panel, /getStatus\(\)/);
  assert.match(panel, /emailAddress/);
  assert.doesNotMatch(panel, /access_token|refresh_token|client_secret|localStorage\.setItem/);
});

test('Gmail UI handles popup blocking, polling, reconnect and confirmed disconnect result', () => {
  assert.match(panel, /window\.open/);
  assert.match(panel, /O navegador bloqueou a nova guia/);
  assert.match(panel, /setInterval/);
  assert.match(panel, /Reconectar Gmail/);
  assert.match(panel, /revocationConfirmed/);
  assert.match(api, /\/oauth\/start/);
  assert.match(api, /reconnect:[\s\S]*?\/reconnect[\s\S]*?POST/);
  assert.match(api, /\/disconnect/);
});

test('Gmail UI validates the official authorization origin and bounds polling', () => {
  assert.match(panel, /new URL\(value\)/);
  assert.match(panel, /url\.protocol !== "https:"/);
  assert.match(panel, /url\.origin !== "https:\/\/accounts\.google\.com"/);
  assert.match(panel, /url\.pathname !== "\/o\/oauth2\/v2\/auth"/);
  assert.match(panel, /OAUTH_POLL_TIMEOUT_MS/);
  assert.match(panel, /pollBusyRef/);
  assert.match(panel, /mountedRef/);
});

test('Gmail card is restricted by the existing admin permission context', () => {
  assert.match(library, /useAuth/);
  assert.match(library, /isAdmin \? <GmailIntegrationPanel \/> : null/);
});
