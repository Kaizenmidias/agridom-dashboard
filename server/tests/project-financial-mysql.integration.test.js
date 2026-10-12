const assert = require('node:assert/strict');
const test = require('node:test');
const mysql = require('mysql2/promise');
const {
  recordProjectPayment,
  settleProjectOnCompletion,
} = require('../services/project-financial-service');

const enabled = process.env.KAIZEN_FINANCIAL_TEST_DB === '1';
const config = {
  host: process.env.KAIZEN_FINANCIAL_TEST_HOST || '127.0.0.1',
  port: Number(process.env.KAIZEN_FINANCIAL_TEST_PORT || 3306),
  database: process.env.KAIZEN_FINANCIAL_TEST_DATABASE || 'kaizen_financial_test',
  user: process.env.KAIZEN_FINANCIAL_TEST_USER || 'kaizen_financial_test',
  password: process.env.KAIZEN_FINANCIAL_TEST_PASSWORD || 'kaizen_financial_test',
};

const safeTarget = config.host === '127.0.0.1'
  && Number.isInteger(config.port) && config.port > 0 && config.port <= 65535
  && config.database === 'kaizen_financial_test'
  && config.user === 'kaizen_financial_test'
  && config.user !== 'root';

if (enabled && !safeTarget) {
  throw new Error('Refusing financial integration tests: target is not the isolated kaizen_financial_test database');
}

const integrationTest = (name, fn) => test(name, { skip: !enabled }, fn);
let pool;
let userId;

async function withTransaction(fn) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await fn(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createProject({ paidValue = 0, status = 'active' } = {}) {
  const [result] = await pool.execute(
    `INSERT INTO projects (user_id, name, project_type, status, project_value, paid_value, start_date, created_at, updated_at)
     VALUES (?, ?, 'website', ?, 900.00, ?, '2026-10-05', '2026-10-05 12:00:00', '2026-10-05 12:00:00')`,
    [userId, `financial-test-${Date.now()}-${Math.random()}`, status, paidValue]
  );
  return result.insertId;
}

async function projectRow(id) {
  const [rows] = await pool.execute('SELECT project_value, paid_value, status, completion_date FROM projects WHERE id = ?', [id]);
  return rows[0];
}

async function financialRows(id) {
  const [events] = await pool.execute('SELECT event_type, amount, competence_date, idempotency_key FROM project_financial_events WHERE project_id = ? ORDER BY id', [id]);
  const [baselines] = await pool.execute('SELECT amount, competence_date FROM project_financial_baselines WHERE project_id = ?', [id]);
  return { events, baseline: baselines[0] || null };
}

test.before(async () => {
  if (!enabled) return;
  pool = mysql.createPool({ ...config, connectionLimit: 8, decimalNumbers: true });
  const [users] = await pool.execute('SELECT id FROM users WHERE email = ?', ['financial-integration-test@local.invalid']);
  if (users[0]) userId = users[0].id;
  else {
    const [result] = await pool.execute(
      `INSERT INTO users (email, password, name, role, can_access_projects)
       VALUES ('financial-integration-test@local.invalid', 'test-only', 'Financial Integration Test', 'user', 1)`
    );
    userId = result.insertId;
  }
});

test.after(async () => {
  if (!pool || !userId) return;
  await pool.execute('DELETE FROM project_financial_baselines WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)', [userId]);
  await pool.execute('DELETE FROM project_financial_events WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)', [userId]);
  await pool.execute('DELETE FROM projects WHERE user_id = ?', [userId]);
  await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
  await pool.end();
});

integrationTest('new project records October payment and November incremental completion', async () => {
  const id = await createProject();
  await withTransaction((connection) => recordProjectPayment({ connection, projectId: id, amount: 400, competenceDate: '2026-10-05', idempotencyKey: `new:${id}:october` }));
  await withTransaction((connection) => settleProjectOnCompletion({ connection, projectId: id, completionDate: '2026-11-05' }));
  const { events, baseline } = await financialRows(id);
  assert.equal(baseline, null);
  assert.deepEqual(events.map((event) => [event.event_type, Number(event.amount), String(event.competence_date)]), [
    ['payment_received', 400, '2026-10-05'],
    ['completion_settlement', 500, '2026-11-05'],
  ]);
  assert.equal(Number((await projectRow(id)).paid_value), 900);
});

integrationTest('legacy project captures one unknown baseline before completion settlement', async () => {
  const id = await createProject({ paidValue: 400 });
  await withTransaction((connection) => settleProjectOnCompletion({ connection, projectId: id, completionDate: '2026-11-05' }));
  const { events, baseline } = await financialRows(id);
  assert.equal(Number(baseline.amount), 400);
  assert.equal(baseline.competence_date, null);
  assert.deepEqual(events.map((event) => [event.event_type, Number(event.amount), String(event.competence_date)]), [['completion_settlement', 500, '2026-11-05']]);
  assert.equal(Number((await projectRow(id)).paid_value), 900);
});

integrationTest('idempotent payment accepts identical payload and rejects conflicts before balance checks', async () => {
  const id = await createProject();
  const key = `same:${id}`;
  await withTransaction((connection) => recordProjectPayment({ connection, projectId: id, amount: 900, competenceDate: '2026-12-31', idempotencyKey: key }));
  await withTransaction((connection) => recordProjectPayment({ connection, projectId: id, amount: 900, competenceDate: '2026-12-31', idempotencyKey: key }));
  await assert.rejects(() => withTransaction((connection) => recordProjectPayment({ connection, projectId: id, amount: 1, competenceDate: '2027-01-01', idempotencyKey: key })), { code: 'FINANCIAL_IDEMPOTENCY_CONFLICT' });
  assert.equal((await financialRows(id)).events.length, 1);
});

integrationTest('concurrent payments cannot overpay the project', async () => {
  const id = await createProject();
  const results = await Promise.allSettled([1, 2].map((n) => withTransaction((connection) => recordProjectPayment({ connection, projectId: id, amount: 600, competenceDate: `2026-12-0${n}`, idempotencyKey: `concurrent:${id}:${n}` }))));
  assert.equal(Number((await projectRow(id)).paid_value), 600);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
});

integrationTest('concurrent completions create only one settlement', async () => {
  const id = await createProject({ paidValue: 400 });
  await Promise.all([1, 2].map(() => withTransaction((connection) => settleProjectOnCompletion({ connection, projectId: id, completionDate: '2027-01-05' }))));
  const { events } = await financialRows(id);
  assert.equal(events.filter((event) => event.event_type === 'completion_settlement').length, 1);
});

integrationTest('rollback leaves project and event unchanged after controlled failure', async () => {
  const id = await createProject();
  await assert.rejects(() => withTransaction(async (connection) => {
    await recordProjectPayment({ connection, projectId: id, amount: 400, competenceDate: '2026-10-05', idempotencyKey: `rollback:${id}` });
    throw new Error('controlled failure');
  }), /controlled failure/);
  assert.equal(Number((await projectRow(id)).paid_value), 0);
  assert.deepEqual((await financialRows(id)).events, []);
});

integrationTest('January competence remains separate from December', async () => {
  const id = await createProject();
  await withTransaction((connection) => recordProjectPayment({ connection, projectId: id, amount: 400, competenceDate: '2026-12-31', idempotencyKey: `dec:${id}` }));
  await withTransaction((connection) => recordProjectPayment({ connection, projectId: id, amount: 500, competenceDate: '2027-01-01', idempotencyKey: `jan:${id}` }));
  const { events } = await financialRows(id);
  assert.deepEqual(events.map((event) => String(event.competence_date)), ['2026-12-31', '2027-01-01']);
});
