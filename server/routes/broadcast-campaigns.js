const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess } = require('../middleware/commercial-access');
const { query } = require('../config/database');
const campaigns = require('../services/broadcast-campaign-service');
const { materializeCampaign } = require('../services/broadcast-campaign-worker');

const router = express.Router();
router.use(authenticateToken, requireCommercialAccess);
const PAGE_SIZE_MAX = 100;
const EXPLICIT_RECIPIENT_MAX = 1000;
const parseId = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const parsePage = (value, fallback) => Math.min(Math.max(Number(value) || fallback, 1), 100000);
const errorResponse = (res, error) => res.status(Number(error?.status) || 500).json({ error: error?.status ? error.message : 'Nao foi possivel processar a campanha.' });
const campaignForUser = (id, userId) => campaigns.getCampaign(id, userId);

async function writeEvent(campaignId, userId, eventType, metadata = {}) {
  await query('INSERT INTO broadcast_campaign_events (campaign_id, event_type, metadata, created_by_user_id) VALUES (?, ?, ?, ?)', [campaignId, eventType, JSON.stringify(metadata), userId]);
}

async function validAccount(accountId, userId) {
  if (accountId == null) return null;
  const id = parseId(accountId);
  if (!id) throw new campaigns.BroadcastCampaignError(400, 'INVALID_COMMUNICATION_ACCOUNT');
  const result = await query("SELECT id, name, phone_number, status, channel FROM communication_accounts WHERE id = ? AND channel = 'whatsapp' AND archived_at IS NULL AND (owner_user_id = ? OR owner_user_id IS NULL) LIMIT 1", [id, userId]);
  if (!result.rows?.[0]) throw new campaigns.BroadcastCampaignError(400, 'INVALID_COMMUNICATION_ACCOUNT');
  return result.rows[0];
}

function contentPayload(body = {}) { return { contentType: body.content_type, textContent: body.text_content, mediaStoragePath: body.media_storage_path, mimeType: body.mime_type, originalFilename: body.original_filename }; }

