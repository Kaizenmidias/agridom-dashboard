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
    if (req.query.search) { where.push('(p.business_name LIKE ? OR p.phone LIKE ? OR p.normalized_phone LIKE ?)'); const search = `%${String(req.query.search).slice(0, 100)}%`; params.push(search, search, search); }
    const [rows] = await getPool().execute(`SELECT c.*, p.business_name AS lead_name, p.phone AS lead_phone, ca.name AS account_name, ca.phone_number AS account_phone FROM conversations c JOIN communication_accounts ca ON ca.id = c.communication_account_id LEFT JOIN prospects p ON p.id = c.lead_id WHERE ${where.join(' AND ')} ORDER BY c.last_message_at DESC, c.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({ conversations: rows.map((row) => ({ ...row, id: Number(row.id), leadId: row.lead_id ? Number(row.lead_id) : null, accountId: Number(row.communication_account_id), unreadCount: Number(row.unread_count) })) , page, limit });
  } catch { res.status(500).json({ error: 'Nao foi possivel carregar as conversas.' }); }
});

router.get('/:id', async (req, res) => {
  try { const [rows] = await getPool().execute('SELECT c.*, p.business_name AS lead_name, p.phone AS lead_phone, p.email AS lead_email, ca.name AS account_name, ca.phone_number AS account_phone FROM conversations c JOIN communication_accounts ca ON ca.id = c.communication_account_id LEFT JOIN prospects p ON p.id = c.lead_id WHERE c.id = ?', [req.params.id]); if (!rows[0]) return res.status(404).json({ error: 'Conversa nao encontrada.' }); res.json(rows[0]); }
  catch { res.status(500).json({ error: 'Nao foi possivel carregar a conversa.' }); }
});

router.get('/:id/messages', async (req, res) => {
  try { const limit = parsePage(req.query.limit, 100, 200); const [rows] = await getPool().execute('SELECT * FROM communication_messages WHERE conversation_id = ? ORDER BY created_at DESC, id DESC LIMIT ?', [req.params.id, limit]); res.json({ messages: rows.reverse() }); }
  catch { res.status(500).json({ error: 'Nao foi possivel carregar as mensagens.' }); }
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
    catch (error) { await connection.rollback(); res.status(error?.retryable === false ? 409 : 502).json({ error: error?.publicMessage || 'Nao foi possivel enviar a mensagem.' }); }
    finally { connection.release(); }
  } catch { res.status(500).json({ error: 'Nao foi possivel enviar a mensagem.' }); }
});

module.exports = router;
