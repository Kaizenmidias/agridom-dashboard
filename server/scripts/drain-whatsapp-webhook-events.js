const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env') });

const { closeConnection, getPool } = require('../config/database');
const { processPendingWhatsAppEvents } = require('../services/whatsapp-service');

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function parseArgs(argv = []) {
  const apply = argv.includes('--apply');
  const dryRun = !apply;
  const rawLimit = argv.find((value) => value.startsWith('--limit='))?.slice('--limit='.length);
  const limit = rawLimit == null ? DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new Error(`--limit deve ser um inteiro entre 1 e ${MAX_LIMIT}.`);
  if (argv.includes('--dry-run') && apply) throw new Error('Use apenas um modo: --dry-run ou --apply.');
  return { apply, dryRun, limit };
}

async function summarizePending(connection) {
  const [summaryRows] = await connection.execute(
    "SELECT COUNT(*) AS total_pending, MIN(received_at) AS oldest_received_at, MAX(received_at) AS newest_received_at FROM communication_webhook_events WHERE status = 'pending'"
  );
  const [typeRows] = await connection.execute(
    "SELECT event_type, COUNT(*) AS total FROM communication_webhook_events WHERE status = 'pending' GROUP BY event_type ORDER BY event_type"
  );
  return {
    totalPending: Number(summaryRows[0]?.total_pending || 0),
    oldestReceivedAt: summaryRows[0]?.oldest_received_at || null,
    newestReceivedAt: summaryRows[0]?.newest_received_at || null,
    byEventType: typeRows.map((row) => ({ eventType: String(row.event_type || 'unknown'), total: Number(row.total || 0) })),
  };
}

async function main(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  const pool = dependencies.pool || getPool();
  const processPending = dependencies.processPending || processPendingWhatsAppEvents;
  if (options.apply) {
    const processed = await processPending({ batchSize: options.limit });
    const result = { mode: 'apply', limit: options.limit, processed: Number(processed || 0), message: 'Lote concluido; nenhum outro batch foi executado.' };
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  const connection = await pool.getConnection();
  try {
    const summary = await summarizePending(connection);
    console.log(JSON.stringify({ mode: 'dry-run', limit: options.limit, ...summary, message: 'Nenhuma alteracao realizada.' }, null, 2));
    return summary;
  } finally {
    connection.release();
    if (!dependencies.pool) await closeConnection();
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(error.code || error.message || 'WHATSAPP_WEBHOOK_DRAIN_FAILED');
    await closeConnection();
    process.exitCode = 1;
  });
}

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, main, parseArgs, summarizePending };