router.get('/', async (req, res) => {
  try {
    const page = parsePage(req.query.page, 1); const pageSize = Math.min(parsePage(req.query.page_size || req.query.limit, 30), PAGE_SIZE_MAX);
    const params = [req.userId]; const conditions = ['c.created_by_user_id = ?'];
    if (req.query.status) { if (!campaigns.CAMPAIGN_STATUSES.includes(String(req.query.status))) throw new campaigns.BroadcastCampaignError(400, 'INVALID_CAMPAIGN_STATUS'); conditions.push('c.status = ?'); params.push(String(req.query.status)); }
    if (req.query.search) { conditions.push('c.name LIKE ?'); params.push(`%${String(req.query.search).slice(0, 100)}%`); }
    if (req.query.communication_account_id) { const accountId = parseId(req.query.communication_account_id); if (!accountId) throw new campaigns.BroadcastCampaignError(400, 'INVALID_COMMUNICATION_ACCOUNT'); conditions.push('c.communication_account_id = ?'); params.push(accountId); }
    const result = await query(`SELECT c.id, c.name, c.channel, c.status, c.scheduled_at, c.created_at, c.updated_at,
      ca.name AS account_name, ca.phone_number AS account_phone,
      COUNT(r.id) AS total, SUM(r.status = 'pending') AS pending, SUM(r.status = 'processing') AS processing,
      SUM(r.status = 'sent') AS sent, SUM(r.status = 'delivered') AS delivered, SUM(r.status = 'read') AS read_count,
      SUM(r.status = 'failed') AS failed, SUM(r.status = 'skipped') AS skipped, SUM(r.status = 'cancelled') AS cancelled
      FROM broadcast_campaigns c LEFT JOIN communication_accounts ca ON ca.id = c.communication_account_id
      LEFT JOIN broadcast_campaign_recipients r ON r.campaign_id = c.id
      WHERE ${conditions.join(' AND ')} GROUP BY c.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
    res.json({ campaigns: result.rows || [], page, pageSize });
  } catch (error) { errorResponse(res, error); }
});

router.post('/', async (req, res) => {
  try {
    const account = await validAccount(req.body?.communication_account_id, req.userId);
    const campaign = await campaigns.createDraft({ userId: req.userId, name: req.body?.name, communicationAccountId: account?.id ?? null });
    await writeEvent(campaign.id, req.userId, 'created');
    res.status(201).json({ campaign });
  } catch (error) { errorResponse(res, error); }
});

router.get('/audience/preview', async (req, res) => {
  try {
    const params = [req.userId]; const conditions = ['p.owner_user_id = ?']; const q = String(req.query.search || '').trim().slice(0, 100);
    if (q) { conditions.push('(p.business_name LIKE ? OR p.phone LIKE ? OR p.email LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    for (const field of ['status', 'origin', 'city', 'state']) if (req.query[field]) { conditions.push(`p.${field} = ?`); params.push(String(req.query[field]).slice(0, 100)); }
    if (req.query.assigned_user_id) { const id = parseId(req.query.assigned_user_id); if (!id) throw new campaigns.BroadcastCampaignError(400, 'INVALID_AUDIENCE_FILTER'); conditions.push('p.assigned_user_id = ?'); params.push(id); }
    if (req.query.label_id) { const id = parseId(req.query.label_id); if (!id) throw new campaigns.BroadcastCampaignError(400, 'INVALID_AUDIENCE_FILTER'); conditions.push('EXISTS (SELECT 1 FROM prospect_labels pl WHERE pl.prospect_id = p.id AND pl.label_id = ?)'); params.push(id); }
    if (req.query.created_from) { conditions.push('p.created_at >= ?'); params.push(String(req.query.created_from).slice(0, 30)); }
    if (req.query.created_to) { conditions.push('p.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(String(req.query.created_to).slice(0, 30)); }
    if (req.query.has_phone === 'true') conditions.push('(p.normalized_phone IS NOT NULL AND p.normalized_phone <> \'\')');
    if (req.query.has_phone === 'false') conditions.push('(p.normalized_phone IS NULL OR p.normalized_phone = \'\')');
    const where = conditions.join(' AND '); const page = parsePage(req.query.page, 1); const pageSize = Math.min(parsePage(req.query.page_size || req.query.limit, 25), PAGE_SIZE_MAX);
    const metrics = await query(`SELECT COUNT(*) AS total, SUM(p.normalized_phone IS NOT NULL AND p.normalized_phone <> '') AS with_phone,
      SUM(p.normalized_phone IS NULL OR p.normalized_phone = '') AS without_phone,
      SUM(p.normalized_phone IN (SELECT normalized_phone FROM prospects WHERE owner_user_id = ? AND normalized_phone IS NOT NULL AND normalized_phone <> '' GROUP BY normalized_phone HAVING COUNT(*) > 1)) AS potentially_duplicate
      FROM prospects p WHERE ${where}`, [req.userId, ...params]);
    const rows = await query(`SELECT p.id, p.business_name, p.phone, p.normalized_phone, p.email, p.status, p.origin, p.city, p.state, p.assigned_user_id, p.created_at
      FROM prospects p WHERE ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
    const totals = metrics.rows?.[0] || {};
    res.json({ total: Number(totals.total || 0), with_phone: Number(totals.with_phone || 0), without_phone: Number(totals.without_phone || 0), potentially_duplicate: Number(totals.potentially_duplicate || 0), prospects: rows.rows || [], page, pageSize });
  } catch (error) { errorResponse(res, error); }
});

router.get('/:id/review', async (req, res) => {
  try {
    const campaign = await campaignForUser(req.params.id, req.userId); const account = await validAccount(campaign.communication_account_id, req.userId); const recipients = await campaigns.getRecipients(campaign.id, req.userId);
    const content = campaign.content_id ? { id: campaign.content_id, content_type: campaign.content_type, text_content: campaign.text_content, media_storage_path: campaign.media_storage_path, mime_type: campaign.mime_type, original_filename: campaign.original_filename } : null;
    const counts = Object.fromEntries(campaigns.RECIPIENT_STATUSES.map((status) => [status, recipients.filter((item) => item.status === status).length]));
    const validation = { has_name: Boolean(String(campaign.name || '').trim()), has_account: Boolean(account), has_content: Boolean(content && (content.content_type !== 'text' || String(content.text_content || '').trim())), has_recipients: recipients.length > 0 };
    res.json({ campaign, account, content, total_recipients: recipients.length, counts, validation, ready_for_scheduling: Object.values(validation).every(Boolean), ready_for_start: Object.values(validation).every(Boolean) });
  } catch (error) { errorResponse(res, error); }
});

router.get('/:id', async (req, res) => { try { const campaign = await campaignForUser(req.params.id, req.userId); const account = await validAccount(campaign.communication_account_id, req.userId); const recipients = await campaigns.getRecipients(campaign.id, req.userId); res.json({ campaign, account, recipient_summary: { total: recipients.length, by_status: Object.fromEntries(campaigns.RECIPIENT_STATUSES.map((status) => [status, recipients.filter((item) => item.status === status).length])) } }); } catch (error) { errorResponse(res, error); } });

router.patch('/:id', async (req, res) => { try { const account = req.body?.communication_account_id === undefined ? null : await validAccount(req.body.communication_account_id, req.userId); const campaign = await campaigns.updateDraft(req.params.id, req.userId, { name: req.body?.name, communicationAccountId: req.body?.communication_account_id === undefined ? undefined : account?.id ?? null, scheduledAt: req.body?.scheduled_at }); await writeEvent(campaign.id, req.userId, 'updated'); res.json({ campaign }); } catch (error) { errorResponse(res, error); } });
router.put('/:id/content', async (req, res) => { try { const campaign = await campaigns.updateContent(req.params.id, req.userId, contentPayload(req.body)); await writeEvent(campaign.id, req.userId, 'content_updated'); res.json({ campaign }); } catch (error) { errorResponse(res, error); } });

router.get('/:id/recipients', async (req, res) => { try { const campaign = await campaignForUser(req.params.id, req.userId); const page = parsePage(req.query.page, 1); const pageSize = Math.min(parsePage(req.query.page_size || req.query.limit, 50), PAGE_SIZE_MAX); const params = [campaign.id]; const filters = ['r.campaign_id = ?']; if (req.query.status) { if (!campaigns.RECIPIENT_STATUSES.includes(String(req.query.status))) throw new campaigns.BroadcastCampaignError(400, 'INVALID_RECIPIENT_STATUS'); filters.push('r.status = ?'); params.push(String(req.query.status)); } if (req.query.search) { filters.push('(r.recipient_name LIKE ? OR r.recipient_phone LIKE ?)'); const search = `%${String(req.query.search).slice(0, 100)}%`; params.push(search, search); } const result = await query(`SELECT r.id, r.prospect_id, r.recipient_name, r.recipient_phone, r.status, r.attempt_count, r.sent_at, r.delivered_at, r.read_at, r.failed_at, LEFT(r.last_error, 300) AS last_error FROM broadcast_campaign_recipients r WHERE ${filters.join(' AND ')} ORDER BY r.id LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]); res.json({ recipients: result.rows || [], page, pageSize }); } catch (error) { errorResponse(res, error); } });

router.post('/:id/recipients', async (req, res) => { try { const campaign = await campaignForUser(req.params.id, req.userId); if (campaign.status !== 'draft') throw new campaigns.BroadcastCampaignError(409, 'CAMPAIGN_NOT_EDITABLE'); const explicit = req.body?.prospect_ids; if (explicit && req.body?.filters) throw new campaigns.BroadcastCampaignError(400, 'Informe prospect_ids ou filters, nao ambos.'); let prospects = []; if (explicit) { if (!Array.isArray(explicit) || explicit.length > EXPLICIT_RECIPIENT_MAX) throw new campaigns.BroadcastCampaignError(400, 'Lista de prospects excede o limite tecnico.'); const ids = [...new Set(explicit.map(parseId).filter(Boolean))]; if (ids.length) { const result = await query(`SELECT id, business_name, phone, normalized_phone FROM prospects WHERE owner_user_id = ? AND id IN (${ids.map(() => '?').join(',')})`, [req.userId, ...ids]); prospects = result.rows || []; } } else { const previewReq = { query: { ...req.body?.filters, page: 1, page_size: EXPLICIT_RECIPIENT_MAX } }; const originalQuery = req.query; req.query = previewReq.query; const params = [req.userId]; const conditions = ['p.owner_user_id = ?', 'p.normalized_phone IS NOT NULL', "p.normalized_phone <> ''"]; for (const field of ['status', 'origin', 'city', 'state']) if (req.query[field]) { conditions.push(`p.${field} = ?`); params.push(String(req.query[field]).slice(0, 100)); } const result = await query(`SELECT p.id, p.business_name, p.phone, p.normalized_phone FROM prospects p WHERE ${conditions.join(' AND ')} ORDER BY p.id LIMIT ${EXPLICIT_RECIPIENT_MAX}`, params); prospects = result.rows || []; req.query = originalQuery; } const existing = await campaigns.getRecipients(campaign.id, req.userId); const existingKeys = new Set(existing.map((item) => `${item.prospect_id || ''}:${item.recipient_phone}`)); const eligible = prospects.filter((item) => item.normalized_phone && !existingKeys.has(`${item.id}:${item.normalized_phone}`)); const result = await campaigns.addRecipients(campaign.id, req.userId, eligible.map((item) => ({ prospectId: item.id, phone: item.normalized_phone, name: item.business_name }))); await writeEvent(campaign.id, req.userId, 'recipients_added', { requested: prospects.length, added: result.recipientIds.length, duplicates: prospects.length - eligible.length }); res.status(201).json({ requested: prospects.length, eligible: eligible.length, added: result.recipientIds.length, duplicates: prospects.length - eligible.length, missing_phone: 0, invalid_phone: 0 }); } catch (error) { errorResponse(res, error); } });

router.delete('/:id/recipients/:recipientId', async (req, res) => { try { const campaign = await campaignForUser(req.params.id, req.userId); if (campaign.status !== 'draft') throw new campaigns.BroadcastCampaignError(409, 'CAMPAIGN_NOT_EDITABLE'); const recipientId = parseId(req.params.recipientId); if (!recipientId) throw new campaigns.BroadcastCampaignError(400, 'RECIPIENT_NOT_FOUND'); const result = await query('DELETE FROM broadcast_campaign_recipients WHERE id = ? AND campaign_id = ?', [recipientId, campaign.id]); if (!result.affectedRows) throw new campaigns.BroadcastCampaignError(404, 'RECIPIENT_NOT_FOUND'); await writeEvent(campaign.id, req.userId, 'recipient_removed', { recipient_id: recipientId }); res.json({ success: true }); } catch (error) { errorResponse(res, error); } });

router.post('/:id/start', async (req, res) => { try { const result = await materializeCampaign({ campaignId: parseId(req.params.id), userId: req.userId }); res.status(202).json(result); } catch (error) { errorResponse(res, error); } });
router.post('/:id/pause', async (req, res) => { try { const campaign = await campaignForUser(req.params.id, req.userId); if (!['scheduled', 'running', 'paused'].includes(campaign.status)) throw new campaigns.BroadcastCampaignError(409, 'CAMPAIGN_NOT_PAUSABLE'); if (campaign.status !== 'paused') { await query("UPDATE broadcast_campaigns SET status = 'paused', paused_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND created_by_user_id = ? AND status IN ('scheduled', 'running')", [campaign.id, req.userId]); await writeEvent(campaign.id, req.userId, 'paused'); } res.json({ campaign: await campaignForUser(campaign.id, req.userId) }); } catch (error) { errorResponse(res, error); } });
router.post('/:id/resume', async (req, res) => { try { const campaign = await campaignForUser(req.params.id, req.userId); if (campaign.status !== 'paused') return res.json({ campaign }); const next = campaign.scheduled_at && new Date(campaign.scheduled_at) > new Date() ? 'scheduled' : 'running'; await query('UPDATE broadcast_campaigns SET status = ?, paused_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND created_by_user_id = ? AND status = \'paused\'', [next, campaign.id, req.userId]); await writeEvent(campaign.id, req.userId, 'resumed'); res.json({ campaign: await campaignForUser(campaign.id, req.userId) }); } catch (error) { errorResponse(res, error); } });
router.post('/:id/cancel', async (req, res) => { try { const campaign = await campaignForUser(req.params.id, req.userId); if (campaign.status === 'cancelled') return res.json({ campaign }); if (['completed', 'failed'].includes(campaign.status)) throw new campaigns.BroadcastCampaignError(409, 'CAMPAIGN_NOT_CANCELLABLE'); await query("UPDATE broadcast_campaigns SET status = 'cancelled', cancelled_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND created_by_user_id = ? AND status NOT IN ('completed', 'failed', 'cancelled')", [campaign.id, req.userId]); await query("UPDATE broadcast_campaign_jobs SET status = 'cancelled', processed_at = UTC_TIMESTAMP(), locked_at = NULL, locked_by = NULL WHERE campaign_id = ? AND status = 'pending'", [campaign.id]); await query("UPDATE broadcast_campaign_recipients SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE campaign_id = ? AND status = 'pending'", [campaign.id]); await writeEvent(campaign.id, req.userId, 'cancelled'); res.json({ campaign: await campaignForUser(campaign.id, req.userId) }); } catch (error) { errorResponse(res, error); } });
router.get('/:id/progress', async (req, res) => { try { const campaign = await campaignForUser(req.params.id, req.userId); const result = await query(`SELECT COUNT(*) AS total, SUM(status = 'pending') AS pending, SUM(status = 'processing') AS processing, SUM(status = 'sent') AS sent, SUM(status = 'delivered') AS delivered, SUM(status = 'read') AS read_count, SUM(status = 'failed') AS failed, SUM(status = 'skipped') AS skipped, SUM(status = 'cancelled') AS cancelled FROM broadcast_campaign_recipients WHERE campaign_id = ?`, [campaign.id]); const jobs = await query("SELECT status, COUNT(*) AS total FROM broadcast_campaign_jobs WHERE campaign_id = ? GROUP BY status", [campaign.id]); const jobCounts = Object.fromEntries(['pending', 'processing', 'completed', 'failed', 'cancelled'].map((status) => [status, 0])); for (const row of jobs.rows || []) jobCounts[row.status] = Number(row.total); const totals = result.rows?.[0] || {}; res.json({ status: campaign.status, total: Number(totals.total || 0), pending: Number(totals.pending || 0), processing: Number(totals.processing || 0), sent: Number(totals.sent || 0), delivered: Number(totals.delivered || 0), read: Number(totals.read_count || 0), failed: Number(totals.failed || 0), skipped: Number(totals.skipped || 0), cancelled: Number(totals.cancelled || 0), jobs: jobCounts }); } catch (error) { errorResponse(res, error); } });

module.exports = router;
