const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const { calculateTotalMonthlyExpenses } = require('../utils/billing-calculations');

// Middleware para acessar a função query
const getQuery = (req) => req.app.locals.query;

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.dashboard_SUPABASE_JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    console.error('Erro na autenticação:', error.message);
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// ===== USERS =====

// GET /api/users
router.get('/users', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      'SELECT id, email, full_name, position, avatar_url, is_active, created_at, updated_at, can_access_dashboard, can_access_briefings, can_access_codes, can_access_projects, can_access_expenses, can_access_crm, can_access_users FROM users WHERE is_active = true ORDER BY created_at DESC'
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/users/:id
router.get('/users/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      'SELECT id, email, full_name, position, avatar_url, is_active, created_at, updated_at, can_access_dashboard, can_access_briefings, can_access_codes, can_access_projects, can_access_expenses, can_access_crm, can_access_users FROM users WHERE id = ? AND is_active = true',
      [req.params.id]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/users/:id
router.put('/users/:id', authenticateToken, async (req, res) => {
  try {
    const { full_name, position, avatar_url, is_active } = req.body;
    const query = getQuery(req);
    
    // Se o cargo for Administrador, dar todas as permissões automaticamente
    const permissions = position === 'Administrador' ? {
      can_access_dashboard: true,
      can_access_projects: true,
      can_access_expenses: true,
      can_access_crm: true,
      can_access_briefings: true,
      can_access_codes: true,
      can_access_users: true
    } : {
      can_access_dashboard: req.body.can_access_dashboard,
      can_access_projects: req.body.can_access_projects,
      can_access_expenses: req.body.can_access_expenses,
      can_access_crm: req.body.can_access_crm,
      can_access_briefings: req.body.can_access_briefings,
      can_access_codes: req.body.can_access_codes,
      can_access_users: req.body.can_access_users
    };
    
    // Tratar valores undefined como null
    const params = [
      full_name !== undefined ? full_name : null,
      position !== undefined ? position : null,
      avatar_url !== undefined ? avatar_url : null,
      is_active !== undefined ? is_active : null,
      permissions.can_access_dashboard !== undefined ? permissions.can_access_dashboard : null,
      permissions.can_access_briefings !== undefined ? permissions.can_access_briefings : null,
      permissions.can_access_codes !== undefined ? permissions.can_access_codes : null,
      permissions.can_access_projects !== undefined ? permissions.can_access_projects : null,
      permissions.can_access_expenses !== undefined ? permissions.can_access_expenses : null,
      permissions.can_access_crm !== undefined ? permissions.can_access_crm : null,
      permissions.can_access_users !== undefined ? permissions.can_access_users : null,
      req.params.id
    ];
    
    await query(
      `UPDATE users 
       SET full_name = COALESCE(?, full_name),
           position = COALESCE(?, position),
           avatar_url = COALESCE(?, avatar_url),
           is_active = COALESCE(?, is_active),
           can_access_dashboard = COALESCE(?, can_access_dashboard),
           can_access_briefings = COALESCE(?, can_access_briefings),
           can_access_codes = COALESCE(?, can_access_codes),
           can_access_projects = COALESCE(?, can_access_projects),
           can_access_expenses = COALESCE(?, can_access_expenses),
           can_access_crm = COALESCE(?, can_access_crm),
           can_access_users = COALESCE(?, can_access_users),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      params
    );
    
    const result = await query(
      'SELECT id, email, full_name, position, avatar_url, is_active, created_at, updated_at, can_access_dashboard, can_access_briefings, can_access_codes, can_access_projects, can_access_expenses, can_access_crm, can_access_users FROM users WHERE id = ?',
      [req.params.id]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/users
router.post('/users', authenticateToken, async (req, res) => {
  try {
    const { 
      email, 
      password_hash, 
      full_name, 
      position, 
      bio, 
      can_access_dashboard,
      can_access_projects,
      can_access_expenses,
      can_access_crm,
      can_access_briefings,
      can_access_codes,
      can_access_users
    } = req.body;
    const query = getQuery(req);
    
    if (!email || !password_hash) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Verificar se o email já existe
    const existingUserResult = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUserResult.rows && existingUserResult.rows.length > 0) {
      return res.status(409).json({ error: 'Este email já está em uso' });
    }

    // Validar parâmetros obrigatórios
    if (!email || !password_hash || !full_name || !position) {
      return res.status(400).json({ 
        error: 'Parâmetros obrigatórios ausentes',
        missing: {
          email: !email,
          password_hash: !password_hash,
          full_name: !full_name,
          position: !position
        }
      });
    }

    // Hash da senha se não estiver hasheada
    const bcrypt = require('bcryptjs');
    const hashedPassword = (password_hash && password_hash.startsWith('$2')) ? password_hash : await bcrypt.hash(password_hash, 10);

    // Se o cargo for Administrador, dar todas as permissões automaticamente
    const permissions = position === 'Administrador' ? {
      can_access_dashboard: true,
      can_access_projects: true,
      can_access_expenses: true,
      can_access_crm: true,
      can_access_briefings: true,
      can_access_codes: true,
      can_access_users: true
    } : {
      can_access_dashboard: can_access_dashboard || false,
      can_access_projects: can_access_projects || false,
      can_access_expenses: can_access_expenses || false,
      can_access_crm: can_access_crm || false,
      can_access_briefings: can_access_briefings || false,
      can_access_codes: can_access_codes || false,
      can_access_users: can_access_users || false
    };

    // Inserir novo usuário com permissões
    const insertResult = await query(
      `INSERT INTO users (
        email, password_hash, full_name, position, is_active,
        can_access_dashboard, can_access_projects, can_access_expenses,
        can_access_crm, can_access_briefings, can_access_codes, can_access_users
      ) VALUES (?, ?, ?, ?, true, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email, hashedPassword, full_name, position,
        permissions.can_access_dashboard,
        permissions.can_access_projects,
        permissions.can_access_expenses,
        permissions.can_access_crm,
        permissions.can_access_briefings,
        permissions.can_access_codes,
        permissions.can_access_users
      ]
    );
    
    // Buscar o usuário inserido pelo email (já que a tabela usa UUID)
    const result = await query(
      'SELECT id, email, full_name, position, bio, avatar_url, is_active, created_at, updated_at FROM users WHERE email = ?',
      [email]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(500).json({ error: 'Erro ao criar usuário' });
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/users/:id
router.delete('/users/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    await query(
      'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ message: 'Usuário desativado com sucesso' });
  } catch (error) {
    console.error('Erro ao desativar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== PROJECTS =====

// GET /api/projects
router.get('/projects', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar projetos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/projects/:id
router.get('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/projects
router.post('/projects', authenticateToken, async (req, res) => {
  try {
    const { name, client, project_type, status, description, project_value, paid_value, delivery_date } = req.body;
    const query = getQuery(req);
    
    if (!name) {
      return res.status(400).json({ error: 'Nome do projeto é obrigatório' });
    }
    
    await query(
      `INSERT INTO projects (user_id, name, client, project_type, status, description, project_value, paid_value, delivery_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [req.userId, name, client, project_type, status || 'active', description, project_value, paid_value || 0, delivery_date]
    );
    
    const result = await query(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.userId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/projects/:id
router.put('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const { name, client, project_type, status, description, project_value, paid_value, delivery_date } = req.body;
    const query = getQuery(req);
    
    // Converter data para formato MySQL se fornecida
    let formattedDate = delivery_date;
    if (delivery_date && delivery_date !== null) {
      const date = new Date(delivery_date);
      if (!isNaN(date.getTime())) {
        formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else {
        formattedDate = null;
      }
    }
    
    // Converter undefined para null para evitar erro do MySQL
    const params = [
      name ?? null,
      client ?? null, 
      project_type ?? null,
      status ?? null,
      description ?? null,
      project_value ?? null,
      paid_value ?? null,
      formattedDate ?? null,
      req.params.id,
      req.userId
    ];
    
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
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?`,
       params
     );
    
    const result = await query(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/projects/:id
router.delete('/projects/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    await query(
      'DELETE FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId]
    );
    
    res.json({ message: 'Projeto excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir projeto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== EXPENSES =====

// GET /api/expenses
router.get('/expenses', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT e.*, p.name as project_name 
       FROM expenses e 
       LEFT JOIN projects p ON e.project_id = p.id 
       WHERE p.user_id = ? 
       ORDER BY e.expense_date DESC`,
      [req.userId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar despesas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/expenses/:id
router.get('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT e.*, p.name as project_name 
       FROM expenses e 
       LEFT JOIN projects p ON e.project_id = p.id 
       WHERE e.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar despesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/expenses
router.post('/expenses', authenticateToken, async (req, res) => {
  try {
    const { 
      project_id, 
      description, 
      amount, 
      category, 
      date,
      billing_type,
      notes,
      is_recurring,
      recurring_day_of_week,
      recurring_end_date,
      status
    } = req.body;
    const query = getQuery(req);
    
    if (!project_id || !description || !amount) {
      return res.status(400).json({ error: 'Projeto, descrição e valor são obrigatórios' });
    }
    
    // Verificar se o projeto pertence ao usuário
    const projectResult = await query(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?',
      [project_id, req.userId]
    );
    
    if (!projectResult.rows || projectResult.rows.length === 0) {
      return res.status(403).json({ error: 'Projeto não encontrado ou não autorizado' });
    }
    
    await query(
      `INSERT INTO expenses (
        project_id, description, amount, category, expense_date, user_id, 
        billing_type, notes, is_recurring, recurring_day_of_week, 
        recurring_end_date, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        project_id, 
        description, 
        amount, 
        category, 
        date || new Date().toISOString().split('T')[0], 
        req.userId,
        billing_type || 'unica',
        notes || null,
        is_recurring || false,
        recurring_day_of_week || null,
        recurring_end_date || null,
        status || 'pending'
      ]
    );
    
    const result = await query(
      `SELECT e.*, p.name as project_name 
       FROM expenses e 
       LEFT JOIN projects p ON e.project_id = p.id 
       WHERE p.user_id = ? 
       ORDER BY e.created_at DESC LIMIT 1`,
      [req.userId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar despesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/expenses/:id
router.put('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const { description, amount, category, date, billing_type, notes, is_recurring, recurring_day_of_week, recurring_end_date } = req.body;
    const query = getQuery(req);
    
    // Verificar se a despesa existe e pertence ao usuário
    const expenseCheck = await query(
      `SELECT id FROM expenses WHERE id = ? AND user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!expenseCheck.rows || expenseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }
    
    // Tratar valores undefined como null
    const params = [
      description !== undefined ? description : null,
      amount !== undefined ? amount : null,
      category !== undefined ? category : null,
      date !== undefined ? date : null,
      billing_type !== undefined ? billing_type : null,
      notes !== undefined ? notes : null,
      is_recurring !== undefined ? is_recurring : null,
      recurring_day_of_week !== undefined ? recurring_day_of_week : null,
      recurring_end_date !== undefined ? recurring_end_date : null,
      new Date().toISOString(),
      req.params.id
    ];
    
    await query(
      `UPDATE expenses 
       SET description = COALESCE(?, description),
           amount = COALESCE(?, amount),
           category = COALESCE(?, category),
           expense_date = COALESCE(?, expense_date),
           billing_type = COALESCE(?, billing_type),
           notes = COALESCE(?, notes),
           is_recurring = COALESCE(?, is_recurring),
           recurring_day_of_week = COALESCE(?, recurring_day_of_week),
           recurring_end_date = COALESCE(?, recurring_end_date),
           updated_at = ?
       WHERE id = ?`,
      params
    );
    
    const result = await query(
      `SELECT * FROM expenses WHERE id = ?`,
      [req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar despesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/expenses/:id
router.delete('/expenses/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    // Verificar se a despesa pertence ao usuário
    const expenseCheck = await query(
      `SELECT e.id FROM expenses e 
       LEFT JOIN projects p ON e.project_id = p.id 
       WHERE e.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!expenseCheck.rows || expenseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Despesa não encontrada' });
    }
    
    await query(
      'DELETE FROM expenses WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ message: 'Despesa excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir despesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== PARCELS =====

// GET /api/parcels
router.get('/parcels', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT pa.*, p.name as project_name 
       FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE p.user_id = ? 
       ORDER BY pa.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar parcelas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/parcels/:id
router.get('/parcels/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT pa.*, p.name as project_name 
       FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE pa.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/parcels
router.post('/parcels', authenticateToken, async (req, res) => {
  try {
    const { project_id, name, area, soil_type, coordinates } = req.body;
    const query = getQuery(req);
    
    if (!project_id || !name) {
      return res.status(400).json({ error: 'Projeto e nome são obrigatórios' });
    }
    
    // Verificar se o projeto pertence ao usuário
    const projectResult = await query(
      'SELECT id FROM projects WHERE id = ? AND user_id = ?',
      [project_id, req.userId]
    );
    
    if (!projectResult.rows || projectResult.rows.length === 0) {
      return res.status(403).json({ error: 'Projeto não encontrado ou não autorizado' });
    }
    
    await query(
      `INSERT INTO parcels (project_id, name, area, soil_type, coordinates, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [project_id, name, area, soil_type, coordinates]
    );
    
    const result = await query(
      `SELECT pa.*, p.name as project_name 
       FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE p.user_id = ? 
       ORDER BY pa.created_at DESC LIMIT 1`,
      [req.userId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/parcels/:id
router.put('/parcels/:id', authenticateToken, async (req, res) => {
  try {
    const { name, area, soil_type, coordinates } = req.body;
    const query = getQuery(req);
    
    // Verificar se a parcela pertence ao usuário
    const parcelCheck = await query(
      `SELECT pa.id FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE pa.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!parcelCheck.rows || parcelCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }
    
    // Tratar valores undefined como null
    const params = [
      name !== undefined ? name : null,
      area !== undefined ? area : null,
      soil_type !== undefined ? soil_type : null,
      coordinates !== undefined ? coordinates : null,
      req.params.id
    ];
    
    await query(
      `UPDATE parcels 
       SET name = COALESCE(?, name),
           area = COALESCE(?, area),
           soil_type = COALESCE(?, soil_type),
           coordinates = COALESCE(?, coordinates),
           updated_at = NOW()
       WHERE id = ?`,
      params
    );
    
    const result = await query(
      `SELECT pa.*, p.name as project_name 
       FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE pa.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/parcels/:id
router.delete('/parcels/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    // Verificar se a parcela pertence ao usuário
    const parcelCheck = await query(
      `SELECT pa.id FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE pa.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!parcelCheck.rows || parcelCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Parcela não encontrada' });
    }
    
    await query(
      'DELETE FROM parcels WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ message: 'Parcela excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir parcela:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== CROPS =====

// GET /api/crops
router.get('/crops', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT c.*, pa.name as parcel_name, p.name as project_name 
       FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE p.user_id = ? 
       ORDER BY c.created_at DESC`,
      [req.userId]
    );
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar culturas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/crops/:id
router.get('/crops/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      `SELECT c.*, pa.name as parcel_name, p.name as project_name 
       FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE c.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Cultura não encontrada' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar cultura:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/crops
router.post('/crops', authenticateToken, async (req, res) => {
  try {
    const { parcel_id, name, variety, planting_date, expected_harvest_date, status } = req.body;
    const query = getQuery(req);
    
    if (!parcel_id || !name) {
      return res.status(400).json({ error: 'Parcela e nome são obrigatórios' });
    }
    
    // Verificar se a parcela pertence ao usuário
    const parcelResult = await query(
      `SELECT pa.id FROM parcels pa 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE pa.id = ? AND p.user_id = ?`,
      [parcel_id, req.userId]
    );
    
    if (!parcelResult.rows || parcelResult.rows.length === 0) {
      return res.status(403).json({ error: 'Parcela não encontrada ou não autorizada' });
    }
    
    await query(
      `INSERT INTO crops (parcel_id, name, variety, planting_date, expected_harvest_date, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [parcel_id, name, variety, planting_date, expected_harvest_date, status || 'planted']
    );
    
    const result = await query(
      `SELECT c.*, pa.name as parcel_name, p.name as project_name 
       FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE p.user_id = ? 
       ORDER BY c.created_at DESC LIMIT 1`,
      [req.userId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao criar cultura:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/crops/:id
router.put('/crops/:id', authenticateToken, async (req, res) => {
  try {
    const { name, variety, planting_date, expected_harvest_date, status } = req.body;
    const query = getQuery(req);
    
    // Verificar se a cultura pertence ao usuário
    const cropCheck = await query(
      `SELECT c.id FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE c.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!cropCheck.rows || cropCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cultura não encontrada' });
    }
    
    // Tratar valores undefined como null
    const params = [
      name !== undefined ? name : null,
      variety !== undefined ? variety : null,
      planting_date !== undefined ? planting_date : null,
      expected_harvest_date !== undefined ? expected_harvest_date : null,
      status !== undefined ? status : null,
      req.params.id
    ];
    
    await query(
      `UPDATE crops 
       SET name = COALESCE(?, name),
           variety = COALESCE(?, variety),
           planting_date = COALESCE(?, planting_date),
           expected_harvest_date = COALESCE(?, expected_harvest_date),
           status = COALESCE(?, status),
           updated_at = NOW()
       WHERE id = ?`,
      params
    );
    
    const result = await query(
      `SELECT c.*, pa.name as parcel_name, p.name as project_name 
       FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE c.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar cultura:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/crops/:id
router.delete('/crops/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    // Verificar se a cultura pertence ao usuário
    const cropCheck = await query(
      `SELECT c.id FROM crops c 
       LEFT JOIN parcels pa ON c.parcel_id = pa.id 
       LEFT JOIN projects p ON pa.project_id = p.id 
       WHERE c.id = ? AND p.user_id = ?`,
      [req.params.id, req.userId]
    );
    
    if (!cropCheck.rows || cropCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Cultura não encontrada' });
    }
    
    await query(
      'DELETE FROM crops WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ message: 'Cultura excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir cultura:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/dashboard/stats - Buscar estatísticas do dashboard
router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const { startDate, endDate, previousStartDate, previousEndDate } = req.query;
    
    // Se não há filtros de data, usar período atual (mês atual)
    const currentStart = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const currentEnd = endDate || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0];
    
    // Período anterior (mês anterior)
    const prevStart = previousStartDate || new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().split('T')[0];
    const prevEnd = previousEndDate || new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().split('T')[0];
    
    // Buscar estatísticas de projetos do período atual
    const projectStats = await query(
      `SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_projects,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
        COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_projects,
        COALESCE(SUM(project_value), 0) as total_project_value,
        COALESCE(SUM(paid_value), 0) as total_paid_value_creation,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN project_value - paid_value ELSE 0 END), 0) as total_completion_revenue
       FROM projects 
       WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ?`,
      [req.userId, currentStart, currentEnd]
    );
    
    // Buscar estatísticas de projetos do período anterior
    const previousProjectStats = await query(
      `SELECT 
        COALESCE(SUM(paid_value), 0) as total_paid_value
       FROM projects 
       WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ?`,
      [req.userId, prevStart, prevEnd]
    );
    
    // Buscar todas as despesas do período atual para cálculo mensal
    const currentExpenses = await query(
      `SELECT 
        e.amount,
        e.expense_date,
        e.date,
        e.category,
        e.billing_type
       FROM expenses e
       LEFT JOIN projects p ON e.project_id = p.id
       WHERE p.user_id = ? AND DATE(e.created_at) BETWEEN ? AND ?`,
      [req.userId, currentStart, currentEnd]
    );
    
    // Calcular estatísticas de despesas atuais
    const currentExpensesArray = currentExpenses?.rows || [];
    const currentDate = new Date(currentStart);
    const totalExpensesAmount = calculateTotalMonthlyExpenses(
      currentExpensesArray,
      currentDate.getFullYear(),
      currentDate.getMonth() + 1
    );
    
    const expenseStats = [{
      total_expenses: currentExpensesArray.length,
      total_expenses_amount: totalExpensesAmount,
      expense_categories: [...new Set(currentExpensesArray.map(e => e.category))].length
    }];
    
    // Buscar todas as despesas do período anterior para cálculo mensal
    const previousExpenses = await query(
      `SELECT 
        e.amount,
        e.expense_date,
        e.date,
        e.billing_type
       FROM expenses e
       LEFT JOIN projects p ON e.project_id = p.id
       WHERE p.user_id = ? AND DATE(e.created_at) BETWEEN ? AND ?`,
      [req.userId, prevStart, prevEnd]
    );
    
    // Calcular estatísticas de despesas do período anterior
    const previousExpensesArray = previousExpenses?.rows || [];
    const prevDate = new Date(prevStart);
    const previousTotalExpensesAmount = calculateTotalMonthlyExpenses(
      previousExpensesArray,
      prevDate.getFullYear(),
      prevDate.getMonth() + 1
    );
    
    const previousExpenseStats = [{
      total_expenses_amount: previousTotalExpensesAmount
    }];
    
    // Buscar dados de faturamento por período filtrado
    const revenueByMonth = await query(
      `SELECT 
        strftime('%Y-%m', created_at) as month,
        COALESCE(SUM(paid_value), 0) as revenue
       FROM projects 
       WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY strftime('%Y-%m', created_at)
       ORDER BY month`,
      [req.userId, currentStart, currentEnd]
    );
    
    // Buscar dados de despesas por mês
    const expensesByMonth = await query(
      `SELECT 
        strftime('%Y-%m', e.expense_date) as month,
        COALESCE(SUM(e.amount), 0) as expenses
       FROM expenses e
       LEFT JOIN projects p ON e.project_id = p.id
       WHERE p.user_id = ? AND DATE(e.expense_date) BETWEEN ? AND ?
       GROUP BY strftime('%Y-%m', e.expense_date)
       ORDER BY month`,
      [req.userId, currentStart, currentEnd]
    );
    
    // Combinar dados de faturamento e despesas por mês
    const revenueData = revenueByMonth.rows || [];
    const expensesData = expensesByMonth.rows || [];
    
    // Criar um mapa de todos os meses com dados
    const monthlyDataMap = new Map();
    
    // Adicionar dados de faturamento
    revenueData.forEach(item => {
      monthlyDataMap.set(item.month, {
        month: item.month,
        revenue: parseFloat(item.revenue) || 0,
        expenses: 0
      });
    });
    
    // Adicionar dados de despesas
    expensesData.forEach(item => {
      if (monthlyDataMap.has(item.month)) {
        monthlyDataMap.get(item.month).expenses = parseFloat(item.expenses) || 0;
      } else {
        monthlyDataMap.set(item.month, {
          month: item.month,
          revenue: 0,
          expenses: parseFloat(item.expenses) || 0
        });
      }
    });
    
    // Converter mapa para array ordenado
    const combinedMonthlyData = Array.from(monthlyDataMap.values())
      .sort((a, b) => a.month.localeCompare(b.month));
    
    // Buscar despesas por categoria do período atual
    const expensesByCategoryRaw = await query(
      `SELECT 
        category,
        amount,
        expense_date
       FROM expenses e
       LEFT JOIN projects p ON e.project_id = p.id
       WHERE p.user_id = ? AND category IS NOT NULL AND DATE(e.created_at) BETWEEN ? AND ?
       ORDER BY category`,
      [req.userId, currentStart, currentEnd]
    );
    
    // Agrupar e calcular totais mensais por categoria
    const categoryTotals = {};
    const expensesByCategoryArray = expensesByCategoryRaw?.rows || [];
    expensesByCategoryArray.forEach(expense => {
      const monthlyAmount = calculateTotalMonthlyExpenses(
        [expense],
        currentDate.getFullYear(),
        currentDate.getMonth() + 1
      );
      
      if (!categoryTotals[expense.category]) {
        categoryTotals[expense.category] = {
          total_amount: 0,
          count: 0
        };
      }
      
      categoryTotals[expense.category].total_amount += monthlyAmount;
      categoryTotals[expense.category].count += 1;
    });
    
    const expensesByCategory = Object.entries(categoryTotals)
      .map(([category, data]) => ({
        category,
        total_amount: data.total_amount,
        count: data.count
      }))
      .sort((a, b) => b.total_amount - a.total_amount);
    
    // Buscar projetos recentes do período atual
    const recentProjects = await query(
      `SELECT id, name, status, project_value, created_at
       FROM projects 
       WHERE user_id = ? AND DATE(created_at) BETWEEN ? AND ?
       ORDER BY created_at DESC
       LIMIT 5`,
      [req.userId, currentStart, currentEnd]
    );
    
    const currentProjectsRaw = projectStats.rows?.[0] || {
      total_projects: 0,
      active_projects: 0,
      completed_projects: 0,
      paused_projects: 0,
      total_project_value: 0,
      total_paid_value_creation: 0,
      total_completion_revenue: 0
    };
    
    // Converter valores para números
     const currentProjects = {
       total_projects: parseInt(currentProjectsRaw.total_projects) || 0,
       active_projects: parseInt(currentProjectsRaw.active_projects) || 0,
       completed_projects: parseInt(currentProjectsRaw.completed_projects) || 0,
       paused_projects: parseInt(currentProjectsRaw.paused_projects) || 0,
       total_project_value: parseFloat(currentProjectsRaw.total_project_value) || 0,
       // Combinar faturamento de criação e conclusão
       total_paid_value: (parseFloat(currentProjectsRaw.total_paid_value_creation) || 0) + (parseFloat(currentProjectsRaw.total_completion_revenue) || 0)
     };
    
    const currentExpensesStats = expenseStats[0] || {
      total_expenses: 0,
      total_expenses_amount: 0,
      expense_categories: 0
    };
    
    const previousProjectsRaw = previousProjectStats.rows?.[0] || {
      total_paid_value: 0
    };
    
    const previousProjects = {
      total_paid_value: parseFloat(previousProjectsRaw.total_paid_value) || 0
    };
    const previousExpensesStats = previousExpenseStats[0] || { total_expenses_amount: 0 };
    
    const stats = {
      projects: currentProjects,
      expenses: currentExpensesStats,
      previous_period: {
        revenue: previousProjects.total_paid_value,
        expenses: previousExpensesStats.total_expenses_amount,
        receivable: 0 // Pode ser calculado se necessário
      },
      revenue_by_month: combinedMonthlyData,
      expenses_by_category: expensesByCategory || [],
      recent_projects: recentProjects.rows || []
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas do dashboard:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== CODES =====

// GET /api/codes
router.get('/codes', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const { search, code_type } = req.query;
    
    let sql = 'SELECT * FROM codes WHERE 1=1';
    const params = [];
    
    if (search) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (code_type && code_type !== 'all') {
      sql += ' AND code_type = ?';
      params.push(code_type);
    }
    
    sql += ' ORDER BY created_at DESC';
    
    const result = await query(sql, params);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Erro ao buscar códigos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/codes/:id
router.get('/codes/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    const result = await query(
      'SELECT * FROM codes WHERE id = ?',
      [req.params.id]
    );
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Código não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/codes
router.post('/codes', authenticateToken, async (req, res) => {
  try {
    const { title, language, code_content, description } = req.body;
    
    if (!title || !language || !code_content) {
      return res.status(400).json({ error: 'Título, linguagem e conteúdo do código são obrigatórios' });
    }
    
    if (!['css', 'html', 'javascript'].includes(language)) {
      return res.status(400).json({ error: 'Linguagem de código inválida' });
    }
    
    const query = getQuery(req);
    const result = await query(
      'INSERT INTO codes (title, language, code_content, description, user_id) VALUES (?, ?, ?, ?, ?)',
      [title, language, code_content, description || null, req.userId]
    );
    
    const newCode = await query(
      'SELECT * FROM codes WHERE id = ?',
      [result.insertId]
    );
    
    res.status(201).json(newCode.rows[0]);
  } catch (error) {
    console.error('Erro ao criar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/codes/:id
router.put('/codes/:id', authenticateToken, async (req, res) => {
  try {
    const { title, language, code_content, description } = req.body;
    
    if (!title || !language || !code_content) {
      return res.status(400).json({ error: 'Título, linguagem e conteúdo do código são obrigatórios' });
    }
    
    if (!['css', 'html', 'javascript'].includes(language)) {
      return res.status(400).json({ error: 'Linguagem de código inválida' });
    }
    
    const query = getQuery(req);
    
    // Verificar se o código existe
    const existingCode = await query(
      'SELECT * FROM codes WHERE id = ?',
      [req.params.id]
    );
    
    if (!existingCode.rows || existingCode.rows.length === 0) {
      return res.status(404).json({ error: 'Código não encontrado' });
    }
    
    await query(
      'UPDATE codes SET name = ?, code_type = ?, code_content = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, code_type, code_content, description || null, req.params.id]
    );
    
    const updatedCode = await query(
      'SELECT * FROM codes WHERE id = ?',
      [req.params.id]
    );
    
    res.json(updatedCode.rows[0]);
  } catch (error) {
    console.error('Erro ao atualizar código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/codes/:id
router.delete('/codes/:id', authenticateToken, async (req, res) => {
  try {
    const query = getQuery(req);
    
    // Verificar se o código existe
    const existingCode = await query(
      'SELECT * FROM codes WHERE id = ?',
      [req.params.id]
    );
    
    if (!existingCode.rows || existingCode.rows.length === 0) {
      return res.status(404).json({ error: 'Código não encontrado' });
    }
    
    await query(
      'DELETE FROM codes WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ message: 'Código excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir código:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;