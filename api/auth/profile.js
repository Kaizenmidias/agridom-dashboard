const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Configuração do banco de dados para serverless
let pool;

function getPool() {
  if (!pool) {
    // Configurar string de conexão com prioridade para dashboard_POSTGRES_URL
    let connectionString;
    if (process.env.dashboard_POSTGRES_URL) {
      connectionString = process.env.dashboard_POSTGRES_URL;
    } else if (process.env.SUPABASE_DATABASE_URL) {
      connectionString = process.env.SUPABASE_DATABASE_URL;
    } else {
      // Fallback para variáveis individuais do Supabase
      const host = process.env.dashboard_POSTGRES_HOST || 'localhost';
      const port = process.env.dashboard_POSTGRES_PORT || 5432;
      const database = process.env.dashboard_POSTGRES_DATABASE || 'postgres';
      const user = process.env.dashboard_POSTGRES_USER || 'postgres';
      const password = process.env.dashboard_POSTGRES_PASSWORD || '';
      connectionString = `postgres://${user}:${password}@${host}:${port}/${database}`;
    }

    // Desabilitar SSL completamente para resolver certificados autoassinados
    if (!connectionString.includes('sslmode')) {
      const separator = connectionString.includes('?') ? '&' : '?';
      connectionString += `${separator}sslmode=disable`;
    }

    pool = new Pool({
      connectionString,
      ssl: false,
      max: 1,
      min: 0,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 5000,
      acquireTimeoutMillis: 5000,
    });
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
    const { full_name, position, bio, avatar_url } = req.body;

    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const decoded = jwt.verify(token, process.env.dashboard_SUPABASE_JWT_SECRET);
    const userId = decoded.userId;

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
}