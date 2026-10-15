const crypto = require("node:crypto");
const { query } = require("../config/database");
const { channelValue, normalizeCampaignChannels, normalizeCampaignEmail } = require("./broadcast-campaign-audience");
const { sanitizeEmailHtml, htmlToText } = require("./broadcast-email-html");
const { removeAttachment } = require("./broadcast-email-attachments");

const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
  "cancelled",
  "failed",
];
const CONTENT_TYPES = ["text", "image", "video", "document", "audio"];
const RECIPIENT_STATUSES = [
  "pending",
  "processing",
  "sent",
  "delivered",
  "read",
  "failed",
  "skipped",
  "cancelled",
];
const BROADCAST_EVENT_TYPES = [
  "created",
  "updated",
  "content_updated",
  "recipients_added",
  "recipient_removed",
  "scheduled",
  "started",
  "paused",
  "resumed",
  "cancelled",
  "completed",
  "failed",
];
// status !== 'draft' remains the edit guard for campaign mutation.

class BroadcastCampaignError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const idOf = (value) =>
  Number.isSafeInteger(Number(value)) && Number(value) > 0
    ? Number(value)
    : null;
const normalizePhone = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .slice(0, 50);
const normalizeContent = (content = {}) => {
  const contentType = String(
    content.contentType || content.content_type || "text",
  ).trim();
  if (!CONTENT_TYPES.includes(contentType))
    throw new BroadcastCampaignError(400, "Tipo de conteudo invalido.");
  return {
    contentType,
    textContent: content.textContent ?? content.text_content ?? null,
    mediaStoragePath:
      content.mediaStoragePath ?? content.media_storage_path ?? null,
    mimeType: content.mimeType ?? content.mime_type ?? null,
    originalFilename:
      content.originalFilename ?? content.original_filename ?? null,
    ...(Object.prototype.hasOwnProperty.call(content, "emailSubject") || Object.prototype.hasOwnProperty.call(content, "email_subject") || Object.prototype.hasOwnProperty.call(content, "emailBodyText") || Object.prototype.hasOwnProperty.call(content, "email_body_text")
      ? {
          emailSubject: content.emailSubject ?? content.email_subject ?? null,
          emailBodyText: content.emailBodyText ?? content.email_body_text ?? null,
          emailHtml: sanitizeEmailHtml(content.emailHtml ?? content.email_html ?? ""),
          emailSignatureHtml: sanitizeEmailHtml(content.emailSignatureHtml ?? content.email_signature_html ?? ""),
          emailSignatureText: htmlToText(content.emailSignatureHtml ?? content.email_signature_html ?? ""),
        }
      : {}),
  };
};

const campaignRow = (result) => result.rows?.[0] || null;
const ensureDraft = (campaign) => {
  if (!campaign)
    throw new BroadcastCampaignError(404, "Campanha nao encontrada.");
  if (campaign.status !== "draft")
    throw new BroadcastCampaignError(
      409,
      "Somente campanhas em rascunho podem ser editadas.",
    );
  return campaign;
};

async function getCampaign(id, userId) {
  const campaignId = idOf(id);
  const ownerId = idOf(userId);
  if (!campaignId || !ownerId)
    throw new BroadcastCampaignError(400, "Campanha ou usuario invalido.");
  const result = await query(
    `SELECT c.*, cc.id AS content_id, cc.content_type, cc.text_content, cc.media_storage_path,
    cc.mime_type, cc.original_filename, cc.email_subject, cc.email_body_text, cc.email_html, cc.email_signature_html, cc.email_signature_text
    FROM broadcast_campaigns c LEFT JOIN broadcast_campaign_contents cc ON cc.campaign_id = c.id
    WHERE c.id = ? AND c.created_by_user_id = ?`,
    [campaignId, ownerId],
  );
  return campaignRow(result);
}

async function listCampaigns({ userId, status } = {}) {
  const ownerId = idOf(userId);
  if (!ownerId) throw new BroadcastCampaignError(400, "Usuario invalido.");
  const params = [ownerId];
  let filter = "";
  if (status) {
    if (!CAMPAIGN_STATUSES.includes(status))
      throw new BroadcastCampaignError(400, "Status de campanha invalido.");
    filter = " AND c.status = ?";
    params.push(status);
  }
  const result = await query(
    `SELECT c.*, COUNT(r.id) AS recipient_count,
    SUM(r.status IN ('sent', 'delivered', 'read')) AS sent_count,
    SUM(r.status = 'failed') AS failed_count
    FROM broadcast_campaigns c LEFT JOIN broadcast_campaign_recipients r ON r.campaign_id = c.id
    WHERE c.created_by_user_id = ?${filter} GROUP BY c.id ORDER BY c.created_at DESC`,
    params,
  );
  return result.rows || [];
}

