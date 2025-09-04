const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Configuração do banco de dados para serverless
let pool;

function getPool() {
  if (!pool) {
    console.log('🔧 Configurando pool de conexão...');
    
    // Usar variáveis do Supabase
    const connectionString = process.env.SUPABASE_DATABASE_URL || 
      `postgresql://${process.env.SUPABASE_DB_USER}:${process.env.SUPABASE_DB_PASSWORD}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT}/${process.env.SUPABASE_DB_NAME}`;
    
    console.log('🔗 Connection string configurada:', connectionString ? 'Sim' : 'Não');
    
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 1, // Reduzido para serverless
      min: 0,
      idleTimeoutMillis: 1000,
      connectionTimeoutMillis: 10000,
      acquireTimeoutMillis: 10000,
    });
    
    console.log('✅ Pool de conexão criado');
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Conectar ao banco Supabase real
    console.log('🔍 Fazendo login com banco real:', email);
    
    // Buscar usuário no banco
    const result = await query(
      'SELECT id, email, password, name as full_name, role, can_access_dashboard, can_access_projects, can_access_briefings, can_access_codes, can_access_expenses, can_access_crm, can_access_users FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (!result.rows || result.rows.length === 0) {
      console.log('❌ Usuário não encontrado:', email);
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];
    console.log('👤 Usuário encontrado:', user.email, 'Hash:', user.password.substring(0, 20) + '...');

    // Verificar senha
    console.log('🔐 Verificando senha...');
    const isValidPassword = await bcrypt.compare(password, user.password);
    console.log('🔐 Senha válida:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Senha inválida');
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Gerar token JWT
    const jwtSecret = process.env.dashboard_SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
    console.log('🔑 JWT Secret:', jwtSecret ? 'Definido' : 'Não definido');
    
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role
      },
      jwtSecret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Retornar dados do usuário (sem a senha)
    const authUser = {
      id: user.id,
      email: user.email,
      name: user.full_name,
      role: user.role,
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
}