const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { calculateTotalMonthlyExpenses } = require('../utils/billing-calculations');

const router = express.Router();

const getQuery = (req) => req.app.locals.query;

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
router.get('/projects', authenticateToken, async (req, res) => {
  try {
    const result = await getQuery(req)('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar projetos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/projects', authenticateToken, async (req, res) => {
  try {
    const { name, client, client_name, project_type, status, description, project_value, paid_value, delivery_date, completion_date } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome do projeto e obrigatorio' });
    const query = getQuery(req);
    const inserted = await query(
      `INSERT INTO projects (user_id, name, client, project_type, status, description, project_value, paid_value, delivery_date, completion_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [req.userId, name, client || client_name || null, project_type || 'website', status || 'active', description || null, project_value || 0, paid_value || 0, delivery_date || null, completion_date || null]
    );
    const result = await query('SELECT * FROM projects WHERE id = ?', [inserted.insertId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { name, client, client_name, project_type, status, description, project_value, paid_value, delivery_date, completion_date } = req.body;
    const query = getQuery(req);
    await query(
      `UPDATE projects
       SET name = COALESCE(?, name),
           client = COALESCE(?, client),
           project_type = COALESCE(?, project_type),
           status = COALESCE(?, status),
           description = COALESCE(?, description),
           project_value = COALESCE(?, project_value),
           paid_value = COALESCE(?, paid_value),
           delivery_date = COALESCE(?, delivery_date),
           completion_date = COALESCE(?, completion_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [name ?? null, client || client_name || null, project_type ?? null, status ?? null, description ?? null, project_value ?? null, paid_value ?? null, delivery_date ?? null, completion_date ?? null, req.params.id, req.userId]
    );
    const result = await query('SELECT * FROM projects WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!result.rows?.length) return res.status(404).json({ error: 'Projeto nao encontrado' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/projects/:id', authenticateToken, async (req, res) => {
  try {
    await getQuery(req)('DELETE FROM projects WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
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
router.get('/briefings', authenticateToken, async (req, res) => {
  try {
    const result = await getQuery(req)('SELECT * FROM briefings WHERE user_id = ? ORDER BY created_at DESC', [req.userId]);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar briefings:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/briefings', authenticateToken, async (req, res) => {
  try {
    const { title, client, description, content, status, priority, deadline } = req.body;
    if (!title) return res.status(400).json({ error: 'Titulo e obrigatorio' });
    const inserted = await getQuery(req)(
      `INSERT INTO briefings (title, client, description, content, status, priority, deadline, user_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [title, client || null, description || null, content || description || null, status || 'pending', priority || 'medium', deadline || null, req.userId]
    );
    const result = await getQuery(req)('SELECT * FROM briefings WHERE id = ?', [inserted.insertId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar briefing:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/briefings/:id', authenticateToken, async (req, res) => {
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
       WHERE id = ? AND user_id = ?`,
      [title ?? null, client ?? null, description ?? null, content ?? null, status ?? null, priority ?? null, deadline ?? null, req.params.id, req.userId]
    );
    const result = await queryById(query, 'briefings', req.params.id, req.userId);
    if (!result) return res.status(404).json({ error: 'Briefing nao encontrado' });
    res.json(result);
  } catch (error) {
    console.error('Erro ao atualizar briefing:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/briefings/:id', authenticateToken, async (req, res) => {
  try {
    await getQuery(req)('DELETE FROM briefings WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
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
      `SELECT *
       FROM projects
       WHERE user_id = ?
         AND (DATE(created_at) BETWEEN ? AND ? OR DATE(delivery_date) BETWEEN ? AND ? OR DATE(completion_date) BETWEEN ? AND ?)`,
      [req.userId, currentStart, currentEnd, currentStart, currentEnd, currentStart, currentEnd]
    );
    const expensesResult = await query('SELECT * FROM expenses WHERE user_id = ?', [req.userId]);
    const previousProjectsResult = await query('SELECT * FROM projects WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ?', [req.userId, prevStart, prevEnd]);

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
    const previousRevenue = (previousProjectsResult.rows || []).reduce((sum, project) => sum + parseNumber(project.paid_value), 0);

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
        revenue: totalPaidValue,
        expenses: totalExpensesAmount,
        profit: totalPaidValue - totalExpensesAmount,
        receivable: Math.max(0, totalProjectValue - totalPaidValue),
      },
      current_receivable: Math.max(0, totalProjectValue - totalPaidValue),
      revenue_by_month: [{ month: `${year}-${String(month).padStart(2, '0')}`, revenue: totalPaidValue, expenses: totalExpensesAmount }],
      expenses_by_category: Array.from(categoryMap.values()),
      recent_projects: recentProjects.rows || [],
    });
  } catch (error) {
    console.error('Erro ao buscar estatisticas do dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
