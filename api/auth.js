import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../utils/db.js';

// Verificar se estamos em ambiente serverless
if (typeof process !== 'undefined' && process.env.VERCEL) {
  console.log('Executando em ambiente Vercel serverless');
}

// Configuração CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

// Middleware de autenticação
function authenticateToken(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Token não fornecido');
  }

  try {
    const decoded = jwt.verify(token, process.env.dashboard_SUPABASE_JWT_SECRET);
    return decoded.userId;
  } catch (error) {
    throw new Error('Token inválido');
  }
}

// Função de login
async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário no PostgreSQL
    const userResult = await query(
      'SELECT * FROM users WHERE email = $1 AND status = $2',
      [email, 'active']
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.dashboard_SUPABASE_JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Atualizar último login
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Função de registro
async function handleRegister(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email, password, full_name, role = 'user' } = req.body;

    // Validações
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, senha e nome completo são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    // Verificar se o usuário já existe
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Usuário já existe com este email' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar novo usuário no PostgreSQL/Supabase
    const result = await query(
      'INSERT INTO users (email, password, full_name, role, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
      [email, hashedPassword, full_name, role, 'active']
    );

    const userId = result.insertId;

    // Gerar token JWT
    const token = jwt.sign(
      { userId, email },
      process.env.dashboard_SUPABASE_JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: userId,
        email,
        full_name,
        role
      }
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Função de perfil
async function handleProfile(req, res) {
  try {
    const userId = authenticateToken(req);

    if (req.method === 'GET') {
      // GET - Buscar perfil do usuário
      const result = await query(
        'SELECT id, email, full_name, avatar_url, is_active, created_at FROM users WHERE id = $1',
        [userId]
      );

      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      const user = result.rows[0];
      res.json({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        created_at: user.created_at
      });
    } else if (req.method === 'PUT') {
      // PUT - Atualizar perfil do usuário
      const { full_name, avatar_url } = req.body;

      if (!full_name) {
        return res.status(400).json({ error: 'Nome completo é obrigatório' });
      }

      await query(
        'UPDATE users SET full_name = $1, avatar_url = $2, updated_at = NOW() WHERE id = $3',
        [full_name, avatar_url || null, userId]
      );

      // Buscar usuário atualizado
      const result = await query(
        'SELECT id, email, full_name, avatar_url, is_active, created_at FROM users WHERE id = $1',
        [userId]
      );

      const user = result.rows[0];
      res.json({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        is_active: user.is_active,
        created_at: user.created_at
      });
    } else {
      return res.status(405).json({ error: 'Método não permitido' });
    }
  } catch (error) {
    console.error('Erro no perfil:', error);
    if (error.message === 'Token não fornecido' || error.message === 'Token inválido') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Função de mudança de senha
async function handleChangePassword(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const userId = authenticateToken(req);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
    }

    // Buscar usuário atual
    const userResult = await query(
      'SELECT * FROM users WHERE id = $1 AND is_active = $2',
      [userId, true]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = userResult.rows[0];

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Senha atual incorreta' });
    }

    // Hash da nova senha
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Atualizar senha no banco
    await query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashedNewPassword, userId]
    );

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    if (error.message === 'Token não fornecido' || error.message === 'Token inválido') {
      return res.status(401).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Função de esqueci minha senha
async function handleForgotPassword(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email é obrigatório' });
    }

    // Verificar se o usuário existe
    const userResult = await query(
      'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (userResult.rows.length === 0) {
      // Por segurança, sempre retornar sucesso mesmo se o email não existir
      return res.json({ 
        message: 'Se o email existir em nossa base de dados, você receberá instruções para redefinir sua senha.' 
      });
    }

    const user = userResult.rows[0];

    // Gerar token de reset
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hora

    // Salvar token no banco
    await query(
      'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpiry, user.id]
    );

    res.json({ 
      message: 'Se o email existir em nossa base de dados, você receberá instruções para redefinir sua senha.',
      token: resetToken // Em produção, isso seria enviado por email
    });
  } catch (error) {
    console.error('Erro ao solicitar reset de senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Função de reset de senha
async function handleResetPassword(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres' });
    }

    // Verificar se o token é válido
    const userResult = await query(
      'SELECT * FROM users WHERE reset_password_token = $1 AND is_active = $2',
      [token, true]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Token inválido ou expirado' });
    }

    const user = userResult.rows[0];

    // Verificar se o token não expirou
    const now = new Date();
    const expiresAt = new Date(user.reset_password_expires);
    
    if (expiresAt < now) {
      return res.status(400).json({ error: 'Token expirado' });
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Atualizar senha e limpar token
    await query(
      'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL, updated_at = NOW() WHERE id = $2',
      [hashedPassword, user.id]
    );

    res.json({ message: 'Senha redefinida com sucesso' });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Função principal que roteia as requisições
export default async function handler(req, res) {
  try {
    console.log('Iniciando handler auth.js:', {
      method: req.method,
      url: req.url,
      headers: Object.keys(req.headers)
    });

    // Configurar CORS
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      console.log('Respondendo a requisição OPTIONS');
      return res.status(200).end();
    }

    // Extrair o path da URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    console.log('Path extraído:', path);

    // Roteamento baseado no path
    if (path.includes('/login')) {
      console.log('Roteando para handleLogin');
      return await handleLogin(req, res);
    } else if (path.includes('/register')) {
      console.log('Roteando para handleRegister');
      return await handleRegister(req, res);
    } else if (path.includes('/profile')) {
      console.log('Roteando para handleProfile');
      return await handleProfile(req, res);
    } else if (path.includes('/change-password')) {
      console.log('Roteando para handleChangePassword');
      return await handleChangePassword(req, res);
    } else if (path.includes('/forgot-password')) {
      console.log('Roteando para handleForgotPassword');
      return await handleForgotPassword(req, res);
    } else if (path.includes('/reset-password')) {
      console.log('Roteando para handleResetPassword');
      return await handleResetPassword(req, res);
    } else {
      console.log('Endpoint não encontrado:', path);
      return res.status(404).json({ error: 'Endpoint não encontrado' });
    }
  } catch (error) {
    console.error('Erro crítico na API de autenticação:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    });
    
    // Garantir que a resposta seja enviada
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Erro interno do servidor',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};