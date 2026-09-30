const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, process.env.NODE_ENV === 'production' ? '../../.env.production' : '../../.env') });
const { closeConnection, getPool } = require('../config/database');
const { normalizePhone } = require('../services/whatsapp-service');

function parseArgs(argv) {
  return { apply: argv.includes('--apply') };
}

function conversationPhone(value) {
  const jid = String(value || '').trim();
  return /@(?:s\.whatsapp\.net|c\.us)$/i.test(jid) ? normalizePhone(jid) : null;
}

async function preview(connection) {
  const [rows] = await connection.execute(`SELECT c.id, c.lead_id, c.external_conversation_id, ca.owner_user_id
    FROM conversations c JOIN communication_accounts ca ON ca.id = c.communication_account_id
    WHERE c.lead_id IS NULL AND c.conversation_type <> 'group' AND ca.owner_user_id IS NOT NULL
      AND c.external_conversation_id NOT LIKE '%@g.us' ORDER BY c.id`);
  const summary = { analyzed: 0, associable: 0, alreadyAssociated: 0, noProspect: 0, ambiguous: 0, groupsIgnored: 0, conflicts: 0, updated: 0 };
  const matches = [];
  for (const row of rows) {
    summary.analyzed += 1;
    const normalizedPhone = conversationPhone(row.external_conversation_id);
    if (!normalizedPhone) { summary.noProspect += 1; continue; }
    const [prospects] = await connection.execute('SELECT id FROM prospects WHERE owner_user_id = ? AND normalized_phone = ? LIMIT 2', [row.owner_user_id, normalizedPhone]);
    if (prospects.length > 1) { summary.ambiguous += 1; continue; }
    if (!prospects[0]) { summary.noProspect += 1; continue; }
    summary.associable += 1;
    matches.push({ conversationId: row.id, prospectId: prospects[0].id });
  }
  return { summary, matches };
}

async function reconcile(connection, shouldApply = false) {
  const report = await preview(connection);
  if (!shouldApply) return report;
  await connection.beginTransaction();
  try {
    for (const match of report.matches) {
      const [result] = await connection.execute('UPDATE conversations SET lead_id = ? WHERE id = ? AND lead_id IS NULL', [match.prospectId, match.conversationId]);
      if (Number(result.affectedRows || 0) > 0) report.summary.updated += 1;
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
  return report;
}

async function main(argv = process.argv.slice(2)) {
  const { apply } = parseArgs(argv);
  const connection = await getPool().getConnection();
  try {
    const report = await reconcile(connection, apply);
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', ...report }, null, 2));
  } finally { connection.release(); await closeConnection(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });

module.exports = { conversationPhone, parseArgs, preview, reconcile };
