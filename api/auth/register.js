const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

// Configuração CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

module.exports = async (req, res) => {
  // Configurar CORS
  Object.keys(corsHeaders).forEach(key => {
    res.setHeader(key, corsHeaders[key]);
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
    const existingUser = await query('SELECT id FROM users WHERE email = ?', [email]);
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Usuário já existe com este email' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 12);

    // Criar novo usuário no MySQL
    const insertResult = await query(
      `INSERT INTO users (email, password, full_name, role, status, created_at, updated_at, 
       can_create_users, can_edit_users, can_delete_users, can_view_reports) 
       VALUES (?, ?, ?, ?, 'active', NOW(), NOW(), ?, ?, ?, ?)`,
      [
        email,
        hashedPassword,
        full_name,
        role,
        role === 'admin' ? 1 : 0,
        role === 'admin' ? 1 : 0,
        role === 'admin' ? 1 : 0,
        role === 'admin' ? 1 : 0
      ]
    );

    const userId = insertResult.rows.insertId;

    // Gerar token JWT
    const token = jwt.sign(
      { 
        userId, 
        email, 
        role,
        permissions: {
          can_create_users: role === 'admin',
          can_edit_users: role === 'admin',
          can_delete_users: role === 'admin',
          can_view_reports: role === 'admin'
        }
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      token,
      user: {
        id: userId,
        email,
        full_name,
        role,
        permissions: {
          can_create_users: role === 'admin',
          can_edit_users: role === 'admin',
          can_delete_users: role === 'admin',
          can_view_reports: role === 'admin'
        }
      }
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};