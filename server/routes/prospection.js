const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requireCommercialAccess } = require('../middleware/commercial-access');
const { getPool } = require('../config/database');
const { dispatchDomainEvent, requestEventContext } = require('../services/domain-events');
const { createOrFindProspect } = require('../services/prospect-service');

const router = express.Router();
const automationVersionsTable = ['automation', '_versions'].join('');

const getQuery = (req) => req.app.locals.query;
const connectionQuery = async (connection, sql, params = []) => {
  const [rows] = await connection.execute(sql, params);
  return { rows: Array.isArray(rows) ? rows : [], rowCount: Array.isArray(rows) ? rows.length : rows.affectedRows || 0, insertId: rows?.insertId, affectedRows: rows?.affectedRows };
};

router.use(authenticateToken);
router.use(requireCommercialAccess);

router.get('/folders', async (req, res) => {
  try {
    const result = await getQuery(req)(`SELECT f.id, f.name, f.description, f.icon, COUNT(m.prospect_id) AS total,
      GROUP_CONCAT(DISTINCT m.prospect_id ORDER BY m.prospect_id) AS prospect_ids,
      SUM(p.normalized_phone IS NOT NULL AND p.normalized_phone <> '') AS with_phone
      FROM lead_folders f LEFT JOIN lead_folder_members m ON m.folder_id = f.id
      LEFT JOIN prospects p ON p.id = m.prospect_id WHERE f.owner_user_id = ? GROUP BY f.id ORDER BY f.name`, [req.userId]);
    res.json({ folders: (result.rows || []).map((row) => ({ ...row, id: Number(row.id), total: Number(row.total || 0), with_phone: Number(row.with_phone || 0), prospect_ids: row.prospect_ids ? String(row.prospect_ids).split(',').map(Number) : [] })) });
  } catch (error) { console.error('[Prospection] folders list failed', { code: error?.code || 'UNKNOWN', message: error?.message || 'unknown' }); res.status(500).json({ error: 'Nao foi possivel carregar as pastas.' }); }
});

