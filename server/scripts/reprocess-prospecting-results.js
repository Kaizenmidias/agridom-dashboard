const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env') });
const { closeConnection, getPool } = require('../config/database');
const { createOrFindProspect } = require('../services/prospect-service');
const { dispatchDomainEvent } = require('../services/domain-events');
const { normalize } = require('../services/prospecting-service');
const { normalizeIntegrationMetadata } = require('../services/integration-metadata');

const CLASSIFICATIONS = Object.freeze({ WOULD_CREATE: 'WOULD_CREATE', ALREADY_EXISTS: 'ALREADY_EXISTS', NO_PHONE: 'NO_PHONE', ALREADY_LINKED: 'ALREADY_LINKED', CONFLICT: 'CONFLICT' });

function parseArgs(argv) {
  const index = argv.indexOf('--job-id');
  const jobId = index >= 0 ? argv[index + 1] : null;
  if (!jobId || !/^[0-9a-f-]{36}$/i.test(jobId)) throw new Error('Informe --job-id com um UUID valido.');
  return { jobId, apply: argv.includes('--apply') };
}

function normalizeStoredPayload(value) {
  let payload = value;
  if (typeof payload === 'string') { try { payload = JSON.parse(payload); } catch { payload = {}; } }
  return normalize(normalizeIntegrationMetadata(payload));
}

async function loadContext(connection, jobId) {
  const [jobs] = await connection.execute('SELECT id, created_by, destination_folder_id, requested_quantity, processed_count, found_count, duplicate_count, invalid_count FROM prospecting_jobs WHERE id = ? LIMIT 1', [jobId]);
  if (!jobs.length) throw new Error('Job de prospeccao nao encontrado.');
  const job = jobs[0];
  let folder = null;
  if (job.destination_folder_id != null) {
    const [folders] = await connection.execute('SELECT id, name FROM lead_folders WHERE id = ? AND owner_user_id = ? LIMIT 1', [job.destination_folder_id, job.created_by]);
    folder = folders[0] || null;
  }
  return { job, folder };
}

async function loadRows(connection, jobId) {
  const [rows] = await connection.execute(`SELECT pr.id, pr.job_id, pr.prospect_id, pr.company_name, pr.category, pr.address, pr.city, pr.state,
    pr.phone, pr.normalized_phone, pr.email, pr.website, pr.normalized_website_domain, pr.instagram_url, pr.rating, pr.review_count,
    pr.duplicate_status, pr.whatsapp_status, pr.raw_payload FROM prospecting_results pr
    WHERE pr.job_id = ? ORDER BY pr.created_at, pr.id`, [jobId]);
  return rows;
}

async function findProspect(connection, prospectId) {
  if (prospectId == null) return null;
  const [rows] = await connection.execute('SELECT id, normalized_phone FROM prospects WHERE id = ? LIMIT 1', [prospectId]);
  return rows[0] || null;
}

async function findByPhone(connection, normalizedPhone) {
  if (!normalizedPhone) return null;
  const [rows] = await connection.execute('SELECT id, normalized_phone FROM prospects WHERE normalized_phone = ? LIMIT 1', [normalizedPhone]);
  return rows[0] || null;
}

async function classifyRow(connection, row) {
  const normalized = normalizeStoredPayload(row.raw_payload);
  const linked = await findProspect(connection, row.prospect_id);
  if (row.prospect_id != null && !linked) return { classification: CLASSIFICATIONS.CONFLICT, reason: 'prospect_id_not_found', row, normalized };
  if (linked && normalized.normalized_phone && linked.normalized_phone !== normalized.normalized_phone) return { classification: CLASSIFICATIONS.CONFLICT, reason: 'linked_phone_mismatch', row, normalized };
  if (linked) return { classification: CLASSIFICATIONS.ALREADY_LINKED, prospectId: linked.id, row, normalized };
  if (!normalized.normalized_phone) return { classification: CLASSIFICATIONS.NO_PHONE, row, normalized };
  const existing = await findByPhone(connection, normalized.normalized_phone);
  if (existing) return { classification: CLASSIFICATIONS.ALREADY_EXISTS, prospectId: existing.id, row, normalized };
  return { classification: CLASSIFICATIONS.WOULD_CREATE, row, normalized };
}

