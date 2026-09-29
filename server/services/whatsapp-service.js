const crypto = require('node:crypto');
const { getPool } = require('../config/database');
const { decryptSecret } = require('./integration-crypto');
const { dispatchDomainEvent } = require('./domain-events');
const { EvolutionWhatsAppProvider, providerError } = require('./evolution-whatsapp-provider');
const { normalizeMediaType, storeBase64, removeMedia } = require('./chat-media');

const parseJson = (value, fallback = {}) => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
};

function normalizePhone(value) {
  const input = String(value || '').trim();
  if (/@lid$/i.test(input) || (input.includes('@') && !/@(?:s\.whatsapp\.net|c\.us)$/i.test(input))) return null;
  const raw = input.replace(/@s\.whatsapp\.net$|@c\.us$/i, '').replace(/\D/g, '');
  if (!raw) return null;
  if (input.startsWith('+') && !raw.startsWith('55')) return raw.length >= 7 && raw.length <= 15 ? raw : null;
  if (raw.startsWith('55') && (raw.length === 12 || raw.length === 13)) return raw;
  if ((raw.length === 10 || raw.length === 11) && !raw.startsWith('0')) return `55${raw}`;
  return raw.length >= 7 && raw.length <= 15 && !raw.startsWith('0') ? raw : null;
}

function resolveWhatsAppDestination({ recipient, lead = null }) {
  const rawRecipient = String(recipient || '').trim();
  if (/@g\.us$/i.test(rawRecipient)) return rawRecipient;
  const direct = normalizePhone(rawRecipient);
  if (direct) return direct;
  if (/@lid$/i.test(rawRecipient)) {
    const fromLead = normalizePhone(lead?.normalized_phone || lead?.phone);
    if (fromLead) return fromLead;
  }
  const error = new Error('WHATSAPP_DESTINATION_UNRESOLVED');
  error.code = 'WHATSAPP_DESTINATION_UNRESOLVED';
  error.retryable = false;
  error.publicMessage = 'Nao foi possivel identificar o numero do WhatsApp deste contato.';
  throw error;
}