router.post('/folders', async (req, res) => {
  const name = normalizeText(req.body?.name);
  if (!name || name.length > 150) return res.status(400).json({ error: 'Nome da pasta invalido.' });
  try {
    const result = await getQuery(req)('INSERT INTO lead_folders (owner_user_id, name, description, icon) VALUES (?, ?, ?, ?)', [req.userId, name, normalizeText(req.body?.description) || null, normalizeText(req.body?.icon) || 'folder']);
    res.status(201).json({ folder: { id: Number(result.insertId), name, description: normalizeText(req.body?.description) || null, icon: normalizeText(req.body?.icon) || 'folder', total: 0, with_phone: 0 } });
  } catch (error) { if (error?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Já existe uma pasta com este nome.' }); console.error('[Prospection] folder create failed', { code: error?.code || 'UNKNOWN', message: error?.message || 'unknown' }); res.status(500).json({ error: 'Nao foi possivel criar a pasta.' }); }
});

router.delete('/folders/:id', async (req, res) => {
  let connection;
  try {
    const folderId = parseId(req.params.id);
    if (!folderId) return res.status(400).json({ error: 'Pasta invalida.' });
    connection = await getPool().getConnection();
    await connection.beginTransaction();
    const db = (sql, params) => connectionQuery(connection, sql, params);
    const folder = await db('SELECT id, name FROM lead_folders WHERE id = ? AND owner_user_id = ? FOR UPDATE', [folderId, req.userId]);
    if (!folder.rows?.length) { await connection.rollback(); return res.status(404).json({ error: 'Pasta nao encontrada.' }); }
    const references = await db(`SELECT a.id, a.name
      FROM automations a JOIN ${automationVersionsTable} av ON av.id = a.active_version_id
      WHERE a.owner_user_id = ? AND a.status = 'active' AND av.status = 'published'
        AND JSON_UNQUOTE(JSON_EXTRACT(av.definition, '$.trigger.type')) = 'lead.added_to_folder'
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(av.definition, '$.trigger.config.folderId')) AS UNSIGNED) = ?
      GROUP BY a.id, a.name`, [req.userId, folderId]);
    if (references.rows?.length) { await connection.rollback(); return res.status(409).json({ error: 'Esta lista esta sendo usada por uma ou mais automacoes. Altere ou desative essas automacoes antes de excluir a lista.', automations: references.rows }); }
    await db('DELETE FROM lead_folder_members WHERE folder_id = ?', [folderId]);
    await db('DELETE FROM lead_folders WHERE id = ? AND owner_user_id = ?', [folderId, req.userId]);
    await connection.commit();
    res.json({ success: true, id: folderId });
  } catch (error) { if (connection) await connection.rollback(); console.error('[Prospection] folder delete failed', { code: error?.code || 'UNKNOWN', message: error?.message || 'unknown' }); res.status(500).json({ error: 'Nao foi possivel excluir a pasta.' }); }
  finally { if (connection) connection.release(); }
});

router.post('/folders/:id/members', async (req, res) => {
  try {
    const folderId = parseId(req.params.id);
    const values = Array.isArray(req.body?.prospect_ids) ? req.body.prospect_ids : [req.body?.prospect_id];
    const ids = [...new Set(values.map(parseId).filter(Boolean))];
    if (!folderId || !ids.length) return res.status(400).json({ error: 'Informe uma pasta e ao menos um lead.' });
    const query = getQuery(req);
    const folder = await query('SELECT id FROM lead_folders WHERE id = ? AND owner_user_id = ?', [folderId, req.userId]);
    if (!folder.rows?.length) return res.status(404).json({ error: 'Pasta nao encontrada.' });
    const owned = await query(`SELECT id FROM prospects WHERE owner_user_id = ? AND id IN (${ids.map(() => '?').join(',')})`, [req.userId, ...ids]);
    const ownedIds = (owned.rows || []).map((row) => Number(row.id));
    let added = 0;
    for (const prospectId of ownedIds) {
      const inserted = await query('INSERT IGNORE INTO lead_folder_members (folder_id, prospect_id) VALUES (?, ?)', [folderId, prospectId]);
      if (Number(inserted.affectedRows || 0) > 0) {
        added += 1;
        await dispatchDomainEvent({
          type: 'lead.added_to_folder',
          entityType: 'lead',
          entityId: prospectId,
          actorUserId: req.userId,
          payload: { leadId: prospectId, folderId },
          idempotencyKey: `lead-folder:${folderId}:${prospectId}`,
          ...requestEventContext(req),
        });
      }
    }
    res.status(201).json({ folder_id: folderId, added, missing: ids.length - ownedIds.length });
  } catch (error) { console.error('[Prospection] folder members add failed', error); res.status(500).json({ error: 'Nao foi possivel adicionar leads a pasta.' }); }
});

router.delete('/folders/:id/members/:prospectId', async (req, res) => {
  try {
    const folderId = parseId(req.params.id); const prospectId = parseId(req.params.prospectId);
    if (!folderId || !prospectId) return res.status(400).json({ error: 'Identificadores invalidos.' });
    const result = await getQuery(req)(`DELETE m FROM lead_folder_members m JOIN lead_folders f ON f.id = m.folder_id
      JOIN prospects p ON p.id = m.prospect_id WHERE m.folder_id = ? AND m.prospect_id = ? AND f.owner_user_id = ? AND p.owner_user_id = ?`, [folderId, prospectId, req.userId, req.userId]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Membro nao encontrado.' });
    res.json({ success: true });
  } catch (error) { console.error('[Prospection] folder member remove failed', error); res.status(500).json({ error: 'Nao foi possivel remover o lead da pasta.' }); }
});

router.delete('/folders/:id/members', async (req, res) => {
  try {
    const folderId = parseId(req.params.id);
    const ids = [...new Set((Array.isArray(req.body?.prospect_ids) ? req.body.prospect_ids : []).map(parseId).filter(Boolean))];
    if (!folderId || !ids.length) return res.status(400).json({ error: 'Informe uma pasta e ao menos um lead.' });
    const result = await getQuery(req)(`DELETE m FROM lead_folder_members m
      JOIN lead_folders f ON f.id = m.folder_id JOIN prospects p ON p.id = m.prospect_id
      WHERE m.folder_id = ? AND f.owner_user_id = ? AND p.owner_user_id = ? AND m.prospect_id IN (${ids.map(() => '?').join(',')})`, [folderId, req.userId, req.userId, ...ids]);
    res.json({ success: true, removed: Number(result.affectedRows || 0), missing: ids.length - Number(result.affectedRows || 0) });
  } catch (error) { console.error('[Prospection] bulk folder members remove failed', { code: error?.code || 'UNKNOWN', message: error?.message || 'unknown' }); res.status(500).json({ error: 'Nao foi possivel remover os leads da pasta.' }); }
});

const defaultSettings = {
  whatsapp_template: 'Olá, {{business_name}}! Tudo bem?',
  email_subject: 'Podemos ajudar sua empresa a vender mais',
  email_body_html: '<p>Olá, tudo bem?</p>',
  sender_name: 'Kaizen',
};

const normalizeText = (value) => String(value || '').trim();
const normalizeNullable = (value) => {
  const text = normalizeText(value);
  return text || null;
};
const onlyDigits = (value) => String(value || '').replace(/\D/g, '');
const normalizeWebsite = (value) => {
  const text = normalizeText(value);
  if (!text) return null;
  return text.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').toLowerCase();
};
const normalizeBusinessName = (value) =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const buildAnalysisReport = (body = {}, previous = {}) => {
  const { labels, assignedUserId, assignedTo, ...legacyMetadata } = body.metadata || {};
  return {
    ...(previous || {}),
    ...legacyMetadata,
    source: normalizeNullable(body.source) || previous?.source || 'manual',
    contactName: normalizeNullable(body.contact_name) || null,
    folderName: previous?.folderName || 'Todos os Leads',
  };
};

const parseId = (value) => {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

async function validateAssignedUser(query, value) {
  if (value === null) return true;
  const result = await query(
    `SELECT id FROM users
     WHERE id = ? AND is_active = 1
       AND (can_access_crm = 1 OR LOWER(role) IN ('admin', 'administrator', 'administrador'))
     LIMIT 1`,
    [value]
  );
  return Boolean(result.rows?.length);
}

async function hydrateProspect(query, prospect, ownerUserId) {
  if (!prospect) return null;
  const labels = await query(
    `SELECT ll.id, ll.name, ll.color
     FROM prospect_labels pl JOIN lead_labels ll ON ll.id = pl.label_id
     WHERE pl.prospect_id = ? AND ll.owner_user_id = ? ORDER BY ll.name`,
    [prospect.id, ownerUserId]
  );
  return { ...prospect, labels: labels.rows || [] };
}

async function insertHistory(query, { prospectId, ownerUserId, channel = 'system', subject = null, message, recipient = null, metadata = {} }) {
  await query(
    `INSERT INTO prospect_contact_history (prospect_id, owner_user_id, channel, subject, message, recipient, delivery_status, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [prospectId, ownerUserId, channel, subject, message, recipient, 'registrado', JSON.stringify(metadata)]
  );
}

async function syncProspectLabels(query, prospectId, ownerUserId, labels, options = {}) {
  if (!Array.isArray(labels)) return;
  const previous = await query('SELECT label_id FROM prospect_labels WHERE prospect_id = ?', [prospectId]);
  const previousIds = new Set((previous.rows || []).map((row) => Number(row.label_id)));
  const labelIds = [];
  for (const item of labels) {
    const name = normalizeText(typeof item === 'string' ? item : item?.name);
    if (!name) continue;
    const color = normalizeText(item?.color) || '#4D6EDB';
    await query(
      `INSERT INTO lead_labels (owner_user_id, name, color) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE color = VALUES(color), updated_at = CURRENT_TIMESTAMP`,
      [ownerUserId, name, color]
    );
    const label = await query('SELECT id FROM lead_labels WHERE owner_user_id = ? AND name = ?', [ownerUserId, name]);
    if (label.rows?.[0]) labelIds.push(label.rows[0].id);
  }
  await query('DELETE FROM prospect_labels WHERE prospect_id = ?', [prospectId]);
  for (const labelId of labelIds) {
    await query('INSERT IGNORE INTO prospect_labels (prospect_id, label_id, created_by) VALUES (?, ?, ?)', [prospectId, labelId, ownerUserId]);
  }
  if (options.connection) {
    for (const labelId of labelIds.filter((id) => !previousIds.has(id))) {
      await dispatchDomainEvent({ type: 'lead.tag_added', entityType: 'lead', entityId: prospectId, actorUserId: ownerUserId, payload: { leadId: prospectId, labelId }, ...options.eventContext }, { connection: options.connection });
    }
    for (const labelId of [...previousIds].filter((id) => !labelIds.includes(id))) {
      await dispatchDomainEvent({ type: 'lead.tag_removed', entityType: 'lead', entityId: prospectId, actorUserId: ownerUserId, payload: { leadId: prospectId, labelId }, ...options.eventContext }, { connection: options.connection });
    }
  }
}

router.get('/bootstrap', async (req, res) => {
  try {
    const query = getQuery(req);
    const prospects = await query(`SELECT p.*, u.name AS assigned_user_name, u.email AS assigned_user_email
      FROM prospects p LEFT JOIN users u ON u.id = p.assigned_user_id
      WHERE p.owner_user_id = ? ORDER BY p.created_at DESC`, [req.userId]);
    const settings = await query('SELECT * FROM prospecting_settings WHERE owner_user_id = ? LIMIT 1', [req.userId]);
    const history = await query(
      'SELECT * FROM prospect_contact_history WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.userId]
    );

    const labels = await query(`SELECT pl.prospect_id, ll.id, ll.name, ll.color
      FROM prospect_labels pl JOIN lead_labels ll ON ll.id = pl.label_id
      JOIN prospects p ON p.id = pl.prospect_id
      WHERE p.owner_user_id = ? ORDER BY ll.name`, [req.userId]);
    const activities = await query(`SELECT la.*, u.name AS assigned_user_name
      FROM lead_activities la LEFT JOIN users u ON u.id = la.assigned_user_id
      JOIN prospects p ON p.id = la.prospect_id
      WHERE p.owner_user_id = ? ORDER BY la.created_at DESC`, [req.userId]);

    const labelsByProspect = (labels.rows || []).reduce((acc, label) => {
      const key = String(label.prospect_id);
      acc[key] = [...(acc[key] || []), { id: String(label.id), name: label.name, color: label.color }];
      return acc;
    }, {});
    const rows = (prospects.rows || []).map((prospect) => ({
      ...prospect,
      labels: labelsByProspect[String(prospect.id)] || [],
    }));
    res.json({
      prospects: rows,
      settings: settings.rows?.[0] || { id: 0, owner_user_id: req.userId, ...defaultSettings },
      history: history.rows || [],
      activities: activities.rows || [],
      metrics: {
        leadsFound: rows.length,
        hotLeads: rows.filter((item) => Number(item.lead_score || 0) >= 70).length,
        noWebsite: rows.filter((item) => !item.website_exists).length,
        whatsappSent: 0,
        emailsSent: 0,
        responseRate: 0,
        meetingsScheduled: rows.filter((item) => item.status === 'Reuniao Agendada').length,
        clientsClosed: rows.filter((item) => item.status === 'Fechado').length,
      },
      integrations: {
        apifyConfigured: Boolean(process.env.APIFY_TOKEN),
        googlePlacesConfigured: Boolean(process.env.GOOGLE_PLACES_API_KEY),
        pageSpeedConfigured: Boolean(process.env.GOOGLE_PAGESPEED_API_KEY),
        openAIConfigured: Boolean(process.env.OPENAI_API_KEY),
        smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
      },
    });
  } catch (error) {
    console.error('Erro no bootstrap de prospeccao:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/search', async (req, res) => {
  res.json({
    inserted: [],
    total: 0,
    provider: 'mysql',
    message: 'Busca externa nao configurada nesta instalacao. Configure as integracoes e implemente o provedor desejado.',
  });
});

router.post('/prospects', async (req, res) => {
  let connection;
  let transactionStarted = false;
  try {
    const businessName = normalizeText(req.body.business_name);
    if (!businessName) return res.status(400).json({ error: 'Nome da organizacao e obrigatorio' });

    const query = getQuery(req);
    const phone = normalizeNullable(req.body.phone);
    const website = normalizeNullable(req.body.website);
    const analysisReport = buildAnalysisReport(req.body);
    const requestedAssignee = Object.prototype.hasOwnProperty.call(req.body || {}, 'assigned_user_id')
      ? req.body.assigned_user_id
      : (req.body.metadata?.assignedUserId ?? null);
    const assignedUserId = requestedAssignee === null || requestedAssignee === '' ? null : parseId(requestedAssignee);
    if (requestedAssignee !== null && requestedAssignee !== '' && !assignedUserId) return res.status(400).json({ error: 'Responsavel invalido' });
    if (!await validateAssignedUser(query, assignedUserId)) return res.status(400).json({ error: 'Responsavel inexistente, inativo ou sem acesso ao CRM' });

    connection = await getPool().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const db = (sql, params) => connectionQuery(connection, sql, params);
    const created = await createOrFindProspect({
      ownerUserId: req.userId,
      assignedUserId,
      businessName,
      category: req.body.category,
      address: req.body.metadata?.address,
      city: req.body.city,
      state: req.body.state,
      phone,
      email: req.body.email,
      website,
      leadScore: 0,
      status: 'Novo',
      analysisReport,
    }, { connection });
    if (created.reason === 'missing_normalized_phone') {
      await connection.rollback();
      transactionStarted = false;
      return res.status(400).json({ error: 'Telefone normalizavel e obrigatorio para criar o lead.', reason: created.reason });
    }

    if (created.created) {
      await insertHistory(db, {
        prospectId: created.prospect.id,
        ownerUserId: req.userId,
        message: 'Lead cadastrado manualmente no CRM.',
        recipient: normalizeNullable(req.body.email) || phone,
        metadata: { action: 'created', source: analysisReport.source },
      });

      await syncProspectLabels(db, created.prospect.id, req.userId, req.body.metadata?.labels, { connection, eventContext: requestEventContext(req) });

      await dispatchDomainEvent({
        type: 'lead.created',
        entityType: 'lead',
        entityId: created.prospect.id,
        actorUserId: req.userId,
        payload: { leadId: created.prospect.id, source: analysisReport.source, status: 'Novo', assignedUserId },
        ...requestEventContext(req),
      }, { connection });
    }

    const result = await db(`SELECT p.*, u.name AS assigned_user_name, u.email AS assigned_user_email
      FROM prospects p LEFT JOIN users u ON u.id = p.assigned_user_id
      WHERE p.id = ?`, [created.prospect.id]);
    await connection.commit();
    transactionStarted = false;
    res.status(created.created ? 201 : 200).json({
      ...(await hydrateProspect(getQuery(req), result.rows[0], req.userId)),
      created: created.created,
      duplicate: created.duplicate,
    });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('Erro ao criar prospect:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (connection) connection.release();
  }
});

router.patch('/prospects/:id', async (req, res) => {
  let connection;
  let transactionStarted = false;
  try {
    const { status, last_contact_date, approach_suggestion, diagnostic_summary, problems_found, folder_name } = req.body;
    const query = getQuery(req);
    const prospectId = parseId(req.params.id);
    if (!prospectId) return res.status(400).json({ error: 'ID do Lead invalido' });
    connection = await getPool().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const db = (sql, params) => connectionQuery(connection, sql, params);
    const existing = await db('SELECT * FROM prospects WHERE id = ? AND owner_user_id = ? FOR UPDATE', [prospectId, req.userId]);
    if (!existing.rows?.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Prospect nao encontrado' });
    }

    let previousReport = {};
    try {
      previousReport = typeof existing.rows[0].analysis_report === 'string'
        ? JSON.parse(existing.rows[0].analysis_report || '{}')
        : (existing.rows[0].analysis_report || {});
    } catch {
      previousReport = {};
    }

    const nextReport = buildAnalysisReport(req.body, {
      ...previousReport,
      folderName: folder_name ?? previousReport.folderName,
    });
    const businessName = normalizeNullable(req.body.business_name);
    const phone = normalizeNullable(req.body.phone);
    const website = normalizeNullable(req.body.website);
    const hasAssignee = Object.prototype.hasOwnProperty.call(req.body || {}, 'assigned_user_id')
      || Object.prototype.hasOwnProperty.call(req.body?.metadata || {}, 'assignedUserId');
    const requestedAssignee = Object.prototype.hasOwnProperty.call(req.body || {}, 'assigned_user_id')
      ? req.body.assigned_user_id
      : (req.body.metadata?.assignedUserId ?? null);
    const assignedUserId = requestedAssignee === null || requestedAssignee === '' ? null : parseId(requestedAssignee);
    if (hasAssignee && requestedAssignee !== null && requestedAssignee !== '' && !assignedUserId) return res.status(400).json({ error: 'Responsavel invalido' });
    if (hasAssignee && !await validateAssignedUser(query, assignedUserId)) return res.status(400).json({ error: 'Responsavel inexistente, inativo ou sem acesso ao CRM' });

    await db(
      `UPDATE prospects
       SET business_name = COALESCE(?, business_name),
           normalized_business_name = COALESCE(?, normalized_business_name),
           category = COALESCE(?, category),
           address = COALESCE(?, address),
           city = COALESCE(?, city),
           state = COALESCE(?, state),
           phone = COALESCE(?, phone),
           normalized_phone = COALESCE(?, normalized_phone),
           email = COALESCE(?, email),
           website = COALESCE(?, website),
           normalized_website = COALESCE(?, normalized_website),
           website_exists = COALESCE(?, website_exists),
           status = COALESCE(?, status),
           last_contact_date = COALESCE(?, last_contact_date),
           approach_suggestion = COALESCE(?, approach_suggestion),
           diagnostic_summary = COALESCE(?, diagnostic_summary),
           problems_found = COALESCE(?, problems_found),
           assigned_user_id = IF(?, ?, assigned_user_id),
           analysis_report = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_user_id = ?`,
      [
        businessName,
        businessName ? normalizeBusinessName(businessName) : null,
        normalizeNullable(req.body.category),
        normalizeNullable(req.body.metadata?.address),
        normalizeNullable(req.body.city),
        normalizeNullable(req.body.state),
        phone,
        phone ? onlyDigits(phone) : null,
        normalizeNullable(req.body.email),
        website,
        website ? normalizeWebsite(website) : null,
        website ? 1 : null,
        status ?? null,
        last_contact_date ?? null,
        approach_suggestion ?? null,
        diagnostic_summary ?? null,
        problems_found ? JSON.stringify(problems_found) : null,
        hasAssignee,
        assignedUserId,
        JSON.stringify(nextReport),
        prospectId,
        req.userId,
      ]
    );

    await syncProspectLabels(db, prospectId, req.userId, req.body.metadata?.labels, { connection, eventContext: requestEventContext(req) });

    const previous = existing.rows[0];
    const nextStatus = status ?? previous.status;
    if (nextStatus !== previous.status) {
      await dispatchDomainEvent({ type: 'lead.status_changed', entityType: 'lead', entityId: prospectId, actorUserId: req.userId, payload: { leadId: prospectId, oldStatus: previous.status, newStatus: nextStatus }, ...requestEventContext(req) }, { connection });
    }
    const nextAssignedUserId = hasAssignee ? assignedUserId : previous.assigned_user_id;
    if (Number(nextAssignedUserId || 0) !== Number(previous.assigned_user_id || 0)) {
      await dispatchDomainEvent({ type: 'lead.assigned', entityType: 'lead', entityId: prospectId, actorUserId: req.userId, payload: { leadId: prospectId, oldUserId: previous.assigned_user_id, newUserId: nextAssignedUserId }, ...requestEventContext(req) }, { connection });
    }
    const generalFieldsChanged = [
      ['business_name', businessName], ['phone', phone], ['email', normalizeNullable(req.body.email)],
      ['website', website], ['category', normalizeNullable(req.body.category)], ['city', normalizeNullable(req.body.city)], ['state', normalizeNullable(req.body.state)],
    ].some(([field, value]) => value !== null && String(value) !== String(previous[field] ?? ''));
    if (generalFieldsChanged) {
      await dispatchDomainEvent({ type: 'lead.updated', entityType: 'lead', entityId: prospectId, actorUserId: req.userId, payload: { leadId: prospectId, changedFields: ['profile'] }, ...requestEventContext(req) }, { connection });
    }

    await insertHistory(db, {
      prospectId,
      ownerUserId: req.userId,
      message: 'Informacoes do lead atualizadas.',
      recipient: normalizeNullable(req.body.email) || phone,
      metadata: { action: 'updated' },
    });

    const result = await db(`SELECT p.*, u.name AS assigned_user_name, u.email AS assigned_user_email
      FROM prospects p LEFT JOIN users u ON u.id = p.assigned_user_id
      WHERE p.id = ? AND p.owner_user_id = ?`, [prospectId, req.userId]);
    await connection.commit();
    transactionStarted = false;
    res.json(await hydrateProspect(query, result.rows[0], req.userId));
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('Erro ao atualizar prospect:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    if (connection) connection.release();
  }
});

router.delete('/prospects/bulk', async (req, res) => {
  let connection;
  try {
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(parseId).filter(Boolean))];
    if (!ids.length || ids.length > 500) return res.status(400).json({ error: 'Informe entre 1 e 500 leads validos.' });
    connection = await getPool().getConnection(); await connection.beginTransaction();
    const [owned] = await connection.execute(`SELECT id FROM prospects WHERE owner_user_id = ? AND id IN (${ids.map(() => '?').join(',')})`, [req.userId, ...ids]);
    const ownedIds = owned.map((row) => Number(row.id));
    if (ownedIds.length) await connection.execute(`DELETE FROM prospects WHERE owner_user_id = ? AND id IN (${ownedIds.map(() => '?').join(',')})`, [req.userId, ...ownedIds]);
    await connection.commit();
    res.json({ success: true, deleted: ownedIds.length, missing: ids.length - ownedIds.length });
  } catch (error) { if (connection) await connection.rollback(); console.error('[Prospection] bulk delete failed', error); res.status(500).json({ error: 'Nao foi possivel excluir os leads selecionados.' }); }
  finally { if (connection) connection.release(); }
});

router.post('/prospects/bulk-action', async (req, res) => {
  let connection;
  try {
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : []).map(parseId).filter(Boolean))];
    const action = String(req.body?.action || '');
    if (!ids.length || ids.length > 500) return res.status(400).json({ error: 'Informe entre 1 e 500 leads validos.' });
    if (!['status', 'assignee', 'archive'].includes(action)) return res.status(400).json({ error: 'Acao em massa invalida.' });
    const status = action === 'status' ? normalizeText(req.body?.value) : null;
    const assignedUserId = action === 'assignee' ? (req.body?.value === null || req.body?.value === '' ? null : parseId(req.body?.value)) : null;
    if (action === 'status' && !['novo', 'em_contato', 'qualificado', 'reuniao', 'proposta', 'convertido', 'perdido', 'arquivado'].includes(status)) return res.status(400).json({ error: 'Status invalido.' });
    if (action === 'assignee' && assignedUserId !== null && (!assignedUserId || !(await validateAssignedUser(getQuery(req), assignedUserId)))) return res.status(400).json({ error: 'Responsavel invalido.' });
    connection = await getPool().getConnection(); await connection.beginTransaction();
    const db = (sql, params) => connectionQuery(connection, sql, params);
    const owned = await db(`SELECT id, status, assigned_user_id FROM prospects WHERE owner_user_id = ? AND id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, [req.userId, ...ids]);
    for (const lead of owned.rows || []) {
      const nextStatus = action === 'archive' ? 'arquivado' : status;
      const nextAssignee = action === 'assignee' ? assignedUserId : lead.assigned_user_id;
      await db('UPDATE prospects SET status = ?, assigned_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ?', [nextStatus || lead.status, nextAssignee, lead.id, req.userId]);
      if (nextStatus && nextStatus !== lead.status) await dispatchDomainEvent({ type: 'lead.status_changed', entityType: 'lead', entityId: lead.id, actorUserId: req.userId, payload: { leadId: lead.id, oldStatus: lead.status, newStatus: nextStatus }, ...requestEventContext(req) }, { connection });
      if (action === 'assignee' && Number(nextAssignee || 0) !== Number(lead.assigned_user_id || 0)) await dispatchDomainEvent({ type: 'lead.assigned', entityType: 'lead', entityId: lead.id, actorUserId: req.userId, payload: { leadId: lead.id, oldUserId: lead.assigned_user_id, newUserId: nextAssignee }, ...requestEventContext(req) }, { connection });
    }
    await connection.commit();
    res.json({ success: true, processed: owned.rows?.length || 0, missing: ids.length - (owned.rows?.length || 0) });
  } catch (error) { if (connection) await connection.rollback(); console.error('[Prospection] bulk action failed', { code: error?.code || 'UNKNOWN', message: error?.message || 'unknown' }); res.status(500).json({ error: 'Nao foi possivel processar a acao em massa.' }); }
  finally { if (connection) connection.release(); }
});

router.delete('/prospects/:id', async (req, res) => {
  try {
    await getQuery(req)('DELETE FROM prospects WHERE id = ? AND owner_user_id = ?', [req.params.id, req.userId]);
    res.json({ success: true, id: Number(req.params.id) });
  } catch (error) {
    console.error('Erro ao excluir prospect:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/prospects/:id/add-to-crm', async (req, res) => {
  try {
    const query = getQuery(req);
    const prospectId = parseId(req.params.id);
    if (!prospectId) return res.status(400).json({ error: 'ID do Lead invalido' });
    const ownedProspect = await query('SELECT id FROM prospects WHERE id = ? AND owner_user_id = ?', [prospectId, req.userId]);
    if (!ownedProspect.rows?.length) return res.status(404).json({ error: 'Prospect nao encontrado' });
    await query(
      `UPDATE prospects
       SET analysis_report = JSON_SET(
         COALESCE(analysis_report, JSON_OBJECT()),
         '$.crmSent', true,
         '$.crmSentAt', ?
       ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_user_id = ?`,
      [new Date().toISOString(), prospectId, req.userId]
    );
    await query(`INSERT INTO lead_labels (owner_user_id, name, color) VALUES (?, 'Frio', '#4D6EDB')
      ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`, [req.userId]);
    const coldLabel = await query("SELECT id FROM lead_labels WHERE owner_user_id = ? AND name = 'Frio' LIMIT 1", [req.userId]);
    if (coldLabel.rows?.length) {
      await query('INSERT IGNORE INTO prospect_labels (prospect_id, label_id, created_by) VALUES (?, ?, ?)', [prospectId, coldLabel.rows[0].id, req.userId]);
    }
    let pipeline = await query('SELECT id FROM pipeline_definitions WHERE owner_user_id = ? ORDER BY is_default DESC, id LIMIT 1', [req.userId]);
    if (!pipeline.rows?.length) {
      const inserted = await query("INSERT INTO pipeline_definitions (owner_user_id, name, is_default) VALUES (?, 'Pipeline Comercial', 1)", [req.userId]);
      for (const [index, name] of ['Qualificados', 'Reuniao', 'Proposta', 'Negociacao', 'Convertidos'].entries()) {
        await query('INSERT INTO pipeline_stages (pipeline_id, name, sort_order, is_system) VALUES (?, ?, ?, 1)', [inserted.insertId, name, index]);
      }
      pipeline = { rows: [{ id: inserted.insertId }] };
    }
    const firstStage = await query('SELECT id FROM pipeline_stages WHERE pipeline_id = ? ORDER BY sort_order, id LIMIT 1', [pipeline.rows[0].id]);
    if (firstStage.rows?.length) {
      await query(`INSERT INTO prospect_pipeline_positions (prospect_id, pipeline_id, stage_id, sort_order)
        VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`, [prospectId, pipeline.rows[0].id, firstStage.rows[0].id]);
    }
    await insertHistory(query, {
      prospectId,
      ownerUserId: req.userId,
      channel: 'crm',
      message: 'Lead adicionado ao Kanban comercial.',
      metadata: { action: 'added_to_kanban' },
    });
    const result = await query(`SELECT p.*, u.name AS assigned_user_name, u.email AS assigned_user_email
      FROM prospects p LEFT JOIN users u ON u.id = p.assigned_user_id
      WHERE p.id = ? AND p.owner_user_id = ?`, [prospectId, req.userId]);
    res.json(await hydrateProspect(query, result.rows[0], req.userId));
  } catch (error) {
    console.error('Erro ao adicionar prospect ao CRM:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/prospects/import-to-folder', async (req, res) => {
  let connection;
  let transactionStarted = false;
  try {
    const folderId = parseId(req.body?.folder_id);
    const ids = [...new Set((Array.isArray(req.body?.prospect_ids) ? req.body.prospect_ids : []).map(parseId).filter(Boolean))];
    if (!folderId || !ids.length || ids.length > 500) return res.status(400).json({ error: 'Informe uma lista e entre 1 e 500 leads validos.' });

    connection = await getPool().getConnection();
    await connection.beginTransaction();
    transactionStarted = true;
    const db = (sql, params) => connectionQuery(connection, sql, params);
    const folder = await db('SELECT id, name FROM lead_folders WHERE id = ? AND owner_user_id = ? FOR UPDATE', [folderId, req.userId]);
    if (!folder.rows?.length) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(404).json({ error: 'Lista de destino nao encontrada.' });
    }

    const leads = await db(`SELECT id, analysis_report FROM prospects WHERE owner_user_id = ? AND id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, [req.userId, ...ids]);
    const foundIds = new Set((leads.rows || []).map((row) => Number(row.id)));
    let newLeads = 0;
    let existingLeads = 0;
    let addedToFolder = 0;
    let alreadyInFolder = 0;
    let triggers = 0;

    for (const lead of leads.rows || []) {
      let report = {};
      try { report = typeof lead.analysis_report === 'string' ? JSON.parse(lead.analysis_report || '{}') : (lead.analysis_report || {}); } catch { report = {}; }
      if (report.crmSent) existingLeads += 1;
      else {
        newLeads += 1;
        await db(`UPDATE prospects SET analysis_report = JSON_SET(COALESCE(analysis_report, JSON_OBJECT()), '$.crmSent', true, '$.crmSentAt', ?), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND owner_user_id = ?`, [new Date().toISOString(), lead.id, req.userId]);
      }
      const membership = await db('INSERT IGNORE INTO lead_folder_members (folder_id, prospect_id) VALUES (?, ?)', [folderId, lead.id]);
      if (Number(membership.affectedRows || 0) > 0) {
        addedToFolder += 1;
        triggers += 1;
        await dispatchDomainEvent({
          type: 'lead.added_to_folder',
          entityType: 'lead',
          entityId: lead.id,
          actorUserId: req.userId,
          payload: { leadId: lead.id, folderId },
          idempotencyKey: `lead-folder:${folderId}:${lead.id}`,
          ...requestEventContext(req),
        }, { connection });
      } else alreadyInFolder += 1;
    }
    await connection.commit();
    transactionStarted = false;
    res.status(201).json({
      selected: ids.length,
      new_leads: newLeads,
      existing_leads: existingLeads,
      added_to_folder: addedToFolder,
      already_in_folder: alreadyInFolder,
      triggers,
      failed: ids.length - foundIds.size,
      folder: { id: folderId, name: folder.rows[0].name },
    });
  } catch (error) {
    if (connection && transactionStarted) await connection.rollback();
    console.error('[Prospection] import to folder failed', { code: error?.code || 'UNKNOWN', message: error?.message || 'unknown' });
    res.status(500).json({ error: 'Nao foi possivel importar os leads para a lista.' });
  } finally {
    if (connection) connection.release();
  }
});

router.put('/settings', async (req, res) => {
  try {
    const payload = { ...defaultSettings, ...req.body };
    const query = getQuery(req);
    await query(
      `INSERT INTO prospecting_settings (owner_user_id, whatsapp_template, email_subject, email_body_html, sender_name)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE whatsapp_template = VALUES(whatsapp_template),
         email_subject = VALUES(email_subject),
         email_body_html = VALUES(email_body_html),
         sender_name = VALUES(sender_name)`,
      [req.userId, payload.whatsapp_template, payload.email_subject, payload.email_body_html, payload.sender_name]
    );
    const result = await query('SELECT * FROM prospecting_settings WHERE owner_user_id = ? LIMIT 1', [req.userId]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao salvar configuracoes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/integrations', async (req, res) => {
  res.json({
    apify: { configured: Boolean(process.env.APIFY_TOKEN), actorId: process.env.APIFY_GOOGLE_MAPS_ACTOR || '' },
    google: { configured: Boolean(process.env.GOOGLE_PLACES_API_KEY) },
    openai: { configured: Boolean(process.env.OPENAI_API_KEY), model: process.env.OPENAI_MODEL || 'gpt-4o-mini' },
    smtp: { configured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER), host: process.env.SMTP_HOST || '', port: process.env.SMTP_PORT || '587', user: process.env.SMTP_USER || '', from: process.env.EMAIL_FROM || '' },
  });
});

router.put('/integrations', async (req, res) => {
  await getQuery(req)(
    `INSERT INTO system_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [`prospection_integrations_user_${req.userId}`, JSON.stringify(req.body || {})]
  );
  res.json(req.body || {});
});

router.post('/integrations/:provider/test', async (req, res) => {
  res.json({ success: true, message: `Integracao ${req.params.provider} registrada no CRM.` });
});

router.post('/whatsapp/register', async (req, res) => {
  const { prospect_ids = [], template = '' } = req.body;
  const ids = Array.isArray(prospect_ids) ? prospect_ids : [];
  if (!ids.length) return res.json({ links: [] });
  const result = await getQuery(req)(`SELECT id, business_name, phone FROM prospects WHERE owner_user_id = ? AND id IN (${ids.map(() => '?').join(',')})`, [req.userId, ...ids]);
  res.json({
    links: (result.rows || []).map((prospect) => ({
      prospect_id: prospect.id,
      business_name: prospect.business_name,
      url: `https://wa.me/${String(prospect.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(template.replace('{{business_name}}', prospect.business_name))}`,
    })),
  });
});

router.post('/email/send', async (req, res) => {
  res.json({ sent: [] });
});

module.exports = router;
