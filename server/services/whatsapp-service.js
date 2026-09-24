const crypto = require('node:crypto');
const { getPool } = require('../config/database');
const { decryptSecret } = require('./integration-crypto');
const { dispatchDomainEvent } = require('./domain-events');
const { EvolutionWhatsAppProvider, providerError } = require('./evolution-whatsapp-provider');

const parseJson = (value, fallback = {}) => {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(value || JSON.stringify(fallback)); } catch { return fallback; }
};

function normalizePhone(value) {
  const raw = String(value || '').trim().replace(/@s\.whatsapp\.net$/i, '').replace(/\D/g, '');
  if (!raw) return null;
  if (raw.startsWith('55') && (raw.length === 12 || raw.length === 13)) return raw;
  if ((raw.length === 10 || raw.length === 11) && !raw.startsWith('0')) return `55${raw}`;
  return raw;
}

function phoneCandidates(normalized) {
  if (!normalized) return [];
  const candidates = [normalized];
  if (normalized.startsWith('55')) candidates.push(normalized.slice(2));
  return [...new Set(candidates)];
}

function extractText(message) {
  return message?.conversation || message?.extendedTextMessage?.text || message?.buttonsResponseMessage?.selectedDisplayText || message?.listResponseMessage?.title || null;
}

function extractInbound(payload) {
  const data = payload?.data || payload;
  const key = data?.key || {};
  const remoteJid = String(key.remoteJid || data?.remoteJid || '');
  const externalMessageId = String(key.id || data?.id || '').trim();
  const isGroup = remoteJid.endsWith('@g.us');
  const isBroadcast = remoteJid.endsWith('@broadcast') || remoteJid === 'status@broadcast';
  const fromMe = Boolean(key.fromMe || data?.fromMe);
  const timestamp = Number(data?.messageTimestamp || data?.timestamp || 0);
  return { remoteJid, externalMessageId, externalSenderId: remoteJid, phone: normalizePhone(remoteJid), fromMe, isGroup, isBroadcast, text: extractText(data?.message || data), messageType: extractText(data?.message || data) ? 'text' : 'unsupported', occurredAt: timestamp > 0 ? new Date(timestamp * 1000) : new Date(), pushName: String(data?.pushName || data?.sender?.pushName || '').trim() || null };
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

async function getOrCreateConversation(connection, account, externalConversationId, leadId, direction, occurredAt) {
  await connection.execute(`INSERT INTO conversations (channel, communication_account_id, lead_id, external_conversation_id, last_message_at, last_inbound_at, last_outbound_at, unread_count) VALUES ('whatsapp', ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE lead_id = COALESCE(VALUES(lead_id), lead_id), last_message_at = GREATEST(COALESCE(last_message_at, VALUES(last_message_at)), VALUES(last_message_at)), last_inbound_at = IF(VALUES(last_inbound_at) IS NULL, last_inbound_at, VALUES(last_inbound_at)), last_outbound_at = IF(VALUES(last_outbound_at) IS NULL, last_outbound_at, VALUES(last_outbound_at)), unread_count = unread_count + VALUES(unread_count), updated_at = CURRENT_TIMESTAMP`, [account.id, leadId, externalConversationId, occurredAt, direction === 'inbound' ? occurredAt : null, direction === 'outbound' ? occurredAt : null, direction === 'inbound' ? 1 : 0]);
  const [rows] = await connection.execute('SELECT * FROM conversations WHERE communication_account_id = ? AND external_conversation_id = ? FOR UPDATE', [account.id, externalConversationId]);
  return rows[0];
}

async function persistMessage(connection, { account, conversation, lead, event, direction, text, externalMessageId, externalSenderId, messageType, occurredAt, metadata = {} }) {
  if (!externalMessageId) return { duplicate: false, id: null };
  const [existing] = await connection.execute('SELECT id FROM communication_messages WHERE communication_account_id = ? AND external_message_id = ? LIMIT 1', [account.id, externalMessageId]);
  if (existing[0]) return { duplicate: true, id: Number(existing[0].id) };
  const [result] = await connection.execute(`INSERT INTO communication_messages (channel, direction, lead_id, conversation_id, communication_account_id, external_message_id, external_sender_id, recipient, body_text, message_type, delivery_status, metadata, status, provider, created_at, sent_at) VALUES ('whatsapp', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent', 'evolution', ?, ?)` , [direction, lead?.id || null, conversation.id, account.id, externalMessageId, externalSenderId || null, direction === 'inbound' ? account.phone_number || '' : lead?.phone || '', text || null, messageType || 'text', direction === 'inbound' ? 'received' : 'sent', JSON.stringify(metadata), occurredAt, direction === 'outbound' ? occurredAt : null]);
  return { duplicate: false, id: Number(result.insertId) };
}

async function processWebhookEvent(connection, event) {
  const account = event.communication_account_id ? (await connection.execute('SELECT * FROM communication_accounts WHERE id = ? AND archived_at IS NULL FOR UPDATE', [event.communication_account_id]))[0][0] : null;
  if (!account) throw new Error('WHATSAPP_ACCOUNT_NOT_FOUND');
  const parsed = extractInbound(parseJson(event.payload));
  if (!parsed.externalMessageId || parsed.isGroup || parsed.isBroadcast || !parsed.phone) return { ignored: true, reason: parsed.isGroup ? 'group' : parsed.isBroadcast ? 'broadcast' : 'missing_sender' };
  const lead = await findOrCreateLead(connection, account, parsed.phone, parsed.pushName);
  const direction = parsed.fromMe ? 'outbound' : 'inbound';
  const conversation = await getOrCreateConversation(connection, account, parsed.remoteJid, lead?.id || null, direction, parsed.occurredAt);
  const message = await persistMessage(connection, { account, conversation, lead, event, direction, text: parsed.text, externalMessageId: parsed.externalMessageId, externalSenderId: parsed.externalSenderId, messageType: parsed.messageType, occurredAt: parsed.occurredAt, metadata: { pushName: parsed.pushName, fromMe: parsed.fromMe, eventType: event.event_type } });
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

async function sendWhatsAppMessage(connection, { account, leadId, recipient, text, idempotencyKey, automationId = null, runId = null, stepId = null, ownerUserId = null }) {
  const phone = normalizePhone(recipient);
  if (!phone) throw Object.assign(new Error('RECIPIENT_PHONE_MISSING'), { code: 'RECIPIENT_PHONE_MISSING', retryable: false, publicMessage: 'Telefone do destinatario nao informado.' });
  if (account.status !== 'connected') throw Object.assign(new Error('WHATSAPP_ACCOUNT_NOT_CONNECTED'), { code: 'WHATSAPP_ACCOUNT_NOT_CONNECTED', retryable: false, publicMessage: 'A conta WhatsApp nao esta conectada.' });
  const [existing] = await connection.execute('SELECT * FROM communication_messages WHERE idempotency_key = ? FOR UPDATE', [idempotencyKey]);
  if (existing[0]?.status === 'sent') return { idempotent: true, messageId: existing[0].provider_message_id, conversationId: existing[0].conversation_id };
  const [leadRows] = await connection.execute('SELECT * FROM prospects WHERE id = ? LIMIT 1', [leadId || 0]);
  const lead = leadRows[0] || null;
  const conversation = await getOrCreateConversation(connection, account, `${phone}@s.whatsapp.net`, lead?.id || null, 'outbound', new Date());
  const { provider } = await loadEvolutionConfig(connection, account);
  const result = await provider.sendText(account.external_instance_id, phone, text);
  await connection.execute(`INSERT INTO communication_messages (channel, direction, lead_id, automation_id, automation_run_id, automation_step_id, conversation_id, communication_account_id, idempotency_key, recipient, body_text, message_type, delivery_status, status, provider, provider_message_id, sent_at) VALUES ('whatsapp', 'outbound', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'text', 'sent', 'sent', 'evolution', ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE status = 'sent', provider_message_id = VALUES(provider_message_id), sent_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP`, [lead?.id || null, automationId, runId, stepId, conversation.id, account.id, idempotencyKey, phone, text, result.externalMessageId]);
  await connection.execute('UPDATE conversations SET last_message_at = UTC_TIMESTAMP(), last_outbound_at = UTC_TIMESTAMP(), updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversation.id]);
  return { ...result, conversationId: Number(conversation.id), recipient: phone };
}

module.exports = { normalizePhone, extractInbound, loadEvolutionConfig, findOrCreateLead, processWebhookEvent, processPendingWhatsAppEvents, sendWhatsAppMessage };