function formatWhatsAppParticipantPhone(value) {
  const digits = String(value || '').replace(/@s\.whatsapp\.net$|@c\.us$|@lid$/i, '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.length === 13 ? digits.slice(4, 9) : digits.slice(4, 8)}-${digits.length === 13 ? digits.slice(9) : digits.slice(8)}`;
  return `+${digits}`;
}

function phoneCandidates(normalized) {
  if (!normalized) return [];
  const candidates = [normalized];
  if (normalized.startsWith('55')) candidates.push(normalized.slice(2));
  return [...new Set(candidates)];
}

function unwrapMessage(message) {
  let current = message || {};
  for (let index = 0; index < 3; index += 1) {
    const nested = current?.ephemeralMessage?.message || current?.viewOnceMessage?.message || current?.viewOnceMessageV2?.message;
    if (!nested) break;
    current = nested;
  }
  return current;
}

function extractText(message) {
  const content = unwrapMessage(message);
  return content?.conversation || content?.extendedTextMessage?.text || content?.imageMessage?.caption || content?.videoMessage?.caption || content?.documentMessage?.caption || content?.buttonsResponseMessage?.selectedDisplayText || content?.listResponseMessage?.title || null;
}

function mediaFromMessage(message) {
  const content = unwrapMessage(message);
  const entries = [['imageMessage', 'image'], ['videoMessage', 'video'], ['audioMessage', 'audio'], ['documentMessage', 'document'], ['stickerMessage', 'sticker']];
  const entry = entries.find(([key]) => content?.[key]);
  if (!entry) return { type: extractText(content) ? 'text' : 'unknown', content, caption: extractText(content) };
  const media = content[entry[0]] || {};
  return { type: entry[1], content: media, caption: media.caption || null, mimeType: media.mimetype || media.mime_type || null, filename: media.fileName || media.file_name || null, size: Number(media.fileLength || media.file_length || 0) || null, duration: Number(media.seconds || media.duration || 0) || null, width: Number(media.width || 0) || null, height: Number(media.height || 0) || null };
}

function extractInbound(payload) {
  const data = payload?.data || payload;
  const key = data?.key || {};
  const remoteJid = String(key.remoteJid || data?.remoteJid || '');
  const externalMessageId = String(key.id || data?.id || '').trim();
  const participantId = String(key.participant || data?.participant || '').trim();
  const participantAlt = String(key.participantAlt || key.remoteJidAlt || data?.participantAlt || data?.remoteJidAlt || '').trim() || null;
  const isGroup = remoteJid.endsWith('@g.us');
  const isBroadcast = remoteJid.endsWith('@broadcast') || remoteJid === 'status@broadcast';
  const fromMe = Boolean(key.fromMe || data?.fromMe);
  const timestamp = Number(data?.messageTimestamp || data?.timestamp || 0);
  const message = unwrapMessage(data?.message || data);
  const media = mediaFromMessage(message);
  const contextInfo = media.content?.contextInfo || Object.values(media.content || {}).find((value) => value && typeof value === 'object' && value.contextInfo)?.contextInfo || data?.contextInfo || data?.message?.contextInfo || null;
  const quoted = contextInfo?.quotedMessage ? { text: extractText(contextInfo.quotedMessage), messageType: mediaFromMessage(contextInfo.quotedMessage).type, externalMessageId: contextInfo.stanzaId || null, participant: contextInfo.participant || contextInfo.remoteJid || null } : null;
  const canonicalParticipantId = /@s\.whatsapp\.net$/i.test(String(participantAlt || '')) ? participantAlt : participantId || remoteJid;
  return { remoteJid, externalMessageId, externalSenderId: canonicalParticipantId, participantId, participantAlt, phone: normalizePhone(participantAlt) || normalizePhone(remoteJid), fromMe, isGroup, isBroadcast, text: media.caption || extractText(message), messageType: media.type, media: { ...media, key: { id: externalMessageId, remoteJid, fromMe, participant: participantId || null, participantAlt } }, providerMessage: { key: { id: externalMessageId, remoteJid, fromMe, participant: participantId || null, participantAlt }, message }, quoted, occurredAt: timestamp > 0 ? new Date(timestamp * 1000) : new Date(), pushName: String(data?.pushName || data?.sender?.pushName || '').trim() || null };
}

function participantContractSummary(participant) {
  const identifier = String(participant?.id || participant?.jid || participant?.participant || '');
  return { fields: Object.keys(participant || {}).sort(), identifierType: identifier.endsWith('@lid') ? 'lid' : identifier.endsWith('@s.whatsapp.net') ? 'phone_jid' : identifier.includes('@') ? 'other_jid' : 'plain', hasDisplayName: Boolean(participant?.name || participant?.notify || participant?.pushName || participant?.verifiedName), hasPhoneMapping: Boolean(participant?.phoneNumber || participant?.number || participant?.participantAlt || participant?.remoteJidAlt), hasAvatarCandidate: Boolean(participant?.imgUrl || participant?.profilePicUrl || participant?.profilePictureUrl), role: participant?.admin || null };
}

function extractDeliveryStatus(payload) {
  const data = Array.isArray(payload?.data) ? payload.data[0] : payload?.data || payload;
  const raw = data?.status || data?.update?.status || data?.messageUpdate?.status || data?.ack;
  const value = String(raw || '').toLowerCase();
  if (['read', 'seen', 'read_by_recipient'].includes(value) || raw === 4) return 'read';
  if (['delivered', 'delivery', 'delivery_ack', 'delivered_to_recipient'].includes(value) || raw === 3) return 'delivered';
  if (['sent', 'server_ack', 'serverack'].includes(value) || raw === 2) return 'sent';
  if (['failed', 'error'].includes(value) || raw === -1 || raw === 5) return 'failed';
  return null;
}

function deliveryUpdates(payload) {
  const rawItems = Array.isArray(payload?.data) ? payload.data : [payload?.data || payload];
  return rawItems.map((data) => ({
    externalMessageId: String(data?.key?.id || data?.keyId || data?.messageId || data?.id || data?.update?.key?.id || '').trim(),
    status: extractDeliveryStatus({ data }),
  })).filter((update) => update.externalMessageId && update.status);
}

function receiptHash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 12); }

