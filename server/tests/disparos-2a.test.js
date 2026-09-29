const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const migration = fs.readFileSync(path.join(root, 'database', 'migrations', '20260929_broadcast_campaigns.sql'), 'utf8');
const service = fs.readFileSync(path.join(root, 'server', 'services', 'broadcast-campaign-service.js'), 'utf8');
const route = fs.readFileSync(path.join(root, 'server', 'routes', 'broadcast-campaigns.js'), 'utf8');
const domain = require('../services/broadcast-campaign-service');

test('DISPAROS-2A migration creates campaign domain with MySQL-safe contracts', () => {
  for (const table of ['broadcast_campaigns', 'broadcast_campaign_contents', 'broadcast_campaign_recipients', 'broadcast_campaign_events']) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`, 'i'));
  assert.match(migration, /status ENUM\('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed'\)/);
  assert.match(migration, /content_type ENUM\('text', 'image', 'video', 'document', 'audio'\)/);
  assert.match(migration, /UNIQUE KEY uq_broadcast_recipient_campaign_prospect/);
  assert.match(migration, /communication_message_id BIGINT UNSIGNED NULL/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.doesNotMatch(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i);
  assert.doesNotMatch(migration, /api.?key|webhook.?secret|jwt/i);
});

test('DISPAROS-2A domain validates statuses, content and snapshots', () => {
  assert.deepEqual(domain.CAMPAIGN_STATUSES, ['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed']);
  assert.equal(domain.normalizePhone('(16) 99999-0000'), '16999990000');
  assert.deepEqual(domain.normalizeContent({ contentType: 'image', textContent: 'Legenda' }), { contentType: 'image', textContent: 'Legenda', mediaStoragePath: null, mimeType: null, originalFilename: null });
  assert.throws(() => domain.normalizeContent({ contentType: 'template' }), /Tipo de conteudo invalido/);
  assert.doesNotMatch(service, /sendWhatsApp(Content|Message|Media)|Evolution API|provider\.send/i);
  assert.match(service, /status !== 'draft'/);
  assert.match(service, /ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID\(id\)/);
});

test('DISPAROS-2B exposes only authenticated campaign management and audience preparation', () => {
  assert.match(route, /router\.use\(authenticateToken, requireCommercialAccess\)/);
  assert.match(route, /router\.get\(['"]\/['"]|router\.post\(['"]\/['"]/);
  assert.match(route, /router\.get\(['"]\/:id['"]|router\.patch\(['"]\/:id['"]|router\.put\(['"]\/:id\/content['"]\)/);
  assert.match(route, /router\.get\(['"]\/:id\/recipients['"]/);
  assert.match(route, /router\.post\(['"]\/:id\/recipients['"]/);
  assert.match(route, /router\.delete\(['"]\/:id\/recipients\/\:recipientId['"]/);
  assert.match(route, /audience\/preview/);
  assert.match(route, /review/);
  assert.match(route, /created_by_user_id/);
  assert.match(route, /normalized_phone/);
  assert.doesNotMatch(route, /router\.(post|put|patch)\(['"]\/(:id\/)?send/);
  assert.doesNotMatch(route, /sendWhatsApp(Content|Message|Media)|Evolution/);
});
