const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const repositorySource = fs.readFileSync(require.resolve('../services/automation-repository'), 'utf8');
const routesSource = fs.readFileSync(require.resolve('../routes/automations'), 'utf8');
const engineSource = fs.readFileSync(require.resolve('../services/automation-engine'), 'utf8');
const pageSource = fs.readFileSync(require.resolve('../../src/pages/commercial/AutomationRunsPage.tsx'), 'utf8');

test('automation runs expose real lead data without an N+1 lookup', () => {
  assert.match(repositorySource, /LEFT JOIN prospects p/);
  assert.match(repositorySource, /p\.business_name AS lead_name/);
  assert.match(repositorySource, /p\.phone AS lead_phone/);
  assert.doesNotMatch(repositorySource, /for \(const .*run|runs\.map\(async/);
});

test('queued run cancellation is admin-only and transactionally guarded', () => {
  assert.match(routesSource, /:runId\/cancel/);
  assert.match(routesSource, /requireCommercialAdmin/);
  assert.match(repositorySource, /status = 'pending'/);
  assert.match(repositorySource, /status = 'cancelled'/);
  assert.match(repositorySource, /WHERE id = \? AND status = 'pending'/);
  assert.match(repositorySource, /run\.run_status !== 'queued'/);
});

test('worker claims only pending jobs and does not reopen cancelled work', () => {
  assert.match(engineSource, /status = 'pending' AND available_at <= UTC_TIMESTAMP\(\)/);
  assert.match(engineSource, /ar\.status IN \('failed', 'queued'\)/);
  assert.doesNotMatch(engineSource, /ar\.status IN \([^)]*cancelled/);
});

test('retry blocks ambiguous provider outcomes and only exposes safe failures', () => {
  assert.match(repositorySource, /EVOLUTION_REQUEST_FAILED/);
  assert.match(repositorySource, /const SAFE_RETRY_FAILURES/);
  assert.match(repositorySource, /isSafeRetryFailure\(run\.error_code, run\.error_message\)/);
  assert.match(repositorySource, /ar\.error_code, ar\.error_message/);
  assert.match(repositorySource, /retry_block_reason/);
});

test('runs page uses backend authority for retry and cancellation controls', () => {
  assert.match(pageSource, /run\.can_retry/);
  assert.match(pageSource, /run\.retry_block_reason/);
  assert.match(pageSource, /run\.can_cancel/);
  assert.match(pageSource, /automationsAPI\.cancelRun/);
  assert.match(pageSource, /Lead #\$\{run\.entity_id\}/);
});

test('run control API preserves existing retry and adds cancellation without worker side effects', () => {
  assert.match(routesSource, /retryRun/);
  assert.match(routesSource, /cancelRun/);
  assert.match(repositorySource, /withTransaction/);
  assert.match(repositorySource, /manual-retry:\$\{runId\}:/);
});