async function updateDeliveryReceipt(connection, accountId, update) {
  const [rows] = await connection.execute('SELECT id, direction, delivery_status FROM communication_messages WHERE communication_account_id = ? AND external_message_id = ? LIMIT 1', [accountId, update.externalMessageId]);
  const message = rows[0];
  if (!message || message.direction !== 'outbound') {
    console.info('[WhatsApp] recibo sem mensagem outbound correspondente', { communicationAccountId: Number(accountId), externalMessageIdHash: receiptHash(update.externalMessageId), status: update.status, matched: false });
    return false;
  }
  const current = String(message.delivery_status || '').toLowerCase();
  const regresses = (current === 'read' && ['sent', 'delivered'].includes(update.status)) || (current === 'delivered' && update.status === 'sent');
  if (!regresses) {
    await connection.execute('UPDATE communication_messages SET delivery_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [update.status, message.id]);
    await connection.execute(`UPDATE broadcast_campaign_recipients r
      JOIN broadcast_campaigns c ON c.id = r.campaign_id
      SET r.status = CASE
        WHEN ? = 'read' THEN 'read'
        WHEN ? = 'delivered' AND r.status NOT IN ('read') THEN 'delivered'
        WHEN ? = 'failed' AND r.status NOT IN ('read', 'delivered') THEN 'failed'
        ELSE r.status END,
        r.delivered_at = IF(? = 'delivered', COALESCE(r.delivered_at, UTC_TIMESTAMP()), r.delivered_at),
        r.read_at = IF(? = 'read', COALESCE(r.read_at, UTC_TIMESTAMP()), r.read_at),
        r.failed_at = IF(? = 'failed', COALESCE(r.failed_at, UTC_TIMESTAMP()), r.failed_at),
        r.last_error = IF(? = 'failed', 'PROVIDER_DELIVERY_FAILED', r.last_error),
        r.updated_at = CURRENT_TIMESTAMP
      WHERE r.communication_message_id = ?`, [update.status, update.status, update.status, update.status, update.status, update.status, update.status, message.id]);
  }
  console.info('[WhatsApp] recibo processado', { communicationAccountId: Number(accountId), messageId: Number(message.id), externalMessageIdHash: receiptHash(update.externalMessageId), previousStatus: current || null, status: regresses ? current : update.status, matched: true });
  return true;
}

async function loadEvolutionConfig(connection, account) {
  const [rows] = await connection.execute("SELECT * FROM integration_providers WHERE id = ? AND provider = 'evolution' LIMIT 1", [account.integration_provider_id]);
  const row = rows[0];
  if (!row) throw providerError('Integracao Evolution nao configurada.', 'WHATSAPP_NOT_CONFIGURED');
  const secret = decryptSecret(row);
  const metadata = parseJson(row.configuration_metadata);
  return { provider: new EvolutionWhatsAppProvider({ baseUrl: metadata.baseUrl, apiKey: secret?.apiKey, timeout: metadata.timeout }), row, metadata };
}

async function findOrCreateLead(connection, account, phone, pushName) {
  if (!phone) return null;
  const lockKey = `kaizen:whatsapp:lead:${crypto.createHash('sha256').update(phone).digest('hex').slice(0, 32)}`;
  await connection.execute('SELECT GET_LOCK(?, 10)', [lockKey]);
  try {
    const candidates = phoneCandidates(phone);
    const [rows] = await connection.execute(`SELECT * FROM prospects WHERE normalized_phone IN (${candidates.map(() => '?').join(',')}) ORDER BY id LIMIT 1 FOR UPDATE`, candidates);
    if (rows[0]) return rows[0];
    if (!account.auto_create_leads) return null;
    const name = pushName || phone;
    const [result] = await connection.execute("INSERT INTO prospects (owner_user_id, business_name, normalized_business_name, phone, normalized_phone, status, origin, category) VALUES (?, ?, ?, ?, ?, 'Novo', 'WhatsApp', 'WhatsApp')", [account.owner_user_id, name, name.toLowerCase(), phone, phone]);
    const [createdRows] = await connection.execute('SELECT * FROM prospects WHERE id = ?', [result.insertId]);
    await dispatchDomainEvent({ type: 'lead.created', entityType: 'lead', entityId: result.insertId, actorUserId: account.owner_user_id, payload: { leadId: result.insertId, source: 'whatsapp', status: 'Novo' }, idempotencyKey: `whatsapp-lead:${phone}` }, { connection });
    return createdRows[0] || null;
  } finally {
    await connection.execute('SELECT RELEASE_LOCK(?)', [lockKey]).catch(() => {});
  }
}

async function getOrCreateConversation(connection, account, externalConversationId, leadId, direction, occurredAt, metadata = {}) {
  const conversationType = metadata.isGroup ? 'group' : 'contact';
  await connection.execute(`INSERT INTO conversations (channel, conversation_type, communication_account_id, lead_id, external_conversation_id, display_name, last_message_at, last_inbound_at, last_outbound_at, unread_count) VALUES ('whatsapp', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE conversation_type = VALUES(conversation_type), lead_id = COALESCE(VALUES(lead_id), lead_id), display_name = COALESCE(display_name, VALUES(display_name)), last_message_at = GREATEST(COALESCE(last_message_at, VALUES(last_message_at)), VALUES(last_message_at)), last_inbound_at = IF(VALUES(last_inbound_at) IS NULL, last_inbound_at, VALUES(last_inbound_at)), last_outbound_at = IF(VALUES(last_outbound_at) IS NULL, last_outbound_at, VALUES(last_outbound_at)), unread_count = unread_count + VALUES(unread_count), updated_at = CURRENT_TIMESTAMP`, [conversationType, account.id, leadId, externalConversationId, metadata.displayName || null, occurredAt, direction === 'inbound' ? occurredAt : null, direction === 'outbound' ? occurredAt : null, direction === 'inbound' ? 1 : 0]);
  const [rows] = await connection.execute('SELECT * FROM conversations WHERE communication_account_id = ? AND external_conversation_id = ? FOR UPDATE', [account.id, externalConversationId]);
  return rows[0];
}

async function persistMessage(connection, { account, conversation, lead, event, direction, text, externalMessageId, externalSenderId, messageType, occurredAt, metadata = {}, media = null, quotedMessageId = null }) {
  if (!externalMessageId) return { duplicate: false, id: null };
  const [existing] = await connection.execute('SELECT id FROM communication_messages WHERE communication_account_id = ? AND external_message_id = ? LIMIT 1', [account.id, externalMessageId]);
  if (existing[0]) return { duplicate: true, id: Number(existing[0].id) };
  const [result] = await connection.execute(`INSERT INTO communication_messages (channel, direction, lead_id, conversation_id, communication_account_id, external_message_id, external_sender_id, sender_name, recipient, body_text, message_type, delivery_status, metadata, media_storage_path, media_mime_type, media_filename, media_size_bytes, media_duration_seconds, media_width, media_height, quoted_message_id, media_status, status, provider, created_at, sent_at) VALUES ('whatsapp', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', 'evolution', ?, ?)` , [direction, lead?.id || null, conversation.id, account.id, externalMessageId, externalSenderId || null, metadata.senderName || null, direction === 'inbound' ? account.phone_number || '' : lead?.phone || '', text || null, messageType || 'text', direction === 'inbound' ? 'received' : 'sent', JSON.stringify(metadata), media?.storagePath || null, media?.mime || null, media?.filename || null, media?.size || null, media?.duration || null, media?.width || null, media?.height || null, quotedMessageId, media ? 'ready' : null, occurredAt, direction === 'outbound' ? occurredAt : null]);
  return { duplicate: false, id: Number(result.insertId) };
}

async function enrichGroupParticipantFromMessage(connection, conversation, parsed) {
  if (!parsed.isGroup || !parsed.externalSenderId || parsed.externalSenderId === parsed.remoteJid) return;
  const phoneIdentifier = parsed.participantAlt && /@s\.whatsapp\.net$/i.test(parsed.participantAlt) ? parsed.participantAlt : parsed.externalSenderId;
  const phone = /@lid$/i.test(phoneIdentifier) ? null : formatWhatsAppParticipantPhone(phoneIdentifier);
  const name = parsed.pushName || null;
  await connection.execute(`INSERT INTO conversation_participants (conversation_id, external_participant_id, display_name, phone, participant_role) VALUES (?, ?, ?, ?, 'participant')
    ON DUPLICATE KEY UPDATE display_name = COALESCE(VALUES(display_name), display_name), phone = COALESCE(VALUES(phone), phone), updated_at = CURRENT_TIMESTAMP`, [conversation.id, parsed.externalSenderId.slice(0, 191), name, phone]);
}

async function downloadInboundMedia(connection, account, parsed) {
  if (!parsed.media || !['image', 'audio', 'video', 'document', 'sticker'].includes(parsed.messageType)) return { stored: null, status: null };
  const { provider } = await loadEvolutionConfig(connection, account);
  const downloaded = await provider.downloadMedia(account.external_instance_id, parsed.providerMessage || { key: parsed.media.key }, { convertToMp4: false });
  if (!downloaded.base64) throw providerError('A Evolution nao retornou a midia.', 'MEDIA_DOWNLOAD_EMPTY');
  const stored = await storeBase64(downloaded.base64, { type: parsed.messageType, mime: downloaded.mimeType || parsed.media.mimeType, filename: downloaded.filename || parsed.media.filename || undefined });
  return { stored: { ...stored, duration: parsed.media.duration, width: parsed.media.width, height: parsed.media.height }, status: 'ready' };
}

async function processWebhookEvent(connection, event) {
  const account = event.communication_account_id ? (await connection.execute('SELECT * FROM communication_accounts WHERE id = ? AND archived_at IS NULL FOR UPDATE', [event.communication_account_id]))[0][0] : null;
  if (!account) throw new Error('WHATSAPP_ACCOUNT_NOT_FOUND');
  const payload = parseJson(event.payload);
  const parsed = extractInbound(payload);
  if (String(event.event_type || '').toLowerCase().includes('messages.update')) {
    const updates = deliveryUpdates(payload);
    for (const update of updates) await updateDeliveryReceipt(connection, account.id, update);
    return { ignored: true, reason: updates.length ? 'delivery_status' : 'unsupported_status' };
  }
  if (!parsed.externalMessageId || parsed.isBroadcast || (!parsed.isGroup && !parsed.phone)) return { ignored: true, reason: parsed.isBroadcast ? 'broadcast' : 'missing_sender' };
  const lead = parsed.isGroup ? null : await findOrCreateLead(connection, account, parsed.phone, parsed.pushName);
  const direction = parsed.fromMe ? 'outbound' : 'inbound';
  const conversation = await getOrCreateConversation(connection, account, parsed.remoteJid, lead?.id || null, direction, parsed.occurredAt, { isGroup: parsed.isGroup });
  if (direction === 'inbound') await connection.execute('UPDATE conversations SET archived_at = NULL WHERE id = ? AND hidden_at IS NULL', [conversation.id]);
  await enrichGroupParticipantFromMessage(connection, conversation, parsed);
  let media = null;
  let mediaStatus = null;
  if (parsed.messageType !== 'text' && parsed.messageType !== 'unknown') {
    try { const downloaded = await downloadInboundMedia(connection, account, parsed); media = downloaded.stored; mediaStatus = downloaded.status; }
    catch (error) { mediaStatus = 'unavailable'; console.error('[WhatsApp] download de midia falhou', { communicationAccountId: Number(account.id), provider: String(account.provider || 'unknown'), operation: 'download_media', messageType: parsed.messageType, providerStatus: error?.providerStatus || null, errorCode: String(error?.code || 'MEDIA_DOWNLOAD_FAILED').replace(/[^A-Z0-9_]/g, '_').slice(0, 80) }); }
  }
  const [quotedRows] = parsed.quoted?.externalMessageId ? await connection.execute('SELECT id FROM communication_messages WHERE communication_account_id = ? AND external_message_id = ? LIMIT 1', [account.id, parsed.quoted.externalMessageId]) : [[]];
  const message = await persistMessage(connection, { account, conversation, lead, event, direction, text: parsed.text, externalMessageId: parsed.externalMessageId, externalSenderId: parsed.externalSenderId, messageType: parsed.messageType, occurredAt: parsed.occurredAt, media, quotedMessageId: quotedRows[0]?.id || null, metadata: { pushName: parsed.pushName, senderName: parsed.isGroup ? parsed.pushName : null, fromMe: parsed.fromMe, isGroup: parsed.isGroup, eventType: event.event_type, identity: { remoteJid: parsed.remoteJid, participantId: parsed.participantId, participantAlt: parsed.participantAlt, phoneResolved: Boolean(parsed.phone) }, media: parsed.media ? { key: parsed.media.key, mimeType: parsed.media.mimeType, filename: parsed.media.filename, size: parsed.media.size, duration: parsed.media.duration, width: parsed.media.width, height: parsed.media.height, status: mediaStatus } : null, quoted: parsed.quoted } });
  if (!message.duplicate && lead?.id) await connection.execute("INSERT INTO prospect_contact_history (prospect_id, owner_user_id, channel, message, recipient, delivery_status, metadata) VALUES (?, ?, 'whatsapp', ?, ?, ?, ?)", [lead.id, account.owner_user_id, direction === 'inbound' ? 'Mensagem recebida no WhatsApp' : 'Mensagem enviada no WhatsApp', parsed.phone, direction === 'inbound' ? 'received' : 'sent', JSON.stringify({ conversationId: conversation.id, externalMessageId: parsed.externalMessageId })]);
  if (!message.duplicate) await dispatchDomainEvent({ type: direction === 'inbound' ? 'message.received' : 'message.sent', entityType: 'conversation', entityId: conversation.id, actorUserId: parsed.fromMe ? account.owner_user_id : null, payload: { conversationId: conversation.id, messageId: message.id, leadId: lead?.id || null, channel: 'whatsapp' }, idempotencyKey: `whatsapp-message:${account.id}:${parsed.externalMessageId}` }, { connection });
  return { ignored: false, duplicate: message.duplicate, conversationId: Number(conversation.id), leadId: lead?.id ? Number(lead.id) : null, messageId: message.id };
}

async function processPendingWhatsAppEvents({ batchSize = 25 } = {}) {
  const connection = await getPool().getConnection();
  let processed = 0;
  try {
    for (let index = 0; index < batchSize; index += 1) {
      await connection.beginTransaction();
      const [rows] = await connection.execute("SELECT * FROM communication_webhook_events WHERE status = 'pending' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED");
      const event = rows[0];
      if (!event) { await connection.rollback(); break; }
      await connection.execute("UPDATE communication_webhook_events SET status = 'processing', attempts = attempts + 1 WHERE id = ?", [event.id]);
      try { await processWebhookEvent(connection, event); await connection.execute("UPDATE communication_webhook_events SET status = 'processed', processed_at = UTC_TIMESTAMP(), error_code = NULL WHERE id = ?", [event.id]); await connection.commit(); processed += 1; }
      catch (error) { await connection.rollback(); await connection.execute("UPDATE communication_webhook_events SET status = 'failed', error_code = ? WHERE id = ?", [String(error.code || 'WHATSAPP_EVENT_FAILED').slice(0, 100), event.id]); }
    }
    return processed;
  } finally { connection.release(); }
}

async function sendWhatsAppContent(connection, { account, leadId, recipient, text = null, messageType = 'text', file = null, mimeType = null, filename = null, caption = null, quotedMessageId = null, idempotencyKey, automationId = null, runId = null, stepId = null, ownerUserId = null }) {
  const isGroup = String(recipient || '').endsWith('@g.us');
  const accountStatus = account.account_status ?? account.status;
  if (accountStatus !== 'connected') throw Object.assign(new Error('WHATSAPP_ACCOUNT_NOT_CONNECTED'), { code: 'WHATSAPP_ACCOUNT_NOT_CONNECTED', retryable: false, publicMessage: 'A conta WhatsApp nao esta conectada.' });
  if (!['text', 'image', 'audio', 'video', 'document'].includes(messageType)) throw Object.assign(new Error('MEDIA_TYPE_NOT_SUPPORTED'), { code: 'MEDIA_TYPE_NOT_SUPPORTED', retryable: false, publicMessage: 'Este tipo de mensagem nao e suportado para envio.' });
  if (messageType === 'text' && !String(text || '').trim()) throw Object.assign(new Error('INVALID_WHATSAPP_MESSAGE'), { code: 'INVALID_WHATSAPP_MESSAGE', retryable: false, publicMessage: 'Mensagem obrigatoria.' });
  const [existing] = await connection.execute('SELECT * FROM communication_messages WHERE idempotency_key = ? FOR UPDATE', [idempotencyKey]);
  if (existing[0]?.status === 'sent') return { idempotent: true, communicationMessageId: Number(existing[0].id), providerMessageId: existing[0].provider_message_id, messageId: existing[0].provider_message_id, conversationId: existing[0].conversation_id };
  const [leadRows] = await connection.execute('SELECT * FROM prospects WHERE id = ? LIMIT 1', [leadId || 0]);
  const lead = leadRows[0] || null;
  const phone = resolveWhatsAppDestination({ recipient, lead });
  const remoteJid = isGroup ? phone : `${phone}@s.whatsapp.net`;
  const conversation = await getOrCreateConversation(connection, account, remoteJid, lead?.id || null, 'outbound', new Date(), { isGroup });
  const { provider } = await loadEvolutionConfig(connection, account);
  let stored = null;
  let result;
  let quoted = null;
  if (quotedMessageId) {
    const [quotedRows] = await connection.execute('SELECT id, external_message_id, conversation_id, direction FROM communication_messages WHERE id = ? AND conversation_id = ? LIMIT 1', [quotedMessageId, conversation.id]);
    if (quotedRows[0]?.external_message_id) quoted = { key: { id: quotedRows[0].external_message_id, remoteJid, fromMe: quotedRows[0].direction === 'outbound' } };
  }
  const resolvedQuotedMessageId = quoted ? Number(quotedMessageId) : null;
  try {
    if (messageType === 'text') result = await provider.sendText(account.external_instance_id, phone, text, quoted);
    else {
    if (!file?.buffer) throw Object.assign(new Error('MEDIA_FILE_REQUIRED'), { code: 'MEDIA_FILE_REQUIRED', retryable: false, publicMessage: 'Arquivo obrigatorio.' });
    const { storeBuffer } = require('./chat-media');
    stored = await storeBuffer(file.buffer, { type: messageType, mime: mimeType || file.mimetype, filename });
    const encoded = file.buffer.toString('base64');
      result = messageType === 'audio' ? await provider.sendAudio(account.external_instance_id, { number: phone, audio: encoded, quoted }) : await provider.sendMedia(account.external_instance_id, { number: phone, mediaType: messageType, mimeType: stored.mime, media: encoded, filename: stored.filename, caption, quoted });
    }
  } catch (error) {
    if (stored?.storagePath) await removeMedia(stored.storagePath).catch(() => {});
    throw error;
  }
  try {
    await connection.execute(`INSERT INTO communication_messages (channel, direction, lead_id, automation_id, automation_run_id, automation_step_id, conversation_id, communication_account_id, idempotency_key, external_message_id, recipient, body_text, message_type, delivery_status, metadata, media_storage_path, media_mime_type, media_filename, media_size_bytes, quoted_message_id, media_status, status, provider, provider_message_id, sent_at) VALUES ('whatsapp', 'outbound', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?, 'sent', 'evolution', ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE status = 'sent', external_message_id = VALUES(external_message_id), provider_message_id = VALUES(provider_message_id), sent_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP`, [lead?.id || null, automationId, runId, stepId, conversation.id, account.id, idempotencyKey, result.externalMessageId, phone, messageType === 'text' ? text : caption || null, messageType, JSON.stringify({ quotedMessageId: resolvedQuotedMessageId }), stored?.storagePath || null, stored?.mime || null, stored?.filename || null, stored?.size || null, resolvedQuotedMessageId, stored ? 'ready' : null, result.externalMessageId]);
    await connection.execute('UPDATE conversations SET last_message_at = UTC_TIMESTAMP(), last_outbound_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversation.id]);
  } catch (error) {
    if (stored?.storagePath) await removeMedia(stored.storagePath).catch(() => {});
    throw error;
  }
  const [messageRows] = await connection.execute('SELECT id, provider_message_id FROM communication_messages WHERE idempotency_key = ? LIMIT 1', [idempotencyKey]);
  return { ...result, communicationMessageId: Number(messageRows[0]?.id || 0) || null, providerMessageId: messageRows[0]?.provider_message_id || result.externalMessageId || null, conversationId: Number(conversation.id), recipient: phone };
}

async function sendWhatsAppMessage(connection, options) { return sendWhatsAppContent(connection, { ...options, messageType: 'text' }); }

async function sendWhatsAppMedia(connection, options) { return sendWhatsAppContent(connection, options); }

module.exports = { normalizePhone, resolveWhatsAppDestination, formatWhatsAppParticipantPhone, extractInbound, participantContractSummary, extractDeliveryStatus, deliveryUpdates, updateDeliveryReceipt, loadEvolutionConfig, findOrCreateLead, processWebhookEvent, processPendingWhatsAppEvents, sendWhatsAppMessage, sendWhatsAppMedia, sendWhatsAppContent };
