const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess, requireCommercialAdmin } = require('../middleware/commercial-access');
const { getPool } = require('../config/database');
const { dispatchDomainEvent, requestEventContext } = require('../services/domain-events');

const router = express.Router();
router.use(authenticateToken);
router.use(requireCommercialAccess);
const getQuery = (req) => req.app.locals.query;

const parseId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const parseSortOrder = (value) => {
  const order = Number(value);
  return Number.isSafeInteger(order) && order >= 0 ? order : 0;
};

const validColor = (value, fallback = '#4D6EDB') => /^#[0-9A-F]{6}$/i.test(String(value || '')) ? String(value).toUpperCase() : fallback;

const normalizeDateTime = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

async function validAssignableUser(query, userId) {
  if (userId === null) return true;
  const result = await query(
    `SELECT id FROM users
     WHERE id = ? AND is_active = 1
       AND (can_access_crm = 1 OR LOWER(role) IN ('admin', 'administrator', 'administrador'))
     LIMIT 1`,
    [userId]
  );
  return Boolean(result.rows?.length);
}

const defaultStages = ['Qualificados', 'Reuniao', 'Proposta', 'Negociacao', 'Convertidos'];

async function ensureDefaultPipeline(query, userId) {
  let result = await query('SELECT * FROM pipeline_definitions WHERE owner_user_id = ? ORDER BY is_default DESC, id LIMIT 1', [userId]);
  if (result.rows?.length) return result.rows[0];

  const inserted = await query(
    "INSERT INTO pipeline_definitions (owner_user_id, name, is_default) VALUES (?, 'Pipeline Comercial', 1)",
    [userId]
  );
  for (let index = 0; index < defaultStages.length; index += 1) {
    await query(
      'INSERT INTO pipeline_stages (pipeline_id, name, sort_order, is_system) VALUES (?, ?, ?, 1)',
      [inserted.insertId, defaultStages[index], index]
    );
  }
  result = await query('SELECT * FROM pipeline_definitions WHERE id = ?', [inserted.insertId]);
  return result.rows[0];
}

async function ownedPipeline(query, pipelineId, userId) {
  const result = await query('SELECT * FROM pipeline_definitions WHERE id = ? AND owner_user_id = ?', [pipelineId, userId]);
  return result.rows?.[0] || null;
}

router.get('/pipelines', async (req, res) => {
  try {
    const query = getQuery(req);
    await ensureDefaultPipeline(query, req.userId);
    const pipelines = await query('SELECT * FROM pipeline_definitions WHERE owner_user_id = ? ORDER BY is_default DESC, name', [req.userId]);
    const ids = pipelines.rows.map((item) => item.id);
    const stages = ids.length ? await query(`SELECT * FROM pipeline_stages WHERE pipeline_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort_order, id`, ids) : { rows: [] };
    const positions = ids.length ? await query(
      `SELECT pp.* FROM prospect_pipeline_positions pp
       JOIN prospects p ON p.id = pp.prospect_id
       WHERE pp.pipeline_id IN (${ids.map(() => '?').join(',')}) AND p.owner_user_id = ?
       ORDER BY pp.sort_order, pp.id`,
      [...ids, req.userId]
    ) : { rows: [] };
    res.json({ pipelines: pipelines.rows, stages: stages.rows, positions: positions.rows });
  } catch (error) {
    console.error('Erro ao carregar pipelines:', error);
    res.status(500).json({ error: 'Nao foi possivel carregar a Pipeline.' });
  }
});

router.post('/pipelines', requireCommercialAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nome da Pipeline e obrigatorio.' });
    const inserted = await getQuery(req)('INSERT INTO pipeline_definitions (owner_user_id, name, description) VALUES (?, ?, ?)', [req.userId, name, req.body?.description || null]);
    const result = await getQuery(req)('SELECT * FROM pipeline_definitions WHERE id = ?', [inserted.insertId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Nao foi possivel criar a Pipeline.' });
  }
});

