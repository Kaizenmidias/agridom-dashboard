const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { calculateTotalMonthlyExpenses } = require('../utils/billing-calculations');
const { getPool } = require('../config/database');
const { settleProjectOnCompletion, recordProjectPayment, recordFinancialEvent, parseAmount } = require('../services/project-financial-service');

const router = express.Router();

const getQuery = (req) => req.app.locals.query;

const requireModuleAccess = (field) => async (req, res, next) => {
  try {
    const result = await getQuery(req)(`SELECT role, ${field} FROM users WHERE id = ? AND is_active = 1 LIMIT 1`, [req.userId]);
    const user = result.rows?.[0];
    const isAdmin = ['admin', 'administrator', 'administrador'].includes(String(user?.role || '').toLowerCase());
    if (!user || (!isAdmin && !user[field])) return res.status(403).json({ error: 'Sem permissao para este modulo' });
    next();
  } catch (error) {
    console.error('Erro ao validar permissao do modulo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Token nao fornecido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key');
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Token invalido' });
  }
};

const queryById = async (query, table, id, userId) => {
  const result = await query(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`, [id, userId]);
  return result.rows?.[0] || null;
};

const parseNumber = (value) => Number(value || 0) || 0;

const normalizeDateOnly = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!text) return null;

  const dateOnly = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) return dateOnly[1];

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
};

const isProjectCompletionRequest = (body = {}) => {
  if (String(body.status || '').toLowerCase() !== 'completed') return false;
  const allowedFields = new Set(['status', 'completion_date']);
  return Object.keys(body).every((key) => allowedFields.has(key));
};

// Users
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const result = await getQuery(req)(
      `SELECT id, email, name, name AS full_name, role, avatar_url, is_active,
              can_access_dashboard, can_access_projects, can_access_briefings,
              can_access_codes, can_access_expenses, can_access_crm, can_access_users,
              created_at, updated_at
       FROM users
       WHERE is_active = 1
       ORDER BY created_at DESC`
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar usuarios:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/users', authenticateToken, async (req, res) => {
  try {
    const { email, password, password_hash, full_name, name, role = 'user' } = req.body;
    const plainPassword = password || password_hash;
    if (!email || !plainPassword) return res.status(400).json({ error: 'Email e senha sao obrigatorios' });

    const query = getQuery(req);
    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.rows?.length) return res.status(409).json({ error: 'Este email ja esta em uso' });

    const hashedPassword = String(plainPassword).startsWith('$2')
      ? plainPassword
      : await bcrypt.hash(plainPassword, 10);

    const inserted = await query(
      `INSERT INTO users (email, password, name, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [email, hashedPassword, full_name || name || email, role]
    );

    const result = await query('SELECT id, email, name, name AS full_name, role, is_active, created_at, updated_at FROM users WHERE id = ?', [inserted.insertId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar usuario:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { full_name, name, avatar_url, is_active, role } = req.body;
    const query = getQuery(req);
    await query(
      `UPDATE users
       SET name = COALESCE(?, name),
           avatar_url = COALESCE(?, avatar_url),
           is_active = COALESCE(?, is_active),
           role = COALESCE(?, role),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [full_name || name || null, avatar_url ?? null, is_active ?? null, role ?? null, req.params.id]
    );
    const result = await query('SELECT id, email, name, name AS full_name, role, avatar_url, is_active FROM users WHERE id = ?', [req.params.id]);
    if (!result.rows?.length) return res.status(404).json({ error: 'Usuario nao encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar usuario:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    await getQuery(req)('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    res.json({ message: 'Usuario desativado com sucesso' });
  } catch (error) {
    console.error('Erro ao desativar usuario:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Projects
router.get('/projects', authenticateToken, requireModuleAccess('can_access_projects'), async (req, res) => {
  try {
    const result = await getQuery(req)(`SELECT p.*, COALESCE(b.amount, 0) AS financial_legacy_baseline, COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE -e.amount END), 0) AS financial_event_total, COUNT(e.id) AS financial_event_count
      FROM projects p LEFT JOIN project_financial_baselines b ON b.project_id = p.id LEFT JOIN project_financial_events e ON e.project_id = p.id
      WHERE p.user_id = ? GROUP BY p.id ORDER BY p.created_at DESC`, [req.userId]);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar projetos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/projects', authenticateToken, requireModuleAccess('can_access_projects'), async (req, res) => {
  let connection;
  try {
    const { name, client, client_name, project_type, status, description, project_value, paid_value, payment_date, delivery_date, completion_date } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome do projeto e obrigatorio' });
    const contractValue = parseAmount(project_value);
    const initialPayment = parseAmount(paid_value);
    if (initialPayment > contractValue) return res.status(400).json({ error: 'Pagamento inicial maior que o valor do projeto' });
    if (initialPayment > 0 && !payment_date) return res.status(400).json({ error: 'Data do pagamento inicial e obrigatoria' });
    connection = await getPool().getConnection();
    await connection.beginTransaction();
    const [inserted] = await connection.execute(
      `INSERT INTO projects (user_id, name, client, project_type, status, description, project_value, paid_value, delivery_date, completion_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [req.userId, name, client || client_name || null, project_type || 'website', status || 'active', description || null, contractValue, initialPayment, delivery_date || null, completion_date || null]
    );
    if (initialPayment > 0) {
      await recordFinancialEvent(connection, { projectId: inserted.insertId, eventType: 'payment_received', amount: initialPayment, competenceDate: normalizeDateOnly(payment_date), origin: 'initial_payment', idempotencyKey: `project:${inserted.insertId}:initial-payment`, createdBy: req.userId });
    }
    await connection.execute(
      `INSERT INTO briefings (project_id, user_id, title, client, client_name, project_type, description, content, status, priority, deadline, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'medium', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [inserted.insertId, req.userId, name, client || client_name || null, client || client_name || null, project_type || 'website', description || null, description || null, delivery_date || null]
    );
    await connection.commit();
    const [rows] = await getPool().execute('SELECT * FROM projects WHERE id = ?', [inserted.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erro ao criar projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  } finally {
    connection?.release();
  }
});

router.put('/projects/:id', authenticateToken, requireModuleAccess('can_access_projects'), async (req, res) => {
  if (isProjectCompletionRequest(req.body)) {
    let connection;
    try {
      connection = await getPool().getConnection();
      await connection.beginTransaction();

      const completionDate = normalizeDateOnly(req.body.completion_date) || new Date().toISOString().slice(0, 10);
      const completedProject = await settleProjectOnCompletion({ connection, projectId: req.params.id, completionDate, createdBy: req.userId });
      if (!completedProject) {
        await connection.rollback();
        return res.status(404).json({ error: 'Projeto nao encontrado' });
      }
      await connection.commit();
      return res.json(completedProject);
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Erro ao concluir projeto:', {
        projectId: req.params.id,
        code: error.code,
        sqlMessage: error.sqlMessage,
        message: error.message
      });
      return res.status(500).json({ error: 'Erro interno do servidor' });
    } finally {
      connection?.release();
    }
  }

  try {
    const { name, client, client_name, project_type, status, description, project_value, delivery_date, completion_date } = req.body;
    const query = getQuery(req);
    const normalizedDeliveryDate = normalizeDateOnly(delivery_date);
    const normalizedCompletionDate = normalizeDateOnly(completion_date);
    await query(
      `UPDATE projects
       SET name = COALESCE(?, name),
           client = COALESCE(?, client),
           project_type = COALESCE(?, project_type),
           status = COALESCE(?, status),
           description = COALESCE(?, description),
           project_value = COALESCE(?, project_value),
           delivery_date = COALESCE(?, delivery_date),
           completion_date = COALESCE(?, completion_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [name ?? null, client || client_name || null, project_type ?? null, status ?? null, description ?? null, project_value ?? null, normalizedDeliveryDate, normalizedCompletionDate, req.params.id]
    );
    const result = await query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!result.rows?.length) return res.status(404).json({ error: 'Projeto nao encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar projeto:', {
      projectId: req.params.id,
      code: error.code,
      sqlMessage: error.sqlMessage,
      message: error.message
    });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/projects/:id/payments', authenticateToken, requireModuleAccess('can_access_projects'), async (req, res) => {
  let connection;
  try {
    const amount = parseAmount(req.body.amount);
    const competenceDate = normalizeDateOnly(req.body.competence_date);
    const idempotencyKey = String(req.body.idempotency_key || '').trim();
    if (amount <= 0 || !competenceDate || !idempotencyKey) return res.status(400).json({ error: 'Valor, competencia e chave de idempotencia sao obrigatorios' });
    connection = await getPool().getConnection();
    await connection.beginTransaction();
    const [owned] = await connection.execute("SELECT id, status, project_value, paid_value FROM projects WHERE id = ? AND user_id = ? FOR UPDATE", [req.params.id, req.userId]);
    if (!owned[0]) { await connection.rollback(); return res.status(404).json({ error: 'Projeto nao encontrado' }); }
    if (owned[0].status === 'cancelled') { await connection.rollback(); return res.status(409).json({ error: 'Projeto cancelado nao aceita pagamentos' }); }
    const project = await recordProjectPayment({ connection, projectId: req.params.id, amount, competenceDate, createdBy: req.userId, idempotencyKey });
    await connection.commit();
    return res.json(project);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erro ao registrar pagamento do projeto:', { projectId: req.params.id, code: error.code, message: error.message });
    const clientError = ['FINANCIAL_IDEMPOTENCY_REQUIRED', 'FINANCIAL_IDEMPOTENCY_CONFLICT', 'FINANCIAL_PAYMENT_EXCEEDS_BALANCE'].includes(error.code);
    return res.status(error.code === 'FINANCIAL_IDEMPOTENCY_REQUIRED' ? 400 : clientError ? 409 : 500).json({ error: clientError ? error.message : 'Erro interno do servidor' });
  } finally { connection?.release(); }
});

router.get('/projects/:id/financial-history', authenticateToken, requireModuleAccess('can_access_projects'), async (req, res) => {
  try {
    const query = getQuery(req);
    const baseline = await query('SELECT id, amount, competence_date, origin, created_at FROM project_financial_baselines WHERE project_id = ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND user_id = ?)', [req.params.id, req.params.id, req.userId]);
    const events = await query('SELECT id, event_type, direction, amount, competence_date, origin, created_at FROM project_financial_events WHERE project_id = ? AND EXISTS (SELECT 1 FROM projects WHERE id = ? AND user_id = ?) ORDER BY COALESCE(competence_date, DATE(created_at)), id', [req.params.id, req.params.id, req.userId]);
    if (!baseline.rows?.length && !events.rows?.length) {
      const project = await query('SELECT id FROM projects WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
      if (!project.rows?.length) return res.status(404).json({ error: 'Projeto nao encontrado' });
    }
    res.json({ baseline: baseline.rows?.[0] || null, events: events.rows || [] });
  } catch (error) {
    console.error('Erro ao buscar historico financeiro:', { projectId: req.params.id, code: error.code, message: error.message });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/projects/:id', authenticateToken, requireModuleAccess('can_access_projects'), async (req, res) => {
  try {
    await getQuery(req)('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Projeto excluido com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Expenses
router.get('/expenses', authenticateToken, async (req, res) => {
  try {
    const result = await getQuery(req)(
      `SELECT e.*, p.name AS project_name
       FROM expenses e
       LEFT JOIN projects p ON e.project_id = p.id
       WHERE e.user_id = ?
       ORDER BY e.date DESC`,
      [req.userId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar despesas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/expenses', authenticateToken, async (req, res) => {
  try {
    const { description, amount, value, category, date, expense_date, billing_type, project_id, notes } = req.body;
    if (!description) return res.status(400).json({ error: 'Descricao e obrigatoria' });
    const query = getQuery(req);
    const inserted = await query(
      `INSERT INTO expenses (description, amount, category, date, billing_type, project_id, user_id, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [description, amount ?? value ?? 0, category || null, date || expense_date || new Date().toISOString().slice(0, 10), billing_type || 'unica', project_id || null, req.userId, notes || null]
    );
    const result = await query('SELECT * FROM expenses WHERE id = ?', [inserted.insertId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar despesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { description, amount, value, category, date, expense_date, billing_type, project_id, notes } = req.body;
    const query = getQuery(req);
    await query(
      `UPDATE expenses
       SET description = COALESCE(?, description),
           amount = COALESCE(?, amount),
           category = COALESCE(?, category),
           date = COALESCE(?, date),
           billing_type = COALESCE(?, billing_type),
           project_id = COALESCE(?, project_id),
           notes = COALESCE(?, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [description ?? null, amount ?? value ?? null, category ?? null, date || expense_date || null, billing_type ?? null, project_id ?? null, notes ?? null, req.params.id, req.userId]
    );
    const result = await queryById(query, 'expenses', req.params.id, req.userId);
    if (!result) return res.status(404).json({ error: 'Despesa nao encontrada' });
    res.json(result);
  } catch (error) {
    console.error('Erro ao atualizar despesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    await getQuery(req)('DELETE FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ message: 'Despesa excluida com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir despesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Company access
router.get('/company-access', authenticateToken, async (req, res) => {
  try {
    const result = await getQuery(req)('SELECT * FROM company_access WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar acessos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/company-access', authenticateToken, async (req, res) => {
  try {
    const fields = ['company_name', 'wordpress_url', 'wordpress_login', 'wordpress_password', 'domain_url', 'domain_login', 'domain_password', 'hosting_url', 'hosting_login', 'hosting_password'];
    const values = fields.map((field) => req.body[field] || null);
    const inserted = await getQuery(req)(
      `INSERT INTO company_access (${fields.join(', ')}, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [...values, req.userId]
    );
    const result = await getQuery(req)('SELECT * FROM company_access WHERE id = ?', [inserted.insertId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar acesso:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/company-access/:id', authenticateToken, async (req, res) => {
  try {
    const fields = ['company_name', 'wordpress_url', 'wordpress_login', 'wordpress_password', 'domain_url', 'domain_login', 'domain_password', 'hosting_url', 'hosting_login', 'hosting_password'];
    const setSql = fields.map((field) => `${field} = COALESCE(?, ${field})`).join(', ');
    await getQuery(req)(`UPDATE company_access SET ${setSql}, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`, [...fields.map((field) => req.body[field] ?? null), req.params.id, req.userId]);
    const result = await queryById(getQuery(req), 'company_access', req.params.id, req.userId);
    if (!result) return res.status(404).json({ error: 'Acesso nao encontrado' });
    res.json(result);
  } catch (error) {
    console.error('Erro ao atualizar acesso:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/company-access/:id', authenticateToken, async (req, res) => {
  try {
    await getQuery(req)('DELETE FROM company_access WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ message: 'Acesso excluido com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir acesso:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Briefings
router.get('/briefings', authenticateToken, requireModuleAccess('can_access_briefings'), async (req, res) => {
  try {
    const result = await getQuery(req)(`SELECT b.*, p.name AS project_name, p.client AS project_client,
       COALESCE(p.client, p.client_name) AS project_client_name, p.project_type AS project_type,
       p.project_value, p.paid_value, p.status AS project_status, p.user_id AS project_owner_id
       FROM briefings b LEFT JOIN projects p ON p.id = b.project_id
       ORDER BY b.created_at DESC`);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar briefings:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/briefings', authenticateToken, requireModuleAccess('can_access_briefings'), async (req, res) => {
  try {
    const { title, client, description, content, status, priority, deadline } = req.body;
    if (!title) return res.status(400).json({ error: 'Titulo e obrigatorio' });
    const inserted = await getQuery(req)(
      `INSERT INTO briefings (user_id, title, client, description, content, status, priority, deadline, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [req.userId, title, client || null, description || null, content || description || null, status || 'pending', priority || 'medium', deadline || null]
    );
    const result = await getQuery(req)('SELECT * FROM briefings WHERE id = ?', [inserted.insertId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar briefing:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/briefings/:id', authenticateToken, requireModuleAccess('can_access_briefings'), async (req, res) => {
  try {
    const { title, client, description, content, status, priority, deadline } = req.body;
    const query = getQuery(req);
    await query(
      `UPDATE briefings
       SET title = COALESCE(?, title),
           client = COALESCE(?, client),
           description = COALESCE(?, description),
           content = COALESCE(?, content),
           status = COALESCE(?, status),
           priority = COALESCE(?, priority),
           deadline = COALESCE(?, deadline),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND (project_id IS NOT NULL OR user_id = ?)`,
      [title ?? null, client ?? null, description ?? null, content ?? null, status ?? null, priority ?? null, deadline ?? null, req.params.id, req.userId]
    );
    const result = await query('SELECT * FROM briefings WHERE id = ? AND (project_id IS NOT NULL OR user_id = ?)', [req.params.id, req.userId]);
    if (!result.rows?.length) return res.status(404).json({ error: 'Briefing nao encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar briefing:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/briefings/:id', authenticateToken, requireModuleAccess('can_access_briefings'), async (req, res) => {
  try {
    await getQuery(req)('DELETE FROM briefings WHERE id = ? AND (project_id IS NULL AND user_id = ?)', [req.params.id, req.userId]);
    res.json({ message: 'Briefing excluido com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir briefing:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Codes
router.get('/codes', authenticateToken, async (req, res) => {
  try {
    const result = await getQuery(req)('SELECT * FROM codes WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar codigos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/codes', authenticateToken, async (req, res) => {
  try {
    const { title, name, language, code_content, description } = req.body;
    if (!(title || name) || !language || !code_content) return res.status(400).json({ error: 'Titulo, linguagem e codigo sao obrigatorios' });
    const inserted = await getQuery(req)(
      'INSERT INTO codes (title, name, language, code_content, description, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [title || name, name || title, language, code_content, description || null, req.userId]
    );
    const result = await getQuery(req)('SELECT * FROM codes WHERE id = ?', [inserted.insertId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar codigo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/codes/:id', authenticateToken, async (req, res) => {
  try {
    const { title, name, language, code_content, description } = req.body;
    const query = getQuery(req);
    await query(
      `UPDATE codes
       SET title = COALESCE(?, title),
           name = COALESCE(?, name),
           language = COALESCE(?, language),
           code_content = COALESCE(?, code_content),
           description = COALESCE(?, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [title || name || null, name || title || null, language ?? null, code_content ?? null, description ?? null, req.params.id, req.userId]
    );
    const result = await queryById(query, 'codes', req.params.id, req.userId);
    if (!result) return res.status(404).json({ error: 'Codigo nao encontrado' });
    res.json(result);
  } catch (error) {
    console.error('Erro ao atualizar codigo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/codes/:id', authenticateToken, async (req, res) => {
  try {
    await getQuery(req)('DELETE FROM codes WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    res.json({ message: 'Codigo excluido com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir codigo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Dashboard
router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const { startDate, endDate, previousStartDate, previousEndDate, targetYear } = req.query;

    const currentStart = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const currentEnd = endDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10);
    const prevStart = previousStartDate || new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 10);
    const prevEnd = previousEndDate || new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10);

    const projectsResult = await query(
      `SELECT p.*, COALESCE(b.amount, 0) AS financial_legacy_baseline, COALESCE(SUM(CASE WHEN e.direction = 'credit' THEN e.amount ELSE -e.amount END), 0) AS financial_event_total, COUNT(e.id) AS financial_event_count
        FROM projects p LEFT JOIN project_financial_baselines b ON b.project_id = p.id LEFT JOIN project_financial_events e ON e.project_id = p.id
        WHERE p.user_id = ?
          AND (DATE(p.created_at) BETWEEN ? AND ? OR DATE(p.delivery_date) BETWEEN ? AND ? OR DATE(p.completion_date) BETWEEN ? AND ?)
        GROUP BY p.id`,
      [req.userId, currentStart, currentEnd, currentStart, currentEnd, currentStart, currentEnd]
    );
    const expensesResult = await query('SELECT * FROM expenses WHERE user_id = ?', [req.userId]);
    const previousProjectsResult = await query('SELECT * FROM projects WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ?', [req.userId, prevStart, prevEnd]);
    const eventRevenueResult = await query(
      `SELECT COALESCE(SUM(e.amount), 0) AS revenue
       FROM project_financial_events e
       JOIN projects p ON p.id = e.project_id
       WHERE p.user_id = ? AND e.direction = 'credit' AND e.competence_date BETWEEN ? AND ?`,
      [req.userId, currentStart, currentEnd]
    );
    const previousEventRevenueResult = await query(
      `SELECT COALESCE(SUM(e.amount), 0) AS revenue
       FROM project_financial_events e
       JOIN projects p ON p.id = e.project_id
       WHERE p.user_id = ? AND e.direction = 'credit' AND e.competence_date BETWEEN ? AND ?`,
      [req.userId, prevStart, prevEnd]
    );
    const unclassifiedLegacyResult = await query(
      `SELECT COALESCE(SUM(CASE WHEN b.amount IS NOT NULL THEN b.amount ELSE p.paid_value END), 0) AS amount
       FROM projects p
       LEFT JOIN project_financial_baselines b ON b.project_id = p.id
       WHERE p.user_id = ? AND p.status <> 'cancelled'
         AND (b.id IS NOT NULL OR (p.paid_value > 0 AND NOT EXISTS (SELECT 1 FROM project_financial_events e WHERE e.project_id = p.id)))`,
      [req.userId]
    );

    const projects = projectsResult.rows || [];
    const expenses = expensesResult.rows || [];
    const year = targetYear ? Number(targetYear) : new Date(`${currentStart}T00:00:00`).getFullYear();
    const month = new Date(`${currentStart}T00:00:00`).getMonth() + 1;

    const mappedExpenses = expenses.map((expense) => ({
      amount: parseNumber(expense.amount ?? expense.value),
      date: expense.date,
      category: expense.category || 'Sem categoria',
      billing_type: expense.billing_type || 'unica',
    }));

    const totalExpensesAmount = calculateTotalMonthlyExpenses(mappedExpenses, year, month);
    const totalProjectValue = projects.reduce((sum, project) => sum + parseNumber(project.project_value), 0);
    const totalPaidValue = projects.reduce((sum, project) => sum + parseNumber(project.paid_value), 0);
    const completedProjects = projects.filter((project) => project.status === 'completed');
    const currentRevenue = parseNumber(eventRevenueResult.rows?.[0]?.revenue);
    const previousRevenue = parseNumber(previousEventRevenueResult.rows?.[0]?.revenue);
    const currentReceivable = projects
      .filter((project) => project.status !== 'cancelled')
      .reduce((sum, project) => sum + Math.max(0, parseNumber(project.project_value) - parseNumber(project.paid_value)), 0);

    const categoryMap = new Map();
    mappedExpenses.forEach((expense) => {
      const current = categoryMap.get(expense.category) || { category: expense.category, total_amount: 0, count: 0 };
      current.total_amount += parseNumber(expense.amount);
      current.count += 1;
      categoryMap.set(expense.category, current);
    });

    const recentProjects = await query(
      'SELECT id, name, status, project_value, created_at FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [req.userId]
    );

    res.json({
      projects: {
        total_projects: projects.length,
        active_projects: projects.filter((project) => project.status === 'active').length,
        completed_projects: projects.filter((project) => project.status === 'completed').length,
        paused_projects: projects.filter((project) => project.status === 'paused').length,
        total_project_value: totalProjectValue,
        total_paid_value: totalPaidValue,
      },
      expenses: {
        total_expenses: expenses.length,
        total_expenses_amount: totalExpensesAmount,
        expense_categories: categoryMap.size,
      },
      previous_period: {
        revenue: previousRevenue,
        expenses: 0,
        receivable: 0,
      },
      current_period: {
        revenue: currentRevenue,
        expenses: totalExpensesAmount,
        profit: currentRevenue - totalExpensesAmount,
        receivable: currentReceivable,
      },
      current_receivable: currentReceivable,
      unclassified_legacy_revenue: parseNumber(unclassifiedLegacyResult.rows?.[0]?.amount),
      revenue_by_month: [{ month: `${year}-${String(month).padStart(2, '0')}`, revenue: currentRevenue, expenses: totalExpensesAmount }],
      expenses_by_category: Array.from(categoryMap.values()),
      recent_projects: recentProjects.rows || [],
    });
  } catch (error) {
    console.error('Erro ao buscar estatisticas do dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
