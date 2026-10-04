const path = require('node:path');
const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });

const { getPool, closeConnection } = require('../config/database');
const { recoverAutomationJobs, RECOVERY_BATCH_LIMIT } = require('../services/automation-engine');

function parseArgs(argv) {
  return { apply: argv.includes('--apply'), limit: Number(argv.find((value) => value.startsWith('--limit='))?.split('=')[1] || RECOVERY_BATCH_LIMIT) };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await recoverAutomationJobs({ connection, limit: options.limit, apply: options.apply });
    if (options.apply) await connection.commit();
    else await connection.rollback();
    console.log(JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', count: result.length, items: result.map((row) => ({ runId: Number(row.automation_run_id), jobId: Number(row.id), eligible: row.eligible, reason: row.reason, lastError: row.last_error })) }));
    return result;
  } finally { connection.release(); await closeConnection(); }
}

if (require.main === module) main().catch(async (error) => { console.error(error.code || 'RECOVERY_FAILED'); await closeConnection(); process.exitCode = 1; });

module.exports = { main, parseArgs };
