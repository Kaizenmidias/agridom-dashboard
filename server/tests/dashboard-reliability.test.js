const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const billing = require(path.join(root, 'server/utils/billing-calculations.js'));
const dashboard = fs.readFileSync(path.join(root, 'src/components/dashboard/DashboardWithFilter.tsx'), 'utf8');

test('billing calculations accept MySQL Date values without changing the calendar day', () => {
  const date = new Date(2026, 9, 5);
  assert.equal(billing.getDayOfWeekFromDate(date), billing.getDayOfWeekFromDate('2026-10-05'));
  assert.equal(billing.calculateMonthlyAmount(100, 'unica', date, 2026, 10), 100);
  assert.equal(billing.calculateMonthlyAmount(100, 'semanal', date, 2026, 10), billing.calculateMonthlyAmount(100, 'semanal', '2026-10-05', 2026, 10));
});

test('billing calculations handle strings, nulls and invalid dates safely', () => {
  assert.equal(billing.calculateMonthlyAmount(100, 'unica', '2026-10-05', 2026, 10), 100);
  assert.equal(billing.calculateMonthlyAmount(100, 'unica', null, 2026, 10), 0);
  assert.equal(billing.calculateMonthlyAmount(100, 'unica', 'not-a-date', 2026, 10), 0);
  assert.equal(billing.calculateMonthlyAmount(100, 'semanal', new Date('invalid'), 2026, 10), 0);
});

test('recurring expense totals remain correct for weekly, monthly and annual expenses', () => {
  const expenses = [
    { amount: 100, billing_type: 'mensal', date: new Date(2026, 0, 1) },
    { amount: 1200, billing_type: 'anual', date: '2026-01-01' },
    { amount: 50, billing_type: 'semanal', date: '2026-01-05' }
  ];
  const total = billing.calculateTotalMonthlyExpenses(expenses, 2026, 1);
  assert.equal(total, 100 + 100 + billing.calculateMonthlyAmount(50, 'semanal', '2026-01-05', 2026, 1));
});

test('dashboard clears stale zero stats and offers a retry after HTTP errors', () => {
  assert.match(dashboard, /const \[dashboardError, setDashboardError\]/);
  assert.match(dashboard, /setDashboardStats\(null\)/);
  assert.match(dashboard, /Não foi possível carregar as estatísticas/);
  assert.match(dashboard, /Tentar novamente/);
  assert.match(dashboard, /loadDashboardData\(lastFilters\)/);
  assert.match(dashboard, /!dashboardError && <Card>/);
});
