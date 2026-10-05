const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env') });

const { closeConnection, getPool } = require('../config/database');

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const ALLOWED_ERROR = 'EVOLUTION_UNAVAILABLE';
const RECOVERY_JOB_TYPE = 'engine.step';

function parseArgs(argv = []) {
  const automationArg = argv.find((value) => value.startsWith('--automation-id='));
  const automationId = Number(automationArg?.slice('--automation-id='.length));
  const rawLimit = argv.find((value) => value.startsWith('--limit='))?.slice('--limit='.length);
  const limit = rawLimit == null ? DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isSafeInteger(automationId) || automationId <= 0) throw new Error('--automation-id deve ser um inteiro positivo e e obrigatorio.');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error(`--limit deve ser um inteiro entre 1 e ${MAX_LIMIT}.`);
  return { automationId, limit, apply: argv.includes('--apply') };
}

function safeErrorCode(row) {
  const value = String(row.error_code || row.last_error || row.error_message || '').toUpperCase();
  if (value.includes('EVOLUTION_REQUEST_FAILED')) return 'EVOLUTION_REQUEST_FAILED';
  if (value.includes(ALLOWED_ERROR)) return ALLOWED_ERROR;
  return row.error_code ? String(row.error_code).slice(0, 100) : 'UNKNOWN';
}

function decision(row, reason, classification) {
  return { runId: Number(row.run_id), leadId: row.entity_id == null ? null : Number(row.entity_id), errorCode: safeErrorCode(row), classification, reason };
}

function nextRecoveryGeneration(runId, stepKey, jobs = []) {
  const prefix = `run:${Number(runId)}:step:${String(stepKey)}:recovery:`;
  const generations = jobs.map((job) => {
    const key = String(job.idempotency_key || '');
    if (!key.startsWith(prefix)) return 0;
    const generation = Number(key.slice(prefix.length));
    return Number.isSafeInteger(generation) && generation > 0 ? generation : 0;
  });
  return Math.max(0, ...generations) + 1;
}

async function loadFailedRuns(connection, automationId, limit) {
  const [rows] = await connection.execute(
    `SELECT ar.id AS run_id, ar.automation_id, ar.entity_id, ar.current_step_key,
            ar.status AS run_status, ar.error_code, ar.error_message,
            aj.id AS failed_job_id, aj.last_error, aj.status AS job_status
       FROM automation_runs ar
       JOIN automation_jobs aj ON aj.id = (
         SELECT MAX(aj2.id) FROM automation_jobs aj2
          WHERE aj2.automation_run_id = ar.id AND aj2.status = 'failed'
       )
      WHERE ar.automation_id = ? AND ar.status = 'failed'
      ORDER BY ar.updated_at, ar.id LIMIT ?`, [automationId, limit]);
  return rows;
}

async function loadSafetyState(connection, row, lock = false) {
  const suffix = lock ? ' FOR UPDATE' : '';
  const [jobs] = await connection.execute(
    `SELECT id, status, idempotency_key, run_step_id FROM automation_jobs
      WHERE automation_run_id = ?${suffix}`,
    [row.run_id]
  );
  const [runMessages] = await connection.execute(
    `SELECT COUNT(*) AS total,
            SUM(status = 'sent' OR sent_at IS NOT NULL OR delivery_status IN ('sent', 'delivered', 'read')) AS confirmed,
            SUM(provider_message_id IS NOT NULL OR external_message_id IS NOT NULL) AS identified
       FROM communication_messages WHERE automation_run_id = ?`, [row.run_id]
  );
  const [leadMessages] = await connection.execute(
    `SELECT COUNT(*) AS total,
            SUM(status = 'sent' OR sent_at IS NOT NULL OR delivery_status IN ('sent', 'delivered', 'read')) AS confirmed,
            SUM(provider_message_id IS NOT NULL OR external_message_id IS NOT NULL) AS identified
       FROM communication_messages
      WHERE lead_id = ? AND direction = 'outbound'`, [row.entity_id]
  );
  const [steps] = await connection.execute(
    `SELECT id, step_key, step_type, status, output FROM automation_run_steps
      WHERE automation_run_id = ? AND step_key = ?${lock ? ' FOR UPDATE' : ''}`,
    [row.run_id, row.current_step_key]
  );
  const activeJobs = jobs.filter((job) => ['pending', 'processing'].includes(String(job.status)));
  const generation = nextRecoveryGeneration(row.run_id, row.current_step_key, jobs);
  const recoveryKey = `run:${Number(row.run_id)}:step:${String(row.current_step_key)}:recovery:${generation}`;
  return { jobs, activeJobs, runMessages: runMessages[0] || {}, leadMessages: leadMessages[0] || {}, step: steps[0] || null, recoveryKey, generation };
}