router.post('/pipelines/:pipelineId/stages', requireCommercialAdmin, async (req, res) => {
  try {
    const query = getQuery(req);
    const pipelineId = parseId(req.params.pipelineId);
    if (!pipelineId) return res.status(400).json({ error: 'ID da Pipeline invalido.' });
    if (!await ownedPipeline(query, pipelineId, req.userId)) return res.status(404).json({ error: 'Pipeline nao encontrada.' });
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nome da etapa e obrigatorio.' });
    const duplicate = await query('SELECT id FROM pipeline_stages WHERE pipeline_id = ? AND LOWER(name) = LOWER(?) LIMIT 1', [pipelineId, name]);
    if (duplicate.rows?.length) return res.status(409).json({ error: 'Ja existe uma etapa com este nome nesta Pipeline.' });
    const order = await query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM pipeline_stages WHERE pipeline_id = ?', [pipelineId]);
    const inserted = await query('INSERT INTO pipeline_stages (pipeline_id, name, color, sort_order) VALUES (?, ?, ?, ?)', [pipelineId, name, req.body?.color ? validColor(req.body.color, null) : null, order.rows[0].next_order]);
    const result = await query('SELECT * FROM pipeline_stages WHERE id = ?', [inserted.insertId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Nao foi possivel criar a etapa.' });
  }
});

router.patch('/pipeline-stages/:stageId', requireCommercialAdmin, async (req, res) => {
  try {
    const query = getQuery(req);
    const stageId = parseId(req.params.stageId);
    if (!stageId) return res.status(400).json({ error: 'ID da etapa invalido.' });
    const stage = await query(`SELECT ps.* FROM pipeline_stages ps JOIN pipeline_definitions pd ON pd.id = ps.pipeline_id WHERE ps.id = ? AND pd.owner_user_id = ?`, [stageId, req.userId]);
    if (!stage.rows?.length) return res.status(404).json({ error: 'Etapa nao encontrada.' });
    const name = req.body?.name === undefined ? null : String(req.body.name).trim();
    if (req.body?.name !== undefined && !name) return res.status(400).json({ error: 'Nome da etapa e obrigatorio.' });
    if (name) {
      const duplicate = await query('SELECT id FROM pipeline_stages WHERE pipeline_id = ? AND LOWER(name) = LOWER(?) AND id <> ? LIMIT 1', [stage.rows[0].pipeline_id, name, stageId]);
      if (duplicate.rows?.length) return res.status(409).json({ error: 'Ja existe uma etapa com este nome nesta Pipeline.' });
    }
    await query('UPDATE pipeline_stages SET name = COALESCE(?, name), color = COALESCE(?, color), sort_order = COALESCE(?, sort_order) WHERE id = ?', [name, req.body?.color ? validColor(req.body.color, null) : null, req.body?.sort_order === undefined ? null : parseSortOrder(req.body.sort_order), stageId]);
    const result = await query('SELECT * FROM pipeline_stages WHERE id = ?', [stageId]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Nao foi possivel atualizar a etapa.' });
  }
});

router.delete('/pipeline-stages/:stageId', requireCommercialAdmin, async (req, res) => {
  try {
    const query = getQuery(req);
    const stageId = parseId(req.params.stageId);
    if (!stageId) return res.status(400).json({ error: 'ID da etapa invalido.' });
    const stage = await query(`SELECT ps.* FROM pipeline_stages ps JOIN pipeline_definitions pd ON pd.id = ps.pipeline_id WHERE ps.id = ? AND pd.owner_user_id = ?`, [stageId, req.userId]);
    if (!stage.rows?.length) return res.status(404).json({ error: 'Etapa nao encontrada.' });
    const stageCount = await query('SELECT COUNT(*) AS total FROM pipeline_stages WHERE pipeline_id = ?', [stage.rows[0].pipeline_id]);
    if (Number(stageCount.rows[0].total) <= 1) return res.status(409).json({ error: 'A Pipeline precisa manter pelo menos uma etapa.' });
    const usage = await query('SELECT COUNT(*) AS total FROM prospect_pipeline_positions WHERE stage_id = ?', [stageId]);
    if (Number(usage.rows[0].total) > 0) return res.status(409).json({ error: 'Mova os Leads desta etapa antes de remove-la.' });
    await query('DELETE FROM pipeline_stages WHERE id = ?', [stageId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Nao foi possivel remover a etapa.' });
  }
});

router.put('/pipelines/:pipelineId/positions/:prospectId', async (req, res) => {
  let connection;
  let transactionStarted = false;
  try {
    const query = getQuery(req);
    const pipelineId = parseId(req.params.pipelineId);
    const prospectId = parseId(req.params.prospectId);
    const stageId = parseId(req.body?.stage_id);
    if (!pipelineId || !prospectId || !stageId) return res.status(400).json({ error: 'Pipeline, etapa ou Lead invalido.' });
    const pipeline = await ownedPipeline(query, pipelineId, req.userId);
    const prospect = await query('SELECT id FROM prospects WHERE id = ? AND owner_user_id = ?', [prospectId, req.userId]);
    const stage = await query('SELECT id FROM pipeline_stages WHERE id = ? AND pipeline_id = ?', [stageId, pipelineId]);
    if (!pipeline || !prospect.rows?.length || !stage.rows?.length) return res.status(404).json({ error: 'Pipeline, etapa ou Lead nao encontrado.' });
    connection = await getPool().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [currentRows] = await connection.execute('SELECT * FROM prospect_pipeline_positions WHERE prospect_id = ? AND pipeline_id = ? FOR UPDATE', [prospectId, pipelineId]);
    const previousStageId = currentRows[0]?.stage_id ?? null;
    await connection.execute(
      `INSERT INTO prospect_pipeline_positions (prospect_id, pipeline_id, stage_id, sort_order)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE entered_stage_at = IF(stage_id <> VALUES(stage_id), CURRENT_TIMESTAMP, entered_stage_at), stage_id = VALUES(stage_id), sort_order = VALUES(sort_order), updated_at = CURRENT_TIMESTAMP`,
      [prospectId, pipelineId, stageId, parseSortOrder(req.body?.sort_order)]
    );
    if (Number(previousStageId || 0) !== Number(stageId)) {
      await dispatchDomainEvent({ type: 'lead.pipeline_stage_changed', entityType: 'lead', entityId: prospectId, actorUserId: req.userId, payload: { leadId: prospectId, pipelineId, oldStageId: previousStageId, newStageId: stageId }, ...requestEventContext(req) }, { connection });
    }
    const [resultRows] = await connection.execute('SELECT * FROM prospect_pipeline_positions WHERE prospect_id = ? AND pipeline_id = ?', [prospectId, pipelineId]);
    await connection.commit();
    transactionStarted = false;
    res.json(resultRows[0]);
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('Erro ao mover Lead na Pipeline:', error);
    res.status(500).json({ error: 'Nao foi possivel mover o Lead.' });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/pipelines/:pipelineId/import-local', async (req, res) => {
  try {
    const query = getQuery(req);
    const pipelineId = parseId(req.params.pipelineId);
    if (!pipelineId) return res.status(400).json({ error: 'ID da Pipeline invalido.' });
    if (!await ownedPipeline(query, pipelineId, req.userId)) return res.status(404).json({ error: 'Pipeline nao encontrada.' });
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    let imported = 0;
    for (const item of items.slice(0, 1000)) {
      const prospectId = parseId(item.prospect_id);
      const stageId = parseId(item.stage_id);
      if (!prospectId || !stageId) continue;
      const prospect = await query('SELECT id FROM prospects WHERE id = ? AND owner_user_id = ?', [prospectId, req.userId]);
      const stage = await query('SELECT id FROM pipeline_stages WHERE id = ? AND pipeline_id = ?', [stageId, pipelineId]);
      if (!prospect.rows?.length || !stage.rows?.length) continue;
      await query(
        `INSERT INTO prospect_pipeline_positions (prospect_id, pipeline_id, stage_id, sort_order)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE stage_id = VALUES(stage_id), sort_order = VALUES(sort_order), updated_at = CURRENT_TIMESTAMP`,
        [prospectId, pipelineId, stageId, parseSortOrder(item.sort_order)]
      );
      imported += 1;
    }
    res.json({ confirmed: true, imported });
  } catch (error) {
    res.status(500).json({ error: 'Nao foi possivel importar o estado local da Pipeline.' });
  }
});

router.get('/labels', async (req, res) => {
  const result = await getQuery(req)('SELECT * FROM lead_labels WHERE owner_user_id = ? ORDER BY name', [req.userId]);
  res.json({ labels: result.rows || [] });
});

router.post('/labels', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nome da etiqueta e obrigatorio.' });
    const query = getQuery(req);
    await query(`INSERT INTO lead_labels (owner_user_id, name, color) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE color = VALUES(color), updated_at = CURRENT_TIMESTAMP`, [req.userId, name, validColor(req.body?.color)]);
    const result = await query('SELECT * FROM lead_labels WHERE owner_user_id = ? AND name = ?', [req.userId, name]);
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Nao foi possivel salvar a etiqueta.' }); }
});

router.patch('/labels/:labelId', async (req, res) => {
  try {
    const query = getQuery(req);
    const labelId = parseId(req.params.labelId);
    if (!labelId) return res.status(400).json({ error: 'ID da etiqueta invalido.' });
    const name = req.body?.name === undefined ? null : String(req.body.name).trim();
    if (req.body?.name !== undefined && !name) return res.status(400).json({ error: 'Nome da etiqueta e obrigatorio.' });
    await query('UPDATE lead_labels SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ? AND owner_user_id = ?', [name, req.body?.color ? validColor(req.body.color) : null, labelId, req.userId]);
    const result = await query('SELECT * FROM lead_labels WHERE id = ? AND owner_user_id = ?', [labelId, req.userId]);
    if (!result.rows?.length) return res.status(404).json({ error: 'Etiqueta nao encontrada.' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Nao foi possivel editar a etiqueta.' }); }
});

router.delete('/labels/:labelId', async (req, res) => {
  try {
    const labelId = parseId(req.params.labelId);
    if (!labelId) return res.status(400).json({ error: 'ID da etiqueta invalido.' });
    const result = await getQuery(req)('DELETE FROM lead_labels WHERE id = ? AND owner_user_id = ?', [labelId, req.userId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Etiqueta nao encontrada.' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Nao foi possivel remover a etiqueta.' }); }
});

router.put('/prospects/:prospectId/labels', async (req, res) => {
  const connection = await getPool().getConnection();
  try {
    const prospectId = parseId(req.params.prospectId);
    if (!prospectId) return res.status(400).json({ error: 'ID do Lead invalido.' });
    const [prospects] = await connection.execute('SELECT id FROM prospects WHERE id = ? AND owner_user_id = ?', [prospectId, req.userId]);
    if (!prospects.length) return res.status(404).json({ error: 'Lead nao encontrado.' });
    const rawIds = Array.isArray(req.body?.label_ids) ? req.body.label_ids : [];
    const ids = [...new Set(rawIds.map(parseId))];
    if (ids.some((id) => id === null)) return res.status(400).json({ error: 'Uma ou mais etiquetas sao invalidas.' });
    await connection.beginTransaction();
    const [previousRows] = await connection.execute('SELECT label_id FROM prospect_labels WHERE prospect_id = ? FOR UPDATE', [prospectId]);
    const previousIds = new Set(previousRows.map((row) => Number(row.label_id)));
    if (ids.length) {
      const [owned] = await connection.execute(`SELECT id FROM lead_labels WHERE owner_user_id = ? AND id IN (${ids.map(() => '?').join(',')})`, [req.userId, ...ids]);
      if (owned.length !== ids.length) throw new Error('Uma ou mais etiquetas nao pertencem ao usuario.');
    }
    await connection.execute('DELETE FROM prospect_labels WHERE prospect_id = ?', [prospectId]);
    for (const id of ids) await connection.execute('INSERT INTO prospect_labels (prospect_id, label_id, created_by) VALUES (?, ?, ?)', [prospectId, id, req.userId]);
    for (const labelId of ids.filter((id) => !previousIds.has(id))) {
      await dispatchDomainEvent({ type: 'lead.tag_added', entityType: 'lead', entityId: prospectId, actorUserId: req.userId, payload: { leadId: prospectId, labelId }, ...requestEventContext(req) }, { connection });
    }
    for (const labelId of [...previousIds].filter((id) => !ids.includes(id))) {
      await dispatchDomainEvent({ type: 'lead.tag_removed', entityType: 'lead', entityId: prospectId, actorUserId: req.userId, payload: { leadId: prospectId, labelId }, ...requestEventContext(req) }, { connection });
    }
    await connection.commit();
    res.json({ label_ids: ids });
  } catch (error) {
    await connection.rollback();
    res.status(400).json({ error: error.message || 'Nao foi possivel atualizar as etiquetas.' });
  } finally { connection.release(); }
});

router.get('/users/options', async (req, res) => {
  const result = await getQuery(req)(`SELECT id, name, email FROM users
    WHERE is_active = 1 AND (can_access_crm = 1 OR LOWER(role) IN ('admin', 'administrator', 'administrador'))
    ORDER BY name`);
  res.json({ users: result.rows || [] });
});

router.get('/prospects/:prospectId/activities', async (req, res) => {
  const prospectId = parseId(req.params.prospectId);
  if (!prospectId) return res.status(400).json({ error: 'ID do Lead invalido.' });
  const result = await getQuery(req)(`SELECT la.*, u.name AS assigned_user_name FROM lead_activities la LEFT JOIN users u ON u.id = la.assigned_user_id JOIN prospects p ON p.id = la.prospect_id WHERE la.prospect_id = ? AND p.owner_user_id = ? ORDER BY la.created_at DESC`, [prospectId, req.userId]);
  res.json({ activities: result.rows || [] });
});

router.post('/prospects/:prospectId/activities', async (req, res) => {
  let connection;
  let transactionStarted = false;
  try {
    const query = getQuery(req);
    const prospectId = parseId(req.params.prospectId);
    if (!prospectId) return res.status(400).json({ error: 'ID do Lead invalido.' });
    const prospect = await query('SELECT id FROM prospects WHERE id = ? AND owner_user_id = ?', [prospectId, req.userId]);
    if (!prospect.rows?.length) return res.status(404).json({ error: 'Lead nao encontrado.' });
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Titulo da atividade e obrigatorio.' });
    const allowedTypes = ['task', 'call', 'follow_up', 'activity'];
    const type = allowedTypes.includes(req.body?.type) ? req.body.type : 'activity';
    const assignedUserId = req.body?.assigned_user_id == null ? null : parseId(req.body.assigned_user_id);
    if (req.body?.assigned_user_id != null && !assignedUserId) return res.status(400).json({ error: 'Responsavel invalido.' });
    if (!await validAssignableUser(query, assignedUserId)) return res.status(400).json({ error: 'Responsavel inexistente, inativo ou sem acesso ao CRM.' });
    const dueAt = normalizeDateTime(req.body?.due_at);
    if (dueAt === undefined) return res.status(400).json({ error: 'Prazo da atividade invalido.' });
    connection = await getPool().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [inserted] = await connection.execute('INSERT INTO lead_activities (prospect_id, type, title, description, assigned_user_id, due_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [prospectId, type, title, req.body?.description || null, assignedUserId, dueAt, req.userId]);
    await dispatchDomainEvent({ type: 'activity.created', entityType: 'activity', entityId: inserted.insertId, actorUserId: req.userId, payload: { activityId: inserted.insertId, leadId: prospectId, type, assignedUserId, dueAt }, ...requestEventContext(req) }, { connection });
    const [resultRows] = await connection.execute('SELECT * FROM lead_activities WHERE id = ?', [inserted.insertId]);
    await connection.commit();
    transactionStarted = false;
    res.status(201).json(resultRows[0]);
  } catch (error) { if (connection && transactionStarted) await connection.rollback(); res.status(500).json({ error: 'Nao foi possivel criar a atividade.' }); }
  finally { if (connection) connection.release(); }
});

router.patch('/activities/:activityId', async (req, res) => {
  let connection;
  let transactionStarted = false;
  try {
    const query = getQuery(req);
    const activityId = parseId(req.params.activityId);
    if (!activityId) return res.status(400).json({ error: 'ID da atividade invalido.' });
    const activity = await query(`SELECT la.id, la.prospect_id, la.status, la.completed_at FROM lead_activities la JOIN prospects p ON p.id = la.prospect_id WHERE la.id = ? AND p.owner_user_id = ?`, [activityId, req.userId]);
    if (!activity.rows?.length) return res.status(404).json({ error: 'Atividade nao encontrada.' });
    const status = ['pending', 'completed', 'cancelled'].includes(req.body?.status) ? req.body.status : null;
    const hasAssignee = Object.prototype.hasOwnProperty.call(req.body || {}, 'assigned_user_id');
    const assignedUserId = hasAssignee && req.body.assigned_user_id !== null ? parseId(req.body.assigned_user_id) : null;
    if (hasAssignee && req.body.assigned_user_id !== null && !assignedUserId) return res.status(400).json({ error: 'Responsavel invalido.' });
    if (hasAssignee && !await validAssignableUser(query, assignedUserId)) return res.status(400).json({ error: 'Responsavel inexistente, inativo ou sem acesso ao CRM.' });
    const hasDueAt = Object.prototype.hasOwnProperty.call(req.body || {}, 'due_at');
    const dueAt = hasDueAt ? normalizeDateTime(req.body.due_at) : null;
    if (dueAt === undefined) return res.status(400).json({ error: 'Prazo da atividade invalido.' });
    connection = await getPool().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const [lockedRows] = await connection.execute('SELECT la.id, la.prospect_id, la.status, la.completed_at FROM lead_activities la JOIN prospects p ON p.id = la.prospect_id WHERE la.id = ? AND p.owner_user_id = ? FOR UPDATE', [activityId, req.userId]);
    const lockedActivity = lockedRows[0];
    if (!lockedActivity) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Atividade nao encontrada.' });
    }
    await connection.execute(`UPDATE lead_activities SET title = COALESCE(?, title), description = COALESCE(?, description), assigned_user_id = IF(?, ?, assigned_user_id), due_at = IF(?, ?, due_at), status = COALESCE(?, status), completed_at = CASE WHEN ? = 'completed' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) WHEN ? = 'pending' THEN NULL ELSE completed_at END WHERE id = ?`, [req.body?.title || null, req.body?.description ?? null, hasAssignee, assignedUserId, hasDueAt, dueAt, status, status, status, activityId]);
    if (lockedActivity.status !== 'completed' && status === 'completed') {
      const [completedRows] = await connection.execute('SELECT completed_at FROM lead_activities WHERE id = ?', [activityId]);
      await dispatchDomainEvent({ type: 'activity.completed', entityType: 'activity', entityId: activityId, actorUserId: req.userId, payload: { activityId, leadId: lockedActivity.prospect_id, completedBy: req.userId, completedAt: completedRows[0]?.completed_at }, ...requestEventContext(req) }, { connection });
    }
    const [resultRows] = await connection.execute('SELECT * FROM lead_activities WHERE id = ?', [activityId]);
    await connection.commit();
    transactionStarted = false;
    res.json(resultRows[0]);
  } catch (error) { if (connection && transactionStarted) await connection.rollback(); res.status(500).json({ error: 'Nao foi possivel atualizar a atividade.' }); }
  finally { if (connection) connection.release(); }
});

router.get('/notifications', async (req, res) => {
  const result = await getQuery(req)('SELECT * FROM internal_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [req.userId]);
  res.json({ notifications: result.rows || [] });
});

router.post('/notifications', async (req, res) => {
  try {
    const type = ['info', 'success', 'warning', 'error'].includes(req.body?.type) ? req.body.type : 'info';
    const title = String(req.body?.title || '').trim().slice(0, 255);
    const message = String(req.body?.message || '').trim();
    if (!title || !message) return res.status(400).json({ error: 'Titulo e mensagem sao obrigatorios.' });
    const query = getQuery(req);
    const inserted = await query(
      `INSERT INTO internal_notifications (user_id, type, title, message, entity_type, entity_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.userId, type, title, message, req.body?.entity_type || null, req.body?.entity_id || null, JSON.stringify(req.body?.metadata || {})]
    );
    const result = await query('SELECT * FROM internal_notifications WHERE id = ? AND user_id = ?', [inserted.insertId, req.userId]);
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Nao foi possivel criar a notificacao.' }); }
});

router.patch('/notifications/:notificationId/read', async (req, res) => {
  const notificationId = parseId(req.params.notificationId);
  if (!notificationId) return res.status(400).json({ error: 'ID da notificacao invalido.' });
  const owned = await getQuery(req)('SELECT id FROM internal_notifications WHERE id = ? AND user_id = ?', [notificationId, req.userId]);
  if (!owned.rows?.length) return res.status(404).json({ error: 'Notificacao nao encontrada.' });
  await getQuery(req)('UPDATE internal_notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ? AND user_id = ?', [notificationId, req.userId]);
  res.json({ success: true });
});

router.patch('/notifications/read-all', async (req, res) => {
  await getQuery(req)('UPDATE internal_notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE user_id = ?', [req.userId]);
  res.json({ success: true });
});

router.delete('/notifications/:notificationId', async (req, res) => {
  const notificationId = parseId(req.params.notificationId);
  if (!notificationId) return res.status(400).json({ error: 'ID da notificacao invalido.' });
  const result = await getQuery(req)('DELETE FROM internal_notifications WHERE id = ? AND user_id = ?', [notificationId, req.userId]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Notificacao nao encontrada.' });
  res.json({ success: true });
});

router.delete('/notifications', async (req, res) => {
  await getQuery(req)('DELETE FROM internal_notifications WHERE user_id = ?', [req.userId]);
  res.json({ success: true });
});

module.exports = router;
