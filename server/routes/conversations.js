const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess } = require('../middleware/commercial-access');
const { getPool } = require('../config/database');
const { sendWhatsAppMessage } = require('../services/whatsapp-service');

const router = express.Router();
router.use(authenticateToken, requireCommercialAccess);
const parsePage = (value, fallback, max) => Math.min(Math.max(Number(value) || fallback, 1), max);

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
    if (req.query.search) { where.push('(p.business_name LIKE ? OR p.phone LIKE ? OR p.normalized_phone LIKE ? OR p.email LIKE ? OR EXISTS (SELECT 1 FROM communication_messages sm WHERE sm.conversation_id = c.id AND sm.body_text LIKE ?))'); const search = `%${String(req.query.search).slice(0, 100)}%`; params.push(search, search, search, search, search); }
    const [rows] = await getPool().execute(`SELECT c.*, p.business_name AS lead_name, p.phone AS lead_phone, p.email AS lead_email, p.website AS lead_website, p.status AS lead_status, p.origin AS lead_origin, ca.name AS account_name, ca.phone_number AS account_phone, u.name AS assigned_user_name, (SELECT sm.body_text FROM communication_messages sm WHERE sm.conversation_id = c.id ORDER BY sm.created_at DESC, sm.id DESC LIMIT 1) AS last_message_text, (SELECT sm.direction FROM communication_messages sm WHERE sm.conversation_id = c.id ORDER BY sm.created_at DESC, sm.id DESC LIMIT 1) AS last_message_direction FROM conversations c JOIN communication_accounts ca ON ca.id = c.communication_account_id LEFT JOIN prospects p ON p.id = c.lead_id LEFT JOIN users u ON u.id = c.assigned_user_id WHERE ${where.join(' AND ')} ORDER BY c.last_message_at DESC, c.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ conversations: rows.map((row) => ({ ...row, id: Number(row.id), leadId: row.lead_id ? Number(row.lead_id) : null, accountId: Number(row.communication_account_id), unreadCount: Number(row.unread_count) })) , page, limit });
  } catch { res.status(500).json({ error: 'Nao foi possivel carregar as conversas.' }); }
});

router.get('/:id', async (req, res) => {
  try { const [rows] = await getPool().execute('SELECT c.*, p.business_name AS lead_name, p.phone AS lead_phone, p.email AS lead_email, p.website AS lead_website, p.city AS lead_city, p.state AS lead_state, p.origin AS lead_origin, p.status AS lead_status, p.category AS lead_category, p.created_at AS lead_created_at, ca.name AS account_name, ca.phone_number AS account_phone, u.name AS assigned_user_name, u.email AS assigned_user_email FROM conversations c JOIN communication_accounts ca ON ca.id = c.communication_account_id LEFT JOIN prospects p ON p.id = c.lead_id LEFT JOIN users u ON u.id = c.assigned_user_id WHERE c.id = ?', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Conversa nao encontrada.' }); res.json({ ...rows[0], id: Number(rows[0].id), unreadCount: Number(rows[0].unread_count) }); }
  catch { res.status(500).json({ error: 'Nao foi possivel carregar a conversa.' }); }
});

router.get('/:id/messages', async (req, res) => {
  try { const limit = parsePage(req.query.limit, 100, 200); const [rows] = await getPool().execute('SELECT * FROM communication_messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT ?', [req.params.id, limit + 1]); const hasMore = rows.length > limit; res.json({ messages: rows.slice(0, limit).reverse(), hasMore }); }
  catch { res.status(500).json({ error: 'Nao foi possivel carregar as mensagens.' }); }
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

router.post('/:id/messages', async (req, res) => {
  if (String(req.body?.type || 'text') !== 'text') return res.status(400).json({ error: 'Apenas mensagens de texto estao disponiveis nesta fase.' });
  const text = String(req.body?.text || '').trim();
  if (!text || text.length > 10000) return res.status(400).json({ error: 'Texto obrigatorio com no maximo 10000 caracteres.' });
  try {
    const [rows] = await getPool().execute('SELECT c.*, ca.provider AS account_provider, ca.name AS account_name, ca.external_instance_id, ca.phone_number, ca.status AS account_status, ca.integration_provider_id, ca.owner_user_id, ca.archived_at FROM conversations c JOIN communication_accounts ca ON ca.id = c.communication_account_id WHERE c.id = ? AND ca.archived_at IS NULL LIMIT 1', [req.params.id]);
    const conversation = rows[0]; if (!conversation) return res.status(404).json({ error: 'Conversa nao encontrada.' });
    const connection = await getPool().getConnection();
    try { await connection.beginTransaction(); const result = await sendWhatsAppMessage(connection, { account: conversation, leadId: conversation.lead_id, recipient: conversation.external_conversation_id, text, idempotencyKey: `manual:conversation:${conversation.id}:${req.get('Idempotency-Key') || `${Date.now()}:${req.userId}`}`, ownerUserId: req.userId }); await connection.commit(); res.status(201).json(result); }
    catch (error) {
      await connection.rollback();
      const responseStatus = error?.retryable === false ? 409 : 502;
      const errorCode = String(error?.code || 'WHATSAPP_SEND_FAILED').replace(/[^A-Z0-9_]/g, '_').slice(0, 80);
      console.error('[WhatsApp] envio de mensagem falhou', {
        conversationId: Number(conversation.id),
        communicationAccountId: Number(conversation.communication_account_id),
        provider: String(conversation.account_provider || 'unknown'),
        operation: 'send_text',
        httpStatus: responseStatus,
        providerStatus: error?.providerStatus || null,
        errorCode
      });
      res.status(responseStatus).json({ error: error?.publicMessage || 'Nao foi possivel enviar a mensagem.', code: errorCode });
    }
    finally { connection.release(); }
  } catch { res.status(500).json({ error: 'Nao foi possivel enviar a mensagem.' }); }
});

module.exports = router;
