const os = require('node:os');
const crypto = require('node:crypto');
const { getPool } = require('../config/database');
const { validateAutomationDefinition } = require('./automation-definition-validator');
const { executeAction } = require('./automation/action-executor');
const { evaluateCondition } = require('./automation/condition-evaluator');

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_POLL_MS = 1000;
const DEFAULT_LOCK_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_MAX_EVENT_ATTEMPTS = 3;
const BACKOFF_MS = [5000, 30000, 120000];
const MAX_LINEAGE_DEPTH = 10;
const LEGACY_BOOTSTRAP_MARKER = 'bootstrap/no-op';

const positiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, max) : fallback;
};

const parseJson = (value, fallback = {}) => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
};

const workerId = (provided) => provided || `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`;
const lockSeconds = (value) => Math.max(1, Math.ceil(positiveInt(value, DEFAULT_LOCK_TIMEOUT_MS, 24 * 60 * 60 * 1000) / 1000));
const safeError = (error) => `ENGINE_ERROR:${String(error?.code || 'UNEXPECTED').replace(/[^A-Z0-9_:-]/gi, '').slice(0, 80) || 'UNEXPECTED'}`;

async function matchAutomationsForEvent(connection, event) {
  const [rows] = await connection.execute(
    `SELECT a.id AS automation_id, a.active_version_id AS automation_version_id, av.version_number, av.definition
     FROM automations a
     JOIN automation_versions av ON av.id = a.active_version_id
       AND av.automation_id = a.id AND av.status = 'published'
     WHERE a.status = 'active'
       AND JSON_UNQUOTE(JSON_EXTRACT(av.definition, '$.trigger.type')) = ?
       AND COALESCE(?, 0) < ${MAX_LINEAGE_DEPTH}
       AND (COALESCE(?, 0) = 0 OR a.id <> COALESCE(?, 0))
     ORDER BY a.id`,
    [event.event_type, event.lineage_depth, event.source_automation_id, event.source_automation_id]
  );
  return rows.map((row) => ({ ...row, automation_id: Number(row.automation_id), automation_version_id: Number(row.automation_version_id), definition: parseJson(row.definition) }));
}

