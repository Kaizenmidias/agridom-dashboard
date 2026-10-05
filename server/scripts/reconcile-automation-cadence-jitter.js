const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env') });

const { closeConnection, getPool } = require('../config/database');

const INCIDENT_AUTOMATION_ID = 15;
const INCIDENT_ACCOUNT_ID = 1;
const ALLOWED_JOBS = new Map([
  [127, { runId: 99, leadId: 63, attempts: 7, maxAttempts: 8, executeAt: '2026-10-06 01:43:04', scheduledAt: '2026-10-05 20:43:04' }],
  [128, { runId: 100, leadId: 64, attempts: 7, maxAttempts: 8, executeAt: '2026-10-06 01:53:04', scheduledAt: '2026-10-05 20:53:04' }],
]);

function parseArgs(argv = []) {
  const automationArg = argv.find((value) => value.startsWith('--automation-id='));
  const accountArg = argv.find((value) => value.startsWith('--account-id='));
  const jobsArg = argv.find((value) => value.startsWith('--job-ids='));
  const automationId = Number(automationArg?.slice('--automation-id='.length));
  const accountId = Number(accountArg?.slice('--account-id='.length));
  const jobIds = String(jobsArg?.slice('--job-ids='.length) || '').split(',').filter(Boolean).map(Number);
  if (automationId !== INCIDENT_AUTOMATION_ID) throw new Error(`--automation-id deve ser ${INCIDENT_AUTOMATION_ID}.`);
  if (accountId !== INCIDENT_ACCOUNT_ID) throw new Error(`--account-id deve ser ${INCIDENT_ACCOUNT_ID}.`);
  if (!jobIds.length || jobIds.some((id) => !ALLOWED_JOBS.has(id)) || new Set(jobIds).size !== jobIds.length) {
    throw new Error('--job-ids deve conter somente 127,128, sem repeticao.');
  }
  return { automationId, accountId, jobIds, apply: argv.includes('--apply') };
}

function parseJson(value) {
  try { return typeof value === 'object' && value ? value : JSON.parse(value || '{}'); } catch { return {}; }
}

function safeDecision(jobId, classification, reason, row = {}) {
  return { jobId: Number(jobId), runId: Number(row.run_id || 0) || null, leadId: Number(row.entity_id || 0) || null, classification, reason };
}

async function loadCandidate(connection, jobId, automationId, accountId, lock = false) {
  const suffix = lock ? ' FOR UPDATE' : '';
  const [rows] = await connection.execute(
    `SELECT aj.id AS job_id, aj.automation_run_id, aj.job_type, aj.status AS job_status,
            aj.attempts, aj.max_attempts, aj.execute_at, aj.available_at, aj.last_error,
            ar.id AS run_id, ar.automation_id, ar.entity_id, ar.status AS run_status, ar.current_step_key,
            ars.id AS step_id, ars.step_key, ars.status AS step_status, ars.output,
            av.definition
       FROM automation_jobs aj
       JOIN automation_runs ar ON ar.id = aj.automation_run_id
       LEFT JOIN automation_run_steps ars ON ars.automation_run_id = aj.automation_run_id AND ars.step_key = ar.current_step_key
       LEFT JOIN automation_versions av ON av.id = ar.automation_version_id
      WHERE aj.id = ? AND ar.automation_id = ?${suffix}`,
    [jobId, automationId]
  );
  const row = rows[0];
  if (!row) return null;
  const [messages] = await connection.execute(
    `SELECT COUNT(*) AS total,
            SUM(provider_message_id IS NOT NULL OR external_message_id IS NOT NULL OR sent_at IS NOT NULL OR status = 'sent') AS evidence
       FROM communication_messages
      WHERE automation_run_id = ? OR automation_step_id = ? OR (lead_id = ? AND direction = 'outbound')`,
    [row.run_id, row.step_id, row.entity_id]
  );
  const stepOutput = parseJson(row.output);
  const definition = parseJson(row.definition);
  const step = Array.isArray(definition.steps) ? definition.steps.find((item) => item.id === row.step_key) : null;
  return { ...row, messages: messages[0] || {}, stepOutput, scheduledAt: stepOutput?.cadence?.scheduled_at || null, stepAccountId: Number(step?.config?.accountId || 0) || null };
}

