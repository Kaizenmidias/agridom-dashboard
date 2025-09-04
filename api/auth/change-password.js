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

module.exports = async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const { currentPassword, newPassword } = req.body;

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias' });
    }

    const decoded = jwt.verify(token, process.env.dashboard_SUPABASE_JWT_SECRET);
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
}