function normalizeCadence(value) {
  const seconds = Number(value ?? 0);
  if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds > 31536000)
    throw new BroadcastCampaignError(400, "Cadencia invalida.");
  return seconds;
}

function normalizeScheduledAt(value) {
  if (value == null || value === "") return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime()))
    throw new BroadcastCampaignError(400, "Data de agendamento invalida.");
  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

async function createDraft({
  userId,
  name,
  channel = "whatsapp",
  channels,
  communicationAccountId = null,
  emailProviderId = null,
  emailProvider = "smtp",
  cadenceSeconds = 0,
  idempotencyKey = null,
  content,
} = {}) {
  const ownerId = idOf(userId);
  const campaignName = String(name || "").trim();
  if (!ownerId || !campaignName || campaignName.length > 150)
    throw new BroadcastCampaignError(400, "Nome da campanha invalido.");
  let campaignChannel;
  try { campaignChannel = channelValue(channels || channel); } catch { throw new BroadcastCampaignError(400, "Canal de campanha invalido."); }
  const accountId =
    communicationAccountId == null ? null : idOf(communicationAccountId);
  if (communicationAccountId != null && !accountId)
    throw new BroadcastCampaignError(400, "Conta de comunicacao invalida.");
  const key = idempotencyKey == null ? null : String(idempotencyKey).trim().slice(0, 191);
  const providerId = emailProviderId == null ? null : idOf(emailProviderId);
  if (emailProviderId != null && !providerId)
    throw new BroadcastCampaignError(400, "Provedor SMTP invalido.");
  const provider = String(emailProvider || "smtp").trim().toLowerCase();
  if (!["smtp", "gmail"].includes(provider))
    throw new BroadcastCampaignError(400, "Provedor de email invalido.");
  if (idempotencyKey != null && (!key || key.length < 8)) throw new BroadcastCampaignError(400, "Idempotency-Key invalida.");
  const existing = key ? await query("SELECT id FROM broadcast_campaigns WHERE created_by_user_id = ? AND idempotency_key = ? LIMIT 1", [ownerId, key]) : { rows: [] };
  if (existing.rows?.[0]) return getCampaign(existing.rows[0].id, ownerId);
  if (campaignChannel !== "email" && !accountId)
    throw new BroadcastCampaignError(400, "Conta de comunicacao invalida.");
  let result;
  try {
    result = await query(
      "INSERT INTO broadcast_campaigns (name, channel, communication_account_id, email_provider_id, email_provider, cadence_seconds, status, created_by_user_id, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?)",
      [campaignName, campaignChannel, accountId, providerId, provider, normalizeCadence(cadenceSeconds), ownerId, key],
    );
  } catch (error) {
    if (!key || String(error?.code || '').toUpperCase() !== 'ER_DUP_ENTRY') throw error;
    const concurrent = await query("SELECT id FROM broadcast_campaigns WHERE created_by_user_id = ? AND idempotency_key = ? LIMIT 1", [ownerId, key]);
    if (!concurrent.rows?.[0]) throw error;
    return getCampaign(concurrent.rows[0].id, ownerId);
  }
  const campaignId = Number(result.insertId);
  if (content) await updateContent(campaignId, ownerId, content);
  return getCampaign(campaignId, ownerId);
}

async function updateDraft(id, userId, values = {}) {
  const campaign = ensureDraft(await getCampaign(id, userId));
  const name = values.name == null ? campaign.name : String(values.name).trim();
  const accountId =
    values.communicationAccountId === undefined
      ? campaign.communication_account_id
      : values.communicationAccountId == null
        ? null
        : idOf(values.communicationAccountId);
  const providerId = values.emailProviderId === undefined
    ? campaign.email_provider_id
    : values.emailProviderId == null ? null : idOf(values.emailProviderId);
  const provider = values.emailProvider === undefined
    ? String(campaign.email_provider || "smtp")
    : String(values.emailProvider || "smtp").trim().toLowerCase();
  if (!["smtp", "gmail"].includes(provider))
    throw new BroadcastCampaignError(400, "Provedor de email invalido.");
  let campaignChannel = campaign.channel;
  if (values.channels !== undefined) {
    try { campaignChannel = channelValue(values.channels); } catch { throw new BroadcastCampaignError(400, "Canal de campanha invalido."); }
  }
  const cadenceSeconds =
    values.cadenceSeconds === undefined
      ? Number(campaign.cadence_seconds || 0)
      : normalizeCadence(values.cadenceSeconds);
  if (
    !name ||
    name.length > 150 ||
    (values.communicationAccountId != null && !accountId)
  )
    throw new BroadcastCampaignError(400, "Dados da campanha invalidos.");
  await query(
    "UPDATE broadcast_campaigns SET name = ?, channel = ?, communication_account_id = ?, email_provider_id = ?, email_provider = ?, scheduled_at = ?, cadence_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND created_by_user_id = ? AND status = 'draft'",
    [
      name,
      campaignChannel,
      accountId,
      providerId,
      provider,
      values.scheduledAt === undefined
        ? campaign.scheduled_at ?? null
        : normalizeScheduledAt(values.scheduledAt),
      cadenceSeconds,
      campaign.id,
      userId,
    ],
  );
  if (values.content) await updateContent(campaign.id, userId, values.content);
  return getCampaign(campaign.id, userId);
}

