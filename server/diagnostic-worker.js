const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', process.env.NODE_ENV === 'production' ? '.env.production' : '.env') });
const { getPool, closeConnection } = require('./config/database');
const { processWebsiteDiagnosticBatch } = require('./services/website-diagnostic-service');
const WORKER_ID = `website-diagnostic-${process.pid}`;
let stopping = false;
async function tick() { if (!stopping) await processWebsiteDiagnosticBatch({ limit: 1, workerId: WORKER_ID }); }
async function run() { while (!stopping) { try { await tick(); } catch (error) { console.error('[DiagnosticWorker] ciclo falhou', { code: error?.code || 'UNEXPECTED' }); } await new Promise((resolve) => setTimeout(resolve, 2000)); } }
async function shutdown(signal) { stopping = true; console.log(`[DiagnosticWorker] ${signal}`); await closeConnection(); process.exit(0); }
process.once('SIGTERM', () => void shutdown('SIGTERM')); process.once('SIGINT', () => void shutdown('SIGINT'));
if (require.main === module) void run();
module.exports = { run, tick };