function classify(row, state) {
  if (row.run_status !== 'failed' || row.job_status !== 'failed') return decision(row, 'invalid_state', 'invalid_state');
  if (safeErrorCode(row) !== ALLOWED_ERROR) return decision(row, 'EVOLUTION_REQUEST_FAILED is ambiguous or error is not allowed', 'ambiguous');
  if (state.activeJobs.length) return decision(row, 'active job already exists', 'already_pending');
  if (Number(state.runMessages.confirmed || 0) > 0 || Number(state.leadMessages.confirmed || 0) > 0) return decision(row, 'confirmed outbound communication exists', 'already_sent');
  if (Number(state.runMessages.identified || 0) > 0 || Number(state.leadMessages.identified || 0) > 0) return decision(row, 'communication has provider or external identifier', 'already_sent');
  if (!row.current_step_key || !state.step || !['action', 'wait', 'finish'].includes(String(state.step.step_type))) return decision(row, 'current resumable step is missing or invalid', 'invalid_state');
  return decision(row, 'no active job or communication evidence', 'eligible');
}

async function audit(connection, automationId, limit) {
  const rows = await loadFailedRuns(connection, automationId, limit);
  const decisions = [];
  for (const row of rows) decisions.push(classify(row, await loadSafetyState(connection, row)));
  const counts = { totalFailedRuns: rows.length, eligible: 0, ambiguous: 0, alreadyPending: 0, alreadySent: 0, unsupportedError: 0, invalidState: 0 };
  for (const item of decisions) {
    if (item.classification === 'eligible') counts.eligible += 1;
    else if (item.classification === 'ambiguous') counts.ambiguous += 1;
    else if (item.classification === 'already_pending') counts.alreadyPending += 1;
    else if (item.classification === 'already_sent') counts.alreadySent += 1;
    else if (item.classification === 'invalid_state') counts.invalidState += 1;
    else counts.unsupportedError += 1;
  }
  return { counts, decisions };
}

async function recoverOne(connection, candidate, automationId) {
  await connection.beginTransaction();
  try {
    const [runs] = await connection.execute(
      `SELECT ar.id AS run_id, ar.automation_id, ar.entity_id, ar.current_step_key,
              ar.status AS run_status, ar.error_code, ar.error_message, aj.last_error, aj.status AS job_status
         FROM automation_runs ar
         JOIN automation_jobs aj ON aj.id = (
           SELECT MAX(aj2.id) FROM automation_jobs aj2
            WHERE aj2.automation_run_id = ar.id AND aj2.status = 'failed'
         )
        WHERE ar.id = ? AND ar.automation_id = ? AND ar.status = 'failed' FOR UPDATE`, [candidate.runId, automationId]
    );
    const row = runs[0];
    if (!row || safeErrorCode(row) !== ALLOWED_ERROR) { await connection.rollback(); return decision(row || { run_id: candidate.runId, automation_id: automationId }, 'state changed during revalidation', 'invalid_state'); }
    const state = await loadSafetyState(connection, row, true);
    const result = classify(row, state);
    if (result.classification !== 'eligible') { await connection.rollback(); return result; }
    await connection.execute(
      `INSERT INTO automation_jobs (automation_run_id, run_step_id, job_type, status, execute_at, available_at, attempts, max_attempts, idempotency_key)
       VALUES (?, ?, ?, 'pending', UTC_TIMESTAMP(), UTC_TIMESTAMP(), 0, 8, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [candidate.runId, state.step.id, RECOVERY_JOB_TYPE, state.recoveryKey]
    );
    await connection.execute("UPDATE automation_run_steps SET status = 'queued', error_code = NULL, error_message = NULL, finished_at = NULL WHERE id = ? AND status IN ('queued', 'waiting')", [state.step.id]);
    await connection.execute("UPDATE automation_runs SET status = 'queued', error_code = NULL, error_message = NULL WHERE id = ? AND status = 'failed'", [candidate.runId]);
    await connection.commit();
    return { ...result, classification: 'recovered', reason: 'one recovery job created' };
  } catch (error) { await connection.rollback(); throw error; }
}

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  const pool = dependencies.pool || getPool();
  const connection = await pool.getConnection();
  try {
    const report = await audit(connection, options.automationId, options.limit);
    if (!options.apply) {
      console.log(JSON.stringify({ mode: 'dry-run', automationId: options.automationId, ...report.counts, candidates: report.decisions }, null, 2));
      return report;
    }
    const recovered = [];
    for (const candidate of report.decisions.filter((item) => item.classification === 'eligible')) recovered.push(await recoverOne(connection, candidate, options.automationId));
    const result = { mode: 'apply', automationId: options.automationId, audited: report.counts, recovered };
    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally { connection.release(); if (!dependencies.pool) await closeConnection(); }
}

if (require.main === module) main().catch(async (error) => { console.error(error.code || error.message || 'WHATSAPP_RECOVERY_FAILED'); await closeConnection(); process.exitCode = 1; });

module.exports = { ALLOWED_ERROR, audit, classify, loadSafetyState, main, parseArgs, recoverOne };
