const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const audience = require('../services/broadcast-campaign-audience');

const source = (path) => fs.readFileSync(require.resolve(path), 'utf8');
const route = source('../routes/broadcast-campaigns');
const service = source('../services/broadcast-campaign-service');
const worker = source('../services/broadcast-campaign-worker');
const migration = source('../../database/migrations/20261006_broadcast_multichannel_foundation.sql');
const emailMigration = source('../../database/migrations/20261006_broadcast_email_engine.sql');

test('elegibilidade multic canal e contadores sao deterministas', () => {
  const rows = [
    { normalized_phone: '5511999999999', email: 'a@example.test' },
    { normalized_phone: '5511888888888', email: null },
    { normalized_phone: '', email: 'b@example.test' },
    { normalized_phone: '', email: 'invalido' },
  ];
  assert.deepEqual(audience.summarizeAudience(rows), { totalLeads: 4, withWhatsApp: 2, withEmail: 2, withBoth: 1, withoutAnyContact: 1 });
  assert.equal(audience.normalizeCampaignEmail('  A@Example.Test '), 'a@example.test');
  assert.equal(audience.normalizeCampaignEmail('invalido'), null);
});

test('canais aceitos preservam campanhas antigas WhatsApp', () => {
  assert.equal(audience.channelValue('whatsapp'), 'whatsapp');
  assert.equal(audience.channelValue(['email']), 'email');
  assert.equal(audience.channelValue(['whatsapp', 'email']), 'both');
  assert.match(service, /campaignChannel/);
  assert.match(service, /idempotency_key/);
});

test('preview suporta Sem Lista e retorna contadores multic canal', () => {
  assert.match(route, /folder_id === "none"/);
  assert.match(route, /NOT EXISTS \(SELECT 1 FROM lead_folder_members/);
  assert.match(route, /with_email/);
  assert.match(route, /with_both/);
  assert.match(route, /without_any_contact/);
  assert.match(route, /whatsappEligible/);
  assert.match(route, /emailEligible/);
});

test('recipient preserva snapshots de telefone e email sem N+1', () => {
  assert.match(service, /recipient_email/);
  assert.match(service, /normalizeCampaignEmail/);
  assert.match(route, /p\.email/);
  assert.match(migration, /recipient_email/);
});

test('jobs possuem canal independente e worker reivindica email para a Fase 2', () => {
  assert.match(migration, /ADD COLUMN channel VARCHAR\(20\)/);
  assert.match(migration, /uq_broadcast_job_campaign_recipient_channel/);
  assert.match(worker, /j\.channel IN \('whatsapp', 'email'\)/);
  assert.match(worker, /executeBroadcastEmailRecipient/);
});

test('idempotencia e cancelamento continuam no backend', () => {
  assert.match(route, /Idempotency-Key/);
  assert.match(service, /created_by_user_id = \? AND idempotency_key = \?/);
  assert.match(route, /broadcast_campaign_jobs SET status = 'cancelled'/);
  assert.doesNotMatch(route, /DELETE FROM broadcast_campaign_jobs/);
});

test('rotas e servico nao enviam diretamente; worker usa executor SMTP isolado', () => {
  assert.doesNotMatch(route, /sendSmtp|nodemailer|sendText/);
  assert.doesNotMatch(service, /sendSmtp|nodemailer|sendText/);
});

test('fase 2 possui conteudo SMTP, provedor criptografado e idempotencia de e-mail', () => {
  assert.match(emailMigration, /email_provider_id/);
  assert.match(emailMigration, /email_subject/);
  assert.match(emailMigration, /email_body_text/);
  assert.match(worker, /decryptSecret/);
  assert.match(worker, /sendSmtp/);
  assert.match(worker, /broadcast:\$\{row\.campaign_id\}:\$\{row\.recipient_id\}:email/);
  assert.match(worker, /EMAIL_SEND_AMBIGUOUS/);
});
