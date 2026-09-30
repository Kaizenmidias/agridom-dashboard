const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env') });
const { getPool, closeConnection } = require('../config/database');
const { normalize } = require('../services/prospecting-service');
const { normalizeIntegrationMetadata } = require('../services/integration-metadata');

const UPDATE_COLUMNS = ['company_name', 'category', 'address', 'city', 'state', 'phone', 'normalized_phone', 'email', 'website', 'normalized_website_domain', 'instagram_url', 'rating', 'review_count'];

function parseArgs(argv) {
  const jobIndex = argv.indexOf('--job-id');
  const jobId = jobIndex >= 0 ? argv[jobIndex + 1] : null;
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) throw new Error('Informe --job-id com um UUID valido.');
  return { jobId, apply: argv.includes('--apply') };
}

function normalizeStoredPayload(value) {
  return normalize(normalizeIntegrationMetadata(value));
}

function changes(row, next) {
  return UPDATE_COLUMNS.reduce((result, column) => {
    const current = row[column];
    const value = next[column];
    if (String(current ?? '') !== String(value ?? '')) result[column] = { current: current ?? null, next: value ?? null };
    return result;
  }, {});
}

async function loadJob(connection, jobId) {
  const [jobs] = await connection.execute('SELECT id FROM prospecting_jobs WHERE id = ? LIMIT 1', [jobId]);
  if (!jobs.length) throw new Error('Job de prospeccao nao encontrado.');
}

async function preview(connection, jobId) {
  const [rows] = await connection.execute('SELECT id, company_name, category, rating, review_count, raw_payload FROM prospecting_results WHERE job_id = ? ORDER BY created_at, id', [jobId]);
  return rows.map((row) => {
    const next = normalizeStoredPayload(row.raw_payload);
    return { id: row.id, company_name_current: row.company_name, company_name_new: next.company_name, category_current: row.category, category_new: next.category, rating_current: row.rating, rating_new: next.rating, review_count_current: row.review_count, review_count_new: next.review_count, changes: changes(row, next) };
  });
}

async function apply(connection, jobId, rows) {
  await connection.beginTransaction();
  try {
    for (const row of rows) {
      const next = normalizeStoredPayload(row.raw_payload);
      await connection.execute(`UPDATE prospecting_results SET ${UPDATE_COLUMNS.map((column) => `${column} = ?`).join(', ')} WHERE id = ? AND job_id = ?`, [
        next.company_name, next.category, next.address, next.city, next.state, next.phone, next.normalized_phone, next.email, next.website, next.normalized_website_domain, next.instagram_url, next.rating, next.review_count, row.id, jobId,
      ]);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main(argv = process.argv.slice(2)) {
  const { jobId, apply: shouldApply } = parseArgs(argv);
  const connection = await getPool().getConnection();
  try {
    await loadJob(connection, jobId);
    const [rows] = await connection.execute('SELECT id, company_name, category, address, city, state, phone, normalized_phone, email, website, normalized_website_domain, instagram_url, rating, review_count, raw_payload FROM prospecting_results WHERE job_id = ? ORDER BY created_at, id', [jobId]);
    const previewRows = rows.map((row) => {
      const next = normalizeStoredPayload(row.raw_payload);
      return { row, report: { id: row.id, company_name_current: row.company_name, company_name_new: next.company_name, category_current: row.category, category_new: next.category, rating_current: row.rating, rating_new: next.rating, review_count_current: row.review_count, review_count_new: next.review_count } };
    });
    console.log(JSON.stringify({ mode: shouldApply ? 'apply' : 'dry-run', jobId, results: previewRows.map((item) => item.report) }, null, 2));
    if (shouldApply) await apply(connection, jobId, rows);
  } finally {
    connection.release();
    await closeConnection();
  }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { parseArgs, normalizeStoredPayload, preview, apply };
