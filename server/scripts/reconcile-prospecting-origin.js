const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env') });
const { closeConnection, getPool } = require('../config/database');

function parseArgs(argv) {
  const index = argv.indexOf('--job-id');
  const jobId = index >= 0 ? argv[index + 1] : null;
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) throw new Error('Informe --job-id com um UUID valido.');
  return { jobId, apply: argv.includes('--apply') };
}

async function reconcile(connection, jobId, apply = false) {
  const [rows] = await connection.execute(`SELECT DISTINCT p.id, p.origin
    FROM prospecting_results pr JOIN prospects p ON p.id = pr.prospect_id
    WHERE pr.job_id = ? AND p.origin IS NULL ORDER BY p.id`, [jobId]);
  const summary = { evidenced: rows.length, eligible: rows.length, updated: 0 };
  if (!apply) return { rows, summary };
  await connection.beginTransaction();
  try {
    const [result] = await connection.execute(`UPDATE prospects p JOIN prospecting_results pr ON pr.prospect_id = p.id
      SET p.origin = 'Scraping' WHERE pr.job_id = ? AND p.origin IS NULL`, [jobId]);
    summary.updated = Number(result.affectedRows || 0);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
  return { rows, summary };
}

async function main(argv = process.argv.slice(2)) {
  const { jobId, apply } = parseArgs(argv);
  const connection = await getPool().getConnection();
  try { console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', jobId, ...(await reconcile(connection, jobId, apply)) }, null, 2)); }
  finally { connection.release(); await closeConnection(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { parseArgs, reconcile };
