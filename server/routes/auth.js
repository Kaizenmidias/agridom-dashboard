const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../config/email');
const { getUserPermissions } = require('../utils/permissions');
const router = express.Router();

// Middleware para acessar a função query
const getQuery = (req) => req.app.locals.query;

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const query = getQuery(req);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário no banco de dados
    // Buscando usuário
    const result = await query(
      'SELECT id, email, password, name, role, avatar_url, is_active, can_access_dashboard, can_access_projects, can_access_briefings, can_access_codes, can_access_expenses, can_access_crm, can_access_users FROM users WHERE email = ? AND is_active = ?',
      [email, 1]
    );

    if (!result.rows || result.rows.length === 0) {
      // Usuário não encontrado
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];
    // Usuário encontrado

    // Verificar senha
    console.log('🔐 Verificando senha...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('🔐 Senha válida:', isValidPassword);
    
    if (!isValidPassword) {
      // Senha inválida
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token JWT
    const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
    // JWT Secret verificado
    
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Retornar dados do usuário (sem a senha)
    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar_url: user.avatar_url,
      is_active: user.is_active,
      permissions: {
        can_access_dashboard: user.can_access_dashboard,
        can_access_projects: user.can_access_projects,
        can_access_briefings: user.can_access_briefings,
        can_access_codes: user.can_access_codes,
        can_access_expenses: user.can_access_expenses,
        can_access_crm: user.can_access_crm,
        can_access_users: user.can_access_users
      }
    };

    res.json({ 
      message: 'Login realizado com sucesso',
      user: authUser, 
      token 
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    const query = getQuery(req);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Verificar se o email já existe
    const existingUserResult = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUserResult.rows && existingUserResult.rows.length > 0) {
      return res.status(409).json({ error: 'Este email já está em uso' });
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Inserir novo usuário
    await query(
      `INSERT INTO users (email, password, name, role, created_at, updated_at)
       VALUES ($1, $2, $3, 'user', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [email, passwordHash, full_name || null]
    );

    // Buscar o usuário inserido
    const result = await query(
      'SELECT id, email, name as full_name, role, created_at FROM users WHERE email = $1',
      [email]
    );

    const userData = result.rows[0];

    // Gerar token JWT
    const token = jwt.sign(
      { userId: userData.id, email: userData.email },
      process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Criar objeto do usuário autenticado
    const authUser = {
      id: userData.id,
      email: userData.email,
      full_name: userData.full_name,
      avatar_url: userData.avatar_url,
      is_active: userData.is_active
    };

    res.status(201).json({ user: authUser, token });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/auth/verify
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const query = getQuery(req);

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-secret-key';
    const decoded = jwt.verify(token, jwtSecret);
    
    // Buscar usuário atual
    const userResult = await query(
      `SELECT id, email, name as full_name, role FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];
    
    // Calcular permissões baseadas no cargo
    const permissions = getUserPermissions(user.role);
    
    // Verificar se é administrador
    const isAdmin = user.role && (
      user.role.toLowerCase() === 'administrador' ||
      user.role.toLowerCase() === 'admin' ||
      user.role.toLowerCase() === 'administrator'
    );
    
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      is_admin: isAdmin,
      can_access_dashboard: permissions.can_access_dashboard || false,
      can_access_projects: permissions.can_access_projects || false,
      can_access_briefings: permissions.can_access_briefings || false,
      can_access_codes: permissions.can_access_codes || false,
      can_access_expenses: permissions.can_access_expenses || false,
      can_access_crm: permissions.can_access_crm || false,
      can_access_users: permissions.can_access_users || false,
      can_access_reports: permissions.can_access_reports || false,
      can_access_settings: permissions.can_access_settings || false,
      can_manage_users: permissions.can_manage_users || false,
      can_manage_projects: permissions.can_manage_projects || false,
      can_manage_briefings: permissions.can_manage_briefings || false,
      can_manage_reports: permissions.can_manage_reports || false,
      can_manage_settings: permissions.can_manage_settings || false
    });
  } catch (error) {
    console.error('Erro na verificação do token:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
});

// PUT /api/auth/profile
router.put('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { full_name, position, bio, avatar_url } = req.body;
    const query = getQuery(req);

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    const userId = decoded.userId;

    // Tratar valores undefined como null
    const params = [
      full_name !== undefined ? full_name : null,
      position !== undefined ? position : null,
      bio !== undefined ? bio : null,
      avatar_url !== undefined ? avatar_url : null,
      userId
    ];
    
    // Atualizar dados no banco
    await query(
      `UPDATE users 
       SET name = COALESCE($1, name),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [full_name, userId]
    );

    // Buscar o usuário atualizado
    const result = await query(
      `SELECT id, email, name as full_name, role,
              can_access_dashboard, can_access_projects, can_access_briefings, 
              can_access_codes, can_access_expenses, can_access_crm, can_access_users 
       FROM users WHERE id = $1`,
      [userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const updatedUser = result.rows[0];
    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      full_name: updatedUser.full_name,
      role: updatedUser.role,
      can_access_dashboard: updatedUser.can_access_dashboard,
      can_access_projects: updatedUser.can_access_projects,
      can_access_briefings: updatedUser.can_access_briefings,
      can_access_codes: updatedUser.can_access_codes,
      can_access_expenses: updatedUser.can_access_expenses,
      can_access_crm: updatedUser.can_access_crm,
      can_access_users: updatedUser.can_access_users
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { currentPassword, newPassword } = req.body;
    const query = getQuery(req);

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    const userId = decoded.userId;

    // Buscar o usuário atual
    const userResult = await query(
      'SELECT password FROM users WHERE id = $1',
      [userId]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    // Verificar senha atual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: 'Senha atual incorreta' });
    }

    // Hash da nova senha
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar senha no banco
    await query(
      'UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, userId]
    );

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const query = getQuery(req);

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Verificar se o usuário existe
    const userResult = await query(
      'SELECT id, email, full_name FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    // Sempre retornar sucesso por segurança (não revelar se email existe)
    if (!userResult.rows || userResult.rows.length === 0) {
      return res.json({ message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' });
    }

    const user = userResult.rows[0];

    // Gerar token de recuperação
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora

    // Salvar token no banco de dados
    await query(
      'UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3',
      [resetToken, resetTokenExpiry, user.id]
    );

    // Enviar email
    const emailResult = await sendPasswordResetEmail(email, resetToken);
    
    if (!emailResult.success) {
      console.error('Falha ao enviar email:', emailResult.error);
      return res.status(500).json({ error: 'Erro ao enviar email de recuperação' });
    }

    res.json({ message: 'Se o email estiver cadastrado, você receberá um link de recuperação.' });
  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const query = getQuery(req);

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
    }

    // Buscar usuário pelo token
    const userResult = await query(
      'SELECT id, email, reset_token_expiry FROM users WHERE reset_token = $1 AND is_active = true',
      [token]
    );

    if (!userResult.rows || userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    const user = userResult.rows[0];

    // Verificar se o token não expirou
    if (new Date() > new Date(user.reset_token_expiry)) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    // Hash da nova senha
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar senha e limpar token
    await query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expiry = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, user.id]
    );

    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;