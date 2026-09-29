const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');
const migration = read('database', 'migrations', '20260929_broadcast_campaign_jobs.sql');
const worker = read('server', 'services', 'broadcast-campaign-worker.js');
const workerEntry = read('server', 'worker.js');
const route = read('server', 'routes', 'broadcast-campaigns.js');
const { executeBroadcastRecipient, BACKOFF_MS } = require('../services/broadcast-campaign-worker');

test('DISPAROS-2C migration protects jobs with unique campaign recipient and persistent locks', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS broadcast_campaign_jobs/);
  assert.match(migration, /UNIQUE KEY uq_broadcast_job_campaign_recipient/);
  assert.match(migration, /status ENUM\('pending', 'processing', 'completed', 'failed', 'cancelled'\)/);
  assert.match(migration, /available_at DATETIME/);
  assert.match(migration, /locked_by VARCHAR/);
  assert.match(migration, /locked_at DATETIME/);
  assert.doesNotMatch(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i);
});

test('DISPAROS-2C claims atomically, recovers stale locks and has bounded retry', () => {
  assert.match(worker, /FOR UPDATE SKIP LOCKED/);
  assert.match(worker, /locked_by/);
  assert.match(worker, /locked_at/);
  assert.match(worker, /max_attempts/);
  assert.match(worker, /BACKOFF_MS/);
  assert.match(worker, /campaign_status/);
  assert.deepEqual(BACKOFF_MS, [5000, 30000, 120000]);
});

test('DISPAROS-2C lifecycle routes and worker keep sending behind an executor boundary', () => {
  for (const endpoint of ['/start', '/pause', '/resume', '/cancel', '/progress']) assert.match(route, new RegExp(`router\\.(post|get)\\(['"]\\/:id${endpoint}`));
  assert.match(route, /materializeCampaign/);
  assert.match(workerEntry, /processBroadcastBatch/);
  assert.match(worker, /executor/);
  assert.doesNotMatch(worker, /axios|new EvolutionWhatsAppProvider/);
  assert.doesNotMatch(route, /sendWhatsApp(Content|Message|Media)|sendText|sendMedia|sendAudio|Evolution/);
  assert.rejects(() => executeBroadcastRecipient(), /EXECUTOR_NOT_CONFIGURED/);
});