function summarize(items, folder) {
  const summary = { analyzed: items.length, alreadyLinked: 0, wouldCreate: 0, alreadyExists: 0, noPhone: 0, conflicts: 0, membershipsWouldCreate: 0 };
  for (const item of items) {
    if (item.classification === CLASSIFICATIONS.ALREADY_LINKED) summary.alreadyLinked += 1;
    if (item.classification === CLASSIFICATIONS.WOULD_CREATE) { summary.wouldCreate += 1; if (folder) summary.membershipsWouldCreate += 1; }
    if (item.classification === CLASSIFICATIONS.ALREADY_EXISTS) summary.alreadyExists += 1;
    if (item.classification === CLASSIFICATIONS.NO_PHONE) summary.noPhone += 1;
    if (item.classification === CLASSIFICATIONS.CONFLICT) summary.conflicts += 1;
  }
  return summary;
}

async function preview(connection, jobId) {
  const context = await loadContext(connection, jobId);
  const rows = await loadRows(connection, jobId);
  const items = [];
  for (const row of rows) items.push(await classifyRow(connection, row));
  return { ...context, classifications: items, summary: summarize(items, context.folder) };
}

async function applyReconciliation(connection, jobId) {
  const report = await preview(connection, jobId);
  const emitted = [];
  await connection.beginTransaction();
  try {
    for (const item of report.classifications) {
      if (item.classification === CLASSIFICATIONS.ALREADY_LINKED || item.classification === CLASSIFICATIONS.CONFLICT) continue;
      const row = item.row;
      if (item.classification === CLASSIFICATIONS.NO_PHONE) {
        await connection.execute("UPDATE prospecting_results SET duplicate_status = 'invalid_no_phone', prospect_id = NULL WHERE id = ? AND job_id = ? AND prospect_id IS NULL", [row.id, jobId]);
        continue;
      }
      const result = await createOrFindProspect({ ownerUserId: report.job.created_by, businessName: item.normalized.company_name, category: item.normalized.category, address: item.normalized.address, city: item.normalized.city, state: item.normalized.state, phone: item.normalized.phone, email: item.normalized.email, website: item.normalized.website, analysisReport: { source: 'historical_reconciliation', google_maps_url: item.normalized.google_maps_url, google_rating: item.normalized.rating, google_reviews: item.normalized.review_count, instagram: item.normalized.instagram_url, place_id: item.normalized.place_id } }, { connection });
      await connection.execute('UPDATE prospecting_results SET prospect_id = ?, duplicate_status = ? WHERE id = ? AND job_id = ? AND prospect_id IS NULL', [result.prospect.id, result.created ? 'new' : 'duplicate', row.id, jobId]);
      if (result.created && report.folder) {
        const [membership] = await connection.execute('INSERT IGNORE INTO lead_folder_members (folder_id, prospect_id) VALUES (?, ?)', [report.folder.id, result.prospect.id]);
        if (Number(membership.affectedRows || 0) > 0) emitted.push({ prospectId: result.prospect.id, folderId: report.folder.id });
      }
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  for (const event of emitted) await dispatchDomainEvent({ type: 'lead.added_to_folder', entityType: 'lead', entityId: event.prospectId, actorUserId: report.job.created_by, payload: { leadId: event.prospectId, folderId: event.folderId }, idempotencyKey: `historical-reconciliation:${jobId}:${event.prospectId}:${event.folderId}` });
  return emitted;
}

async function main(argv = process.argv.slice(2)) {
  const { jobId, apply: shouldApply } = parseArgs(argv);
  const connection = await getPool().getConnection();
  try {
    const report = await preview(connection, jobId);
    if (shouldApply) await applyReconciliation(connection, jobId);
    console.log(JSON.stringify({ mode: shouldApply ? 'apply' : 'dry-run', jobId, summary: report.summary, classifications: report.classifications.map(({ row, normalized, ...item }) => ({ resultId: row.id, ...item, normalizedPhone: normalized.normalized_phone })), message: shouldApply ? 'Reconciliação concluída.' : 'Nenhuma alteração realizada.' }, null, 2));
  } finally { connection.release(); await closeConnection(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { CLASSIFICATIONS, applyReconciliation, classifyRow, normalizeStoredPayload, parseArgs, preview, summarize };
