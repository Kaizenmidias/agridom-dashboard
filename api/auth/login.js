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
        max: 1, // Reduzido para serverless
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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Mock temporário para teste (enquanto resolve conectividade Supabase)
    console.log('🔍 Testando login com mock:', email);
    if (email === 'admin@agridom.com' && password === 'admin123') {
      const mockUser = {
        id: 1,
        email: 'admin@agridom.com',
        full_name: 'Administrador',
        role: 'admin',
        can_access_dashboard: true,
        can_access_projects: true,
        can_access_briefings: true,
        can_access_codes: true,
        can_access_expenses: true,
        can_access_crm: true,
        can_access_users: true
      };
      
      console.log('👤 Usuário mock encontrado:', { id: mockUser.id, email: mockUser.email, full_name: mockUser.full_name });
      
      // Gerar token JWT
      const jwtSecret = process.env.dashboard_SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
      console.log('🔑 JWT Secret:', jwtSecret ? 'Definido' : 'Não definido');
      
      const token = jwt.sign(
        { 
          userId: mockUser.id, 
          email: mockUser.email,
          role: mockUser.role
        },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      return res.json({
        message: 'Login realizado com sucesso',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.full_name,
          role: mockUser.role,
          permissions: {
            can_access_dashboard: mockUser.can_access_dashboard,
            can_access_projects: mockUser.can_access_projects,
            can_access_briefings: mockUser.can_access_briefings,
            can_access_codes: mockUser.can_access_codes,
            can_access_expenses: mockUser.can_access_expenses,
            can_access_crm: mockUser.can_access_crm,
            can_access_users: mockUser.can_access_users
          }
        },
        token
      });
    } else {
      console.log('❌ Credenciais inválidas para mock');
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Código para banco real (comentado até resolver conectividade)
    /*
    // Buscar usuário no banco
    const result = await query(
      'SELECT id, email, password, name as full_name, role, can_access_dashboard, can_access_projects, can_access_briefings, can_access_codes, can_access_expenses, can_access_crm, can_access_users FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (!result.rows || result.rows.length === 0) {
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
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.dashboard_SUPABASE_JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Retornar dados do usuário (sem a senha)
    const authUser = {
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
    };

    res.json({ user: authUser, token });
    */
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}