function classify(row, jobId, accountId) {
  const expected = ALLOWED_JOBS.get(Number(jobId));
  if (!row) return safeDecision(jobId, 'blocked', 'job_not_found');
  if (Number(row.run_id) !== expected.runId || Number(row.entity_id) !== expected.leadId) return safeDecision(jobId, 'blocked', 'run_or_lead_mismatch', row);
  if (Number(row.automation_id) !== INCIDENT_AUTOMATION_ID || row.job_type !== 'engine.bootstrap') return safeDecision(jobId, 'blocked', 'automation_or_job_type_mismatch', row);
  if (row.job_status !== 'pending' || row.run_status !== 'queued') return safeDecision(jobId, 'blocked', 'job_or_run_state_changed', row);
  if (Number(row.attempts) !== expected.attempts || Number(row.max_attempts) !== expected.maxAttempts) return safeDecision(jobId, 'blocked', 'attempt_state_changed', row);
  if (Number(row.stepAccountId) !== accountId) return safeDecision(jobId, 'blocked', 'account_mismatch', row);
  if (String(row.last_error || '') !== 'ENGINE_ERROR:EVOLUTION_UNAVAILABLE') return safeDecision(jobId, 'blocked', 'error_state_changed', row);
  if (String(row.scheduledAt || '') !== expected.scheduledAt) return safeDecision(jobId, 'blocked', 'cadence_evidence_changed', row);
  if (String(row.execute_at).slice(0, 19) !== expected.executeAt || String(row.available_at).slice(0, 19) !== expected.executeAt) return safeDecision(jobId, 'blocked', 'queue_time_changed', row);
  if (Number(row.messages?.evidence || 0) > 0) return safeDecision(jobId, 'blocked', 'communication_evidence_exists', row);
  return safeDecision(jobId, 'eligible', 'confirmed_artificial_cadence_attempt', row);
}

async function audit(connection, options) {
  const decisions = [];
  for (const jobId of options.jobIds) decisions.push(classify(await loadCandidate(connection, jobId, options.automationId, options.accountId), jobId, options.accountId));
  return { decisions, eligible: decisions.filter((item) => item.classification === 'eligible').length, blocked: decisions.filter((item) => item.classification === 'blocked').length };
}

async function applyOne(connection, jobId, options) {
  await connection.beginTransaction();
  try {
    const row = await loadCandidate(connection, jobId, options.automationId, options.accountId, true);
    const decision = classify(row, jobId, options.accountId);
    if (decision.classification !== 'eligible') { await connection.rollback(); return decision; }
    const [result] = await connection.execute(
      `UPDATE automation_jobs
          SET attempts = 6, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND automation_run_id = ? AND status = 'pending' AND attempts = 7 AND max_attempts = 8
          AND job_type = 'engine.bootstrap'`,
      [jobId, ALLOWED_JOBS.get(Number(jobId)).runId]
    );
    if (Number(result.affectedRows || 0) !== 1) { await connection.rollback(); return safeDecision(jobId, 'blocked', 'state_changed_during_apply', row); }
    await connection.commit();
    return { ...decision, classification: 'reconciled', reason: 'attempt restored from 7 to 6; queue and cadence preserved' };
  } catch (error) { await connection.rollback(); throw error; }
}

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  const pool = dependencies.pool || getPool();
  const connection = await pool.getConnection();
  try {
    const report = await audit(connection, options);
    if (!options.apply) return { mode: 'dry-run', ...report, message: 'Nenhuma alteracao realizada.' };
    const reconciled = [];
    for (const item of report.decisions) reconciled.push(item.classification === 'eligible' ? await applyOne(connection, item.jobId, options) : item);
    return { mode: 'apply', ...report, reconciled, message: 'Somente jobs explicitamente elegiveis foram reconciliados.' };
  } finally { connection.release(); if (!dependencies.pool) await closeConnection(); }
}

if (require.main === module) main().then((result) => console.log(JSON.stringify(result, null, 2))).catch(async (error) => { console.error(error.message || 'CADENCE_RECONCILIATION_FAILED'); await closeConnection(); process.exitCode = 1; });

module.exports = { ALLOWED_JOBS, audit, classify, main, parseArgs };
