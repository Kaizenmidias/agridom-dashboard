const { query } = require('../config/database');

const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed'];
const CONTENT_TYPES = ['text', 'image', 'video', 'document', 'audio'];
const RECIPIENT_STATUSES = ['pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'skipped', 'cancelled'];

class BroadcastCampaignError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const idOf = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : null;
const normalizePhone = (value) => String(value || '').replace(/\D/g, '').slice(0, 50);
const normalizeContent = (content = {}) => {
  const contentType = String(content.contentType || content.content_type || 'text').trim();
  if (!CONTENT_TYPES.includes(contentType)) throw new BroadcastCampaignError(400, 'Tipo de conteudo invalido.');
  return {
    contentType,
    textContent: content.textContent ?? content.text_content ?? null,
    mediaStoragePath: content.mediaStoragePath ?? content.media_storage_path ?? null,
    mimeType: content.mimeType ?? content.mime_type ?? null,
    originalFilename: content.originalFilename ?? content.original_filename ?? null,
  };
};

const campaignRow = (result) => result.rows?.[0] || null;
const ensureDraft = (campaign) => {
  if (!campaign) throw new BroadcastCampaignError(404, 'Campanha nao encontrada.');
  if (campaign.status !== 'draft') throw new BroadcastCampaignError(409, 'Somente campanhas em rascunho podem ser editadas.');
  return campaign;
};

async function getCampaign(id, userId) {
  const campaignId = idOf(id);
  const ownerId = idOf(userId);
  if (!campaignId || !ownerId) throw new BroadcastCampaignError(400, 'Campanha ou usuario invalido.');
  const result = await query(`SELECT c.*, cc.id AS content_id, cc.content_type, cc.text_content, cc.media_storage_path,
    cc.mime_type, cc.original_filename
    FROM broadcast_campaigns c LEFT JOIN broadcast_campaign_contents cc ON cc.campaign_id = c.id
    WHERE c.id = ? AND c.created_by_user_id = ?`, [campaignId, ownerId]);
  return campaignRow(result);
}

async function listCampaigns({ userId, status } = {}) {
  const ownerId = idOf(userId);
  if (!ownerId) throw new BroadcastCampaignError(400, 'Usuario invalido.');
  const params = [ownerId];
  let filter = '';
  if (status) {
    if (!CAMPAIGN_STATUSES.includes(status)) throw new BroadcastCampaignError(400, 'Status de campanha invalido.');
    filter = ' AND c.status = ?'; params.push(status);
  }
  const result = await query(`SELECT c.*, COUNT(r.id) AS recipient_count,
    SUM(r.status IN ('sent', 'delivered', 'read')) AS sent_count,
    SUM(r.status = 'failed') AS failed_count
    FROM broadcast_campaigns c LEFT JOIN broadcast_campaign_recipients r ON r.campaign_id = c.id
    WHERE c.created_by_user_id = ?${filter} GROUP BY c.id ORDER BY c.created_at DESC`, params);
  return result.rows || [];
}

async function createDraft({ userId, name, channel = 'whatsapp', communicationAccountId = null, content } = {}) {
  const ownerId = idOf(userId);
  const campaignName = String(name || '').trim();
  if (!ownerId || !campaignName || campaignName.length > 150) throw new BroadcastCampaignError(400, 'Nome da campanha invalido.');
  if (channel !== 'whatsapp') throw new BroadcastCampaignError(400, 'Canal de campanha invalido.');
  const accountId = communicationAccountId == null ? null : idOf(communicationAccountId);
  if (communicationAccountId != null && !accountId) throw new BroadcastCampaignError(400, 'Conta de comunicacao invalida.');
  const result = await query('INSERT INTO broadcast_campaigns (name, channel, communication_account_id, status, created_by_user_id) VALUES (?, ?, ?, \'draft\', ?)', [campaignName, channel, accountId, ownerId]);
  const campaignId = Number(result.insertId);
  if (content) await updateContent(campaignId, ownerId, content);
  return getCampaign(campaignId, ownerId);
}

async function updateDraft(id, userId, values = {}) {
  const campaign = ensureDraft(await getCampaign(id, userId));
  const name = values.name == null ? campaign.name : String(values.name).trim();
  const accountId = values.communicationAccountId === undefined ? campaign.communication_account_id : (values.communicationAccountId == null ? null : idOf(values.communicationAccountId));
  if (!name || name.length > 150 || (values.communicationAccountId != null && !accountId)) throw new BroadcastCampaignError(400, 'Dados da campanha invalidos.');
  await query('UPDATE broadcast_campaigns SET name = ?, communication_account_id = ?, scheduled_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND created_by_user_id = ? AND status = \'draft\'', [name, accountId, values.scheduledAt ?? campaign.scheduled_at ?? null, campaign.id, userId]);
  if (values.content) await updateContent(campaign.id, userId, values.content);
  return getCampaign(campaign.id, userId);
}

async function updateContent(campaignId, userId, content) {
  const campaign = ensureDraft(await getCampaign(campaignId, userId));
  const normalized = normalizeContent(content);
  await query(`INSERT INTO broadcast_campaign_contents (campaign_id, content_type, text_content, media_storage_path, mime_type, original_filename)
    VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE content_type = VALUES(content_type), text_content = VALUES(text_content),
    media_storage_path = VALUES(media_storage_path), mime_type = VALUES(mime_type), original_filename = VALUES(original_filename), updated_at = CURRENT_TIMESTAMP`,
  [campaign.id, normalized.contentType, normalized.textContent, normalized.mediaStoragePath, normalized.mimeType, normalized.originalFilename]);
  return getCampaign(campaign.id, userId);
}

async function addRecipients(campaignId, userId, recipients = []) {
  const campaign = ensureDraft(await getCampaign(campaignId, userId));
  if (!Array.isArray(recipients)) throw new BroadcastCampaignError(400, 'Destinatarios invalidos.');
  const added = [];
  for (const recipient of recipients) {
    const phone = normalizePhone(recipient.phone || recipient.recipientPhone || recipient.recipient_phone);
    if (!phone) throw new BroadcastCampaignError(400, 'Destinatario sem telefone valido.');
    const prospectId = recipient.prospectId == null ? null : idOf(recipient.prospectId);
    const result = await query(`INSERT INTO broadcast_campaign_recipients (campaign_id, prospect_id, recipient_phone, recipient_name)
      VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`, [campaign.id, prospectId, phone, recipient.name || recipient.recipientName || null]);
    added.push(Number(result.insertId));
  }
  return { campaignId: campaign.id, recipientIds: added };
}

async function getRecipients(campaignId, userId, status) {
  const campaign = await getCampaign(campaignId, userId);
  if (status && !RECIPIENT_STATUSES.includes(status)) throw new BroadcastCampaignError(400, 'Status de destinatario invalido.');
  const params = [campaign.id];
  const filter = status ? ' AND r.status = ?' : '';
  if (status) params.push(status);
  const result = await query(`SELECT r.* FROM broadcast_campaign_recipients r WHERE r.campaign_id = ?${filter} ORDER BY r.id`, params);
  return result.rows || [];
}

module.exports = { CAMPAIGN_STATUSES, CONTENT_TYPES, RECIPIENT_STATUSES, BroadcastCampaignError, normalizePhone, normalizeContent, createDraft, getCampaign, listCampaigns, updateDraft, updateContent, addRecipients, getRecipients };
