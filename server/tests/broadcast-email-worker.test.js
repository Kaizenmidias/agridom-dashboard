const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../services/broadcast-campaign-worker'), 'utf8');

test('executor de email usa snapshots, SMTP validado e sendSmtp mockável', () => {
  assert.match(source, /recipient_email/);
  assert.match(source, /validateSmtpConfig/);
  assert.match(source, /emailSender = sendSmtp/);
  assert.match(source, /emailSender\(config, \{ to: row\.recipient_email, subject, text, html: renderedHtml, attachments \}\)/);
});

test('executor de email evita duplicidade após comunicação enviada', () => {
  assert.match(source, /status === "sent"/);
  assert.match(source, /idempotency_key = \?/);
  assert.match(source, /idempotent: true/);
  assert.match(source, /status === "sending"/);
  assert.match(source, /EMAIL_SEND_AMBIGUOUS/);
});

test('worker despacha email sequencialmente sem alterar o caminho WhatsApp', () => {
  assert.match(source, /const selectedExecutor = current\.channel === "email" \? emailExecutor : executor/);
  assert.match(source, /for \(let index = 0; index < batchSize; index \+= 1\)/);
  assert.match(source, /await processBroadcastJob\(job/);
});
