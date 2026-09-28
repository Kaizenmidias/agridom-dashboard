const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess } = require('../middleware/commercial-access');
const { getPool } = require('../config/database');
const { sendWhatsAppMessage, sendWhatsAppMedia, loadEvolutionConfig } = require('../services/whatsapp-service');
const { sendFile, LIMITS } = require('../services/chat-media');

const router = express.Router();
router.use(authenticateToken, requireCommercialAccess);
const parsePage = (value, fallback, max) => Math.min(Math.max(Number(value) || fallback, 1), max);
const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Math.max(...Object.values(LIMITS)) } });
const profileRefreshes = new Map();
const PROFILE_TTL_HOURS = 12;
const validProfilePictureUrl = (value) => {
  try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
};
const safeProviderError = (error) => ({ providerStatus: error?.providerStatus || null, errorCode: String(error?.code || 'PROFILE_REFRESH_FAILED').replace(/[^A-Z0-9_]/gi, '_').slice(0, 80) });
const normalizeParticipants = (value) => {
  const list = Array.isArray(value) ? value : [];
  return list.slice(0, 256).map((participant, index) => {
    const externalId = String(participant?.id || participant?.jid || participant?.participant || '').trim().slice(0, 191);
    const name = String(participant?.name || participant?.notify || participant?.pushName || '').trim().slice(0, 191) || `Participante ${index + 1}`;
    const role = participant?.admin === 'superadmin' ? 'superadmin' : participant?.admin === 'admin' ? 'admin' : 'participant';
    return { externalId, name, role };
  }).filter((participant) => participant.externalId);
};

