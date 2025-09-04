const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Configuração do banco de dados para serverless
let pool;

function getPool() {
  if (!pool) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      const connectionString = process.env.dashboard_POSTGRES_URL || 
        `postgresql://${process.env.dashboard_POSTGRES_USER || 'postgres'}:${process.env.dashboard_POSTGRES_PASSWORD}@${process.env.dashboard_POSTGRES_HOST}:5432/${process.env.dashboard_POSTGRES_DATABASE || 'postgres'}`;
      
      pool = new Pool({
        connectionString,
        ssl: {
          rejectUnauthorized: false
        },
        max: 1,
        min: 0,
        idleTimeoutMillis: 1000,
        connectionTimeoutMillis: 5000,
        acquireTimeoutMillis: 5000,
      });
    } else {
      if (process.env.dashboard_POSTGRES_HOST && process.env.dashboard_POSTGRES_HOST.includes('supabase.co')) {
        const connectionString = `postgresql://${process.env.dashboard_POSTGRES_USER}:${process.env.dashboard_POSTGRES_PASSWORD}@${process.env.dashboard_POSTGRES_HOST}:5432/${process.env.dashboard_POSTGRES_DATABASE}?sslmode=require`;
        pool = new Pool({
          connectionString,
          ssl: {
            rejectUnauthorized: false
          },
          max: 1,
          idleTimeoutMillis: 1000,
          connectionTimeoutMillis: 5000,
        });
      } else {
        pool = new Pool({
          host: process.env.dashboard_POSTGRES_HOST || 'localhost',
          port: 5432,
          database: process.env.dashboard_POSTGRES_DATABASE || 'agridom_dev',
          user: process.env.dashboard_POSTGRES_USER || 'postgres',
          password: process.env.dashboard_POSTGRES_PASSWORD || '',
          max: 1,
          idleTimeoutMillis: 1000,
          connectionTimeoutMillis: 5000,
        });
      }
    }
  }
  return pool;
}

// Função para executar queries
async function query(text, params) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { email, password, full_name } = req.body;

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
      process.env.dashboard_SUPABASE_JWT_SECRET,
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
}