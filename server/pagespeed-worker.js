const path = require('node:path');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.join(__dirname, envFile) });

const { closeConnection, getPool } = require('./config/database');
const { acquirePageSpeedAnalysis, persistPageSpeedAnalysis, recordPageSpeedFailure } = require('./services/pagespeed-performance');
const { runGooglePageSpeed } = require('./services/pagespeed-google-provider');
const { requestPageSpeed } = require('./services/pagespeed-google-transport');

const DEFAULT_POLL_MS = 30000;
const positiveInt = (value, fallback, max) => { const number = Number(value); return Number.isSafeInteger(number) && number > 0 ? Math.min(number, max) : fallback; };
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const configuredKey = (value) => typeof value === 'string' && value.trim() ? value.trim() : null;
const safeCode = (error) => String(error?.code || 'UNEXPECTED').replace(/[^A-Z0-9_:-]/gi, '').slice(0, 80) || 'UNEXPECTED';

async function processNextPageSpeedJob({ apiKey, connection, pool = getPool(), transport = requestPageSpeed, acquire = acquirePageSpeedAnalysis, provider = runGooglePageSpeed, persist = persistPageSpeedAnalysis, recordFailure = recordPageSpeedFailure, workerId = 'pagespeed-worker' } = {}) {
  const key = configuredKey(apiKey);
  if (!key) return { processed: false, reason: 'disabled' };
  const job = await acquire({ connection, workerId });
  if (!job) return { processed: false, reason: 'empty' };
  const started = Date.now();
  try {
    const normalized = await provider({ url: job.website_url, strategy: job.strategy, apiKey: key, transport });
    await persist({ connection: pool, job, normalized });
    console.info('[PageSpeed] job completed', { job_id: job.id, prospect_id: job.prospect_id, status: normalized.status, attempt_count: job.attempt_count, duration_ms: Date.now() - started });
    return { processed: true, status: normalized.status, jobId: job.id };
  } catch (error) {
    const classification = error?.classification || safeCode(error);
    let result;
    try {
      result = await recordFailure({ connection: pool, job, error, kind: classification });
    } catch (failureError) {
      console.error('[PageSpeed] failure persistence failed', { job_id: job.id, prospect_id: job.prospect_id, attempt_count: job.attempt_count, classification: safeCode(failureError) });
      return { processed: true, status: 'failure_persistence_failed', classification, jobId: job.id };
    }
    console.error('[PageSpeed] job failed', { job_id: job.id, prospect_id: job.prospect_id, status: result.status, attempt_count: job.attempt_count, duration_ms: Date.now() - started, classification });
    return { processed: true, status: result.status, classification, jobId: job.id };
  }
}

async function startPageSpeedWorker(options = {}) {
  const apiKey = options.apiKey ?? process.env.GOOGLE_PAGESPEED_API_KEY;
  const pollMs = positiveInt(options.pollMs ?? process.env.PAGESPEED_WORKER_POLL_MS, DEFAULT_POLL_MS, 300000);
  const connectionFactory = options.connectionFactory || (() => getPool().getConnection());
  const transport = options.transport || requestPageSpeed;
  const sleepFn = options.sleep || sleep;
  const close = options.closeConnection || closeConnection;
  const processLike = options.process || process;
  let stopping = false;
  let currentCycle = Promise.resolve();
  const stop = () => { stopping = true; };
  processLike.once('SIGINT', stop);
  processLike.once('SIGTERM', stop);
  if (!configuredKey(apiKey)) console.info('[PageSpeed] disabled: API key not configured');
  else console.info('[PageSpeed] worker started', { poll_ms: pollMs, max_concurrency: 1 });
  try {
    while (!stopping) {
      if (!configuredKey(apiKey)) { await sleepFn(pollMs); continue; }
      let result = null;
      try {
        currentCycle = (async () => {
          const connection = await connectionFactory();
          try { return await processNextPageSpeedJob({ ...options, apiKey, connection, transport }); }
          finally { connection.release(); }
        })();
        result = await currentCycle;
      } catch (error) {
        console.error('[PageSpeed] worker cycle failed', { classification: safeCode(error) });
      }
      if ((!result?.processed || result.status === 'pending' || result.status === 'failure_persistence_failed') && !stopping) await sleepFn(pollMs);
    }
  } finally {
    await currentCycle.catch(() => {});
    await close();
    processLike.removeListener('SIGINT', stop);
    processLike.removeListener('SIGTERM', stop);
    console.info('[PageSpeed] worker stopped');
  }
}

if (require.main === module) startPageSpeedWorker().catch(async (error) => { console.error('[PageSpeed] worker stopped unexpectedly', { classification: safeCode(error) }); await closeConnection(); process.exitCode = 1; });

module.exports = { DEFAULT_POLL_MS, configuredKey, processNextPageSpeedJob, startPageSpeedWorker };
