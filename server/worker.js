const path = require('node:path');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.join(__dirname, envFile) });

const { closeConnection } = require('./config/database');
const { DEFAULT_BATCH_SIZE, DEFAULT_LOCK_TIMEOUT_MS, DEFAULT_POLL_MS, processEventBatch, processJobBatch, workerId } = require('./services/automation-engine');
const { processPendingWhatsAppEvents } = require('./services/whatsapp-service');
const { processBroadcastBatch, workerId: broadcastWorkerId } = require('./services/broadcast-campaign-worker');
const { processProspectingBatch } = require('./services/prospecting-service');

const positiveInt = (value, fallback, max) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, max) : fallback;
};
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function startWorker(options = {}) {
  const currentWorkerId = workerId(options.workerId);
  const currentBroadcastWorkerId = broadcastWorkerId(options.workerId || currentWorkerId);
  const pollMs = positiveInt(options.pollMs ?? process.env.AUTOMATION_WORKER_POLL_MS, DEFAULT_POLL_MS, 60000);
  const batchSize = positiveInt(options.batchSize ?? process.env.AUTOMATION_WORKER_BATCH_SIZE, DEFAULT_BATCH_SIZE, 100);
  const lockTimeoutMs = positiveInt(options.lockTimeoutMs ?? process.env.AUTOMATION_JOB_LOCK_TIMEOUT_MS, DEFAULT_LOCK_TIMEOUT_MS, 24 * 60 * 60 * 1000);
  let stopping = false;
  let currentCycle = Promise.resolve();
  const stop = () => { stopping = true; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  console.info('Automation worker started:', { worker_id: currentWorkerId, poll_ms: pollMs, batch_size: batchSize });
  try {
    while (!stopping) {
      currentCycle = (async () => {
        const events = await processEventBatch({ workerId: currentWorkerId, batchSize, lockTimeoutMs });
        const jobs = await processJobBatch({ currentWorkerId, batchSize, lockTimeoutMs });
        const whatsappEvents = await processPendingWhatsAppEvents({ batchSize });
        let broadcasts = 0;
        try { broadcasts = await processBroadcastBatch({ currentWorkerId: currentBroadcastWorkerId, batchSize: Math.min(batchSize, 10) }); }
        catch (error) { console.error('Broadcast worker cycle failed:', error?.code || 'UNEXPECTED'); }
        let prospecting = 0;
        try { prospecting = await processProspectingBatch(Math.min(batchSize, 2)); }
        catch (error) { console.error('Prospecting worker cycle failed:', error?.code || 'UNEXPECTED'); }
        return events + jobs + whatsappEvents + broadcasts + prospecting;
      })();
      const workCount = await currentCycle;
      if (!workCount && !stopping) await sleep(pollMs);
    }
  } catch (error) {
    console.error('Automation worker cycle failed:', error?.code || 'UNEXPECTED');
    if (!stopping) await sleep(pollMs);
  } finally {
    await currentCycle.catch(() => {});
    await closeConnection();
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    console.info('Automation worker stopped:', { worker_id: currentWorkerId });
  }
}

if (require.main === module) startWorker().catch(async (error) => { console.error('Automation worker stopped unexpectedly:', error?.code || 'UNEXPECTED'); await closeConnection(); process.exitCode = 1; });

module.exports = { startWorker };
