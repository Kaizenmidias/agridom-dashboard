const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { getPool } = require('../config/database');

const router = express.Router();
router.use(authenticateToken);
const getQuery = (req) => req.app.locals.query;

router.use(async (req, res, next) => {
  try {
    const result = await getQuery(req)('SELECT role, is_active, can_access_crm FROM users WHERE id = ? LIMIT 1', [req.userId]);
    const user = result.rows?.[0];
    const isAdmin = ['admin', 'administrator', 'administrador'].includes(String(user?.role || '').toLowerCase());
    if (!user?.is_active || (!isAdmin && !user?.can_access_crm)) return res.status(403).json({ error: 'Sem permissao para acessar entidades comerciais.' });
    next();
  } catch (error) {
    res.status(500).json({ error: 'Nao foi possivel validar a permissao.' });
  }
});

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

router.post('/pipelines', async (req, res) => {
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

router.post('/pipelines/:pipelineId/stages', async (req, res) => {
  try {
    const query = getQuery(req);
    if (!await ownedPipeline(query, req.params.pipelineId, req.userId)) return res.status(404).json({ error: 'Pipeline nao encontrada.' });
    const name = String(req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Nome da etapa e obrigatorio.' });
    const order = await query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM pipeline_stages WHERE pipeline_id = ?', [req.params.pipelineId]);
    const inserted = await query('INSERT INTO pipeline_stages (pipeline_id, name, color, sort_order) VALUES (?, ?, ?, ?)', [req.params.pipelineId, name, req.body?.color || null, order.rows[0].next_order]);
    const result = await query('SELECT * FROM pipeline_stages WHERE id = ?', [inserted.insertId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Nao foi possivel criar a etapa.' });
  }
});

router.patch('/pipeline-stages/:stageId', async (req, res) => {
  try {
    const query = getQuery(req);
    const stage = await query(`SELECT ps.* FROM pipeline_stages ps JOIN pipeline_definitions pd ON pd.id = ps.pipeline_id WHERE ps.id = ? AND pd.owner_user_id = ?`, [req.params.stageId, req.userId]);
    if (!stage.rows?.length) return res.status(404).json({ error: 'Etapa nao encontrada.' });
    await query('UPDATE pipeline_stages SET name = COALESCE(?, name), color = COALESCE(?, color), sort_order = COALESCE(?, sort_order) WHERE id = ?', [req.body?.name || null, req.body?.color || null, req.body?.sort_order ?? null, req.params.stageId]);
    const result = await query('SELECT * FROM pipeline_stages WHERE id = ?', [req.params.stageId]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Nao foi possivel atualizar a etapa.' });
  }
});

router.delete('/pipeline-stages/:stageId', async (req, res) => {
  try {
    const query = getQuery(req);
    const stage = await query(`SELECT ps.* FROM pipeline_stages ps JOIN pipeline_definitions pd ON pd.id = ps.pipeline_id WHERE ps.id = ? AND pd.owner_user_id = ?`, [req.params.stageId, req.userId]);
    if (!stage.rows?.length) return res.status(404).json({ error: 'Etapa nao encontrada.' });
    const usage = await query('SELECT COUNT(*) AS total FROM prospect_pipeline_positions WHERE stage_id = ?', [req.params.stageId]);
    if (Number(usage.rows[0].total) > 0) return res.status(409).json({ error: 'Mova os Leads desta etapa antes de remove-la.' });
    await query('DELETE FROM pipeline_stages WHERE id = ?', [req.params.stageId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Nao foi possivel remover a etapa.' });
  }
});

router.put('/pipelines/:pipelineId/positions/:prospectId', async (req, res) => {
  try {
    const query = getQuery(req);
    const pipeline = await ownedPipeline(query, req.params.pipelineId, req.userId);
    const prospect = await query('SELECT id FROM prospects WHERE id = ? AND owner_user_id = ?', [req.params.prospectId, req.userId]);
    const stage = await query('SELECT id FROM pipeline_stages WHERE id = ? AND pipeline_id = ?', [req.body?.stage_id, req.params.pipelineId]);
    if (!pipeline || !prospect.rows?.length || !stage.rows?.length) return res.status(404).json({ error: 'Pipeline, etapa ou Lead nao encontrado.' });
    await query(
      `INSERT INTO prospect_pipeline_positions (prospect_id, pipeline_id, stage_id, sort_order)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE stage_id = VALUES(stage_id), sort_order = VALUES(sort_order), entered_stage_at = IF(stage_id <> VALUES(stage_id), CURRENT_TIMESTAMP, entered_stage_at), updated_at = CURRENT_TIMESTAMP`,
      [req.params.prospectId, req.params.pipelineId, req.body.stage_id, Number(req.body?.sort_order || 0)]
    );
    const result = await query('SELECT * FROM prospect_pipeline_positions WHERE prospect_id = ? AND pipeline_id = ?', [req.params.prospectId, req.params.pipelineId]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao mover Lead na Pipeline:', error);
    res.status(500).json({ error: 'Nao foi possivel mover o Lead.' });
  }
});

router.post('/pipelines/:pipelineId/import-local', async (req, res) => {
  try {
    const query = getQuery(req);
    if (!await ownedPipeline(query, req.params.pipelineId, req.userId)) return res.status(404).json({ error: 'Pipeline nao encontrada.' });
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    let imported = 0;
    for (const item of items.slice(0, 1000)) {
      const prospect = await query('SELECT id FROM prospects WHERE id = ? AND owner_user_id = ?', [item.prospect_id, req.userId]);
      const stage = await query('SELECT id FROM pipeline_stages WHERE id = ? AND pipeline_id = ?', [item.stage_id, req.params.pipelineId]);
      if (!prospect.rows?.length || !stage.rows?.length) continue;
      await query(`INSERT IGNORE INTO prospect_pipeline_positions (prospect_id, pipeline_id, stage_id, sort_order) VALUES (?, ?, ?, ?)`, [item.prospect_id, req.params.pipelineId, item.stage_id, Number(item.sort_order || 0)]);
      imported += 1;
    }
    res.json({ imported });
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
    await query(`INSERT INTO lead_labels (owner_user_id, name, color) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE color = VALUES(color), updated_at = CURRENT_TIMESTAMP`, [req.userId, name, req.body?.color || '#4D6EDB']);
    const result = await query('SELECT * FROM lead_labels WHERE owner_user_id = ? AND name = ?', [req.userId, name]);
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Nao foi possivel salvar a etiqueta.' }); }
});

router.patch('/labels/:labelId', async (req, res) => {
  try {
    const query = getQuery(req);
    await query('UPDATE lead_labels SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ? AND owner_user_id = ?', [req.body?.name || null, req.body?.color || null, req.params.labelId, req.userId]);
    const result = await query('SELECT * FROM lead_labels WHERE id = ? AND owner_user_id = ?', [req.params.labelId, req.userId]);
    if (!result.rows?.length) return res.status(404).json({ error: 'Etiqueta nao encontrada.' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Nao foi possivel editar a etiqueta.' }); }
});

router.delete('/labels/:labelId', async (req, res) => {
  try {
    const result = await getQuery(req)('DELETE FROM lead_labels WHERE id = ? AND owner_user_id = ?', [req.params.labelId, req.userId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Etiqueta nao encontrada.' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Nao foi possivel remover a etiqueta.' }); }
});

router.put('/prospects/:prospectId/labels', async (req, res) => {
  const connection = await getPool().getConnection();
  try {
    const [prospects] = await connection.execute('SELECT id FROM prospects WHERE id = ? AND owner_user_id = ?', [req.params.prospectId, req.userId]);
    if (!prospects.length) return res.status(404).json({ error: 'Lead nao encontrado.' });
    const ids = [...new Set((Array.isArray(req.body?.label_ids) ? req.body.label_ids : []).map(Number).filter(Boolean))];
    await connection.beginTransaction();
    if (ids.length) {
      const [owned] = await connection.execute(`SELECT id FROM lead_labels WHERE owner_user_id = ? AND id IN (${ids.map(() => '?').join(',')})`, [req.userId, ...ids]);
      if (owned.length !== ids.length) throw new Error('Uma ou mais etiquetas nao pertencem ao usuario.');
    }
    await connection.execute('DELETE FROM prospect_labels WHERE prospect_id = ?', [req.params.prospectId]);
    for (const id of ids) await connection.execute('INSERT INTO prospect_labels (prospect_id, label_id, created_by) VALUES (?, ?, ?)', [req.params.prospectId, id, req.userId]);
    await connection.commit();
    res.json({ label_ids: ids });
  } catch (error) {
    await connection.rollback();
    res.status(400).json({ error: error.message || 'Nao foi possivel atualizar as etiquetas.' });
  } finally { connection.release(); }
});

router.get('/users/options', async (req, res) => {
  const result = await getQuery(req)('SELECT id, name, email FROM users WHERE is_active = 1 ORDER BY name');
  res.json({ users: result.rows || [] });
});

router.get('/prospects/:prospectId/activities', async (req, res) => {
  const result = await getQuery(req)(`SELECT la.*, u.name AS assigned_user_name FROM lead_activities la LEFT JOIN users u ON u.id = la.assigned_user_id JOIN prospects p ON p.id = la.prospect_id WHERE la.prospect_id = ? AND p.owner_user_id = ? ORDER BY la.created_at DESC`, [req.params.prospectId, req.userId]);
  res.json({ activities: result.rows || [] });
});

router.post('/prospects/:prospectId/activities', async (req, res) => {
  try {
    const query = getQuery(req);
    const prospect = await query('SELECT id FROM prospects WHERE id = ? AND owner_user_id = ?', [req.params.prospectId, req.userId]);
    if (!prospect.rows?.length) return res.status(404).json({ error: 'Lead nao encontrado.' });
    const title = String(req.body?.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Titulo da atividade e obrigatorio.' });
    const allowedTypes = ['task', 'call', 'follow_up', 'activity'];
    const type = allowedTypes.includes(req.body?.type) ? req.body.type : 'activity';
    const inserted = await query(`INSERT INTO lead_activities (prospect_id, type, title, description, assigned_user_id, due_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`, [req.params.prospectId, type, title, req.body?.description || null, req.body?.assigned_user_id || null, req.body?.due_at || null, req.userId]);
    const result = await query('SELECT * FROM lead_activities WHERE id = ?', [inserted.insertId]);
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Nao foi possivel criar a atividade.' }); }
});

router.patch('/activities/:activityId', async (req, res) => {
  try {
    const query = getQuery(req);
    const activity = await query(`SELECT la.id FROM lead_activities la JOIN prospects p ON p.id = la.prospect_id WHERE la.id = ? AND p.owner_user_id = ?`, [req.params.activityId, req.userId]);
    if (!activity.rows?.length) return res.status(404).json({ error: 'Atividade nao encontrada.' });
    const status = ['pending', 'completed', 'cancelled'].includes(req.body?.status) ? req.body.status : null;
    await query(`UPDATE lead_activities SET title = COALESCE(?, title), description = COALESCE(?, description), assigned_user_id = COALESCE(?, assigned_user_id), due_at = COALESCE(?, due_at), status = COALESCE(?, status), completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP WHEN ? = 'pending' THEN NULL ELSE completed_at END WHERE id = ?`, [req.body?.title || null, req.body?.description || null, req.body?.assigned_user_id || null, req.body?.due_at || null, status, status, status, req.params.activityId]);
    const result = await query('SELECT * FROM lead_activities WHERE id = ?', [req.params.activityId]);
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Nao foi possivel atualizar a atividade.' }); }
});

router.get('/notifications', async (req, res) => {
  const result = await getQuery(req)('SELECT * FROM internal_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', [req.userId]);
  res.json({ notifications: result.rows || [] });
});

router.patch('/notifications/:notificationId/read', async (req, res) => {
  await getQuery(req)('UPDATE internal_notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP) WHERE id = ? AND user_id = ?', [req.params.notificationId, req.userId]);
  res.json({ success: true });
});

module.exports = router;
