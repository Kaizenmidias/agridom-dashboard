const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../utils/db.js');

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    return decoded;
  } catch (error) {
    throw new Error('Token inválido');
  }
}

// Handler principal que roteia todas as requisições
module.exports = async function handler(req, res) {
  try {
    console.log('API Handler:', {
      method: req.method,
      url: req.url,
      query: req.query
    });

    // Configurar CORS
    Object.keys(corsHeaders).forEach(key => {
      res.setHeader(key, corsHeaders[key]);
    });

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const { route } = req.query;
    const path = Array.isArray(route) ? route.join('/') : route || '';

    console.log('Rota processada:', path);

    // Roteamento baseado no path
    switch (path) {
      case 'login':
        return await handleLogin(req, res);
      
      case 'profile':
        return await handleProfile(req, res);
      
      case 'forgot-password':
        return await handleForgotPassword(req, res);
      
      case 'reset-password':
        return await handleResetPassword(req, res);
      
      case 'register':
        return await handleRegister(req, res);
      
      case 'verify':
        return await handleVerify(req, res);
      
      case 'change-password':
        return await handleChangePassword(req, res);
      
      case 'dashboard':
        return await handleDashboard(req, res);
      
      case 'users':
        return await handleUsers(req, res);
      
      case 'projects':
        return await handleProjects(req, res);
      
      case 'parcels':
        return await handleParcels(req, res);
      
      case 'crops':
        return await handleCrops(req, res);
      
      case 'expenses':
        return await handleExpenses(req, res);
      
      case 'codes':
        return await handleCodes(req, res);
      
      default:
        return res.status(404).json({ error: 'Rota não encontrada', path });
    }

  } catch (error) {
    console.error('Erro no handler principal:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method
    });
    
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Handler para login
async function handleLogin(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  const userResult = await query(
    'SELECT id, email, password, name, role, status FROM users WHERE email = $1',
    [email]
  );

  if (userResult.rows.length === 0) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  const user = userResult.rows[0];

  if (user.status !== 'active') {
    return res.status(401).json({ error: 'Conta inativa' });
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  // Atualizar last_login
  await query(
    'UPDATE users SET last_login = NOW() WHERE id = $1',
    [user.id]
  );

  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    }
  });
}

// Handler para profile
async function handleProfile(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const decoded = authenticateToken(req);
  
  const userResult = await query(
    'SELECT id, email, name, role, created_at, last_login FROM users WHERE id = $1 AND status = $2',
    [decoded.userId, 'active']
  );

  if (userResult.rows.length === 0) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  res.json({ user: userResult.rows[0] });
}

// Handler para forgot-password
async function handleForgotPassword(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email é obrigatório' });
  }

  const userResult = await query(
    'SELECT id, email FROM users WHERE email = $1 AND status = $2',
    [email, 'active']
  );

  if (userResult.rows.length === 0) {
    return res.json({ message: 'Se o email existir, você receberá instruções para redefinir sua senha.' });
  }

  const user = userResult.rows[0];
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetExpires = new Date(Date.now() + 3600000); // 1 hora

  await query(
    'UPDATE users SET reset_password_token = $1, reset_password_expires = $2 WHERE id = $3',
    [resetToken, resetExpires, user.id]
  );

  res.json({ 
    message: 'Se o email existir, você receberá instruções para redefinir sua senha.',
    ...(process.env.NODE_ENV === 'development' && { resetToken })
  });
}

// Handler para reset-password
async function handleResetPassword(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token e nova senha são obrigatórios' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
  }

  const userResult = await query(
    'SELECT id, reset_password_expires FROM users WHERE reset_password_token = $1 AND status = $2',
    [token, 'active']
  );

  if (userResult.rows.length === 0) {
    return res.status(400).json({ error: 'Token inválido' });
  }

  const user = userResult.rows[0];
  const now = new Date();
  const expiresAt = new Date(user.reset_password_expires);
  
  if (expiresAt < now) {
    return res.status(400).json({ error: 'Token expirado' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await query(
    'UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expires = NULL, updated_at = NOW() WHERE id = $2',
    [hashedPassword, user.id]
  );

  res.json({ message: 'Senha redefinida com sucesso' });
}

// Handlers básicos para outras rotas
async function handleRegister(req, res) {
  res.status(501).json({ error: 'Registro não implementado ainda' });
}

async function handleVerify(req, res) {
  res.status(501).json({ error: 'Verificação não implementada ainda' });
}

async function handleChangePassword(req, res) {
  res.status(501).json({ error: 'Mudança de senha não implementada ainda' });
}

async function handleDashboard(req, res) {
  res.status(501).json({ error: 'Dashboard não implementado ainda' });
}

async function handleUsers(req, res) {
  res.status(501).json({ error: 'Usuários não implementado ainda' });
}

async function handleProjects(req, res) {
  res.status(501).json({ error: 'Projetos não implementado ainda' });
}

async function handleParcels(req, res) {
  res.status(501).json({ error: 'Parcelas não implementado ainda' });
}

async function handleCrops(req, res) {
  res.status(501).json({ error: 'Cultivos não implementado ainda' });
}

async function handleExpenses(req, res) {
  res.status(501).json({ error: 'Despesas não implementado ainda' });
}

async function handleCodes(req, res) {
  res.status(501).json({ error: 'Códigos não implementado ainda' });
}