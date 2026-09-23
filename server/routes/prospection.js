const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const getQuery = (req) => req.app.locals.query;

const authenticateRequest = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token nao fornecido' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalido' });
  }
};

router.use(authenticateRequest);

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

const buildAnalysisReport = (body = {}, previous = {}) => ({
  ...(previous || {}),
  ...(body.metadata || {}),
  source: normalizeNullable(body.source) || previous?.source || 'manual',
  contactName: normalizeNullable(body.contact_name) || null,
  assignedTo: normalizeNullable(body.assigned_to) || null,
  folderName: previous?.folderName || 'Todos os Leads',
});

async function insertHistory(query, { prospectId, ownerUserId, channel = 'system', subject = null, message, recipient = null, metadata = {} }) {
  await query(
    `INSERT INTO prospect_contact_history (prospect_id, owner_user_id, channel, subject, message, recipient, delivery_status, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [prospectId, ownerUserId, channel, subject, message, recipient, 'registrado', JSON.stringify(metadata)]
  );
}

async function syncProspectLabels(query, prospectId, ownerUserId, labels) {
  if (!Array.isArray(labels)) return;
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
    const rows = (prospects.rows || []).map((prospect) => {
      let report = {};
      try { report = typeof prospect.analysis_report === 'string' ? JSON.parse(prospect.analysis_report || '{}') : (prospect.analysis_report || {}); } catch { report = {}; }
      return { ...prospect, analysis_report: { ...report, labels: labelsByProspect[String(prospect.id)] || [], assignedUserId: prospect.assigned_user_id, assignedTo: prospect.assigned_user_name || report.assignedTo || null } };
    });
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
  try {
    const businessName = normalizeText(req.body.business_name);
    if (!businessName) return res.status(400).json({ error: 'Nome da organizacao e obrigatorio' });

    const query = getQuery(req);
    const phone = normalizeNullable(req.body.phone);
    const website = normalizeNullable(req.body.website);
    const analysisReport = buildAnalysisReport(req.body);

    const insert = await query(
      `INSERT INTO prospects (
        owner_user_id, assigned_user_id, business_name, normalized_business_name, category, address, city, state,
        phone, normalized_phone, email, website, normalized_website, website_exists,
        lead_score, status, analysis_report
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.userId,
        req.body.assigned_user_id ?? req.body.metadata?.assignedUserId ?? null,
        businessName,
        normalizeBusinessName(businessName),
        normalizeNullable(req.body.category),
        normalizeNullable(req.body.metadata?.address),
        normalizeNullable(req.body.city),
        normalizeNullable(req.body.state),
        phone,
        onlyDigits(phone),
        normalizeNullable(req.body.email),
        website,
        normalizeWebsite(website),
        website ? 1 : 0,
        0,
        'Novo',
        JSON.stringify(analysisReport),
      ]
    );

    await insertHistory(query, {
      prospectId: insert.insertId,
      ownerUserId: req.userId,
      message: 'Lead cadastrado manualmente no CRM.',
      recipient: normalizeNullable(req.body.email) || phone,
      metadata: { action: 'created', source: analysisReport.source },
    });

    await syncProspectLabels(query, insert.insertId, req.userId, req.body.metadata?.labels);

    const result = await query('SELECT * FROM prospects WHERE id = ? AND owner_user_id = ?', [insert.insertId, req.userId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar prospect:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.patch('/prospects/:id', async (req, res) => {
  try {
    const { status, last_contact_date, approach_suggestion, diagnostic_summary, problems_found, folder_name } = req.body;
    const query = getQuery(req);
    const existing = await query('SELECT * FROM prospects WHERE id = ? AND owner_user_id = ?', [req.params.id, req.userId]);
    if (!existing.rows?.length) return res.status(404).json({ error: 'Prospect nao encontrado' });

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

    await query(
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
           assigned_user_id = COALESCE(?, assigned_user_id),
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
        req.body.assigned_user_id ?? req.body.metadata?.assignedUserId ?? null,
        JSON.stringify(nextReport),
        req.params.id,
        req.userId,
      ]
    );

    await syncProspectLabels(query, req.params.id, req.userId, req.body.metadata?.labels);

    await insertHistory(query, {
      prospectId: req.params.id,
      ownerUserId: req.userId,
      message: 'Informacoes do lead atualizadas.',
      recipient: normalizeNullable(req.body.email) || phone,
      metadata: { action: 'updated' },
    });

    const result = await query('SELECT * FROM prospects WHERE id = ? AND owner_user_id = ?', [req.params.id, req.userId]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar prospect:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
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
    const ownedProspect = await query('SELECT id FROM prospects WHERE id = ? AND owner_user_id = ?', [req.params.id, req.userId]);
    if (!ownedProspect.rows?.length) return res.status(404).json({ error: 'Prospect nao encontrado' });
    await query(
      `UPDATE prospects
       SET analysis_report = JSON_SET(
         COALESCE(analysis_report, JSON_OBJECT()),
         '$.crmSent', true,
         '$.crmSentAt', ?,
         '$.labels', COALESCE(JSON_EXTRACT(analysis_report, '$.labels'), JSON_ARRAY(JSON_OBJECT('id', 'frio', 'name', 'Frio', 'color', '#4D6EDB')))
       ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND owner_user_id = ?`,
      [new Date().toISOString(), req.params.id, req.userId]
    );
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
        VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`, [req.params.id, pipeline.rows[0].id, firstStage.rows[0].id]);
    }
    await insertHistory(query, {
      prospectId: req.params.id,
      ownerUserId: req.userId,
      channel: 'crm',
      message: 'Lead adicionado ao Kanban comercial.',
      metadata: { action: 'added_to_kanban' },
    });
    const result = await query('SELECT * FROM prospects WHERE id = ? AND owner_user_id = ?', [req.params.id, req.userId]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao adicionar prospect ao CRM:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
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