async function createRunAndJob(connection, event, match) {
  const runKey = `event:${event.id}:automation:${match.automation_id}:version:${match.automation_version_id}`;
  const [runResult] = await connection.execute(
    `INSERT INTO automation_runs
      (automation_id, automation_version_id, event_id, entity_type, entity_id, status, correlation_id, idempotency_key)
     VALUES (?, ?, ?, ?, ?, 'queued', ?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [match.automation_id, match.automation_version_id, event.id, event.entity_type, event.entity_id, event.correlation_id, runKey]
  );
  const runId = Number(runResult.insertId);
  const jobKey = `run:${runId}:bootstrap`;
  const [jobResult] = await connection.execute(
    `INSERT INTO automation_jobs
      (automation_run_id, job_type, status, execute_at, available_at, attempts, max_attempts, idempotency_key)
     VALUES (?, 'engine.bootstrap', 'pending', UTC_TIMESTAMP(), UTC_TIMESTAMP(), 0, 3, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [runId, jobKey]
  );
  return { runId, jobId: Number(jobResult.insertId), runKey, jobKey };
}

async function recoverStaleEvents(connection, timeoutMs) {
  const seconds = lockSeconds(timeoutMs);
  await connection.execute(
    `UPDATE automation_events
     SET engine_status = 'pending', engine_locked_at = NULL, engine_locked_by = NULL
     WHERE (engine_status = 'processing' OR (engine_status = 'failed' AND engine_attempts < ?))
       AND engine_locked_at IS NOT NULL
       AND engine_locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${seconds} SECOND)`,
    [DEFAULT_MAX_EVENT_ATTEMPTS]
  );
}

async function processOneEvent({ workerId: currentWorkerId, lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = {}) {
  const connection = await getPool().getConnection();
  let claimedEventId = null;
  try {
    await connection.beginTransaction();
    await recoverStaleEvents(connection, lockTimeoutMs);
    const [pendingRows] = await connection.execute(
      `SELECT * FROM automation_events
       WHERE engine_status = 'pending'
       ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`
    );
    const event = pendingRows[0];
    if (!event) { await connection.rollback(); return { processed: false }; }
    claimedEventId = Number(event.id);
    await connection.execute(
      `UPDATE automation_events
       SET engine_status = 'processing', engine_locked_at = UTC_TIMESTAMP(), engine_locked_by = ?, engine_attempts = engine_attempts + 1
       WHERE id = ?`,
      [currentWorkerId, event.id]
    );
    const matches = await matchAutomationsForEvent(connection, event);
    const created = [];
    for (const match of matches) created.push(await createRunAndJob(connection, event, match));
    await connection.execute(
      `UPDATE automation_events
       SET engine_status = 'processed', engine_processed_at = UTC_TIMESTAMP(), engine_locked_at = NULL, engine_locked_by = NULL, engine_last_error = NULL
       WHERE id = ?`,
      [event.id]
    );
    await connection.commit();
    console.info('Automation event processed:', { event_id: Number(event.id), event_type: event.event_type, matches: created.length });
    return { processed: true, eventId: Number(event.id), matches: created.length, created };
  } catch (error) {
    await connection.rollback();
    await markEventFailed(claimedEventId, currentWorkerId, error);
    throw error;
  } finally {
    connection.release();
  }
}

async function markEventFailed(eventId, currentWorkerId, error) {
  const connection = await getPool().getConnection();
  try {
    await connection.execute(
      `UPDATE automation_events
       SET engine_status = 'failed', engine_locked_at = UTC_TIMESTAMP(), engine_locked_by = ?, engine_attempts = engine_attempts + 1, engine_last_error = ?
       WHERE id = ? AND engine_status = 'pending' AND engine_locked_by IS NULL`,
      [currentWorkerId, safeError(error), eventId]
    );
  } finally { connection.release(); }
}

async function processEventBatch(options = {}) {
  const count = positiveInt(options.batchSize, DEFAULT_BATCH_SIZE, 100);
  let processed = 0;
  for (let index = 0; index < count; index += 1) {
    try {
      const result = await processOneEvent(options);
      if (!result.processed) break;
      processed += 1;
    } catch (error) {
      console.error('Automation event processing failed:', safeError(error));
    }
  }
  return processed;
}

async function claimNextJob({ currentWorkerId, lockTimeoutMs = DEFAULT_LOCK_TIMEOUT_MS } = {}) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const seconds = lockSeconds(lockTimeoutMs);
    await connection.execute(
      `UPDATE automation_runs ar JOIN automation_jobs aj ON aj.automation_run_id = ar.id
       SET ar.status = 'failed', ar.error_code = 'JOB_STALE_MAX_ATTEMPTS', ar.error_message = 'ENGINE_ERROR:STALE_MAX_ATTEMPTS'
       WHERE aj.status = 'processing' AND aj.attempts >= aj.max_attempts AND aj.locked_at IS NOT NULL
         AND aj.locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${seconds} SECOND)`
    );
    await connection.execute(
      `UPDATE automation_jobs
       SET status = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'pending' END,
           locked_at = NULL, locked_by = NULL,
           failed_at = CASE WHEN attempts >= max_attempts THEN UTC_TIMESTAMP() ELSE failed_at END
       WHERE status = 'processing' AND locked_at IS NOT NULL
         AND locked_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ${seconds} SECOND)`
    );
    const [rows] = await connection.execute(
      `SELECT * FROM automation_jobs
       WHERE status = 'pending' AND available_at <= UTC_TIMESTAMP() AND execute_at <= UTC_TIMESTAMP()
       ORDER BY available_at, id LIMIT 1 FOR UPDATE SKIP LOCKED`
    );
    const job = rows[0];
    if (!job) { await connection.rollback(); return null; }
    await connection.execute(
      `UPDATE automation_jobs SET status = 'processing', locked_at = UTC_TIMESTAMP(), locked_by = ?, attempts = attempts + 1 WHERE id = ?`,
      [currentWorkerId, job.id]
    );
    await connection.commit();
    return { ...job, id: Number(job.id), automation_run_id: Number(job.automation_run_id), attempts: Number(job.attempts) + 1 };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

async function completeBootstrapJob(job, currentWorkerId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      `SELECT aj.*, ar.automation_id, ar.automation_version_id, ar.event_id, ar.entity_id, ar.status AS run_status,
              ar.current_step_key, ar.correlation_id, av.definition, ae.event_uuid, ae.lineage_depth,
              a.owner_user_id
       FROM automation_jobs aj
       JOIN automation_runs ar ON ar.id = aj.automation_run_id
       JOIN automation_versions av ON av.id = ar.automation_version_id
       JOIN automations a ON a.id = ar.automation_id
       LEFT JOIN automation_events ae ON ae.id = ar.event_id
       WHERE aj.id = ? AND aj.status = 'processing' AND aj.locked_by = ? FOR UPDATE`,
      [job.id, currentWorkerId]
    );
    const current = rows[0];
    if (!current) { await connection.rollback(); return { skipped: true }; }
    if (['completed', 'failed', 'cancelled'].includes(current.run_status)) {
      await connection.execute("UPDATE automation_jobs SET status = 'completed', completed_at = UTC_TIMESTAMP(), locked_at = NULL, locked_by = NULL WHERE id = ?", [job.id]);
      await connection.commit();
      return { skipped: true };
    }
    const validation = validateAutomationDefinition(parseJson(current.definition), { requireSteps: true });
    if (!validation.valid) throw new Error('PUBLISHED_DEFINITION_INVALID');
    const steps = validation.definition.steps;
    const triggerNext = parseJson(current.definition, {}).trigger?.next;
    const step = steps.find((item) => item.id === current.current_step_key) || steps.find((item) => item.id === triggerNext) || steps[0];
    if (!step) throw new Error('AUTOMATION_STEP_NOT_FOUND');
    await connection.execute("UPDATE automation_run_steps SET status = 'completed', finished_at = COALESCE(finished_at, UTC_TIMESTAMP()) WHERE automation_run_id = ? AND status = 'waiting' AND step_key <> ?", [job.automation_run_id, step.id]);
    const nextJobKey = (stepId) => `run:${job.automation_run_id}:step:${stepId}`;
    const schedule = async (stepId, executeAt = null) => {
      if (!stepId) return;
      const nextDefinition = steps.find((item) => item.id === stepId);
      if (!nextDefinition) throw new Error('UNKNOWN_STEP_REFERENCE');
      await connection.execute(
        `INSERT INTO automation_run_steps (automation_run_id, step_key, step_type, status, attempt, input)
         VALUES (?, ?, ?, 'queued', 0, ?)
         ON DUPLICATE KEY UPDATE step_type = VALUES(step_type)`,
        [job.automation_run_id, stepId, nextDefinition.type, JSON.stringify({ node: stepId })]
      );
      await connection.execute(
        `INSERT INTO automation_jobs (automation_run_id, run_step_id, job_type, status, execute_at, available_at, attempts, max_attempts, idempotency_key)
         VALUES (?, (SELECT id FROM automation_run_steps WHERE automation_run_id = ? AND step_key = ? LIMIT 1), 'engine.step', 'pending', COALESCE(?, UTC_TIMESTAMP()), COALESCE(?, UTC_TIMESTAMP()), 0, 3, ?)
         ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [job.automation_run_id, job.automation_run_id, stepId, executeAt, executeAt, nextJobKey(stepId)]
      );
    };
    const [existingSteps] = await connection.execute('SELECT * FROM automation_run_steps WHERE automation_run_id = ? AND step_key = ? FOR UPDATE', [job.automation_run_id, step.id]);
    const attempt = Number(existingSteps[0]?.attempt || 0) + 1;
    await connection.execute(
      `INSERT INTO automation_run_steps (automation_run_id, step_key, step_type, status, attempt, input, started_at)
       VALUES (?, ?, ?, 'running', ?, ?, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE status = 'running', attempt = ?, input = ?, started_at = COALESCE(started_at, UTC_TIMESTAMP()), error_code = NULL, error_message = NULL`,
      [job.automation_run_id, step.id, step.type, attempt, JSON.stringify({ node: step.id, type: step.type }), attempt, JSON.stringify({ node: step.id, type: step.type })]
    );
    const context = { runId: Number(job.automation_run_id), automationId: Number(current.automation_id), ownerUserId: Number(current.owner_user_id), leadId: Number(current.entity_id), stepId: step.id, correlationId: current.correlation_id, causationId: current.event_uuid, lineageDepth: Number(current.lineage_depth || 0) + 1, idempotencyKey: nextJobKey(step.id) };
    let nextStep = step.next || null;
    let output = {};
    let status = 'completed';
    if (step.type === 'condition') {
      const result = await evaluateCondition(connection, step.config, context);
      nextStep = result.result ? step.branches?.yes || null : step.branches?.no || null;
      output = { result: result.result, branch: result.result ? 'yes' : 'no', field: result.field, operator: result.operator };
    } else if (step.type === 'wait') {
      const amount = Number(step.config?.amount ?? step.config?.duration);
      const unit = step.config?.unit || 'minutes';
      if (!Number.isInteger(amount) || amount <= 0 || !['minutes', 'hours', 'days'].includes(unit)) throw new Error('INVALID_WAIT');
      const seconds = amount * (unit === 'days' ? 86400 : unit === 'hours' ? 3600 : 60);
      const executeAt = new Date(Date.now() + seconds * 1000).toISOString().slice(0, 19).replace('T', ' ');
      status = 'waiting';
      output = { wait: { amount, unit }, resume_at: executeAt };
      await connection.execute("UPDATE automation_runs SET status = 'waiting', current_step_key = ?, started_at = COALESCE(started_at, UTC_TIMESTAMP()) WHERE id = ?", [nextStep, job.automation_run_id]);
      await connection.execute("UPDATE automation_run_steps SET status = 'waiting', output = ?, finished_at = NULL WHERE automation_run_id = ? AND step_key = ?", [JSON.stringify(output), job.automation_run_id, step.id]);
      await connection.execute("UPDATE automation_jobs SET status = 'completed', completed_at = UTC_TIMESTAMP(), locked_at = NULL, locked_by = NULL, last_error = NULL WHERE id = ?", [job.id]);
      await schedule(nextStep, executeAt);
      await connection.commit();
      return { completed: true, waiting: true, jobId: Number(job.id), runId: Number(job.automation_run_id) };
    } else if (step.type === 'action') {
      output = await executeAction(connection, step.config.actionType, step.config, context);
    } else if (step.type === 'finish') {
      nextStep = null;
      output = { finished: true };
    } else {
      throw new Error(`UNKNOWN_STEP_TYPE:${step.type}`);
    }
    await connection.execute("UPDATE automation_run_steps SET status = ?, output = ?, finished_at = UTC_TIMESTAMP() WHERE automation_run_id = ? AND step_key = ?", [status, JSON.stringify(output), job.automation_run_id, step.id]);
    if (nextStep) {
      await connection.execute("UPDATE automation_runs SET status = 'queued', current_step_key = ?, started_at = COALESCE(started_at, UTC_TIMESTAMP()) WHERE id = ?", [nextStep, job.automation_run_id]);
      await schedule(nextStep);
    } else {
      await connection.execute("UPDATE automation_runs SET status = 'completed', current_step_key = NULL, finished_at = UTC_TIMESTAMP(), error_code = NULL, error_message = NULL WHERE id = ?", [job.automation_run_id]);
    }
    await connection.execute("UPDATE automation_jobs SET status = 'completed', completed_at = UTC_TIMESTAMP(), locked_at = NULL, locked_by = NULL, last_error = NULL WHERE id = ?", [job.id]);
    await connection.commit();
    console.info('Automation job completed:', { job_id: Number(job.id), run_id: Number(job.automation_run_id), step: step.id });
    return { completed: true, jobId: Number(job.id), runId: Number(job.automation_run_id), step: step.id };
  } catch (error) {
    await connection.rollback();
    await failJob(job, currentWorkerId, error);
    throw error;
  } finally { connection.release(); }
}

async function failJob(job, currentWorkerId, error) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT attempts, max_attempts, automation_run_id FROM automation_jobs WHERE id = ? AND status = \'processing\' AND locked_by = ? FOR UPDATE', [job.id, currentWorkerId]);
    const current = rows[0];
    if (!current) { await connection.rollback(); return; }
    const attempts = Number(current.attempts);
    const terminal = error?.retryable === false || attempts >= Number(current.max_attempts);
    const delay = BACKOFF_MS[Math.min(Math.max(attempts - 1, 0), BACKOFF_MS.length - 1)];
    await connection.execute(
      `UPDATE automation_jobs SET status = ?, available_at = ${terminal ? 'available_at' : `DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${Math.ceil(delay / 1000)} SECOND)`}, locked_at = NULL, locked_by = NULL, last_error = ?${terminal ? ', failed_at = UTC_TIMESTAMP()' : ''} WHERE id = ?`,
      [terminal ? 'failed' : 'pending', safeError(error), job.id]
    );
    if (terminal) await connection.execute("UPDATE automation_runs SET status = 'failed', error_code = ?, error_message = ? WHERE id = ?", [String(error?.code || 'JOB_FAILED').slice(0, 100), safeError(error), current.automation_run_id]);
    else await connection.execute("UPDATE automation_runs SET status = 'queued', error_code = NULL, error_message = NULL WHERE id = ?", [current.automation_run_id]);
    await connection.commit();
  } catch (failure) {
    await connection.rollback();
    console.error('Automation job failure handling failed:', safeError(failure));
  } finally { connection.release(); }
}

async function processJobBatch(options = {}) {
  const count = positiveInt(options.batchSize, DEFAULT_BATCH_SIZE, 100);
  let processed = 0;
  for (let index = 0; index < count; index += 1) {
    try {
      const job = await claimNextJob(options);
      if (!job) break;
      await completeBootstrapJob(job, options.currentWorkerId);
      processed += 1;
    } catch (error) {
      console.error('Automation job processing failed:', safeError(error));
    }
  }
  return processed;
}

module.exports = { BACKOFF_MS, DEFAULT_BATCH_SIZE, DEFAULT_LOCK_TIMEOUT_MS, DEFAULT_POLL_MS, claimNextJob, completeBootstrapJob, createRunAndJob, matchAutomationsForEvent, processEventBatch, processJobBatch, processOneEvent, workerId };