async function updateContent(campaignId, userId, content) {
  const campaign = ensureDraft(await getCampaign(campaignId, userId));
  const normalized = normalizeContent(content);
  await query(
    `INSERT INTO broadcast_campaign_contents (campaign_id, content_type, text_content, email_subject, email_body_text, email_html, email_signature_html, email_signature_text, media_storage_path, mime_type, original_filename)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE content_type = VALUES(content_type), text_content = VALUES(text_content), email_subject = VALUES(email_subject), email_body_text = VALUES(email_body_text), email_html = VALUES(email_html), email_signature_html = VALUES(email_signature_html), email_signature_text = VALUES(email_signature_text),
    media_storage_path = VALUES(media_storage_path), mime_type = VALUES(mime_type), original_filename = VALUES(original_filename), updated_at = CURRENT_TIMESTAMP`,
    [
      campaign.id,
      normalized.contentType,
      normalized.textContent,
      normalized.emailSubject ?? null,
      normalized.emailBodyText ?? null,
      normalized.emailHtml ?? null,
      normalized.emailSignatureHtml ?? null,
      normalized.emailSignatureText ?? null,
      normalized.mediaStoragePath,
      normalized.mimeType,
      normalized.originalFilename,
    ],
  );
  return getCampaign(campaign.id, userId);
}

