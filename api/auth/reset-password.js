const bcrypt = require('bcryptjs');
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
      const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || 5432;
  const database = process.env.POSTGRES_DATABASE || 'postgres';
  const user = process.env.POSTGRES_USER || 'postgres';
  const password = process.env.POSTGRES_PASSWORD || '';
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { token, newPassword } = req.body;

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
}