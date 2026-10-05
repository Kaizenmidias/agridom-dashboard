const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', 'scripts', 'drain-whatsapp-webhook-events.js');
const script = require(scriptPath);
const source = fs.readFileSync(scriptPath, 'utf8');

test('webhook drain defaults to a safe dry-run and validates the limit', () => {
  assert.deepEqual(script.parseArgs([]), { apply: false, dryRun: true, limit: 25 });
  assert.deepEqual(script.parseArgs(['--dry-run', '--limit=10']), { apply: false, dryRun: true, limit: 10 });
  assert.deepEqual(script.parseArgs(['--apply', '--limit=10']), { apply: true, dryRun: false, limit: 10 });
  assert.throws(() => script.parseArgs(['--apply', '--dry-run']), /apenas um modo/);
  assert.throws(() => script.parseArgs(['--limit=0']), /entre 1 e 100/);
});

test('webhook drain dry-run only reads safe aggregate information', async () => {
  const queries = [];
  const connection = {
    execute: async (sql) => {
      queries.push(sql);
      if (sql.includes('COUNT(*) AS total_pending')) return [[{ total_pending: 164, oldest_received_at: '2026-10-05 01:00:00', newest_received_at: '2026-10-05 02:00:00' }]];
      return [[{ event_type: 'messages.update', total: 118 }, { event_type: 'messages.upsert', total: 46 }]];
    },
    release: () => {},
  };
  const result = await script.main(['--dry-run', '--limit=25'], { pool: { getConnection: async () => connection } });
  assert.equal(result.totalPending, 164);
  assert.deepEqual(result.byEventType, [{ eventType: 'messages.update', total: 118 }, { eventType: 'messages.upsert', total: 46 }]);
  assert.equal(queries.length, 2);
  assert.ok(queries.every((query) => /^SELECT/.test(query)));
  assert.ok(queries.every((query) => /communication_webhook_events/.test(query)));
  assert.ok(queries.every((query) => !/payload|body_text|phone|token|secret|api.?key/i.test(query)));
});

test('webhook drain apply calls only the existing pending-event service once with the limit', async () => {
  const calls = [];
  const result = await script.main(['--apply', '--limit=7'], {
    pool: { getConnection: async () => { throw new Error('apply nao deve abrir conexao propria'); } },
    processPending: async (options) => { calls.push(options); return 6; },
  });
  assert.deepEqual(calls, [{ batchSize: 7 }]);
  assert.equal(result.processed, 6);
});

test('webhook drain is finite, does not start worker, and does not implement other batches or direct sends', () => {
  assert.doesNotMatch(source, /require\(['"]\.\.\/worker['"]\)/);
  assert.doesNotMatch(source, /processEventBatch|processJobBatch|processBroadcastBatch|processProspectingBatch|processWebsiteEnrichmentBatch/);
  assert.doesNotMatch(source, /sendWhatsApp(Message|Content|Media)|sendText|Evolution/);
  assert.doesNotMatch(source, /while\s*\(|setInterval|setTimeout/);
  assert.match(source, /processPendingWhatsAppEvents/);
  assert.match(source, /batchSize: options\.limit/);
});

test('webhook drain does not print event payloads or personal message data', () => {
  assert.match(source, /totalPending/);
  assert.match(source, /byEventType/);
  assert.doesNotMatch(source, /SELECT \* FROM communication_webhook_events/);
  assert.doesNotMatch(source, /payload|body_text|phone|apiKey|Authorization|secret/i);
});