router.get('/', async (req, res) => {
  try {
    const page = parsePage(req.query.page, 1, 10000);
    const limit = parsePage(req.query.limit, 30, 100);
    const offset = (page - 1) * limit;
    const params = [];
    const where = ['c.channel = ?']; params.push(String(req.query.channel || 'whatsapp'));
    if (req.query.status) { where.push('c.status = ?'); params.push(String(req.query.status)); }
    if (req.query.assignedUserId) { where.push('c.assigned_user_id = ?'); params.push(Number(req.query.assignedUserId)); }
    if (req.query.handlingMode) { where.push('c.handling_mode = ?'); params.push(String(req.query.handlingMode)); }
    if (req.query.unread === 'true') where.push('c.unread_count > 0');
    if (req.query.search) { where.push('(c.display_name LIKE ? OR p.business_name LIKE ? OR p.phone LIKE ? OR p.normalized_phone LIKE ? OR p.email LIKE ? OR EXISTS (SELECT 1 FROM communication_messages sm WHERE sm.conversation_id = c.id AND sm.body_text LIKE ?))'); const search = `%${String(req.query.search).slice(0, 100)}%`; params.push(search, search, search, search, search, search); }
    const [rows] = await getPool().execute(`SELECT c.*, (c.profile_picture_updated_at IS NULL OR c.profile_picture_updated_at < UTC_TIMESTAMP() - INTERVAL ${PROFILE_TTL_HOURS} HOUR) AS profile_picture_stale, p.business_name AS lead_name, p.phone AS lead_phone, p.email AS lead_email, p.website AS lead_website, p.status AS lead_status, p.origin AS lead_origin, ca.name AS account_name, ca.phone_number AS account_phone, u.name AS assigned_user_name, (SELECT sm.body_text FROM communication_messages sm WHERE sm.conversation_id = c.id ORDER BY sm.created_at DESC, sm.id DESC LIMIT 1) AS last_message_text, (SELECT sm.message_type FROM communication_messages sm WHERE sm.conversation_id = c.id ORDER BY sm.created_at DESC, sm.id DESC LIMIT 1) AS last_message_type, (SELECT sm.direction FROM communication_messages sm WHERE sm.conversation_id = c.id ORDER BY sm.created_at DESC, sm.id DESC LIMIT 1) AS last_message_direction FROM conversations c JOIN communication_accounts ca ON ca.id = c.communication_account_id LEFT JOIN prospects p ON p.id = c.lead_id LEFT JOIN users u ON u.id = c.assigned_user_id WHERE ${where.join(' AND ')} ORDER BY c.last_message_at DESC, c.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ conversations: rows.map((row) => ({ ...row, id: Number(row.id), leadId: row.lead_id ? Number(row.lead_id) : null, accountId: Number(row.communication_account_id), unreadCount: Number(row.unread_count) })) , page, limit });
  } catch { res.status(500).json({ error: 'Nao foi possivel carregar as conversas.' }); }
});

router.get('/:id', async (req, res) => {
  try { const [rows] = await getPool().execute(`SELECT c.*, (c.profile_picture_updated_at IS NULL OR c.profile_picture_updated_at < UTC_TIMESTAMP() - INTERVAL ${PROFILE_TTL_HOURS} HOUR) AS profile_picture_stale, p.business_name AS lead_name, p.phone AS lead_phone, p.email AS lead_email, p.website AS lead_website, p.city AS lead_city, p.state AS lead_state, p.origin AS lead_origin, p.status AS lead_status, p.category AS lead_category, p.created_at AS lead_created_at, JSON_UNQUOTE(JSON_EXTRACT(p.analysis_report, '$.budget')) AS lead_budget, ca.name AS account_name, ca.phone_number AS account_phone, u.name AS assigned_user_name, u.email AS assigned_user_email FROM conversations c JOIN communication_accounts ca ON ca.id = c.communication_account_id LEFT JOIN prospects p ON p.id = c.lead_id LEFT JOIN users u ON u.id = c.assigned_user_id WHERE c.id = ?`, [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Conversa nao encontrada.' }); const [labels] = rows[0].lead_id ? await getPool().execute('SELECT ll.id, ll.name, ll.color FROM prospect_labels pl JOIN lead_labels ll ON ll.id = pl.label_id WHERE pl.prospect_id = ? ORDER BY ll.name', [rows[0].lead_id]) : [[]]; res.json({ ...rows[0], id: Number(rows[0].id), unreadCount: Number(rows[0].unread_count), lead_labels: labels }); }
  catch { res.status(500).json({ error: 'Nao foi possivel carregar a conversa.' }); }
});

router.post('/:id/profile/refresh', async (req, res) => {
  const rateKey = `${req.userId}:${req.params.id}`;
  const previous = profileRefreshes.get(rateKey) || 0;
  if (Date.now() - previous < 10000) return res.status(429).json({ error: 'Aguarde alguns segundos antes de atualizar novamente.' });
  profileRefreshes.set(rateKey, Date.now());
  try {
    const [rows] = await getPool().execute(`SELECT c.*, ca.external_instance_id, ca.integration_provider_id FROM conversations c JOIN communication_accounts ca ON ca.id = c.communication_account_id AND ca.archived_at IS NULL WHERE c.id = ? LIMIT 1`, [req.params.id]);
    const conversation = rows[0];
    if (!conversation) return res.status(404).json({ error: 'Conversa nao encontrada.' });
    const fresh = conversation.profile_picture_updated_at && Date.now() - new Date(conversation.profile_picture_updated_at).getTime() < PROFILE_TTL_HOURS * 60 * 60 * 1000;
    if (fresh && req.body?.force !== true) {
      const [participantRows] = conversation.conversation_type === 'group' ? await getPool().execute('SELECT display_name, participant_role FROM conversation_participants WHERE conversation_id = ? ORDER BY display_name, id', [conversation.id]) : [[]];
      return res.json({ profilePictureUrl: conversation.profile_picture_url || null, displayName: conversation.display_name || null, participantCount: conversation.participant_count == null ? null : Number(conversation.participant_count), participants: participantRows.map((participant) => ({ name: participant.display_name || 'Participante', role: participant.participant_role === 'superadmin' ? 'Criador' : participant.participant_role === 'admin' ? 'Administrador' : 'Participante' })), cached: true });
    }
    const { provider } = await loadEvolutionConfig(getPool(), conversation);
    let profilePictureUrl = null;
    let displayName = conversation.display_name || null;
    let participantCount = conversation.participant_count == null ? null : Number(conversation.participant_count);
    let participants = [];
    if (conversation.conversation_type === 'group') {
      const group = await provider.findGroup(conversation.external_instance_id, conversation.external_conversation_id);
      try {
        const picture = await provider.fetchProfilePicture(conversation.external_instance_id, conversation.external_conversation_id);
        profilePictureUrl = validProfilePictureUrl(picture.profilePictureUrl) || validProfilePictureUrl(group.profilePictureUrl);
      } catch (error) {
        console.warn('[WhatsApp] avatar de grupo indisponivel', { conversationId: Number(conversation.id), operation: 'group_profile_picture', ...safeProviderError(error) });
        profilePictureUrl = validProfilePictureUrl(group.profilePictureUrl);
      }
      displayName = group.name || displayName;
      let groupParticipants = [];
      try {
        groupParticipants = await provider.findGroupParticipants(conversation.external_instance_id, conversation.external_conversation_id);
      } catch (error) {
        console.warn('[WhatsApp] participantes do grupo indisponiveis', { conversationId: Number(conversation.id), operation: 'group_participants', ...safeProviderError(error) });
      }
      const normalizedParticipants = normalizeParticipants(groupParticipants);
      participantCount = normalizedParticipants.length;
      participants = normalizedParticipants.map((participant) => ({ name: participant.name || 'Participante', role: participant.role === 'superadmin' ? 'Criador' : participant.role === 'admin' ? 'Administrador' : 'Participante' }));
      await getPool().execute('DELETE FROM conversation_participants WHERE conversation_id = ?', [conversation.id]);
      for (const participant of normalizedParticipants) await getPool().execute('INSERT INTO conversation_participants (conversation_id, external_participant_id, display_name, participant_role) VALUES (?, ?, ?, ?)', [conversation.id, participant.externalId, participant.name, participant.role]);
    } else {
      const number = String(conversation.external_conversation_id || '').split('@')[0].split(':')[0];
      const profile = await provider.fetchProfilePicture(conversation.external_instance_id, number);
      profilePictureUrl = validProfilePictureUrl(profile.profilePictureUrl);
    }
    await getPool().execute('UPDATE conversations SET display_name = ?, profile_picture_url = ?, profile_picture_updated_at = UTC_TIMESTAMP(), participant_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [displayName, profilePictureUrl, participantCount, conversation.id]);
    res.json({ profilePictureUrl, displayName, participantCount, participants, cached: false });
  } catch (error) { console.warn('[WhatsApp] atualizacao de perfil indisponivel', { conversationId: Number(req.params.id), operation: 'profile_refresh', ...safeProviderError(error) }); res.json({ profilePictureUrl: null, displayName: null, participantCount: null, participants: [], unavailable: true }); }
});

router.get('/:id/messages', async (req, res) => {
  try { const limit = parsePage(req.query.limit, 40, 100); const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null; const params = [req.params.id]; const before = beforeId ? ' AND id < ?' : ''; if (beforeId) params.push(beforeId); params.push(limit + 1); const [rows] = await getPool().execute(`SELECT * FROM communication_messages WHERE conversation_id = ?${before} ORDER BY created_at DESC, id DESC LIMIT ?`, params); const hasMore = rows.length > limit; res.json({ messages: rows.slice(0, limit).reverse(), hasMore }); }
  catch { res.status(500).json({ error: 'Nao foi possivel carregar as mensagens.' }); }
});

router.get('/:id/messages/search', async (req, res) => {
  const term = String(req.query.q || '').trim().slice(0, 100);
  const limit = parsePage(req.query.limit, 20, 50);
  const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
  if (term.length < 2) return res.status(400).json({ error: 'Informe ao menos dois caracteres para pesquisar.' });
  try {
    const like = `%${term}%`;
    const params = [req.params.id, like];
    const before = beforeId ? ' AND id < ?' : '';
    if (beforeId) params.push(beforeId);
    params.push(limit + 1);
    const [rows] = await getPool().execute(`SELECT * FROM communication_messages WHERE conversation_id = ? AND body_text LIKE ?${before} ORDER BY id DESC LIMIT ?`, params);
    const [countRows] = await getPool().execute('SELECT COUNT(*) AS total FROM communication_messages WHERE conversation_id = ? AND body_text LIKE ?', [req.params.id, like]);
    const hasMore = rows.length > limit;
    res.json({ messages: rows.slice(0, limit), total: Number(countRows[0]?.total || 0), hasMore });
  } catch { res.status(500).json({ error: 'Nao foi possivel pesquisar nesta conversa.' }); }
});

router.get('/:id/shared', async (req, res) => {
  const type = String(req.query.type || 'media');
  const limit = parsePage(req.query.limit, 24, 50);
  const beforeId = req.query.beforeId ? Number(req.query.beforeId) : null;
  if (!['media', 'documents', 'links'].includes(type)) return res.status(400).json({ error: 'Tipo de conteudo compartilhado invalido.' });
  try {
    const [conversations] = await getPool().execute('SELECT id FROM conversations WHERE id = ? LIMIT 1', [req.params.id]);
    if (!conversations[0]) return res.status(404).json({ error: 'Conversa nao encontrada.' });
    const params = [req.params.id];
    const before = beforeId ? ' AND id < ?' : '';
    if (beforeId) params.push(beforeId);
    params.push(limit + 1);
    if (type === 'links') {
      const [rows] = await getPool().execute(`SELECT id, body_text, direction, created_at FROM communication_messages WHERE conversation_id = ? AND body_text REGEXP 'https?://'${before} ORDER BY id DESC LIMIT ?`, params);
      const items = rows.slice(0, limit).flatMap((row) => (String(row.body_text || '').match(/https?:\/\/[^\s<>"']+/gi) || []).slice(0, 10).map((url) => { try { const parsed = new URL(url); return { id: Number(row.id), url: parsed.toString(), domain: parsed.hostname, excerpt: String(row.body_text).slice(0, 240), direction: row.direction, created_at: row.created_at }; } catch { return null; } }).filter(Boolean));
      return res.json({ items, hasMore: rows.length > limit });
    }
    const messageTypes = type === 'media' ? ['image', 'video'] : ['document'];
    const [rows] = await getPool().execute(`SELECT id, direction, body_text, message_type, media_mime_type, media_filename, media_size_bytes, media_duration_seconds, media_width, media_height, created_at FROM communication_messages WHERE conversation_id = ? AND message_type IN (${messageTypes.map(() => '?').join(',')})${before} ORDER BY id DESC LIMIT ?`, [req.params.id, ...messageTypes, ...(beforeId ? [beforeId] : []), limit + 1]);
    res.json({ items: rows.slice(0, limit), hasMore: rows.length > limit });
  } catch { res.status(500).json({ error: 'Nao foi possivel carregar os conteudos compartilhados.' }); }
});

router.get('/:id/messages/:messageId/media', async (req, res) => {
  try {
    const [rows] = await getPool().execute('SELECT cm.* FROM communication_messages cm JOIN conversations c ON c.id = cm.conversation_id WHERE cm.id = ? AND cm.conversation_id = ? LIMIT 1', [req.params.messageId, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Mensagem nao encontrada.' });
    if (!rows[0].media_storage_path) return res.status(404).json({ error: 'Arquivo de midia nao disponivel.' });
    return sendFile(req, res, rows[0]);
  } catch (error) { return res.status(error?.code === 'MEDIA_PATH_INVALID' ? 400 : 404).json({ error: 'Arquivo de midia nao encontrado.' }); }
});

router.patch('/:id/read', async (req, res) => {
  try { const [result] = await getPool().execute('UPDATE conversations SET unread_count = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]); if (!result.affectedRows) return res.status(404).json({ error: 'Conversa nao encontrada.' }); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'Nao foi possivel marcar a conversa como lida.' }); }
});

router.patch('/:id/handling', async (req, res) => {
  const mode = String(req.body?.handling_mode || '').trim();
  if (!['human', 'ai', 'paused'].includes(mode)) return res.status(400).json({ error: 'Modo de atendimento invalido.' });
  try {
    const [rows] = await getPool().execute('SELECT * FROM conversations WHERE id = ?', [req.params.id]);
    const conversation = rows[0]; if (!conversation) return res.status(404).json({ error: 'Conversa nao encontrada.' });
    if (mode === 'ai' && !conversation.ai_agent_id) return res.status(409).json({ error: 'Nenhum agente de IA configurado para esta conversa.' });
    await getPool().execute('UPDATE conversations SET handling_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [mode, req.params.id]);
    if (conversation.lead_id) await getPool().execute('INSERT INTO lead_activities (prospect_id, type, title, description, assigned_user_id, created_by) VALUES (?, \'activity\', ?, ?, ?, ?)', [conversation.lead_id, mode === 'human' ? 'Atendimento assumido' : mode === 'ai' ? 'Atendimento devolvido para IA' : 'Atendimento pausado', `Modo alterado para ${mode}.`, conversation.assigned_user_id || req.userId, req.userId]);
    res.json({ success: true, handling_mode: mode });
  } catch { res.status(500).json({ error: 'Nao foi possivel alterar o modo de atendimento.' }); }
});

router.patch('/:id/assignment', async (req, res) => {
  const assignedUserId = req.body?.assigned_user_id == null ? null : Number(req.body.assigned_user_id);
  if (assignedUserId !== null && (!Number.isInteger(assignedUserId) || assignedUserId < 1)) return res.status(400).json({ error: 'Responsavel invalido.' });
  try {
    if (assignedUserId !== null) { const [users] = await getPool().execute("SELECT id FROM users WHERE id = ? AND is_active = 1 AND (can_access_crm = 1 OR LOWER(role) IN ('admin', 'administrator', 'administrador'))", [assignedUserId]); if (!users[0]) return res.status(400).json({ error: 'Responsavel nao encontrado ou sem acesso ao CRM.' }); }
    const [result] = await getPool().execute('UPDATE conversations SET assigned_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [assignedUserId, req.params.id]); if (!result.affectedRows) return res.status(404).json({ error: 'Conversa nao encontrada.' });
    res.json({ success: true, assigned_user_id: assignedUserId });
  } catch { res.status(500).json({ error: 'Nao foi possivel atribuir a conversa.' }); }
});

router.get('/:id/activities', async (req, res) => {
  try { const [rows] = await getPool().execute('SELECT la.*, u.name AS actor_name FROM lead_activities la LEFT JOIN users u ON u.id = la.created_by JOIN conversations c ON c.lead_id = la.prospect_id WHERE c.id = ? ORDER BY la.created_at DESC LIMIT 50', [req.params.id]); res.json({ activities: rows }); }
  catch { res.status(500).json({ error: 'Nao foi possivel carregar a timeline.' }); }
});

const parseMessageUpload = (req, res, next) => mediaUpload.single('file')(req, res, (error) => {
  if (!error) return next();
  return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Este arquivo e muito grande.' : 'Nao foi possivel receber o arquivo.', code: error.code || 'MEDIA_UPLOAD_FAILED' });
});

router.post('/:id/messages', parseMessageUpload, async (req, res) => {
  const requestedType = String(req.body?.type || 'text');
  if (!['text', 'image', 'audio', 'video', 'document'].includes(requestedType)) return res.status(400).json({ error: 'Tipo de mensagem nao suportado.', code: 'MESSAGE_TYPE_NOT_SUPPORTED' });
  const text = String(req.body?.text || '').trim();
  if (requestedType === 'text' && (!text || text.length > 10000)) return res.status(400).json({ error: 'Texto obrigatorio com no maximo 10000 caracteres.' });
  return handleMessageSend(req, res, requestedType, text);
});

async function handleMessageSend(req, res, requestedType, text) {
  try {
    const [rows] = await getPool().execute('SELECT c.*, ca.provider AS account_provider, ca.name AS account_name, ca.external_instance_id, ca.phone_number, ca.status AS account_status, ca.integration_provider_id, ca.owner_user_id, ca.archived_at FROM conversations c JOIN communication_accounts ca ON ca.id = c.communication_account_id WHERE c.id = ? AND ca.archived_at IS NULL LIMIT 1', [req.params.id]);
    const conversation = rows[0]; if (!conversation) return res.status(404).json({ error: 'Conversa nao encontrada.' });
    const connection = await getPool().getConnection();
    try { await connection.beginTransaction(); const options = { account: conversation, leadId: conversation.lead_id, recipient: conversation.external_conversation_id, text, idempotencyKey: `manual:conversation:${conversation.id}:${req.get('Idempotency-Key') || `${Date.now()}:${req.userId}`}`, ownerUserId: req.userId, quotedMessageId: req.body?.quotedMessageId ? Number(req.body.quotedMessageId) : null }; const result = requestedType === 'text' ? await sendWhatsAppMessage(connection, options) : await sendWhatsAppMedia(connection, { ...options, messageType: requestedType, file: req.file, mimeType: req.file?.mimetype, filename: req.file?.originalname, caption: String(req.body?.caption || '').trim() || null }); await connection.commit(); res.status(201).json(result); }
    catch (error) {
      await connection.rollback();
      const isForeignKeyError = error?.code === 'ER_NO_REFERENCED_ROW_2' || error?.errno === 1452;
      const responseStatus = isForeignKeyError ? 500 : error?.retryable === false ? 409 : 502;
      const errorCode = String(error?.code || 'WHATSAPP_SEND_FAILED').replace(/[^A-Z0-9_]/g, '_').slice(0, 80);
      console.error('[WhatsApp] envio de mensagem falhou', {
        conversationId: Number(conversation.id),
        communicationAccountId: Number(conversation.communication_account_id),
        provider: String(conversation.account_provider || 'unknown'),
            operation: requestedType === 'text' ? 'send_text' : 'send_media',
        messageType: requestedType,
        direction: 'outbound',
        context: isForeignKeyError ? 'communication_messages' : 'message_send',
        databaseError: isForeignKeyError ? 'foreign_key_reference' : null,
        httpStatus: responseStatus,
        providerStatus: error?.providerStatus || null,
        providerErrorCode: error?.providerErrorCode || null,
        providerErrorType: error?.providerErrorType || null,
        providerMessage: error?.providerMessage || null,
        errorCode
      });
      res.status(responseStatus).json({ error: error?.publicMessage || 'Nao foi possivel enviar a mensagem.', code: errorCode });
    }
    finally { connection.release(); }
  } catch { res.status(500).json({ error: 'Nao foi possivel enviar a mensagem.' }); }
}

module.exports = router;
