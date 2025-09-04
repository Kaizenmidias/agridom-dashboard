const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Configuração do banco de dados para serverless
let pool;

function getPool() {
  if (!pool) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      const connectionString = process.env.POSTGRES_URL || 
        `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:5432/${process.env.POSTGRES_DATABASE || 'postgres'}`;
      
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
      if (process.env.POSTGRES_HOST && process.env.POSTGRES_HOST.includes('supabase.co')) {
        const connectionString = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:5432/${process.env.POSTGRES_DATABASE}?sslmode=require`;
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
          host: process.env.POSTGRES_HOST || 'localhost',
          port: 5432,
          database: process.env.POSTGRES_DATABASE || 'agridom_dev',
          user: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD || '',
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

module.exports = async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    
    // Buscar usuário atual
    const result = await query(
      `SELECT id, email, name as full_name, role,
              can_access_dashboard, can_access_projects, can_access_briefings, 
              can_access_codes, can_access_expenses, can_access_crm, can_access_users 
       FROM users WHERE id = $1`,
      [decoded.userId]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      can_access_dashboard: user.can_access_dashboard,
      can_access_projects: user.can_access_projects,
      can_access_briefings: user.can_access_briefings,
      can_access_codes: user.can_access_codes,
      can_access_expenses: user.can_access_expenses,
      can_access_crm: user.can_access_crm,
      can_access_users: user.can_access_users
    });
  } catch (error) {
    console.error('Erro na verificação do token:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
}