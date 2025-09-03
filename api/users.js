const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('./db');

// Configuração CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

// Middleware de autenticação
function authenticateToken(req) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new Error('Token de acesso requerido');
  }

  try {
    const decoded = jwt.verify(token, process.env.dashboard_SUPABASE_JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Token inválido');
  }
}

module.exports = async (req, res) => {
  // Configurar CORS
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Autenticar usuário
    const user = authenticateToken(req);

    switch (req.method) {
      case 'GET':
        return await getUsers(req, res, user);
      case 'POST':
        return await createUser(req, res, user);
      case 'PUT':
        return await updateUser(req, res, user);
      case 'DELETE':
        return await deleteUser(req, res, user);
      default:
        return res.status(405).json({ error: 'Método não permitido' });
    }
  } catch (error) {
    console.error('Erro na API de usuários:', error);
    if (error.message === 'Token de acesso requerido' || error.message === 'Token inválido') {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Listar usuários
async function getUsers(req, res, user) {
  try {
    const { id } = req.query;
    
    if (id) {
      // GET /api/users/[id]
      const result = await query('SELECT * FROM users WHERE id = $1', [id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      
      const userData = result.rows[0];
      delete userData.password;
      
      res.json(userData);
    } else {
      // GET /api/users
      const result = await query('SELECT * FROM users WHERE is_active = 1 ORDER BY created_at DESC');
      
      const users = result.rows.map(user => {
        delete user.password;
        return user;
      });

      res.json(users);
    }
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
}

// Criar usuário
async function createUser(req, res, user) {
  try {
    const { email, password, full_name, position, permissions } = req.body;
    
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, senha e nome completo são obrigatórios' });
    }

    // Verificar se email já existe
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email já está em uso' });
    }

    // Hash da senha
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Criar novo usuário no MySQL
    const insertResult = await query(
      `INSERT INTO users (email, password, full_name, position, is_active, created_at, updated_at,
       can_access_dashboard, can_access_briefings, can_access_codes, can_access_projects,
       can_access_expenses, can_access_crm, can_access_users)
       VALUES (?, ?, ?, ?, 1, NOW(), NOW(), ?, ?, ?, ?, ?, ?, ?)`,
      [
        email,
        password_hash,
        full_name,
        position || 'Usuário',
        permissions?.can_access_dashboard || false,
        permissions?.can_access_briefings || false,
        permissions?.can_access_codes || false,
        permissions?.can_access_projects || false,
        permissions?.can_access_expenses || false,
        permissions?.can_access_crm || false,
        permissions?.can_access_users || false
      ]
    );

    const userId = insertResult.rows.insertId;

    res.status(201).json({ 
      message: 'Usuário criado com sucesso', 
      id: userId 
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

// Atualizar usuário
async function updateUser(req, res, user) {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    const updateData = req.body;

    // Campos permitidos para atualização
    const allowedFields = [
      'full_name', 'position', 'avatar_url',
      'can_access_dashboard', 'can_access_briefings', 'can_access_codes',
      'can_access_projects', 'can_access_expenses', 'can_access_crm', 'can_access_users'
    ];

    const filteredUpdateData = {};
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        filteredUpdateData[field] = updateData[field];
      }
    });

    if (Object.keys(filteredUpdateData).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' });
    }

    // Construir query de atualização dinamicamente
    const fields = Object.keys(filteredUpdateData);
    const values = Object.values(filteredUpdateData);
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const updateQuery = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = ?`;
    
    await query(updateQuery, [...values, id]);

    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

// Desativar usuário (soft delete)
async function deleteUser(req, res, user) {
  try {
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    await query('UPDATE users SET status = \'inactive\', updated_at = NOW() WHERE id = $1', [id]);

    res.json({ message: 'Usuário removido com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ error: 'Erro ao deletar usuário' });
  }
}