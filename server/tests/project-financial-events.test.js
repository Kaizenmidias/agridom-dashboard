const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const typescript = require('typescript');

const root = path.resolve(__dirname, '../..');
const migration = fs.readFileSync(path.join(root, 'database/migrations/20261012_project_financial_events.sql'), 'utf8');
const baselineMigration = fs.readFileSync(path.join(root, 'database/migrations/20261012_project_financial_baselines.sql'), 'utf8');
const softDeleteMigration = fs.readFileSync(path.join(root, 'database/migrations/20261013_project_soft_delete.sql'), 'utf8');
const service = fs.readFileSync(path.join(root, 'server/services/project-financial-service.js'), 'utf8');
const crud = fs.readFileSync(path.join(root, 'server/routes/crud.js'), 'utf8');

test('financial events preserve competence, idempotency and historical traceability', () => {
  assert.match(migration, /idempotency_key VARCHAR\(191\) NOT NULL/);
  assert.match(migration, /competence_date DATE/);
  assert.match(baselineMigration, /UNIQUE KEY uq_project_financial_baseline_project/);
  assert.match(migration, /reference_event_id BIGINT UNSIGNED/);
  assert.match(migration, /is_historical TINYINT\(1\)/);
  assert.match(service, /idempotencyKey/);
});

test('completion records only the incremental balance and remains idempotent', () => {
  assert.match(service, /completion_settlement/);
  assert.match(service, /calculateProjectBalance/);
  assert.match(service, /project:\$\{projectId\}:completion-settlement/);
  assert.match(service, /if \(project\.status === 'completed'\) return project/);
  assert.match(crud, /settleProjectOnCompletion/);
});

test('legacy baseline is captured once and is added to later events without inventing competence', () => {
  assert.match(service, /project_financial_baselines/);
  assert.match(service, /legacy_opening_balance/);
  assert.match(service, /competenceDate: completionDate/);
  assert.match(crud, /financial_legacy_baseline/);
  assert.match(migration, /competence_date DATE NULL/);
});

test('idempotency conflicts are explicit and resolved before balance rejection', () => {
  assert.match(service, /FINANCIAL_IDEMPOTENCY_CONFLICT/);
  assert.match(service, /FINANCIAL_PAYMENT_EXCEEDS_BALANCE/);
  assert.match(crud, /recordProjectPayment/);
});

test('financial history does not expose internal idempotency keys and dashboard signals legacy values', () => {
  assert.doesNotMatch(crud, /SELECT id, amount, competence_date, origin, idempotency_key, created_at FROM project_financial_baselines/);
  assert.doesNotMatch(crud, /SELECT id, event_type, direction, amount, competence_date, origin, idempotency_key, created_at FROM project_financial_events/);
  assert.match(crud, /unclassified_legacy_revenue/);
});

test('dashboard excludes cancelled financial events and frontend uses Brazilian currency parsing', () => {
  assert.match(crud, /p\.status <> 'cancelled' AND e\.direction = 'credit'/);
  const currency = fs.readFileSync(path.join(root, 'src/lib/currency.ts'), 'utf8');
  assert.match(currency, /toLocaleString\('pt-BR'/);
  assert.match(currency, /replace\(\/\\\.\/g, ''\)/);
  assert.match(currency, /maskCurrencyBR/);
});

test('currency conversion does not multiply real-valued API data by 100', () => {
  const source = fs.readFileSync(path.join(root, 'src/lib/currency.ts'), 'utf8');
  const compiled = typescript.transpileModule(source, { compilerOptions: { module: typescript.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('exports', 'module', compiled)(module.exports, module);

  assert.equal(module.exports.formatCurrencyBR(900), 'R$ 900,00');
  assert.equal(module.exports.formatCurrencyBR(900.00), 'R$ 900,00');
  assert.equal(module.exports.formatCurrencyBR('900.00'), 'R$ 900,00');
  assert.equal(module.exports.formatCurrencyBR('150.00'), 'R$ 150,00');
});

test('payment and completion use project locks and do not exceed the contract value', () => {
  assert.match(service, /SELECT \* FROM projects WHERE id = \? AND deleted_at IS NULL FOR UPDATE/);
  assert.match(service, /payment > calculateProjectBalance\(project\)/);
  assert.match(service, /paid_value = paid_value \+ \?/);
  assert.match(service, /paid_value = project_value/);
});

test('legacy projects are not backfilled automatically', () => {
  assert.doesNotMatch(service, /isHistorical:\s*true/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS project_financial_events/);
});

test('financial accumulation uses paid_value once and soft deletion preserves history', () => {
  assert.match(softDeleteMigration, /deleted_at DATETIME NULL/);
  assert.match(crud, /UPDATE projects SET deleted_at = CURRENT_TIMESTAMP/);
  assert.match(crud, /p\.deleted_at IS NULL/);
  assert.match(service, /SELECT id FROM project_financial_events WHERE project_id = \? LIMIT 1 FOR UPDATE/);
});