async function addRecipients(campaignId, userId, recipients = []) {
  const campaign = ensureDraft(await getCampaign(campaignId, userId));
  if (!Array.isArray(recipients))
    throw new BroadcastCampaignError(400, "Destinatarios invalidos.");
  const added = [];
  let suppressed = 0;
  for (const recipient of recipients) {
    const phone = normalizePhone(
      recipient.phone || recipient.recipientPhone || recipient.recipient_phone,
    );
    const email = normalizeCampaignEmail(recipient.email || recipient.recipientEmail || recipient.recipient_email);
    if (!phone && !email)
      throw new BroadcastCampaignError(
        400,
        "Destinatario sem canal valido.",
      );
    const prospectId =
      recipient.prospectId == null ? null : idOf(recipient.prospectId);
    if (email) {
      const suppressedResult = await query("SELECT id FROM broadcast_email_suppressions WHERE email = ? LIMIT 1", [email]);
      if (suppressedResult.rows?.[0]) { suppressed += 1; continue; }
      if (!prospectId) { suppressed += 1; continue; }
      const consentResult = await query("SELECT email_marketing_consent FROM prospects WHERE id = ? LIMIT 1", [prospectId]);
      if (Number(consentResult.rows?.[0]?.email_marketing_consent || 0) !== 1) { suppressed += 1; continue; }
    }
    const unsubscribeToken = email ? crypto.randomBytes(32).toString("hex") : null;
    const result = await query(
      `INSERT INTO broadcast_campaign_recipients (campaign_id, prospect_id, recipient_phone, recipient_email, recipient_name, unsubscribe_token)
      VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [
        campaign.id,
        prospectId,
        phone,
        email,
        recipient.name || recipient.recipientName || null,
        unsubscribeToken,
      ],
    );
    added.push(Number(result.insertId));
  }
  return { campaignId: campaign.id, recipientIds: added, suppressed };
}

async function getRecipients(campaignId, userId, status) {
  const campaign = await getCampaign(campaignId, userId);
  if (status && !RECIPIENT_STATUSES.includes(status))
    throw new BroadcastCampaignError(400, "Status de destinatario invalido.");
  const params = [campaign.id];
  const filter = status ? " AND r.status = ?" : "";
  if (status) params.push(status);
  const result = await query(
    `SELECT r.* FROM broadcast_campaign_recipients r WHERE r.campaign_id = ?${filter} ORDER BY r.id`,
    params,
  );
  return result.rows || [];
}

function parseAudienceFolderSelection(eventRows = []) {
  const legacyFolderIds = [];
  for (const row of eventRows) {
    let metadata = row?.metadata;
    try {
      if (typeof metadata === "string") metadata = JSON.parse(metadata);
    } catch {
      continue;
    }
    if (!metadata || typeof metadata !== "object") continue;
    if (metadata.source === "folders" && Array.isArray(metadata.folder_ids)) {
      return {
        folderIds: [
          ...new Set([
            ...legacyFolderIds,
            ...metadata.folder_ids.map(idOf).filter(Boolean),
          ]),
        ],
        recoverable: true,
      };
    }
    if (metadata.source === "folder") {
      const folderId = idOf(metadata.folder_id);
      if (folderId) legacyFolderIds.push(folderId);
    }
  }
  return {
    folderIds: [...new Set(legacyFolderIds)],
    recoverable: legacyFolderIds.length > 0,
  };
}

async function getFolderAudienceSummary(folderIds, userId) {
  const normalizedFolderIds = [...new Set((folderIds || []).map(idOf).filter(Boolean))];
  if (normalizedFolderIds.length > 100)
    throw new BroadcastCampaignError(400, "Muitas listas selecionadas.");
  if (!normalizedFolderIds.length) {
    return {
      folder_ids: [],
      folders: [],
      total_selected: 0,
      email_valid: 0,
      email_eligible: 0,
      email_no_consent: 0,
      email_unsubscribed: 0,
      email_invalid: 0,
      excluded_contacts: [],
    };
  }
  const placeholders = normalizedFolderIds.map(() => "?").join(",");
  const folders = await query(
    `SELECT f.id, f.name, COUNT(m.prospect_id) AS total
     FROM lead_folders f LEFT JOIN lead_folder_members m ON m.folder_id = f.id
     WHERE f.owner_user_id = ? AND f.id IN (${placeholders})
     GROUP BY f.id, f.name ORDER BY f.name`,
    [userId, ...normalizedFolderIds],
  );
  const ownedFolderIds = (folders.rows || []).map((row) => Number(row.id));
  if (!ownedFolderIds.length) {
    return {
      folder_ids: [],
      folders: [],
      total_selected: 0,
      email_valid: 0,
      email_eligible: 0,
      email_no_consent: 0,
      email_unsubscribed: 0,
      email_invalid: 0,
      excluded_contacts: [],
    };
  }
  const ownedPlaceholders = ownedFolderIds.map(() => "?").join(",");
  const summary = await query(
    `SELECT COUNT(*) AS total_selected,
      SUM(a.email_valid) AS email_valid,
      SUM(a.email_valid = 1 AND a.email_marketing_consent = 1 AND s.id IS NULL) AS email_eligible,
      SUM(a.email_valid = 1 AND COALESCE(a.email_marketing_consent, 0) <> 1 AND s.id IS NULL) AS email_no_consent,
      SUM(a.email_valid = 1 AND s.id IS NOT NULL) AS email_unsubscribed,
      SUM(a.email_valid = 0) AS email_invalid
     FROM (
       SELECT DISTINCT p.id, LOWER(TRIM(p.email)) AS normalized_email,
         p.email_marketing_consent,
         (p.email IS NOT NULL AND LOWER(TRIM(p.email)) REGEXP '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$') AS email_valid
       FROM lead_folder_members m
       JOIN prospects p ON p.id = m.prospect_id
       WHERE m.folder_id IN (${ownedPlaceholders})
     ) a
     LEFT JOIN broadcast_email_suppressions s ON s.email = a.normalized_email`,
    ownedFolderIds,
  );
  const totals = summary.rows?.[0] || {};
  const excluded = await query(
    `SELECT DISTINCT p.id, p.business_name, p.email,
      CASE
        WHEN p.email IS NULL OR NOT (LOWER(TRIM(p.email)) REGEXP '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$') THEN 'invalid_email'
        WHEN s.id IS NOT NULL THEN 'unsubscribed'
        WHEN COALESCE(p.email_marketing_consent, 0) <> 1 THEN 'no_consent'
        ELSE NULL
      END AS reason
     FROM lead_folder_members m
     JOIN prospects p ON p.id = m.prospect_id
     LEFT JOIN broadcast_email_suppressions s ON s.email = LOWER(TRIM(p.email))
     WHERE m.folder_id IN (${ownedPlaceholders})
       AND (p.email IS NULL
         OR NOT (LOWER(TRIM(p.email)) REGEXP '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$')
         OR s.id IS NOT NULL
         OR COALESCE(p.email_marketing_consent, 0) <> 1)
     ORDER BY p.id DESC LIMIT 100`,
    ownedFolderIds,
  );
  return {
    folder_ids: ownedFolderIds,
    folders: (folders.rows || []).map((row) => ({
      id: Number(row.id),
      name: row.name,
      total: Number(row.total || 0),
    })),
    total_selected: Number(totals.total_selected || 0),
    email_valid: Number(totals.email_valid || 0),
    email_eligible: Number(totals.email_eligible || 0),
    email_no_consent: Number(totals.email_no_consent || 0),
    email_unsubscribed: Number(totals.email_unsubscribed || 0),
    email_invalid: Number(totals.email_invalid || 0),
    excluded_contacts: (excluded.rows || []).map((row) => ({
      id: Number(row.id),
      name: row.business_name || "Contato sem nome",
      email: row.email || null,
      reason: row.reason,
    })),
  };
}

async function getAudienceSelection(campaignId, userId) {
  const campaign = await getCampaign(campaignId, userId);
  const events = await query(
    "SELECT metadata FROM broadcast_campaign_events WHERE campaign_id = ? AND event_type = 'recipients_added' ORDER BY id DESC",
    [campaign.id],
  );
  const parsed = parseAudienceFolderSelection(events.rows || []);
  const recipients = await query(
    "SELECT COUNT(*) AS total FROM broadcast_campaign_recipients WHERE campaign_id = ?",
    [campaign.id],
  );
  return {
    ...(await getFolderAudienceSummary(parsed.folderIds, userId)),
    selection_recoverable: parsed.recoverable,
    recipient_total: Number(recipients.rows?.[0]?.total || 0),
  };
}

async function getDefaultEmailSignature() {
  const result = await query("SELECT id, html_content, text_content, updated_at FROM broadcast_email_signatures ORDER BY id LIMIT 1");
  return result.rows?.[0] || null;
}

async function saveDefaultEmailSignature(userId, htmlContent) {
  const html = sanitizeEmailHtml(htmlContent);
  const text = htmlToText(html);
  if (!html || !text) throw new BroadcastCampaignError(400, "Assinatura de e-mail vazia.");
  await query("INSERT INTO broadcast_email_signatures (id, html_content, text_content, updated_by_user_id) VALUES (1, ?, ?, ?) ON DUPLICATE KEY UPDATE html_content = VALUES(html_content), text_content = VALUES(text_content), updated_by_user_id = VALUES(updated_by_user_id), updated_at = CURRENT_TIMESTAMP", [html, text, userId]);
  return getDefaultEmailSignature();
}

async function listEmailAttachments(campaignId, userId) {
  const campaign = await getCampaign(campaignId, userId);
  if (!campaign) throw new BroadcastCampaignError(404, "Campanha nao encontrada.");
  const result = await query("SELECT id, original_name, mime_type, size_bytes, created_at FROM broadcast_campaign_attachments WHERE campaign_id = ? ORDER BY id", [idOf(campaignId)]);
  return result.rows || [];
}

async function getEmailAttachmentsForJob(campaignId) {
  const result = await query("SELECT id, original_name, storage_key, mime_type, size_bytes FROM broadcast_campaign_attachments WHERE campaign_id = ? ORDER BY id", [idOf(campaignId)]);
  return result.rows || [];
}

async function removeEmailAttachment(campaignId, attachmentId, userId) {
  const campaign = ensureDraft(await getCampaign(campaignId, userId));
  const result = await query("SELECT id, storage_key FROM broadcast_campaign_attachments WHERE id = ? AND campaign_id = ? LIMIT 1", [idOf(attachmentId), campaign.id]);
  const row = result.rows?.[0];
  if (!row) throw new BroadcastCampaignError(404, "Anexo nao encontrado.");
  await query("DELETE FROM broadcast_campaign_attachments WHERE id = ? AND campaign_id = ?", [row.id, campaign.id]);
  await removeAttachment(row.storage_key);
  return { id: row.id };
}

module.exports = {
  CAMPAIGN_STATUSES,
  CONTENT_TYPES,
  RECIPIENT_STATUSES,
  BROADCAST_EVENT_TYPES,
  BroadcastCampaignError,
  normalizePhone,
  normalizeContent,
  normalizeCadence,
  normalizeScheduledAt,
  createDraft,
  getCampaign,
  listCampaigns,
  updateDraft,
  updateContent,
  addRecipients,
  getRecipients,
  parseAudienceFolderSelection,
  getFolderAudienceSummary,
  getAudienceSelection,
  getDefaultEmailSignature,
  saveDefaultEmailSignature,
  listEmailAttachments,
  getEmailAttachmentsForJob,
  removeEmailAttachment,
};
